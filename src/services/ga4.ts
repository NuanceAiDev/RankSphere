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
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
      'Content-Type': 'application/json',
    },
  });

  console.debug('GA4 Response:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errorText}`);
  }

  const json: GA4Response = await response.json();
  console.debug('GA4 JSON:', json);

  if (json.ok === false) {
    throw new Error(json.error || 'GA4 request failed');
  }

  return {
    overview: json.overview || null,
    trafficSources: json.trafficSources || []
  };
}

export async function fetchGA4Analytics(clientId: string) {
  try {
    const baseUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!baseUrl || !anonKey) {
      throw new Error("Supabase configuration missing.");
    }

    const response = await fetch(`${baseUrl}/fetch-ga4-analytics?clientId=${clientId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("GA4 Fetch Error:", error);
    return { success: false, error: error.message };
  }
}

export async function testGA4Connection() {
  try {
    const baseUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!baseUrl || !anonKey) {
      throw new Error("Supabase configuration missing.");
    }

    const response = await fetch(`${baseUrl}/test-ga4`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("GA4 Test Connection Error:", error);
    return { success: false, error: error.message };
  }
}