import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Read environment variables
    const clientEmail = Deno.env.get("GA4_CLIENT_EMAIL");
    const privateKey = Deno.env.get("GA4_PRIVATE_KEY");
    const propertyId = Deno.env.get("GA4_PROPERTY_ID");
    
    if (!clientEmail || !privateKey || !propertyId) {
      const response: GA4Response = {
        ok: false,
        error: "GA4 credentials or property ID missing"
      };
      
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const startDate = url.searchParams.get("startDate") || "30daysAgo";
    const endDate = url.searchParams.get("endDate") || "today";

    // Format private key correctly
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    // Import GA4 client
    const { BetaAnalyticsDataClient } = await import("npm:@google-analytics/data@5.2.0");

    // Initialize GA4 client
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: formattedPrivateKey,
      },
    });

    // Fetch overview metrics
    const [overviewResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate,
          endDate,
        },
      ],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'engagedSessions' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
      ],
    });

    // Fetch traffic sources
    const [trafficResponse] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate,
          endDate,
        },
      ],
      metrics: [
        { name: 'sessions' },
      ],
      dimensions: [
        { name: 'sessionSource' },
      ],
      orderBys: [
        {
          metric: {
            metricName: 'sessions'
          },
          desc: true
        }
      ],
      limit: 5
    });

    // Extract overview metrics
    const overviewRow = overviewResponse.rows?.[0];
    const overview = {
      totalUsers: parseInt(overviewRow?.metricValues?.[0]?.value || '0'),
      sessions: parseInt(overviewRow?.metricValues?.[1]?.value || '0'),
      engagementRate: parseFloat(overviewRow?.metricValues?.[3]?.value || '0'),
      averageSessionDuration: parseFloat(overviewRow?.metricValues?.[4]?.value || '0'),
    };

    // Extract traffic sources
    const trafficSources = trafficResponse.rows?.map(row => ({
      source: row.dimensionValues?.[0]?.value || 'Unknown',
      sessions: parseInt(row.metricValues?.[0]?.value || '0')
    })) || [];

    const response: GA4Response = {
      ok: true,
      overview,
      trafficSources
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('GA4 API Error:', error);
    
    const response: GA4Response = {
      ok: false,
      error: "Failed to fetch GA4 data",
      details: error.message || 'Unknown error occurred'
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
});