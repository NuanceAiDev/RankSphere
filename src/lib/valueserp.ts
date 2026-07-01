import { RankSettings, RankingData } from '../types';

// Main ranking function — calls the secure /api/fetch-rank proxy instead of
// hitting ValueSERP directly. This keeps the API key server-side and eliminates CORS issues.
// The proxy checks pages 1-3 with early exit: a page-1 hit costs 1 credit, page-3 costs 3.
// domain and brandName are passed so the proxy can do matching server-side and return early.
export async function fetchKeywordRanking(
  domain: string,
  keyword: string,
  rankType: 'dubai' | 'qatar' = 'qatar',
  brandName?: string | null
): Promise<RankingData> {
  console.count('🔥 API CALL START');
  console.log(`\n🔍 [Proxy] Target: "${domain}" | Keyword: "${keyword}" | Market: ${rankType}`);

  try {
    // Route through our secure Vercel serverless proxy — API key never touches the browser.
    // Proxy returns { rank, url } after checking up to 3 pages with early exit.
    const url = `/api/fetch-rank?keyword=${encodeURIComponent(keyword)}&rankType=${encodeURIComponent(rankType)}&domain=${encodeURIComponent(domain)}&brandName=${encodeURIComponent(brandName ?? '')}&_t=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      console.error(`Proxy returned ${response.status}`);
      throw new Error(`Proxy error: ${response.status}`);
    }

    const result = await response.json();

    if (result.rank != null) {
      console.log(`✅ Found at global pos ${result.rank}`);
      return { rank: result.rank, url: result.url ?? '' };
    }

    console.log('❌ Not found in top 30 results.');
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