interface GA4Params {
  propertyId: string;
  startDate?: string;
  endDate?: string;
}

interface GA4Response {
  ok: boolean;
  overview?: {
    totalUsers: number;
    sessions: number;
    engagementRate: number;
    averageSessionDuration: number;
  };
  trafficSources?: Array<{
    source: string;
    sessions: number;
  }>;
  error?: string;
  details?: any;
}

export async function fetchGA4Data({ 
  propertyId, 
  startDate = "30daysAgo", 
  endDate = "today" 
}: GA4Params): Promise<{ overview: any; trafficSources: any[] }> {
  // Validate required environment variables
  const functionsUrl = 'https://ehbagbwhldczdyhpckbt.supabase.co/functions/v1';
  // Bypassing .env file to fix 401 error
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoYmFnYndobGRjemR5aHBja2J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNTM4MjgsImV4cCI6MjA3MDkyOTgyOH0.k09U97UbG9ZTTQXT4Ah37-1B2s01c8uYBXG7Uo6TdZU';

  if (!functionsUrl) {
    throw new Error('VITE_SUPABASE_FUNCTIONS_URL environment variable is not set');
  }

  if (!anonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY environment variable is not set');
  }

  // Build URL with query parameters (GET request)
  const base = functionsUrl.replace(/\/$/, "");
  const url = `${base}/fetch-ga4-analytics?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  console.debug('GA4 Request URL:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
      'Content-Type': 'application/json',
    },
  });

  console.debug('GA4 Response:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GA4 API request failed: ${response.status} - ${errorText}`);
  }

  const json: GA4Response = await response.json();
  console.debug('GA4 JSON:', json);

  if (!response.ok || json.ok === false) {
    throw new Error(json.error || 'GA4 request failed');
  }

  return {
    overview: json.overview || null,
    trafficSources: json.trafficSources || []
  };
}