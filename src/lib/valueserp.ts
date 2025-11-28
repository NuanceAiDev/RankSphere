import toast from 'react-hot-toast';
import { RankSettings, RankingData } from '../types';

const VALUESERP_API_KEY = import.meta.env.VITE_VALUESERP_API_KEY;
const BASE_URL = 'https://api.valueserp.com/search';

// Helper to strip "https://", "www.", and paths to get the core domain
function normalizeDomain(url: string): string {
  try {
    return url.toLowerCase()
      .replace(/^(?:https?:\/\/)?(?:www\.)?/i, '') // Remove protocol & www
      .split('/')[0]; // Remove path, keep only domain
  } catch (e) {
    return url.toLowerCase();
  }
}

export async function fetchKeywordRanking(
  domain: string, 
  keyword: string, 
  rankType: 'dubai' | 'qatar' = 'qatar'
): Promise<RankingData> {
  if (!VALUESERP_API_KEY) {
    console.warn('ValueSERP API key not configured, using mock data');
    return {
      rank: Math.floor(Math.random() * 100) + 1,
      url: `https://${domain}/sample-page`
    };
  }

  try {
    // 1. Clean the input domain so we match "selectqatar.com" not "https://..."
    const targetDomain = normalizeDomain(domain);
    console.log(`[RankCheck] Searching for target: "${targetDomain}" for keyword: "${keyword}"`);

    const baseParams: any = {
      api_key: VALUESERP_API_KEY,
      q: keyword,
      output: 'json',
      num: 100 // Integer 100 is safer than string '100'
    };

    // 2. Dynamic Location & Google Domain Logic
    // We use .com.qa for Qatar to get accurate local ranks
    const params = new URLSearchParams();
    
    // Add base params manually to URLSearchParams
    Object.keys(baseParams).forEach(key => params.append(key, baseParams[key]));

    if (rankType === 'qatar') {
      params.append('location', 'Doha, Qatar');
      params.append('google_domain', 'google.com.qa'); // CRITICAL FIX: Local Google
      params.append('gl', 'qa');
      params.append('hl', 'en');
      params.append('device', 'desktop');
    } else if (rankType === 'dubai') {
      params.append('location', 'Dubai, United Arab Emirates');
      params.append('google_domain', 'google.ae'); // CRITICAL FIX: Local Google
      params.append('gl', 'ae');
      params.append('hl', 'en');
      params.append('device', 'desktop');
    }
    
    const response = await fetch(`${BASE_URL}?${params}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ValueSERP API Error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    // Search for the domain in organic results
    let rank = null;
    let url = null;
    
    if (data.organic_results && Array.isArray(data.organic_results)) {
      console.log(`[RankCheck] API returned ${data.organic_results.length} results.`);
      
      for (let i = 0; i < data.organic_results.length; i++) {
        const result = data.organic_results[i];
        
        // 3. Brute Force Match: Does the result link contain our clean target domain?
        if (result.link && result.link.toLowerCase().includes(targetDomain)) {
          console.log(`[RankCheck] MATCH FOUND at pos ${result.position}! Link: ${result.link}`);
          rank = result.position || (i + 1);
          url = result.link;
          break;
        }
      }
      
      if (!rank) {
         console.log(`[RankCheck] NO MATCH found in top 100 results.`);
      }
    }
    
    return {
      rank,
      url
    };
  } catch (error) {
    console.error('ValueSERP API Error:', error);
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