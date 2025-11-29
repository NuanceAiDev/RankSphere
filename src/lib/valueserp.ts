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
    page: pageNumber.toString(), // Fetch specific page (1, 2, 3...)
    num: '50' // Standard 10 results per page (Google default)
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
  // DEBUG: This logs how many times the function is called. 
  // If you see "API CALL: 2" for one click, your UI is double-firing.
  console.count("🔥 API CALL START"); 

  if (!VALUESERP_API_KEY) {
    console.warn('ValueSERP API key not configured');
    return { rank: null, url: null };
  }

  const targetDomain = normalizeDomain(domain);
  console.log(`\n🔍 [Hunter Strategy] Target: "${targetDomain}" | Keyword: "${keyword}"`);

  // Max Pages = 10 (Total 100 results). 
  // Logic: Stop IMMEDIATELY when match is found to save money.
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
            return { rank: item.position, url: item.link }; // STOP! Cost: 'page' Credits
          }
        }
      }
      
      // If we are here, we didn't find it on this page.
      // The loop continues to the next page automatically.
    }

    console.log(`❌ Not found in Top ${MAX_PAGES * 10} results.`);
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