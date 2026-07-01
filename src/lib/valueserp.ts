import { RankSettings, RankingData } from '../types';

// Domain normalisation — strips protocol, www, and trailing slashes before matching.
function normalizeTargetDomain(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .trim()
    .toLowerCase();
}

// Main ranking function — calls the secure /api/fetch-rank proxy instead of
// hitting ValueSERP directly. This keeps the API key server-side and eliminates CORS issues.
// The proxy paginates pages 1-3 (max_page=3) to return up to ~30 results, since Google
// deprecated the num=100 parameter in Sept 2025. Ranks use position_overall (global rank).
export async function fetchKeywordRanking(
  domain: string,
  keyword: string,
  rankType: 'dubai' | 'qatar' = 'qatar',
  brandName?: string | null
): Promise<RankingData> {
  console.count('🔥 API CALL START');

  const cleanClientDomain = normalizeTargetDomain(domain);
  // Core name for title fallback (e.g. 'bodyglaze' from 'bodyglaze.com')
  const coreName = cleanClientDomain.split('.')[0];
  // Prefer explicit brandName from DB; fall back to coreName derived from domain
  const titleFallback = brandName?.toLowerCase() || coreName;
  console.log(`\n🔍 [Proxy] Target: "${cleanClientDomain}" | Keyword: "${keyword}" | Market: ${rankType}`);

  try {
    // Route through our secure Vercel serverless proxy — API key never touches the browser
    const response = await fetch(
      `/api/fetch-rank?keyword=${encodeURIComponent(keyword)}&rankType=${encodeURIComponent(rankType)}&_t=${Date.now()}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      console.error(`Proxy returned ${response.status}`);
      throw new Error(`Proxy error: ${response.status}`);
    }

    const data = await response.json();

    // DEBUG: inspect raw SERP data — remove before merging
    console.log('RAW SERP DATA:', data.organic_results);

    // A. Map Pack (local_results) — catches Local Business Box positions.
    //    Some businesses have no website button, so we fall back to title matching.
    const localMatch = data.local_results?.find((item: any) =>
      item.website?.toLowerCase().includes(cleanClientDomain) ||
      item.link?.toLowerCase().includes(cleanClientDomain) ||
      item.title?.toLowerCase().includes(titleFallback)
    );
    if (localMatch) {
      console.log(`✅ Found in MAP PACK at pos ${localMatch.position}`);
      return { rank: localMatch.position, url: localMatch.website || localMatch.link || '' };
    }

    // B. Organic results — use position_overall for the true global rank across paginated pages.
    //    position resets to 1-10 per page, so it would be wrong for results beyond page 1.
    const organicMatch = data.organic_results?.find((item: any) =>
      item.link?.toLowerCase().includes(cleanClientDomain)
    );
    if (organicMatch) {
      const rank = organicMatch.position_overall || organicMatch.position;
      console.log(`✅ Found in ORGANIC at global pos ${rank}`);
      return { rank, url: organicMatch.link };
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