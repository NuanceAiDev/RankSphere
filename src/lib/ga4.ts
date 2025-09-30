import { BetaAnalyticsDataClient } from '@google-analytics/data';

// GA4 API client configuration
const getGA4Client = () => {
  const clientEmail = import.meta.env.VITE_GA4_CLIENT_EMAIL;
  const privateKey = import.meta.env.VITE_GA4_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    console.warn('GA4 credentials not configured');
    return null;
  }

  try {
    return new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
    });
  } catch (error) {
    console.error('Failed to initialize GA4 client:', error);
    return null;
  }
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
  const client = getGA4Client();
  
  if (!client) {
    throw new Error('GA4 client not configured. Please check your credentials.');
  }

  try {
    // Calculate date range: first day of previous month to today
    const today = new Date();
    const firstDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    const startDate = firstDayOfPreviousMonth.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate,
          endDate,
        },
      ],
      dimensions: [
        { name: 'date' },
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'engagements' },
      ],
      orderBys: [
        {
          dimension: {
            dimensionName: 'date',
          },
          desc: false,
        },
      ],
    });

    const data: GA4Metrics[] = [];
    let totalSessions = 0;
    let totalUsers = 0;
    let totalEngagements = 0;

    if (response.rows) {
      for (const row of response.rows) {
        const date = row.dimensionValues?.[0]?.value || '';
        const source = row.dimensionValues?.[1]?.value || '(direct)';
        const medium = row.dimensionValues?.[2]?.value || '(none)';
        
        const sessions = parseInt(row.metricValues?.[0]?.value || '0');
        const users = parseInt(row.metricValues?.[1]?.value || '0');
        const engagements = parseInt(row.metricValues?.[2]?.value || '0');

        // Format date from YYYYMMDD to YYYY-MM-DD
        const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;

        data.push({
          date: formattedDate,
          sessions,
          users,
          engagements,
          source,
          medium,
        });

        totalSessions += sessions;
        totalUsers += users;
        totalEngagements += engagements;
      }
    }

    return {
      totalSessions,
      totalUsers,
      totalEngagements,
      data,
    };
  } catch (error) {
    console.error('GA4 API Error:', error);
    throw new Error(`Failed to fetch GA4 data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const isGA4Configured = () => {
  return !!(import.meta.env.VITE_GA4_CLIENT_EMAIL && import.meta.env.VITE_GA4_PRIVATE_KEY);
};