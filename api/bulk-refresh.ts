import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase — initialised server-side with env vars (no VITE_ prefix)
// ---------------------------------------------------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
);

// ---------------------------------------------------------------------------
// Domain normalisation — strips protocol, www, and trailing slashes
// ---------------------------------------------------------------------------
function normalizeTargetDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .trim()
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// Fetch a single keyword rank from ValueSERP — pages 1-3, early exit on match.
// Google deprecated num=100 in Sept 2025, so we paginate manually.
// Early exit saves credits (page-1 hit = 1 credit instead of 3).
// ---------------------------------------------------------------------------
async function fetchRank(
  keyword: string,
  domain: string,
  rankType: string,
  brandName?: string | null
): Promise<number | null> {
  // Strict geo-parameters — matches fetch-rank.ts logic
  let locationParams: Record<string, string>;
  if (rankType.toLowerCase() === 'dubai') {
    locationParams = {
      location: 'Dubai, Dubai, United Arab Emirates',
      google_domain: 'google.ae',
      gl: 'ae',
      hl: 'en'
    };
  } else {
    // Default to Qatar — city-level targeting matches local Doha browser results
    locationParams = {
      location: 'Doha, Doha, Qatar',
      google_domain: 'google.com.qa',
      gl: 'qa',
      hl: 'en'
    };
  }

  const cleanTargetDomain = normalizeTargetDomain(domain);
  const coreName = cleanTargetDomain.split('.')[0];
  const titleFallback = brandName?.toLowerCase() || coreName;

  for (let page = 1; page <= 3; page++) {
    const params = new URLSearchParams({
      api_key: process.env.VALUESERP_API_KEY ?? '',
      q: keyword,
      output: 'json',
      page: String(page),
      ...locationParams
    });

    const response = await fetch(`https://api.valueserp.com/search?${params.toString()}`);
    if (!response.ok) throw new Error(`ValueSERP error: ${response.status}`);

    const data = await response.json();

    // A. Map Pack (local_results) — only present on page 1.
    if (page === 1) {
      const localMatch = data.local_results?.find((r: any) =>
        r.website?.toLowerCase().includes(cleanTargetDomain) ||
        r.link?.toLowerCase().includes(cleanTargetDomain) ||
        r.title?.toLowerCase().includes(titleFallback)
      );
      if (localMatch) return localMatch.position as number;
    }

    // B. Organic results — position_overall gives the true global rank; fall back to
    //    calculating it from the page number if ValueSERP omits it on single-page requests.
    const organicMatch = data.organic_results?.find((r: any) =>
      r.link?.toLowerCase().includes(cleanTargetDomain)
    );
    if (organicMatch) {
      return (organicMatch.position_overall ?? (organicMatch.position + (page - 1) * 10)) as number;
    }
  }

  return null; // Not ranked in top 30
}

// ---------------------------------------------------------------------------
// Request / Response shape
// ---------------------------------------------------------------------------
interface KeywordPayload {
  id: string;
  text: string;
  last_checked: string | null;
  current_month_rank: number | null;
  previous_month_rank: number | null;
  previous_month_date: string | null;
}

interface BulkRefreshBody {
  keywords: KeywordPayload[];
  domain: string;
  rankType: string;
  brandName?: string | null;
  /** If true, apply the isNewMonth guard and shift previous data. Used by Monthly Refresh. */
  applyMonthGuard: boolean;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { keywords, domain, rankType, brandName, applyMonthGuard } = req.body as BulkRefreshBody;

  if (!keywords?.length || !domain || !rankType) {
    return res.status(400).json({ error: 'Missing required fields: keywords, domain, rankType' });
  }

  const today = new Date();
  let successCount = 0;
  let errorCount = 0;

  const BATCH_SIZE = 4;

  // Process keywords in batches of BATCH_SIZE concurrently, with a 1s gap between batches.
  // Each batch fires BATCH_SIZE requests in parallel; the inter-batch delay prevents 503 overload.
  for (let i = 0; i < keywords.length; i += BATCH_SIZE) {
    const batch = keywords.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (keyword) => {
      try {
        const newRank = await fetchRank(keyword.text, domain, rankType, brandName);

        // isNewMonth guard — only shift current → previous on a genuine new month
        let previousRank = keyword.previous_month_rank;
        let previousDate = keyword.previous_month_date;

        if (applyMonthGuard) {
          const lastChecked = keyword.last_checked ? new Date(keyword.last_checked) : null;
          const isNewMonth =
            !lastChecked ||
            lastChecked.getMonth() !== today.getMonth() ||
            lastChecked.getFullYear() !== today.getFullYear();

          if (isNewMonth) {
            previousRank = keyword.current_month_rank;
            previousDate = keyword.last_checked;
          }
        }

        const payload: Record<string, unknown> = {
          current_month_rank: newRank,
          current_month_date: today.toISOString(),
          last_checked: today.toISOString(),
          updated_at: today.toISOString(),
          previous_month_rank: previousRank,
          previous_month_date: previousDate
        };

        const { error } = await supabase
          .from('keywords')
          .update(payload)
          .eq('id', keyword.id);

        if (error) throw new Error(`Supabase update failed for "${keyword.text}": ${error.message}`);

        successCount++;
      } catch (err) {
        errorCount++;
        console.error(`Failed for keyword "${keyword.text}":`, err);
      }
    }));

    // 1s rest between batches — prevents 503 overload on the ValueSERP proxy
    if (i + BATCH_SIZE < keywords.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return res.status(200).json({
    success: true,
    successCount,
    errorCount,
    total: keywords.length
  });
}
