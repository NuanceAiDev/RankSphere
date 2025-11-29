import React from 'react';
import { TrendingUp, TrendingDown, Target, BarChart3, Users, Award, PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Client, Keyword } from '../types';

interface OverviewProps {
  selectedClient: Client | null;
  clients: Client[];
  keywords: Keyword[];
}

export function Overview({ selectedClient, clients, keywords }: OverviewProps) {
  // --- 1. DETERMINE DATA SOURCE ---
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

  // Check if we actually have trend data (to decide which chart to show)
  const hasTrendData = improvements > 0 || declines > 0 || noChange > 0;

  // Calculate Ranking Distribution (Fallback for when there's no history yet)
  const rank1to3 = relevantKeywords.filter(k => k.current_month_rank && k.current_month_rank <= 3).length;
  const rank4to10 = relevantKeywords.filter(k => k.current_month_rank && k.current_month_rank > 3 && k.current_month_rank <= 10).length;
  const rank11to30 = relevantKeywords.filter(k => k.current_month_rank && k.current_month_rank > 10 && k.current_month_rank <= 30).length;
  const rank31plus = relevantKeywords.filter(k => k.current_month_rank && k.current_month_rank > 30).length;
  const notRanked = relevantKeywords.filter(k => !k.current_month_rank).length;

  // Calculate Average Rank
  const rankedKeywords = relevantKeywords.filter(k => k.current_month_rank);
  const avgCurrentRank = rankedKeywords.length > 0 
    ? Math.round(rankedKeywords.reduce((sum, k) => sum + (k.current_month_rank || 0), 0) / rankedKeywords.length)
    : 0;

  const totalTop10 = relevantKeywords.filter(k => k.current_month_rank && k.current_month_rank <= 10).length;

  // --- 3. PREPARE CHART DATA ---

  // Pie Chart Data Logic
  let pieData = [];
  let pieTitle = "";

  // If we have movement data (improvements/declines), show that.
  // If not (new account), show the static ranking distribution instead of an empty chart.
  if (hasTrendData) {
    pieTitle = selectedClient ? 'Performance Distribution' : 'Agency Keyword Trends';
    pieData = [
      { name: 'Improved', value: improvements, color: '#10b981' }, // Green
      { name: 'Declined', value: declines, color: '#ef4444' },     // Red
      { name: 'Stable', value: noChange, color: '#6b7280' }        // Gray
    ];
  } else {
    pieTitle = selectedClient ? 'Current Rankings' : 'Agency Ranking Distribution';
    pieData = [
      { name: 'Top 3', value: rank1to3, color: '#3b82f6' },        // Blue
      { name: 'Top 4-10', value: rank4to10, color: '#10b981' },    // Green
      { name: 'Top 11-30', value: rank11to30, color: '#f59e0b' },  // Yellow
      { name: 'Top 30+', value: rank31plus, color: '#9ca3af' },    // Light Gray
      { name: 'Not Ranked', value: notRanked, color: '#ef4444' }   // Red
    ].filter(d => d.value > 0); // Hide empty segments
  }

  // Bar Chart Data
  let barChartData = [];
  let barChartXKey = '';
  let barChartTitle = '';

  if (selectedClient) {
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
    barChartTitle = "Top Performing Clients (Most #1-10 Rankings)";
    barChartXKey = "name";
    barChartData = clients.map(client => {
      const clientKws = keywords.filter(k => k.client_id === client.id);
      const top10Count = clientKws.filter(k => k.current_month_rank && k.current_month_rank <= 10).length;
      return {
        name: client.name.length > 15 ? client.name.substring(0, 15) + '...' : client.name,
        top10Count: top10Count
      };
    })
    .sort((a, b) => b.top10Count - a.top10Count)
    .slice(0, 8);
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
        
        {/* Card 1: Total Keywords (Always useful) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Keywords</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalKeywords}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Target className="w-6 h-6 text-white" />
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
            {pieTitle}
          </h3>
          
          {/* Check if data exists to prevent empty graph */}
          {pieData.length > 0 ? (
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
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              <p>No ranking data available yet</p>
            </div>
          )}
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
                reversed={!!selectedClient} 
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