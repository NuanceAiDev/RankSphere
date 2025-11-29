import React, { useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, BarChart3, Users, Award } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Client, Keyword } from '../types';

interface OverviewProps {
  selectedClient: Client | null;
  clients: Client[];
  keywords: Keyword[];
}

export function Overview({ selectedClient, clients, keywords }: OverviewProps) {
  // --- DEBUGGING LOG ---
  useEffect(() => {
    console.log("Overview Component Debug:");
    console.log("Selected Client:", selectedClient?.name || "None (Agency View)");
    console.log("Total Keywords passed:", keywords.length);
    console.log("Sample Keyword:", keywords[0]);
  }, [selectedClient, keywords]);

  // --- 1. DETERMINE DATA SOURCE ---
  // Explicitly handle the null check to ensure we get ALL keywords for Agency View
  const relevantKeywords = selectedClient 
    ? keywords.filter(k => k.client_id === selectedClient.id)
    : keywords; // Use ALL keywords if no client selected

  // --- 2. CALCULATE METRICS ---
  const totalKeywords = relevantKeywords.length;
  
  // Calculate improvements (lower rank number = better position)
  const improvements = relevantKeywords.filter(k => {
    const current = k.current_month_rank;
    const previous = k.previous_month_rank;
    // Both values must exist and be valid numbers
    if (!current || !previous || current <= 0 || previous <= 0) return false;
    // Improvement means current rank is lower (better) than previous rank
    return current < previous;
  }).length;

  const declines = relevantKeywords.filter(k => {
    const current = k.current_month_rank;
    const previous = k.previous_month_rank;
    if (!current || !previous || current <= 0 || previous <= 0) return false;
    // Decline means current rank is higher (worse) than previous rank
    return current > previous;
  }).length;

  const noChange = relevantKeywords.filter(k => {
    const current = k.current_month_rank;
    const previous = k.previous_month_rank;
    if (!current || !previous || current <= 0 || previous <= 0) return false;
    // No change means ranks are exactly the same
    return current === previous;
  }).length;

  // --- 3. DETERMINE CHART STATE ---
  // If we have trends (up/down/stable), show the Trend Chart.
  // If everything is 0 (new data), show the Ranking Distribution Chart instead.
  const hasTrendData = improvements > 0 || declines > 0 || noChange > 0;

  // Ranking Distribution (Fallback Logic)
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

  // --- 4. PREPARE CHART DATA ---
  let pieData = [];
  let pieTitle = "";

  if (hasTrendData) {
    pieTitle = selectedClient ? 'Performance Trends' : 'Agency Trend Health';
    pieData = [
      { name: 'Improved', value: improvements, color: '#10b981' }, 
      { name: 'Declined', value: declines, color: '#ef4444' },     
      { name: 'Stable', value: noChange, color: '#6b7280' }        
    ];
  } else {
    // FALLBACK: If no trend data, show Current Rankings so the chart isn't empty
    pieTitle = selectedClient ? 'Current Rankings' : 'Agency Rankings Overview';
    pieData = [
      { name: 'Top 3', value: rank1to3, color: '#3b82f6' },        
      { name: 'Top 4-10', value: rank4to10, color: '#10b981' },    
      { name: 'Top 11-30', value: rank11to30, color: '#f59e0b' },  
      { name: 'Top 30+', value: rank31plus, color: '#9ca3af' },    
      { name: 'Not Ranked', value: notRanked, color: '#ef4444' }   
    ].filter(d => d.value > 0); 
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
    barChartTitle = "Top Performing Clients (Most Top 10 Rankings)";
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
        
        {/* Card 1: Total Keywords */}
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
        
        {/* Left Chart: Distribution/Trends */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {pieTitle}
          </h3>
          
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
            <div className="h-[300px] flex flex-col items-center justify-center text-gray-400">
              <BarChart3 className="w-12 h-12 mb-2 opacity-20" />
              <p>No ranking data available yet.</p>
              <p className="text-sm mt-1">Add keywords and fetch rankings to see data.</p>
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