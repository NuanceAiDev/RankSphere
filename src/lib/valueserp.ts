import toast from 'react-hot-toast';
import { RankSettings, RankingData } from '../types';

const VALUESERP_API_KEY = import.meta.env.VITE_VALUESERP_API_KEY;
const BASE_URL = 'https://api.valueserp.com/search';

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
    const baseParams = {
      api_key: VALUESERP_API_KEY,
      q: keyword,
      google_domain: 'google.com',
      output: 'json',
      num: '100' // Get top 100 results to find domain
    };

    // Add location-specific parameters based on rank type
    const params = new URLSearchParams(baseParams);
    if (rankType === 'qatar') {
      params.append('location', 'Doha, Qatar');
      params.append('gl', 'qa');
      params.append('hl', 'en');
      params.append('device', 'desktop');
    } else if (rankType === 'dubai') {
      params.append('location', 'Dubai, United Arab Emirates');
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
      for (let i = 0; i < data.organic_results.length; i++) {
        const result = data.organic_results[i];
        if (result.link && result.link.includes(domain)) {
          rank = result.position || (i + 1);
          url = result.link;
          break;
        }
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