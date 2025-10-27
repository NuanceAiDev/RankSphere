import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, MousePointer, RefreshCw, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Client, GA4Summary } from '../types';
import { fetchGA4Analytics, isSupabaseConfigured } from '../lib/ga4';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

interface AnalyticsProps {
  selectedClient: Client | null;
}

interface GA4Report {
  id: string;
  client_id: string;
  date: string;
  sessions: number;
  users: number;
  engagements: number;
  source: string;
  medium: string;
  created_at: string;
  updated_at: string;
}

export function Analytics({ selectedClient }: AnalyticsProps) {
  const [ga4Data, setGa4Data] = useState<GA4Summary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (selectedClient) {
      loadStoredGA4Data();
    }
  }, [selectedClient]);

  const loadStoredGA4Data = async () => {
    if (!selectedClient) return;

    try {
      const { data, error } = await supabase
        .from('ga4_reports')
        .select('*')
        .eq('client_id', selectedClient.id)
        .order('date', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Convert stored data to GA4Summary format
        const reports = data as GA4Report[];
        const totalSessions = reports.reduce((sum, report) => sum + report.sessions, 0);
        const totalUsers = reports.reduce((sum, report) => sum + report.users, 0);
        const totalEngagements = reports.reduce((sum, report) => sum + report.engagements, 0);

        const ga4Summary: GA4Summary = {
          totalSessions,
          totalUsers,
          totalEngagements,
          data: reports.map(report => ({
            date: report.date,
            sessions: report.sessions,
            users: report.users,
            engagements: report.engagements,
            source: report.source,
            medium: report.medium,
          })),
        };

        setGa4Data(ga4Summary);
        setLastUpdated(reports[0]?.updated_at);
      }
    } catch (error) {
      console.error('Error loading stored GA4 data:', error);
    }
  };

  const handleRefreshAnalytics = async () => {
    if (!selectedClient?.ga4_property_id) {
      toast.error('GA4 Property ID not configured for this client');
      return;
    }

    if (!isGA4Configured()) {
      toast.error('GA4 credentials not configured. Please check your environment variables.');
      return;
    }

    setIsLoading(true);
    try {
      toast.loading('Fetching GA4 data...', { id: 'ga4-fetch' });

      const freshData = await fetchGA4Data(selectedClient.ga4_property_id);
      
      // Store fresh data in Supabase
      if (freshData.data.length > 0) {
        // Delete existing data for this client to avoid duplicates
        await supabase
          .from('ga4_reports')
          .delete()
          .eq('client_id', selectedClient.id);

        // Insert fresh data
        const reportsToInsert = freshData.data.map(item => ({
          client_id: selectedClient.id,
          date: item.date,
          sessions: item.sessions,
          users: item.users,
          engagements: item.engagements,
          source: item.source,
          medium: item.medium,
        }));

        const { error } = await supabase
          .from('ga4_reports')
          .insert(reportsToInsert);

        if (error) throw error;
      }

      setGa4Data(freshData);
      setLastUpdated(new Date().toISOString());
      toast.dismiss('ga4-fetch');
      toast.success('GA4 data refreshed successfully!');
    } catch (error) {
      console.error('Error fetching GA4 data:', error);
      toast.dismiss('ga4-fetch');
      toast.error(error instanceof Error ? error.message : 'Failed to fetch GA4 data');
    } finally {
      setIsLoading(false);
    }
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

  if (!selectedClient.ga4_property_id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics for {selectedClient.name}
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">GA4 Not Configured</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            This client doesn't have a Google Analytics 4 Property ID configured.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Edit the client to add their GA4 Property ID and enable analytics reporting.
          </p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const trafficSourceData = ga4Data ? 
    Object.entries(
      ga4Data.data.reduce((acc, item) => {
        const key = `${item.source} / ${item.medium}`;
        if (!acc[key]) {
          acc[key] = { source: key, sessions: 0, users: 0, engagements: 0 };
        }
        acc[key].sessions += item.sessions;
        acc[key].users += item.users;
        acc[key].engagements += item.engagements;
        return acc;
      }, {} as Record<string, { source: string; sessions: number; users: number; engagements: number }>)
    ).map(([_, data]) => data).slice(0, 10) : [];

  const engagementTrendData = ga4Data ?
    Object.entries(
      ga4Data.data.reduce((acc, item) => {
        if (!acc[item.date]) {
          acc[item.date] = { date: item.date, sessions: 0, engagements: 0 };
        }
        acc[item.date].sessions += item.sessions;
        acc[item.date].engagements += item.engagements;
        return acc;
      }, {} as Record<string, { date: string; sessions: number; engagements: number }>)
    ).map(([_, data]) => ({
      ...data,
      formattedDate: format(parseISO(data.date), 'MMM d')
    })).sort((a, b) => a.date.localeCompare(b.date)) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics for {selectedClient.name}
        </h1>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {format(parseISO(lastUpdated), 'MMM d, HH:mm')}
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sessions</p>
              <p className="text-2xl font-bold text-blue-600">
                {ga4Data?.totalSessions.toLocaleString() || '—'}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-green-600">
                {ga4Data?.totalUsers.toLocaleString() || '—'}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Engagements</p>
              <p className="text-2xl font-bold text-purple-600">
                {ga4Data?.totalEngagements.toLocaleString() || '—'}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
              <MousePointer className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Traffic Acquisition</h3>
          {trafficSourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trafficSourceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis 
                  dataKey="source" 
                  stroke="#6b7280"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#374151'
                  }}
                />
                <Bar dataKey="sessions" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              No traffic data available
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Engagement Trend</h3>
          {engagementTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={engagementTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis 
                  dataKey="formattedDate" 
                  stroke="#6b7280"
                  fontSize={12}
                />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#374151'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sessions" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  name="Sessions"
                />
                <Line 
                  type="monotone" 
                  dataKey="engagements" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="Engagements"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
              No engagement data available
            </div>
          )}
        </div>
      </div>

      {!ga4Data && !isLoading && (
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