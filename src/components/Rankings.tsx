import React, { useState } from 'react';
import { Download, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Client, Keyword } from '../types';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { RankTypeToggle } from './RankTypeToggle';

interface RankingsProps {
  selectedClient: Client | null;
  keywords: Keyword[];
  onClientUpdated: () => void;
}

export function Rankings({ selectedClient, keywords, onClientUpdated }: RankingsProps) {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  if (!selectedClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Client Selected</h3>
          <p className="text-gray-500 dark:text-gray-400">Select a client to view their rankings</p>
        </div>
      </div>
    );
  }

  const clientKeywords = keywords.filter(k => k.client_id === selectedClient.id);

  // Calculate improvements vs declines
  const improvements = clientKeywords.filter(k => {
    if (!k.current_month_rank || !k.previous_month_rank) return false;
    return k.previous_month_rank > k.current_month_rank; // Lower rank number = better
  }).length;

  const declines = clientKeywords.filter(k => {
    if (!k.current_month_rank || !k.previous_month_rank) return false;
    return k.previous_month_rank < k.current_month_rank; // Higher rank number = worse
  }).length;

  const noChange = clientKeywords.filter(k => {
    if (!k.current_month_rank || !k.previous_month_rank) return false;
    return k.previous_month_rank === k.current_month_rank;
  }).length;

  const pieData = [
    { name: 'Improvements', value: improvements, color: '#10b981' },
    { name: 'Declines', value: declines, color: '#ef4444' },
    { name: 'No Change', value: noChange, color: '#6b7280' }
  ];

  // Calculate average rankings for trend
  const avgCurrentRank = clientKeywords.length > 0 
    ? clientKeywords.reduce((sum, k) => sum + (k.current_month_rank || 50), 0) / clientKeywords.length
    : 0;

  const avgPreviousRank = clientKeywords.length > 0 
    ? clientKeywords.reduce((sum, k) => sum + (k.previous_month_rank || 50), 0) / clientKeywords.length
    : 0;

  const trendData = [
    { 
      month: 'Previous Month', 
      avgRank: Math.round(avgPreviousRank),
      keywordsWithData: clientKeywords.filter(k => k.previous_month_rank).length
    },
    { 
      month: 'Current Month', 
      avgRank: Math.round(avgCurrentRank),
      keywordsWithData: clientKeywords.filter(k => k.current_month_rank).length
    }
  ];

  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const pdf = new jsPDF();
      
      // Header with RankSphere branding
      pdf.setFontSize(24);
      pdf.setTextColor(59, 130, 246); // Blue color
      pdf.text('RankSphere', 20, 30);
      
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text('SEO Rankings Report', 20, 45);
      
      // Client info
      pdf.setFontSize(12);
      pdf.text(`Client: ${selectedClient.name}`, 20, 65);
      pdf.text(`Domain: ${selectedClient.domain}`, 20, 75);
      if (selectedClient.industry) {
        pdf.text(`Industry: ${selectedClient.industry}`, 20, 85);
      }
      pdf.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, 20, selectedClient.industry ? 95 : 85);
      
      // Summary stats
      const yStart = selectedClient.industry ? 105 : 95;
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Performance Summary', 20, yStart);
      
      // Create performance summary table
      const summaryTableY = yStart + 15;
      
      // Table headers
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Metric', 30, summaryTableY);
      pdf.text('Value', 120, summaryTableY);
      
      // Draw header line
      pdf.line(25, summaryTableY + 3, 160, summaryTableY + 3);
      
      // Table rows
      let rowY = summaryTableY + 15;
      
      // Total Keywords
      pdf.setTextColor(0, 0, 0);
      pdf.text('Total Keywords', 30, rowY);
      pdf.text(`${clientKeywords.length}`, 120, rowY);
      rowY += 12;
      
      // Improvements
      pdf.setTextColor(16, 185, 129); // Green
      pdf.text('Improvements', 30, rowY);
      pdf.text(`${improvements}`, 120, rowY);
      rowY += 12;
      
      // Declines
      pdf.setTextColor(239, 68, 68); // Red
      pdf.text('Declines', 30, rowY);
      pdf.text(`${declines}`, 120, rowY);
      rowY += 12;
      
      // No Change
      pdf.setTextColor(107, 114, 128); // Gray
      pdf.text('No Change', 30, rowY);
      pdf.text(`${noChange}`, 120, rowY);
      
      // Draw table border
      pdf.rect(25, summaryTableY - 5, 135, rowY - summaryTableY + 10);
      
      // Keywords table header
      const tableStart = rowY + 25;
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Keyword Rankings', 20, tableStart);
      
      // Table headers
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Keyword', 20, tableStart + 15);
      pdf.text('Previous Rank', 80, tableStart + 15);
      pdf.text('Current Rank', 120, tableStart + 15);
      pdf.text('Change', 160, tableStart + 15);
      pdf.text('Last Updated', 180, tableStart + 15);
      
      // Draw header line
      pdf.line(20, tableStart + 18, 200, tableStart + 18);
      
      let yPosition = tableStart + 25;
      clientKeywords.forEach((keyword, index) => {
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 30;
        }
        
        const rankChange = keyword.current_month_rank && keyword.previous_month_rank
          ? keyword.previous_month_rank - keyword.current_month_rank
          : null;
        
        pdf.setFontSize(8);
        
        // Truncate long keywords
        const truncatedKeyword = keyword.text.length > 25 
          ? keyword.text.substring(0, 25) + '...' 
          : keyword.text;
        
        pdf.text(truncatedKeyword, 20, yPosition);
        pdf.text(keyword.previous_month_rank ? `#${keyword.previous_month_rank}` : '—', 80, yPosition);
        pdf.text(keyword.current_month_rank ? `#${keyword.current_month_rank}` : '—', 120, yPosition);
        
        if (rankChange !== null) {
          if (rankChange > 0) {
            pdf.setTextColor(16, 185, 129); // Green
            pdf.text(`+${rankChange}`, 160, yPosition);
          } else if (rankChange < 0) {
            pdf.setTextColor(239, 68, 68); // Red
            pdf.text(`${rankChange}`, 160, yPosition);
          } else {
            pdf.setTextColor(107, 114, 128); // Gray
            pdf.text('0', 160, yPosition);
          }
          pdf.setTextColor(0, 0, 0); // Reset to black
        } else {
          pdf.text('—', 160, yPosition);
        }
        
        pdf.text(
          keyword.last_checked 
            ? format(new Date(keyword.last_checked), 'MMM d')
            : '—', 
          180, 
          yPosition
        );
        
        yPosition += 8;
      });
      
      // Save the PDF
      const fileName = `${selectedClient.name}-rankings-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);
      toast.success('Report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Rankings for {selectedClient.name}
        </h1>
        <button
          onClick={generateReport}
          disabled={isGeneratingReport || clientKeywords.length === 0}
          className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
        >
          <Download className="w-4 h-4" />
          {isGeneratingReport ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      <RankTypeToggle client={selectedClient} onUpdate={onClientUpdated} />

      {clientKeywords.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Keywords to Track</h3>
          <p className="text-gray-500 dark:text-gray-400">Add keywords in the Keywords tab to start tracking rankings</p>
        </div>
      ) : (
        <>
          {/* Performance Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Distribution</h3>
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ranking Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                  <XAxis 
                    dataKey="month" 
                    stroke="#6b7280"
                    fontSize={12}
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
                    formatter={(value, name) => [
                      `Rank ${value}`,
                      'Average Ranking'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgRank" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Rank</p>
                  <p className="text-2xl font-bold text-blue-600">#{Math.round(avgCurrentRank)}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                  <Target className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Rankings Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Keyword Rankings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Keyword
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Previous Month
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Current Month
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Change
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Last Checked
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {clientKeywords.map((keyword) => {
                    const rankChange = keyword.current_month_rank && keyword.previous_month_rank
                      ? keyword.previous_month_rank - keyword.current_month_rank
                      : null;

                    return (
                      <tr key={keyword.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {keyword.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                              keyword.previous_month_rank 
                                ? keyword.previous_month_rank <= 10 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : keyword.previous_month_rank <= 30
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {keyword.previous_month_rank ? `#${keyword.previous_month_rank}` : '—'}
                            </span>
                            {keyword.previous_month_date && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {format(new Date(keyword.previous_month_date), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                              keyword.current_month_rank 
                                ? keyword.current_month_rank <= 10 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : keyword.current_month_rank <= 30
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {keyword.current_month_rank ? `#${keyword.current_month_rank}` : 'Not ranked'}
                            </span>
                            {keyword.current_month_date && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {format(new Date(keyword.current_month_date), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {rankChange !== null ? (
                            <div className={`flex items-center gap-2 ${
                              rankChange > 0 ? 'text-green-600' : rankChange < 0 ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              {rankChange > 0 ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : rankChange < 0 ? (
                                <TrendingDown className="w-4 h-4" />
                              ) : (
                                <span className="w-4 h-4 text-center">→</span>
                              )}
                              <span className="text-sm font-medium">
                                {rankChange > 0 ? `+${rankChange}` : rankChange < 0 ? rankChange : '0'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {keyword.last_checked 
                              ? format(new Date(keyword.last_checked), 'MMM d, HH:mm')
                              : 'Never'
                            }
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}