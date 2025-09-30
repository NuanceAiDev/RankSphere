// GA4 API client configuration
const getGA4Client = () => {
  console.warn('GA4 client is a server-side component and cannot run in the browser');
  return null;
};

export interface GA4Metrics {
  date: string;
  sessions: number;
  users: number;
  engagements: number;
  source: string;
  medium: string;
}

export interface GA4Summary {
  totalSessions: number;
  totalUsers: number;
  totalEngagements: number;
  data: GA4Metrics[];
}

export async function fetchGA4Data(propertyId: string): Promise<GA4Summary> {
  throw new Error('GA4 data fetching is a server-side operation and cannot be performed in the browser. This functionality needs to be moved to a server-side component (e.g., Supabase Edge Function).');
}

export const isGA4Configured = () => {
  return false; // GA4 client cannot run in browser
};