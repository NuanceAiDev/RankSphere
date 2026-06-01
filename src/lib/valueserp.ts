import { RankSettings, RankingData } from '../types';

// Domain normalisation — strips protocol, www, and trailing slashes before matching.
function normalizeTargetDomain(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase();
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

  const cleanClientDomain = normalizeTargetDomain(domain);
  // Core name for title fallback (e.g. 'bodyglaze' from 'bodyglaze.com')
  const coreName = cleanClientDomain.split('.')[0];
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

    // A. Map Pack (local_results) — catches Local Business Box positions.
    //    Some businesses have no website button, so we fall back to title matching.
    const localMatch = data.local_results?.find((item: any) =>
      item.website?.toLowerCase().includes(cleanClientDomain) ||
      item.link?.toLowerCase().includes(cleanClientDomain) ||
      item.title?.toLowerCase().includes(coreName)
    );
    if (localMatch) {
      console.log(`✅ Found in MAP PACK at pos ${localMatch.position}`);
      return { rank: localMatch.position, url: localMatch.website || localMatch.link || '' };
    }

    // B. Organic results — substring match is more forgiving than exact equality.
    const organicMatch = data.organic_results?.find((item: any) =>
      item.link?.toLowerCase().includes(cleanClientDomain)
    );
    if (organicMatch) {
      console.log(`✅ Found in ORGANIC at pos ${organicMatch.position}`);
      return { rank: organicMatch.position, url: organicMatch.link };
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