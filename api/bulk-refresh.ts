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
// Bright Data Scraper API — Dataset ID for Google SERP
// ---------------------------------------------------------------------------
const BD_DATASET_ID = 'gd_mfz5x93lmsjjjylob';
const BD_BASE_URL   = 'https://api.brightdata.com/datasets/v3';

// Polling config — bulk-refresh runs in Node (no Vercel timeout per keyword)
const POLL_INTERVAL_MS = 5_000;  // 5 seconds between each progress check
const POLL_TIMEOUT_MS  = 45_000; // bail after 45 seconds per keyword

// ---------------------------------------------------------------------------
// Fetch a single keyword rank via Bright Data Scraper API (async 3-step flow)
// ---------------------------------------------------------------------------
async function fetchRank(
  keyword: string,
  domain: string,
  rankType: string,
  brandName?: string | null
): Promise<number | null> {
  // Strict geo-parameters — matches fetch-rank.ts logic
  const countryCode = rankType.toLowerCase() === 'dubai' ? 'ae' : 'qa';

  const apiKey = process.env.BRIGHTDATA_API_KEY ?? '';
  const authHeader = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  // -------------------------------------------------------------------------
  // Step 1 — Trigger: POST to Scraper API, receive snapshot_id
  // -------------------------------------------------------------------------
  const triggerPayload = [{
    url:          'https://www.google.com/',
    keyword:      keyword,          // passed verbatim — Bright Data handles encoding
    language:     'en',
    start_page:   1,
    end_page:     10,               // pages 1–10 → up to 100 organic results
    collapse_aio: true,             // strip AI Overviews so ranks aren't suppressed
    country:      countryCode,      // 'qa' for Qatar, 'ae' for Dubai
  }];

  const triggerRes = await fetch(
    `${BD_BASE_URL}/trigger?dataset_id=${BD_DATASET_ID}&include_errors=true`,
    { method: 'POST', headers: authHeader, body: JSON.stringify(triggerPayload) }
  );

  if (!triggerRes.ok) {
    throw new Error(`Bright Data trigger error: ${triggerRes.status}`);
  }

  const triggerData = await triggerRes.json();
  const snapshotId: string = triggerData.snapshot_id;

  if (!snapshotId) {
    throw new Error(`Bright Data did not return a snapshot_id for keyword "${keyword}"`);
  }

  // -------------------------------------------------------------------------
  // Step 2 — Poll: GET /progress/{snapshot_id} every 5 s, timeout at 45 s
  // -------------------------------------------------------------------------
  const pollStart = Date.now();

  while (true) {
    if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
      throw new Error(`Bright Data scrape timed out after ${POLL_TIMEOUT_MS / 1000}s for keyword "${keyword}"`);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const progressRes = await fetch(
      `${BD_BASE_URL}/progress/${snapshotId}`,
      { method: 'GET', headers: authHeader }
    );

    if (!progressRes.ok) {
      throw new Error(`Bright Data progress error: ${progressRes.status}`);
    }

    const progress = await progressRes.json();
    const status: string = (progress.status ?? '').toLowerCase();

    if (status === 'failed' || status === 'error') {
      throw new Error(`Bright Data scrape failed for keyword "${keyword}": ${JSON.stringify(progress)}`);
    }

    // 'ready' or 'success' means the snapshot is available
    if (status === 'ready' || status === 'success') break;

    // Any other status ('running', 'pending', etc.) — keep polling
  }

  // -------------------------------------------------------------------------
  // Step 3 — Fetch snapshot & parse results
  // -------------------------------------------------------------------------
  const snapshotRes = await fetch(
    `${BD_BASE_URL}/snapshot/${snapshotId}?format=json`,
    { method: 'GET', headers: authHeader }
  );

  if (!snapshotRes.ok) {
    throw new Error(`Bright Data snapshot error: ${snapshotRes.status}`);
  }

  const data = await snapshotRes.json();
  const cleanTargetDomain = normalizeTargetDomain(domain);

  // Core name for title fallback (e.g. 'bodyglaze' from 'bodyglaze.com')
  const coreName = cleanTargetDomain.split('.')[0];
  // Prefer explicit brandName from DB; fall back to coreName derived from domain
  const titleFallback = brandName?.toLowerCase() || coreName;

  // A. Organic results — iterate data.organic; use native `rank` field for true position.
  //    Scraper API returns pages 1–10 concatenated, so `rank` is already the absolute rank.
  //    Guard: skip any item where `link` is missing/undefined to avoid false negatives.
  const organicMatch = data.organic?.find((r: any) => {
    if (!r.link) return false; // safely skip items with no link field
    return normalizeTargetDomain(r.link).includes(cleanTargetDomain);
  });
  if (organicMatch) {
    return (organicMatch.rank as number);
  }

  // B. Map Pack (local_results) — catches Local Business Box positions.
  //    Universal fallback: match by website URL first, then title/brand name.
  //    Some businesses have no website button, so we fall back to title matching.
  const localMatch = data.local_results?.find((r: any) =>
    r.website?.toLowerCase().includes(cleanTargetDomain) ||
    r.link?.toLowerCase().includes(cleanTargetDomain) ||
    r.title?.toLowerCase().includes(titleFallback)
  );
  if (localMatch) return localMatch.position as number;

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

  // Fire all keyword fetches concurrently — no browser 6-connection cap in Node
  const results = await Promise.allSettled(
    keywords.map(async (keyword) => {
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
