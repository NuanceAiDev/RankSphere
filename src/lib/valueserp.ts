import { RankSettings, RankingData } from '../types';

// ---------------------------------------------------------------------------
// Browser-polling architecture constants
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 5_000;  // 5 seconds between each resolve-scrape call
const POLL_TIMEOUT_MS  = 60_000; // hard stop after 60 seconds — show error to user

// ---------------------------------------------------------------------------
// Main ranking function — drives the 3-step frontend polling loop:
//   1. POST /api/trigger-scrape  → get snapshot_id  (< 2 s)
//   2. Poll POST /api/resolve-scrape every 5 s      (browser-managed)
//   3. On 'complete' → return { rank, url }
//
// Keeps each individual server invocation under 2 seconds, safely below
// Vercel's serverless execution limits on any tier.
// ---------------------------------------------------------------------------
export async function fetchKeywordRanking(
  domain: string,
  keyword: string,
  rankType: 'dubai' | 'qatar' = 'qatar',
  brandName?: string | null,
  keywordId?: string           // required for resolve-scrape to write Supabase
): Promise<RankingData> {
  console.count('🔥 API CALL START');
  console.log(`\n🔍 [Scraper] Keyword: "${keyword}" | Market: ${rankType} | Domain: ${domain}`);

  // -------------------------------------------------------------------------
  // Step 1 — Trigger: fire the Bright Data job, get snapshot_id immediately
  // -------------------------------------------------------------------------
  const triggerRes = await fetch('/api/trigger-scrape', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, rankType }),
  });

  if (!triggerRes.ok) {
    const errData = await triggerRes.json().catch(() => ({}));
    throw new Error(`trigger-scrape failed (${triggerRes.status}): ${errData.error ?? 'unknown'}`);
  }

  const { snapshot_id } = await triggerRes.json();
  if (!snapshot_id) {
    throw new Error('trigger-scrape did not return a snapshot_id');
  }

  console.log(`📸 Snapshot triggered: ${snapshot_id}`);

  // -------------------------------------------------------------------------
  // Step 2 & 3 — Browser polling loop: call resolve-scrape every 5 seconds
  // -------------------------------------------------------------------------
  const pollStart = Date.now();

  while (true) {
    if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
      throw new Error(`Rank check timed out after ${POLL_TIMEOUT_MS / 1000}s for "${keyword}"`);
    }

    // Wait before polling (also on the very first attempt — scrape needs time to boot)
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    console.log(`⏳ Polling resolve-scrape for snapshot ${snapshot_id}...`);

    const resolveRes = await fetch('/api/resolve-scrape', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snapshot_id,
        keyword_id: keywordId ?? '',  // empty string when called without a DB keyword
        domain,
        rankType,
        brandName,
      }),
    });

    if (!resolveRes.ok) {
      throw new Error(`resolve-scrape HTTP error: ${resolveRes.status}`);
    }

    const result = await resolveRes.json();

    if (result.status === 'error') {
      throw new Error(`resolve-scrape error: ${result.error}`);
    }

    if (result.status === 'pending') {
      console.log('⌛ Still running — will check again in 5s');
      continue; // loop back and wait another POLL_INTERVAL_MS
    }

    if (result.status === 'complete') {
      const rank: number | null = result.newRank ?? null;
      if (rank !== null) {
        console.log(`✅ Found at rank #${rank}`);
        return { rank, url: '' };
      } else {
        console.log('❌ Not found in Top 100 results.');
        return { rank: null, url: null };
      }
    }

    // Unknown status — treat as transient and keep polling
    console.warn('⚠️ Unknown resolve status:', result.status);
  }
}

export const DEFAULT_RANK_SETTINGS: RankSettings = {
  type: 'qatar-desktop',
  location: 'Doha, Qatar',
  gl: 'qa',
  hl: 'en',
  device: 'desktop'
};

export const DUBAI_RANK_SETTINGS: RankSettings = {
  type: 'qatar-desktop',
  location: 'Dubai, United Arab Emirates',
  gl: 'ae',
  hl: 'en',
  device: 'desktop'
};