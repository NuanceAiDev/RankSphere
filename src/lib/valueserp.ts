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

// 2. Helper to fetch a SINGLE page with RETRY LOGIC (New!)
async function fetchPageFromAPI(
  keyword: string, 
  pageNumber: number, 
  rankType: string,
  retries = 3 // 🛡️ Try 3 times before failing (Fixes network drops)
): Promise<any> {
  const baseParams: any = {
    api_key: VALUESERP_API_KEY,
    q: keyword,
    output: 'json',
    page: pageNumber.toString(),
    // 🟢 Standard 10 results ensures Map Pack is visible.
    // We removed 'num: 100' because it hides local maps.
    num: '10' 
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

  // 🔄 RETRY LOOP
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}?${params}`);
      
      // Handle Rate Limiting (429) or Server Errors (500+)
      if (!response.ok) {
         if (response.status === 429 || response.status >= 500) {
            console.warn(`⚠️ Attempt ${attempt} failed (Status ${response.status}). Retrying...`);
            await new Promise(r => setTimeout(r, 1000 * attempt)); // Wait 1s, then 2s...
            continue;
         }
         console.warn(`Warning: Page ${pageNumber} failed with status ${response.status}`);
         return null;
      }
      
      return await response.json();

    } catch (err) {
      // 🛡️ CATCH NETWORK ERRORS (Like 'ERR_NAME_NOT_RESOLVED')
      console.error(`⚠️ Network error on Page ${pageNumber} (Attempt ${attempt}/${retries})`);
      if (attempt === retries) return null; // Give up after 3 tries
      await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
    }
  }
  return null;
}

// 3. Main Function with "Sequential Hunter" Loop
export async function fetchKeywordRanking(
  domain: string, 
  keyword: string, 
  rankType: 'dubai' | 'qatar' = 'qatar'
): Promise<RankingData> {
  // Debug counter to catch frontend double-firing
  console.count("🔥 API CALL START"); 

  if (!VALUESERP_API_KEY) {
    console.warn('ValueSERP API key not configured');
    return { rank: null, url: null };
  }

  const targetDomain = normalizeDomain(domain);
  console.log(`\n🔍 [Hunter Strategy] Target: "${targetDomain}" | Keyword: "${keyword}"`);

  // 🔴 SAFETY LIMIT: Stop after Page 5 (Top 50 results).
  // Checking 10 pages costs 10 credits per keyword. 
  // Page 5 is a healthy balance between depth and budget.
  const MAX_PAGES = 10; 

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      console.log(`Scanning Page ${page}...`);
      
      const data = await fetchPageFromAPI(keyword, page, rankType);
      
      if (!data) continue; 

      // A. Check Map Pack (Page 1 only)
      // This catches Rank #1-3 (Local Business Box)
      if (page === 1 && data.local_results) {
        for (const item of data.local_results) {
          const itemUrl = item.website || item.link || '';
          if (normalizeDomain(itemUrl).includes(targetDomain)) {
            console.log(`✅ Found in MAP PACK (Page 1) at pos ${item.position}`);
            return { rank: item.position, url: itemUrl }; 
          }
        }
      }

      // B. Check Organic Results
      if (data.organic_results) {
        for (const item of data.organic_results) {
          if (item.link && normalizeDomain(item.link).includes(targetDomain)) {
            console.log(`✅ Found in ORGANIC (Page ${page}) at pos ${item.position}`);
            
            // 🟢 ACCURATE MATH: 
            // Formula: ((Page Number - 1) * 10) + Item Position
            // Ex: Page 2, Pos 6 = (1 * 10) + 6 = Rank 16.
            const globalRank = ((page - 1) * 10) + item.position;
            
            return { rank: globalRank, url: item.link };
          }
        }
      }
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