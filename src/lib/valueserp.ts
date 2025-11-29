import toast from 'react-hot-toast';
import { RankSettings, RankingData } from '../types';

const VALUESERP_API_KEY = import.meta.env.VITE_VALUESERP_API_KEY;
const BASE_URL = 'https://api.valueserp.com/search';

// 1. Helper to clean domains for accurate matching
// Turns "https://www.SelectQatar.com/about" -> "selectqatar.com"
function normalizeDomain(url: string): string {
  if (!url) return '';
  try {
    return url.toLowerCase()
      .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '')
      .split('/')[0];
  } catch (e) {
    return '';
  }
}

// 2. Helper to fetch a SINGLE page
async function fetchPageFromAPI(
  keyword: string, 
  pageNumber: number, 
  rankType: string
): Promise<any> {
  const baseParams: any = {
    api_key: VALUESERP_API_KEY,
    q: keyword,
    output: 'json',
    page: pageNumber.toString(),
    
    // 🟢 SUPER SQUEEZE STRATEGY:
    // We request 100 results per page.
    // This attempts to fit the entire top 100 into a SINGLE API call.
    // Benefit: Finding Rank #21 or #80 costs only 1 Credit instead of 3 or 9.
    num: '100' 
  };

  const params = new URLSearchParams(baseParams);

  if (rankType === 'qatar') {
    params.append('location', 'Doha, Qatar');
    params.append('google_domain', 'google.com.qa');
    params.append('gl', 'qa');
    params.append('hl', 'en');
  } else {
    params.append('location', 'Dubai, United Arab Emirates');
    params.append('google_domain', 'google.ae');
    params.append('gl', 'ae');
    params.append('hl', 'en');
  }

  try {
    const response = await fetch(`${BASE_URL}?${params}`);
    if (!response.ok) {
       console.warn(`Warning: Page ${pageNumber} failed with status ${response.status}`);
       return null;
    }
    return await response.json();
  } catch (err) {
    console.error(`Network error on Page ${pageNumber}`, err);
    return null;
  }
}

// 3. Main Function with "Sequential Hunter" Loop
export async function fetchKeywordRanking(
  domain: string, 
  keyword: string, 
  rankType: 'dubai' | 'qatar' = 'qatar'
): Promise<RankingData> {
  // DEBUG: Track API calls. 
  // If you see "API CALL: 2" for one click, check your Frontend (Strict Mode/Double Click).
  console.count("🔥 API CALL START"); 

  if (!VALUESERP_API_KEY) {
    console.warn('ValueSERP API key not configured');
    return { rank: null, url: null };
  }

  const targetDomain = normalizeDomain(domain);
  console.log(`\n🔍 [Hunter Strategy] Target: "${targetDomain}" | Keyword: "${keyword}"`);

  // Max Pages logic:
  // Since we set num: '100', Page 1 usually captures everything.
  // We keep the loop just in case Google ignores the '100' param and forces pagination.
  const MAX_PAGES = 10; 

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      console.log(`Scanning Page ${page}...`);
      
      const data = await fetchPageFromAPI(keyword, page, rankType);
      
      if (!data) continue; // Skip failed pages

      // A. Check Map Pack (Only exists on Page 1 usually)
      if (page === 1 && data.local_results) {
        for (const item of data.local_results) {
          const itemUrl = item.website || item.link || '';
          if (normalizeDomain(itemUrl).includes(targetDomain)) {
            console.log(`✅ Found in MAP PACK (Page 1) at pos ${item.position}`);
            return { rank: item.position, url: itemUrl }; // STOP! Cost: 1 Credit
          }
        }
      }

      // B. Check Organic Results
      if (data.organic_results) {
        for (const item of data.organic_results) {
          if (item.link && normalizeDomain(item.link).includes(targetDomain)) {
            console.log(`✅ Found in ORGANIC (Page ${page}) at pos ${item.position}`);
            // Note: When num=100, item.position is usually the global rank (e.g., 21).
            return { rank: item.position, url: item.link }; // STOP! Cost: 'page' Credits
          }
        }
      }
      
      // If we are here, we didn't find it on this page.
      // The loop continues to the next page automatically.
      // With num:100, if it's not on Page 1, it's likely not in the top 100.
      if (page === 1 && data.organic_results && data.organic_results.length >= 80) {
         // Optimization: If Page 1 returned 80+ results and we didn't find it, 
         // it's probably not there. We can stop early to save time if you want.
         // For now, we let it continue just to be safe.
      }
    }

    console.log(`❌ Not found in Top ${MAX_PAGES * 100} results.`);
    return { rank: null, url: null };

  } catch (error) {
    console.error('API Error:', error);
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