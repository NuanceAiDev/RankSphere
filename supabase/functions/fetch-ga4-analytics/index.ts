import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface GA4Request {
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

async function createJWT(clientEmail: string, privateKey: string): Promise<string> {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  
  // Import the private key
  const keyData = privateKey.replace(/\\n/g, '\n');
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = keyData.replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, data);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = await createJWT(clientEmail, privateKey);
  
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const clientEmail = Deno.env.get("GA4_CLIENT_EMAIL");
    const privateKey = Deno.env.get("GA4_PRIVATE_KEY");

    if (!clientEmail || !privateKey) {
      const response: GA4Response = {
        ok: false,
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

    const requestData: GA4Request = await req.json();
    const {
      propertyId,
      startDate = "28daysAgo",
      endDate = "yesterday",
      metrics = ["totalUsers", "sessions", "engagementRate"],
      dimensions = ["sessionDefaultChannelGroup"]
    } = requestData;

    // Get access token
    const accessToken = await getAccessToken(clientEmail, privateKey);

    // Prepare GA4 API request
    const ga4Request = {
      dateRanges: [{
        startDate,
        endDate
      }],
      metrics: metrics.map(name => ({ name })),
      dimensions: dimensions.map(name => ({ name }))
    };

    // Call GA4 Data API
    const ga4Response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(ga4Request)
      }
    );

    if (!ga4Response.ok) {
      const errorData = await ga4Response.json().catch(() => ({}));
      const response: GA4Response = {
        ok: false,
        error: `GA4 API Error: ${ga4Response.status}`,
        details: errorData
      };
      
      return new Response(JSON.stringify(response), {
        status: ga4Response.status,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const ga4Data = await ga4Response.json();

    // Process summary metrics
    const summary: Record<string, number> = {};
    if (ga4Data.rows && ga4Data.rows.length > 0) {
      const totalsRow = ga4Data.rows[0];
      metrics.forEach((metric, index) => {
        const value = totalsRow.metricValues?.[index]?.value;
        summary[metric] = value ? parseFloat(value) : 0;
      });
    } else {
      metrics.forEach(metric => {
        summary[metric] = 0;
      });
    }

    const response: GA4Response = {
      ok: true,
      summary,
      rows: ga4Data.rows || [],
      metrics,
      dimensions,
      raw: ga4Data
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('GA4 Function Error:', error);
    
    const response: GA4Response = {
      ok: false,
      error: error.message || 'Unknown error occurred',
      details: error
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