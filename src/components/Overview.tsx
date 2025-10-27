import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, BarChart3, Users } from 'lucide-react';
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Client, Keyword } from '../types';
import { fetchGA4Analytics, GA4AnalyticsData } from '../lib/ga4';
import toast from 'react-hot-toast';

interface OverviewProps {
  selectedClient: Client | null;
  clients: Client[];
  keywords: Keyword[];
}

export function Overview({ selectedClient, clients, keywords }: OverviewProps) {
  const [ga4Data, setGa4Data] = useState<GA4AnalyticsData | null>(null);
  const [isLoadingGA4, setIsLoadingGA4] = useState(false);

  useEffect(() => {
    if (selectedClient) {
      loadGA4Data();
    } else {
      setGa4Data(null);
    }
  }, [selectedClient]);

  const loadGA4Data = async () => {
    setIsLoadingGA4(true);
    try {
      const data = await fetchGA4Analytics();
      setGa4Data(data);
    } catch (error) {
      console.error('Error loading GA4 data:', error);
      // Don't show error toast for GA4 data - it's optional
    } finally {
      setIsLoadingGA4(false);
    }
  };

  const clientKeywords = selectedClient 
    ? keywords.filter(k => k.client_id === selectedClient.id)
    : keywords;

  // Calculate metrics
  const totalKeywords = clientKeywords.length;
  
  const improvements = clientKeywords.filter(k => {
    if (!k.current_month_rank || !k.previous_month_rank) return false;
    return k.previous_month_rank > k.current_month_rank;
  }).length;

  const declines = clientKeywords.filter(k => {
    if (!k.current_month_rank || !k.previous_month_rank) return false;
    return k.previous_month_rank < k.current_month_rank;
  }).length;

  const topRankings = clientKeywords.filter(k => k.current_month_rank && k.current_month_rank <= 10).length;

  const avgCurrentRank = clientKeywords.length > 0 
    ? Math.round(clientKeywords.reduce((sum, k) => sum + (k.current_month_rank || 50), 0) / clientKeywords.length)
    : 0;

  const avgPreviousRank = clientKeywords.length > 0 
    ? Math.round(clientKeywords.reduce((sum, k) => sum + (k.previous_month_rank || 50), 0) / clientKeywords.length)
    : 0;

  // Create keyword comparison data for dual-bar chart
  const keywordComparisonData = clientKeywords.slice(0, 10).map(keyword => ({
    keyword: keyword.text.length > 15 ? keyword.text.substring(0, 15) + '...' : keyword.text,
    previousRank: keyword.previous_month_rank,
    currentRank: keyword.current_month_rank,
    change: keyword.current_month_rank && keyword.previous_month_rank 
      ? keyword.previous_month_rank - keyword.current_month_rank 
      : null
  }));

  const pieData = [
    { name: 'Improvements', value: improvements, color: '#10b981' },
    { name: 'Declines', value: declines, color: '#ef4444' },
    { name: 'No Change', value: clientKeywords.filter(k => {
      if (!k.current_month_rank || !k.previous_month_rank) return false;
      return k.previous_month_rank === k.current_month_rank;
    }).length, color: '#6b7280' }
  ];

  // Agency overview data when no client is selected
  const agencyData = selectedClient ? null : {
    totalClients: clients.length,
    totalKeywords: keywords.length,
    totalImprovements: keywords.filter(k => {
      if (!k.current_month_rank || !k.previous_month_rank) return false;
      return k.previous_month_rank > k.current_month_rank;
    }).length,
    totalDeclines: keywords.filter(k => {
      if (!k.current_month_rank || !k.previous_month_rank) return false;
      return k.previous_month_rank < k.current_month_rank;
    }).length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {selectedClient ? selectedClient.name : 'Agency Overview'}
        </h1>
        {selectedClient && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Domain: {selectedClient.domain}
            {selectedClient.industry && ` • Industry: ${selectedClient.industry}`}
          </div>
        )}
      </div>

      {/* GA4 Analytics Section - Only show for selected client */}
      {selectedClient && ga4Data && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Analytics Overview
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {ga4Data.dateRange.startDate} to {ga4Data.dateRange.endDate}
            </span>
          </div>

          {/* GA4 Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {ga4Data.overview.totalUsers.toLocaleString()}
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
                    {ga4Data.overview.sessions.toLocaleString()}
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
                    {(ga4Data.overview.engagementRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Session Duration</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {Math.round(ga4Data.overview.averageSessionDuration)}s
                  </p>
                </div>
                <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg">
                  <Target className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Traffic Sources Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Traffic Sources</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ga4Data.trafficSources}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis 
                  dataKey="name" 
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
          </div>
        </div>
      )}

      {/* Loading state for GA4 */}
      {selectedClient && isLoadingGA4 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading analytics data...</p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {selectedClient ? 'Total Keywords' : 'Total Clients'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedClient ? totalKeywords : agencyData?.totalClients}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              {selectedClient ? (
                <Target className="w-6 h-6 text-white" />
              ) : (
                <Users className="w-6 h-6 text-white" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {selectedClient ? 'Improvements' : 'Total Keywords'}
              </p>
              <p className="text-2xl font-bold text-green-600">
                {selectedClient ? improvements : agencyData?.totalKeywords}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              {selectedClient ? (
                <TrendingUp className="w-6 h-6 text-white" />
              ) : (
                <Target className="w-6 h-6 text-white" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {selectedClient ? 'Declines' : 'Improvements'}
              </p>
              <p className="text-2xl font-bold text-red-600">
                {selectedClient ? declines : agencyData?.totalImprovements}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-lg">
              {selectedClient ? (
                <TrendingDown className="w-6 h-6 text-white" />
              ) : (
                <TrendingUp className="w-6 h-6 text-white" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {selectedClient ? 'Average Rank' : 'Declines'}
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {selectedClient ? `#${Math.round(avgCurrentRank)}` : agencyData?.totalDeclines}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              {selectedClient ? (
                <BarChart3 className="w-6 h-6 text-white" />
              ) : (
                <TrendingDown className="w-6 h-6 text-white" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {selectedClient ? 'Performance Distribution' : 'Agency Overview'}
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
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
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4">
            {pieData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {entry.name}: {entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Keyword Ranking Comparison</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={keywordComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis 
                dataKey="keyword" 
                stroke="#6b7280"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={12}
                domain={[1, 100]}
                reversed
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#374151'
                }}
                formatter={(value, name) => {
                  if (name === 'previousRank') return [`Rank ${value || 'N/A'}`, 'Previous Month'];
                  if (name === 'currentRank') return [`Rank ${value || 'N/A'}`, 'Current Month'];
                  return [value, name];
                }}
              />
              <Bar 
                dataKey="previousRank" 
                fill="#94a3b8" 
                name="previousRank"
                radius={[2, 2, 0, 0]}
              />
              <Bar 
                dataKey="currentRank" 
                fill="#3b82f6" 
                name="currentRank"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-400"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Previous Month</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Current Month</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}