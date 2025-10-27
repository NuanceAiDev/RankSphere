import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, MousePointer, RefreshCw, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Client } from '../types';
import { fetchGA4Data } from '../services/ga4';
import toast from 'react-hot-toast';

interface AnalyticsProps {
  selectedClient: Client | null;
}

interface GA4Data {
  totalUsers: number;
  sessions: number;
  engagementRate: number;
  trafficSources: Array<{
    name: string;
    sessions: number;
    color: string;
  }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function Analytics({ selectedClient }: AnalyticsProps) {
  const [ga4Data, setGa4Data] = useState<GA4Data | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (selectedClient) {
      loadGA4Data();
    }
  }, [selectedClient]);

  const loadGA4Data = async () => {
    const propertyId = import.meta.env.VITE_GA4_PROPERTY_ID;
    
    if (!propertyId) {
      setError('GA4 Property ID not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchGA4Data({
        propertyId,
        startDate: "28daysAgo",
        endDate: "yesterday",
        metrics: ["totalUsers", "sessions", "engagementRate"],
        dimensions: ["sessionDefaultChannelGroup"]
      });

      // Process traffic sources from rows
      const trafficSources = response.rows?.map((row: any, index: number) => ({
        name: row.dimensionValues?.[0]?.value || 'Unknown',
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
        color: COLORS[index % COLORS.length]
      })) || [];

      setGa4Data({
        totalUsers: response.summary?.totalUsers || 0,
        sessions: response.summary?.sessions || 0,
        engagementRate: response.summary?.engagementRate || 0,
        trafficSources
      });

      setLastUpdated(new Date().toISOString());
      toast.success('Analytics data refreshed successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshAnalytics = () => {
    loadGA4Data();
  };

  const formatEngagementRate = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  if (!selectedClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Client Selected</h3>
          <p className="text-gray-500 dark:text-gray-400">Select a client to view their analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics for {selectedClient.name}
        </h1>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
          <button
            onClick={handleRefreshAnalytics}
            disabled={isLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Refreshing...' : 'Refresh Analytics'}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Analytics Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-blue-600">
                {ga4Data?.totalUsers.toLocaleString() || '—'}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sessions</p>
              <p className="text-2xl font-bold text-green-600">
                {ga4Data?.sessions.toLocaleString() || '—'}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Engagement Rate</p>
              <p className="text-2xl font-bold text-purple-600">
                {ga4Data ? formatEngagementRate(ga4Data.engagementRate) : '—'}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
              <MousePointer className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Acquisition */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Traffic Acquisition</h3>
        {ga4Data?.trafficSources && ga4Data.trafficSources.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={ga4Data.trafficSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="sessions"
                  >
                    {ga4Data.trafficSources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#374151'
                    }}
                    formatter={(value: number) => [value.toLocaleString(), 'Sessions']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {ga4Data.trafficSources.map((source, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: source.color }}
                    ></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {source.name}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {source.sessions.toLocaleString()} sessions
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No traffic data available</p>
            </div>
          </div>
        )}
      </div>

      {!ga4Data && !isLoading && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Analytics Data</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Click "Refresh Analytics" to fetch the latest data from Google Analytics 4
          </p>
        </div>
      )}
    </div>
  );
}