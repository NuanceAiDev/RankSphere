import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface GA4Credentials {
  client_email: string;
  private_key: string;
}

interface GA4Response {
  success: boolean;
  message: string;
  metrics?: any;
  error?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  propertyId?: string;
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
    const propertyId = Deno.env.get("GA4_PROPERTY_ID") || "286170308";
    
    if (!clientEmail || !privateKey) {
      const response: GA4Response = {
        success: false,
        message: "GA4 connection failed ❌",
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

    // Format private key correctly
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    
    // Import GA4 client (using npm: specifier for Deno)
    const { BetaAnalyticsDataClient } = await import("npm:@google-analytics/data@4.7.0");

    // Initialize GA4 client
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: formattedPrivateKey,
      },
    });

    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    // Run GA4 report
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
      ],
    });

    // Extract metrics from response
    const metrics = {
      sessions: response.rows?.[0]?.metricValues?.[0]?.value || '0',
      totalUsers: response.rows?.[0]?.metricValues?.[1]?.value || '0',
    };

    const successResponse: GA4Response = {
      success: true,
      message: "GA4 connection successful ✅",
      metrics,
      dateRange: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      },
      propertyId
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
      message: "GA4 connection failed ❌",
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