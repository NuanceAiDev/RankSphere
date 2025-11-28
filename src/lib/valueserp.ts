import toast from 'react-hot-toast';
import { RankSettings, RankingData } from '../types';

const VALUESERP_API_KEY = import.meta.env.VITE_VALUESERP_API_KEY;
const BASE_URL = 'https://api.valueserp.com/search';

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

export async function fetchKeywordRanking(
  domain: string, 
  keyword: string, 
  rankType: 'dubai' | 'qatar' = 'qatar'
): Promise<RankingData> {
  if (!VALUESERP_API_KEY) {
    console.warn('ValueSERP API key not configured');
    return { rank: null, url: null };
  }

  try {
    const targetDomain = normalizeDomain(domain);
    console.log(`\n🔍 [DEBUG] Target: "${targetDomain}" | Keyword: "${keyword}"`);

    // --- KEY FIX: Google killed "num=100" in Sept 2025. 
    // We must use "max_page" to fetch multiple pages (max 5 for real-time).
    const baseParams: any = {
      api_key: VALUESERP_API_KEY,
      q: keyword,
      output: 'json',
      page: '1',      // Start at page 1
      max_page: '5'   // Auto-scroll up to page 5 (approx 50 results)
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
    
    const response = await fetch(`${BASE_URL}?${params}`);
    if (!response.ok) {
       const err = await response.text();
       throw new Error(`API Error: ${response.status} ${err}`);
    }
    
    const data = await response.json();
    
    let rank = null;
    let url = null;

    // 1. Check Map Pack (Local Results) - often Rank 1-3
    if (data.local_results) {
      for (const item of data.local_results) {
        const itemUrl = item.website || item.link || '';
        if (normalizeDomain(itemUrl).includes(targetDomain)) {
          console.log(`✅ Found in MAP PACK at pos ${item.position}`);
          rank = item.position; 
          url = itemUrl;
          break;
        }
      }
    }

    // 2. Check Organic Results (Pages 1-5)
    if (!rank && data.organic_results) {
      console.log(`[DEBUG] Scanned ${data.organic_results.length} organic results.`);
      for (const item of data.organic_results) {
        if (item.link && normalizeDomain(item.link).includes(targetDomain)) {
          console.log(`✅ Found in ORGANIC at pos ${item.position}`);
          rank = item.position;
          url = item.link;
          break;
        }
      }
    }

    if (!rank) console.log(`❌ Not found in top 50 results.`);

    return { rank, url };

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