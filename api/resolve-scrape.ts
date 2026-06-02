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
// Bright Data Scraper API — Dataset ID for Google SERP
// ---------------------------------------------------------------------------
const BD_BASE_URL = 'https://api.brightdata.com/datasets/v3';

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
// Step 2 & 3 — Resolve endpoint: checks progress on an existing snapshot_id.
//
// Returns immediately in one of three shapes:
//   { status: 'pending' }                        — still running, poll again
//   { status: 'complete', newRank: number|null } — done; rank written to Supabase
//   { status: 'error', error: string }           — scrape or parse failure
//
// Designed to complete in << 2 seconds so it stays well within Vercel limits.
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    snapshot_id,
    keyword_id,
    domain,
    rankType,
    brandName,
  } = req.body as {
    snapshot_id: string;
    keyword_id:  string;
    domain:      string;
    rankType:    string;
    brandName?:  string | null;
  };

  if (!snapshot_id || !keyword_id || !domain || !rankType) {
    return res.status(400).json({ error: 'Missing required fields: snapshot_id, keyword_id, domain, rankType' });
  }

  const apiKey = process.env.BRIGHTDATA_API_KEY ?? '';
  const authHeader = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // -----------------------------------------------------------------------
    // Step 2 — Check progress: single non-blocking GET
    // -----------------------------------------------------------------------
    const progressRes = await fetch(
      `${BD_BASE_URL}/progress/${snapshot_id}`,
      { method: 'GET', headers: authHeader }
    );

    if (!progressRes.ok) {
      return res.status(progressRes.status).json({
        status: 'error',
        error: `Bright Data progress check failed: ${progressRes.status}`,
      });
    }

    const progress = await progressRes.json();
    const status: string = (progress.status ?? '').toLowerCase();

    // Failure states — surface the error to the frontend immediately
    if (status === 'failed' || status === 'error') {
      return res.status(200).json({
        status: 'error',
        error: `Bright Data scrape failed: ${JSON.stringify(progress)}`,
      });
    }

    // Still running — tell the frontend to poll again in 5 seconds
    if (status !== 'ready' && status !== 'success') {
      return res.status(200).json({ status: 'pending' });
    }

    // -----------------------------------------------------------------------
    // Step 3 — Snapshot is ready: fetch, parse, and write to Supabase
    // -----------------------------------------------------------------------
    const snapshotRes = await fetch(
      `${BD_BASE_URL}/snapshot/${snapshot_id}?format=json`,
      { method: 'GET', headers: authHeader }
    );

    if (!snapshotRes.ok) {
      return res.status(snapshotRes.status).json({
        status: 'error',
        error: `Bright Data snapshot fetch failed: ${snapshotRes.status}`,
      });
    }

    const data = await snapshotRes.json();
    const cleanTargetDomain = normalizeTargetDomain(domain);

    // Core name for title fallback (e.g. 'bodyglaze' from 'bodyglaze.com')
    const coreName = cleanTargetDomain.split('.')[0];
    // Prefer explicit brandName from DB; fall back to coreName derived from domain
    const titleFallback = brandName?.toLowerCase() || coreName;

    // A. Organic results — iterate data.organic; use native `rank` field for true position.
    //    Scraper API returns pages 1–10 concatenated, so `rank` is already the absolute rank.
    let newRank: number | null = null;
    const organicMatch = data.organic?.find((r: any) =>
      r.link?.toLowerCase().includes(cleanTargetDomain)
    );
    if (organicMatch) {
      newRank = organicMatch.rank as number;
    }

    // B. Map Pack (local_results) — catches Local Business Box positions.
    //    Universal fallback: match by website URL first, then title/brand name.
    //    Some businesses have no website button, so we fall back to title matching.
    if (newRank === null) {
      const localMatch = data.local_results?.find((r: any) =>
        r.website?.toLowerCase().includes(cleanTargetDomain) ||
        r.link?.toLowerCase().includes(cleanTargetDomain) ||
        r.title?.toLowerCase().includes(titleFallback)
      );
      if (localMatch) newRank = localMatch.position as number;
    }

    // Write the resolved rank to Supabase — server-side, key never touches the browser
    const now = new Date();
    const { error: dbError } = await supabase
      .from('keywords')
      .update({
        current_month_rank: newRank,
        current_month_date: now.toISOString().split('T')[0],
        last_checked:       now.toISOString(),
        updated_at:         now.toISOString(),
      })
      .eq('id', keyword_id);

    if (dbError) {
      return res.status(500).json({
        status: 'error',
        error: `Supabase update failed: ${dbError.message}`,
      });
    }

    return res.status(200).json({ status: 'complete', newRank });

  } catch (error) {
    console.error('resolve-scrape failed:', error);
    return res.status(500).json({ status: 'error', error: 'resolve-scrape internal error' });
  }
}
