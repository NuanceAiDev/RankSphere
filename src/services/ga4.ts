interface GA4Params {
  propertyId: string;
  startDate?: string;
  endDate?: string;
  metrics?: string[];
  dimensions?: string[];
}

interface GA4Response {
  ok: boolean;
  summary?: Record<string, number>;
  rows?: any[];
  metrics?: string[];
  dimensions?: string[];
  raw?: any;
  error?: string;
  details?: any;
}

export async function fetchGA4Data(params: GA4Params): Promise<GA4Response> {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!functionsUrl) {
    throw new Error('VITE_SUPABASE_FUNCTIONS_URL environment variable is not set');
  }

  if (!anonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY environment variable is not set');
  }

  const response = await fetch(`${functionsUrl}/fetch-ga4-analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anonKey,
    },
    body: JSON.stringify(params),
  });

  const data: GA4Response = await response.json();

  if (!data.ok) {
    throw new Error(data.error || 'Failed to fetch GA4 data');
  }

  return data;
}