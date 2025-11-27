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
      num: 100
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
      // Clean the client domain (remove protocol and www)
      const cleanClientDomain = domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .toLowerCase();
      
      console.log('Checking rank for:', cleanClientDomain);
      
      for (const result of data.organic_results) {
        if (result.link) {
          console.log('Found API Result at pos', result.position, ':', result.link);
          
          const isMatch = result.link.toLowerCase().includes(cleanClientDomain);
          console.log('Match Status:', isMatch);
          
          if (isMatch) {
            rank = result.position;
            url = result.link;
            break;
          }
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