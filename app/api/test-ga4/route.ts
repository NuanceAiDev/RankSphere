import { NextRequest, NextResponse } from 'next/server';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export async function GET(request: NextRequest) {
  try {
    // Read credentials from environment variables
    const clientEmail = process.env.GA4_CLIENT_EMAIL;
    const privateKey = process.env.GA4_PRIVATE_KEY;
    
    if (!clientEmail || !privateKey) {
      return NextResponse.json({
        success: false,
        message: "GA4 connection failed ❌",
        error: "Missing GA4_CLIENT_EMAIL or GA4_PRIVATE_KEY environment variables"
      }, { status: 400 });
    }

    // Fix private key formatting
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    // Initialize GA4 client
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: formattedPrivateKey,
      },
    });

    // Set property ID (replace with actual property ID)
    const propertyId = "YOUR_GA4_PROPERTY_ID";

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

    return NextResponse.json({
      success: true,
      message: "GA4 connection successful ✅",
      metrics,
      dateRange: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      },
      propertyId
    });

  } catch (error: any) {
    console.error('GA4 API Error:', error);
    
    return NextResponse.json({
      success: false,
      message: "GA4 connection failed ❌",
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}