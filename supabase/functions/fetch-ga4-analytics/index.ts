import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface GA4Credentials {
  client_email: string;
  private_key: string;
}

interface GA4OverviewMetrics {
  totalUsers: number;
  sessions: number;
  engagementRate: number;
  averageSessionDuration: number;
}

interface GA4TrafficSource {
  name: string;
  sessions: number;
}

interface GA4Response {
  success: boolean;
  message?: string;
  overview?: GA4OverviewMetrics;
  trafficSources?: GA4TrafficSource[];
  error?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
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
    
    if (!clientEmail || !privateKey) {
      const response: GA4Response = {
        success: false,
        error: "Missing GA4_CLIENT_EMAIL or GA4_PRIVATE_KEY environment variables"
      };
      
      return new Response(JSON.stringify(response), {
        status: 400,
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
    
    // Set the property ID
    const propertyId = "286170308";

    // Import GA4 client
    const { BetaAnalyticsDataClient } = await import("npm:@google-analytics/data@4.7.0");

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
          startDate: startDate,
          endDate: endDate,
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
          startDate: startDate,
          endDate: endDate,
        },
      ],
      dimensions: [
        { name: 'sessionSource' },
      ],
      metrics: [
        { name: 'sessions' },
      ],
      orderBys: [
        {
          metric: {
            metricName: 'sessions',
          },
          desc: true,
        },
      ],
      limit: 5,
    });

    // Extract overview metrics
    const overviewRow = overviewResponse.rows?.[0];
    const overview: GA4OverviewMetrics = {
      totalUsers: parseInt(overviewRow?.metricValues?.[0]?.value || '0'),
      sessions: parseInt(overviewRow?.metricValues?.[1]?.value || '0'),
      engagementRate: parseFloat(overviewRow?.metricValues?.[3]?.value || '0'),
      averageSessionDuration: parseFloat(overviewRow?.metricValues?.[4]?.value || '0'),
    };

    // Extract traffic sources
    const trafficSources: GA4TrafficSource[] = trafficResponse.rows?.map(row => ({
      name: row.dimensionValues?.[0]?.value || 'Unknown',
      sessions: parseInt(row.metricValues?.[0]?.value || '0'),
    })) || [];

    const successResponse: GA4Response = {
      success: true,
      message: "GA4 analytics fetched successfully",
      overview,
      trafficSources,
      dateRange: {
        startDate,
        endDate,
      },
    };

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('GA4 API Error:', error);
    
    const errorResponse: GA4Response = {
      success: false,
      error: error.message || 'Unknown error occurred'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
});