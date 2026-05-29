import { RankSettings, RankingData } from '../types';

// Helper to normalize domain URLs for comparison —
// strips http://, https://, www., and trailing slashes before matching.
function normalizeDomain(url: string): string {
  return url
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
    .replace(/\/$/, '');
}

// Main ranking function — calls the secure /api/fetch-rank proxy instead of
// hitting ValueSERP directly. This keeps the API key server-side and eliminates CORS issues.
// A single num=100 request replaces the old 10-page pagination loop (10x credit saving).
export async function fetchKeywordRanking(
  domain: string,
  keyword: string,
  rankType: 'dubai' | 'qatar' = 'qatar'
): Promise<RankingData> {
  console.count('🔥 API CALL START');

  const cleanClientDomain = normalizeDomain(domain);
  console.log(`\n🔍 [Proxy] Target: "${cleanClientDomain}" | Keyword: "${keyword}" | Market: ${rankType}`);

  try {
    // Route through our secure Vercel serverless proxy — API key never touches the browser
    const response = await fetch(
      `/api/fetch-rank?keyword=${encodeURIComponent(keyword)}&rankType=${encodeURIComponent(rankType)}`
    );

    if (!response.ok) {
      console.error(`Proxy returned ${response.status}`);
      throw new Error(`Proxy error: ${response.status}`);
    }

    const data = await response.json();

    // A. Check Map Pack (local_results) — catches top-3 Local Business Box positions
    if (data.local_results) {
      for (const item of data.local_results) {
        const itemUrl = item.website || item.link || '';
        if (normalizeDomain(itemUrl).includes(cleanClientDomain)) {
          console.log(`✅ Found in MAP PACK at pos ${item.position}`);
          return { rank: item.position, url: itemUrl };
        }
      }
    }

    // B. Check Organic Results — position is already the global rank in a num=100 response
    if (data.organic_results) {
      for (const item of data.organic_results) {
        console.log('Checking pos', item.position, ':', item.link);
        const isMatch = normalizeDomain(item.link).includes(cleanClientDomain);
        console.log('Match:', isMatch);

        if (isMatch) {
          console.log(`✅ Found in ORGANIC at pos ${item.position}`);
          return { rank: item.position, url: item.link };
        }
      }
    }

    console.log('❌ Not found in Top 100 results.');
    return { rank: null, url: null };

  } catch (error) {
    console.error('Proxy fetch failed:', error);
    throw error;
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