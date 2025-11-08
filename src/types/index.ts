export interface Client {
  id: string;
  name: string;
  domain: string;
  industry?: string;
  rank_type?: 'dubai' | 'qatar';
  ga4_property_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: string;
  text: string;
  previous_month_rank: number | null;
  previous_month_date: string | null;
  current_month_rank: number | null;
  current_month_date: string | null;
  client_id: string;
  created_at: string;
  updated_at: string;
  last_checked: string | null;
}

export interface ValueSERPResponse {
  organic_results?: Array<{
    position: number;
    link: string;
    title: string;
    snippet: string;
  }>;
  search_information?: {
    total_results: number;
  };
}

export interface RankingData {
  rank: number | null;
  url?: string;
}

export type RankType = 'organic' | 'qatar-desktop';

export interface RankSettings {
  type: RankType;
  location: string;
  gl: string;
  hl: string;
  device: string;
}

export interface GA4OverviewMetrics {
  totalUsers: number;
  sessions: number;
  engagementRate: number;
  averageSessionDuration: number;
}

export interface GA4TrafficSource {
  name: string;
  sessions: number;
}

export interface GA4AnalyticsData {
  overview: GA4OverviewMetrics;
  trafficSources: GA4TrafficSource[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface GA4Report {
  totalUsers: number;
  sessions: number;
  engagementRate: number;
  averageSessionDuration: number;
  trafficSources: GA4TrafficSource[];
}

export interface GA4Summary {
  totalUsers: number;
  sessions: number;
  engagementRate: number;
  averageSessionDuration: number;
  topTrafficSources: GA4TrafficSource[];
}