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
// Domain normalisation — mirrors src/lib/valueserp.ts
// ---------------------------------------------------------------------------
function normalizeDomain(url: string): string {
  return url
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
    .replace(/\/$/, '');
}

// ---------------------------------------------------------------------------
// Fetch a single keyword rank from ValueSERP
// ---------------------------------------------------------------------------
async function fetchRank(
  keyword: string,
  domain: string,
  rankType: string
): Promise<number | null> {
  // Strict geo-parameters — matches fetch-rank.ts logic
  let locationParams: Record<string, string>;
  if (rankType.toLowerCase() === 'dubai') {
    locationParams = {
      location: 'Dubai,United Arab Emirates',
      google_domain: 'google.ae',
      gl: 'ae',
      hl: 'en'
    };
  } else {
    locationParams = {
      location: 'Qatar',
      google_domain: 'google.com.qa',
      gl: 'qa',
      hl: 'en'
    };
  }

  const params = new URLSearchParams({
    api_key: process.env.VALUESERP_API_KEY ?? '',
    q: keyword,
    output: 'json',
    page: '1',
    num: '100',
    ...locationParams
  });

  const response = await fetch(`https://api.valueserp.com/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`ValueSERP error: ${response.status}`);
  }

  const data = await response.json();
  const cleanDomain = normalizeDomain(domain);

  // A. Map Pack (local_results) — catches top-3 Local Business Box
  if (data.local_results) {
    for (const item of data.local_results) {
      const itemUrl: string = item.website || item.link || '';
      if (normalizeDomain(itemUrl).includes(cleanDomain)) {
        return item.position as number;
      }
    }
  }

  // B. Organic results
  if (data.organic_results) {
    for (const item of data.organic_results) {
      if (normalizeDomain(item.link as string).includes(cleanDomain)) {
        return item.position as number;
      }
    }
  }

  return null; // Not ranked in top 100
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

  const { keywords, domain, rankType, applyMonthGuard } = req.body as BulkRefreshBody;

  if (!keywords?.length || !domain || !rankType) {
    return res.status(400).json({ error: 'Missing required fields: keywords, domain, rankType' });
  }

  const today = new Date();
  let successCount = 0;
  let errorCount = 0;

  // Fire all keyword fetches concurrently — no browser 6-connection cap in Node
  const results = await Promise.allSettled(
    keywords.map(async (keyword) => {
      const newRank = await fetchRank(keyword.text, domain, rankType);

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
        current_month_date: today.toISOString().split('T')[0],
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

      return keyword.id;
    })
  );

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      successCount++;
    } else {
      errorCount++;
      console.error(`Failed for keyword "${keywords[i].text}":`, result.reason);
    }
  });

  return res.status(200).json({
    success: true,
    successCount,
    errorCount,
    total: keywords.length
  });
}
