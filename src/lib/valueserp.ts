import toast from 'react-hot-toast';
import { RankSettings, RankingData } from '../types';

const VALUESERP_API_KEY = import.meta.env.VITE_VALUESERP_API_KEY;
const BASE_URL = 'https://api.valueserp.com/search';

// Helper to clean domains for accurate matching
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

// Helper to fetch a SINGLE page
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
    // Try to fetch 100 results on Page 1. 
    // If Google ignores this (which it often does), we fall back to pagination loops.
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

// Main Function with "Sequential Hunter" Loop
export async function fetchKeywordRanking(
  domain: string, 
  keyword: string, 
  rankType: 'dubai' | 'qatar' = 'qatar'
): Promise<RankingData> {
  console.count("🔥 API CALL START"); 

  if (!VALUESERP_API_KEY) {
    console.warn('ValueSERP API key not configured');
    return { rank: null, url: null };
  }

  const targetDomain = normalizeDomain(domain);
  console.log(`\n🔍 [Hunter Strategy] Target: "${targetDomain}" | Keyword: "${keyword}"`);

  // 🔴 SAFETY LIMIT: Stop after Page 4 (Top 40 results) to save money.
  // Most clients don't care if they are rank #41 or #99.
  const MAX_PAGES = 4; 

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      console.log(`Scanning Page ${page}...`);
      
      const data = await fetchPageFromAPI(keyword, page, rankType);
      
      if (!data) continue; 

      // A. Check Map Pack (Page 1 only)
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
            
            // 🟢 CRITICAL MATH FIX: Calculate Global Rank
            // If we are on Page 2, and position is 6... Real Rank is 16.
            // Formula: ((Page Number - 1) * 10) + Item Position
            let globalRank = item.position;
            
            // Only apply math if Google ignored 'num: 100' and gave us small pages
            if (data.organic_results.length < 50 && page > 1) {
               globalRank = ((page - 1) * 10) + item.position;
            }
            
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