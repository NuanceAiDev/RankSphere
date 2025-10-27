// GA4 API client configuration
import { supabaseUrl, isSupabaseConfigured } from './supabase';
import type { GA4AnalyticsData, GA4Summary, GA4Report } from '../types';

export async function fetchGA4Analytics(
  startDate: string = '30daysAgo',
  endDate: string = 'today'
): Promise<GA4AnalyticsData> {
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  const params = new URLSearchParams({
    startDate,
    endDate,
  });

  const response = await fetch(
    `${supabaseUrl}/functions/v1/fetch-ga4-analytics?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch GA4 analytics');
  }

  return {
    overview: data.overview,
    trafficSources: data.trafficSources,
    dateRange: data.dateRange,
  };
}

export function isGA4Configured(): boolean {
  return isSupabaseConfigured;
}