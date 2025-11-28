import toast from 'react-hot-toast';
import { RankSettings, RankingData } from '../types';

const VALUESERP_API_KEY = import.meta.env.VITE_VALUESERP_API_KEY;
const BASE_URL = 'https://api.valueserp.com/search';

// Helper to clean domains for comparison
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
    console.log(`\n🔍 [DEBUG] Looking for client: "${targetDomain}"`);

    // Setup Params
    const params = new URLSearchParams({
      api_key: VALUESERP_API_KEY,
      q: keyword,
      output: 'json',
      num: '100' 
    });

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
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    
    const data = await response.json();
    
    let rank = null;
    let url = null;
    let foundIn = '';

    // --- DEBUGGING: Collect ALL found domains to see what the API sees ---
    const allFoundDomains: string[] = [];

    // 1. Check Local Results (Map Pack) - CRITICAL FOR LOCAL BUSINESSES
    if (data.local_results) {
      for (let i = 0; i < data.local_results.length; i++) {
        const item = data.local_results[i];
        const itemUrl = item.website || item.link || '';
        if (itemUrl) allFoundDomains.push(`[MAPS] ${itemUrl}`);
        
        if (normalizeDomain(itemUrl).includes(targetDomain)) {
          rank = item.position; 
          url = itemUrl;
          foundIn = 'Map Pack';
          break;
        }
      }
    }

    // 2. Check Organic Results (Standard Links) - Only if not found in Maps
    if (!rank && data.organic_results) {
      for (let i = 0; i < data.organic_results.length; i++) {
        const item = data.organic_results[i];
        if (item.link) allFoundDomains.push(`[#${item.position}] ${item.link}`);

        if (item.link && normalizeDomain(item.link).includes(targetDomain)) {
          rank = item.position;
          url = item.link;
          foundIn = 'Organic';
          break;
        }
      }
    }

    // --- FINAL REPORT IN CONSOLE ---
    if (rank) {
      console.log(`✅ MATCH FOUND! Rank: ${rank} (${foundIn}) | URL: ${url}`);
    } else {
      console.log(`❌ NOT RANKED. API scanned ${allFoundDomains.length} results.`);
      console.log(`👀 DUMP of top 5 results found:\n`, allFoundDomains.slice(0, 5).join('\n'));
      // UNCOMMENT BELOW TO SEE ALL RESULTS IF NEEDED:
      // console.log(allFoundDomains.join('\n'));
    }

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