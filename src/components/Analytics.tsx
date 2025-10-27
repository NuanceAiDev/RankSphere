import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, MousePointer, RefreshCw, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Client } from '../types';
import { fetchGA4Data } from '../services/ga4';
import toast from 'react-hot-toast';

interface AnalyticsProps {
  selectedClient: Client | null;
}

interface GA4Overview {
  totalUsers: number;
  sessions: number;
  engagementRate: number;
  averageSessionDuration: number;
}

interface GA4TrafficSource {
  source: string;
  sessions: number;
  color: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function Analytics({ selectedClient }: AnalyticsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<GA4Overview | null>(null);
  const [trafficSources, setTrafficSources] = useState<GA4TrafficSource[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Resolve GA4 property ID in priority order
  const propertyId = selectedClient?.ga4_property_id || import.meta.env.VITE_GA4_PROPERTY_ID || null;

  const handleRefresh = async () => {
    if (!propertyId) {
      setError('GA4 Property ID not configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchGA4Data({ 
        propertyId, 
        startDate: "30daysAgo", 
        endDate: "today" 
      });

      setOverview(result.overview || null);
      
      // Add colors to traffic sources
      const sourcesWithColors = (result.trafficSources || []).map((source, index) => ({
        ...source,
        color: COLORS[index % COLORS.length]
      }));
      setTrafficSources(sourcesWithColors);

      setLastUpdated(new Date().toISOString());
      toast.success('Analytics data refreshed successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Auto-run on mount and when propertyId changes
  useEffect(() => {
    if (propertyId) {
      handleRefresh();
    }
  }, [propertyId]);

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
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh Analytics'}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-blue-600">
                {overview?.totalUsers?.toLocaleString() || '—'}
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
                {overview?.sessions?.toLocaleString() || '—'}
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
                {overview ? formatEngagementRate(overview.engagementRate) : '—'}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
              <MousePointer className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Session Duration</p>
              <p className="text-2xl font-bold text-orange-600">
                {overview ? `${Math.round(overview.averageSessionDuration)}s` : '—'}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Acquisition */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Traffic Acquisition</h3>
        {trafficSources && trafficSources.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={trafficSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="sessions"
                  >
                    {trafficSources.map((entry, index) => (
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
              {trafficSources.map((source, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: source.color }}
                    ></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {source.source}
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
    </div>
  );
}