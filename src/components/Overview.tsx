import React from 'react';
import { TrendingUp, TrendingDown, Target, BarChart3, Users, Award } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Client, Keyword } from '../types';

interface OverviewProps {
  selectedClient: Client | null;
  clients: Client[];
  keywords: Keyword[];
}

export function Overview({ selectedClient, clients, keywords }: OverviewProps) {
  // --- 1. DETERMINE DATA SOURCE ---
  // If a client is selected, filter keywords. If not, use ALL keywords (Agency View).
  const relevantKeywords = selectedClient 
    ? keywords.filter(k => k.client_id === selectedClient.id)
    : keywords;

  // --- 2. CALCULATE METRICS ---
  const totalKeywords = relevantKeywords.length;
  
  const improvements = relevantKeywords.filter(k => {
    if (!k.current_month_rank || !k.previous_month_rank) return false;
    return k.previous_month_rank > k.current_month_rank;
  }).length;

  const declines = relevantKeywords.filter(k => {
    if (!k.current_month_rank || !k.previous_month_rank) return false;
    return k.previous_month_rank < k.current_month_rank;
  }).length;

  const noChange = relevantKeywords.filter(k => {
    if (!k.current_month_rank || !k.previous_month_rank) return false;
    return k.previous_month_rank === k.current_month_rank;
  }).length;

  // Calculate Average Rank (Agency-wide or Client-specific)
  const avgCurrentRank = relevantKeywords.length > 0 
    ? Math.round(relevantKeywords.reduce((sum, k) => sum + (k.current_month_rank || 0), 0) / relevantKeywords.filter(k => k.current_month_rank).length || 1)
    : 0;

  // Calculate Total Top 10 Rankings (High value metric)
  const totalTop10 = relevantKeywords.filter(k => k.current_month_rank && k.current_month_rank <= 10).length;

  // --- 3. PREPARE CHART DATA ---

  // Pie Chart Data (Same for both views)
  const pieData = [
    { name: 'Improved', value: improvements, color: '#10b981' }, // Green
    { name: 'Declined', value: declines, color: '#ef4444' },     // Red
    { name: 'Stable', value: noChange, color: '#6b7280' }        // Gray
  ];

  // Bar Chart Data - LOGIC SPLIT
  let barChartData = [];
  let barChartXKey = '';
  let barChartTitle = '';

  if (selectedClient) {
    // SINGLE CLIENT VIEW: Show specific keyword changes
    barChartTitle = "Keyword Ranking Comparison (Top 10)";
    barChartXKey = "keyword";
    barChartData = relevantKeywords
      .filter(k => k.current_month_rank)
      .sort((a, b) => (a.current_month_rank || 100) - (b.current_month_rank || 100))
      .slice(0, 10)
      .map(keyword => ({
        keyword: keyword.text.length > 15 ? keyword.text.substring(0, 15) + '...' : keyword.text,
        previousRank: keyword.previous_month_rank || 0,
        currentRank: keyword.current_month_rank || 0,
      }));
  } else {
    // AGENCY VIEW: Show Top Clients instead of random keywords
    barChartTitle = "Top Performing Clients (Most #1-10 Rankings)";
    barChartXKey = "name";
    barChartData = clients.map(client => {
      const clientKws = keywords.filter(k => k.client_id === client.id);
      const top10Count = clientKws.filter(k => k.current_month_rank && k.current_month_rank <= 10).length;
      return {
        name: client.name,
        top10Count: top10Count
      };
    })
    .sort((a, b) => b.top10Count - a.top10Count)
    .slice(0, 8); // Show top 8 clients
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {selectedClient ? selectedClient.name : 'Agency Overview'}
        </h1>
        {selectedClient && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Domain: {selectedClient.domain}
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Total Count */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {selectedClient ? 'Total Keywords' : 'Total Clients'}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedClient ? totalKeywords : clients.length}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              {selectedClient ? <Target className="w-6 h-6 text-white" /> : <Users className="w-6 h-6 text-white" />}
            </div>
          </div>
        </div>

        {/* Card 2: Improvements */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Improvements</p>
              <p className="text-2xl font-bold text-green-600">{improvements}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Card 3: Declines */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Declines</p>
              <p className="text-2xl font-bold text-red-600">{declines}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-lg">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* Card 4: High Value Metric */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {selectedClient ? 'Avg Rank' : 'Top 10 Rankings'}
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {selectedClient ? `#${avgCurrentRank}` : totalTop10}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              {selectedClient ? <BarChart3 className="w-6 h-6 text-white" /> : <Award className="w-6 h-6 text-white" />}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Chart: Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {selectedClient ? 'Performance Distribution' : 'Agency Keyword Health'}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
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
                contentStyle={{ backgroundColor: '#f3f4f6', borderRadius: '8px', border: 'none' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4">
            {pieData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {entry.name}: {entry.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Chart: Ranking Comparison or Top Clients */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {barChartTitle}
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis 
                dataKey={barChartXKey} 
                stroke="#6b7280" 
                fontSize={12} 
                angle={-45} 
                textAnchor="end" 
                height={80} 
              />
              <YAxis 
                stroke="#6b7280" 
                fontSize={12} 
                domain={selectedClient ? [0, 100] : [0, 'auto']} 
                reversed={!!selectedClient} // Only reverse rank for single client
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#f3f4f6', borderRadius: '8px', border: 'none' }}
              />
              
              {selectedClient ? (
                <>
                  <Bar dataKey="previousRank" fill="#94a3b8" name="Previous" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="currentRank" fill="#3b82f6" name="Current" radius={[2, 2, 0, 0]} />
                </>
              ) : (
                <Bar dataKey="top10Count" fill="#3b82f6" name="Keywords in Top 10" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}