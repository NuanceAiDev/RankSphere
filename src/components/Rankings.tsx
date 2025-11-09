import React, { useState } from 'react';
import { Download, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Client, Keyword } from '../types';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { RankTypeToggle } from './RankTypeToggle';
import { markReportAsDone, isReportDone } from '../utils/reportStatus';

interface RankingsProps {
  selectedClient: Client | null;
  keywords: Keyword[];
  onClientUpdated: () => void;
}

export function Rankings({ selectedClient, keywords, onClientUpdated }: RankingsProps) {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  // Check report status when client changes
  React.useEffect(() => {
    if (selectedClient) {
      setReportDone(isReportDone(selectedClient.name));
    } else {
      setReportDone(false);
    }
  }, [selectedClient]);

  // Check if client has report marked done for current month
  const hasReportDoneThisMonth = (): boolean => reportDone;

  const handleMarkAsDone = async () => {
    if (!selectedClient) return;
    
    setIsMarkingDone(true);
    try {
      // Mark report as done in localStorage
      markReportAsDone(selectedClient.name);
      setReportDone(true);
      toast.success('✅ Report marked as done!');
    } catch (error) {
      console.error('Error marking report as done:', error);
      toast.error('❌ Failed to mark report as done');
    } finally {
      setIsMarkingDone(false);
    }
  };

  // Helper function to convert number to ordinal (1st, 2nd, 3rd, etc.)
  const toOrdinal = (num: number): string => {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  };

  // Helper function to get ranking color
  const getRankingColor = (currentRank: number | null, previousRank: number | null): [number, number, number] => {
    if (!currentRank) return [128, 128, 128]; // Gray for no rank
    
    if (previousRank && currentRank < previousRank) {
      return [16, 185, 129]; // Green for improvement
    } else if (previousRank && currentRank > previousRank) {
      return [239, 68, 68]; // Red for decline
    }
    
    return [0, 0, 0]; // Black for no change or first time
  };

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
      // Fetch analytics screenshots
      const fetchAnalyticsScreenshots = async (): Promise<string[]> => {
        try {
          const clientSlug = selectedClient.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
          
          const monthPath = format(new Date(), 'yyyy-MM');
          const folderPath = `${clientSlug}/${monthPath}`;

          const { data: files, error } = await supabase.storage
            .from('analytics_screenshots')
            .list(folderPath);

          if (error || !files) {
            console.warn('No analytics screenshots found:', error);
            return [];
          }

          const imageFiles = files.filter(file => 
            file.name !== '.keep' && 
            /\.(jpg|jpeg|png|webp)$/i.test(file.name)
          );

          const urls = imageFiles.map(file => {
            const { data } = supabase.storage
              .from('analytics_screenshots')
              .getPublicUrl(`${folderPath}/${file.name}`);
            // Add cache busting parameter to ensure fresh images in reports
            const separator = data.publicUrl.includes('?') ? '&' : '?';
            return `${data.publicUrl}${separator}t=${Date.now()}`;
          });

          return urls;
        } catch (error) {
          console.warn('Error fetching analytics screenshots:', error);
          return [];
        }
      };

      const analyticsScreenshots = await fetchAnalyticsScreenshots();
      
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      
      // Calculate date ranges
      const currentDate = new Date();
      const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      
      const currentMonthLabel = format(currentMonth, 'MMM-yy');
      const previousMonthLabel = format(previousMonth, 'MMM-yy');
      
      // Format period as "Oct – Nov 2025"
      const periodText = `${format(previousMonth, 'MMM')} – ${format(currentMonth, 'MMM yyyy')}`;
      
      // ===== FIRST PAGE - PROFESSIONAL COVER =====
      
      // Header Section with actual logo
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        
        const loadLogo = new Promise((resolve) => {
          logoImg.onload = async () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = logoImg.width;
              canvas.height = logoImg.height;
              ctx.drawImage(logoImg, 0, 0);
              
              const logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
              pdf.addImage(logoDataUrl, 'JPEG', margin, 15, 20, 0);
              resolve(true);
            } catch (error) {
              console.warn('Logo processing failed:', error);
              pdf.setFontSize(14);
              pdf.setTextColor(4, 140, 212);
              pdf.text('Nuance Digital', margin, 35);
              resolve(true);
            }
          };
          logoImg.onerror = async () => {
            console.warn('Logo loading failed, using text fallback');
            pdf.setFontSize(14);
            pdf.setTextColor(4, 140, 212);
            pdf.text('Nuance Digital', margin, 35);
            resolve(true);
          };
          logoImg.src = '/pp.jpg';
        });
        
        await loadLogo;
      } catch (error) {
        console.warn('Logo loading error:', error);
        pdf.setFontSize(14);
        pdf.setTextColor(4, 140, 212);
        pdf.text('Nuance Digital', margin, 35);
      }
      
      // Title section (top-right)
      pdf.setFontSize(18);
      pdf.setTextColor(4, 140, 212);
      const titleX = pageWidth - margin;
      pdf.text('Nuance Digital Solutions', titleX, 25, { align: 'right' });
      
      pdf.setFontSize(14);
      pdf.setTextColor(85, 85, 85);
      pdf.text('Monthly SEO Report', titleX, 40, { align: 'right' });
      
      // Header divider line
      pdf.setDrawColor(224, 224, 224);
      pdf.setLineWidth(0.5);
      pdf.line(margin, 55, pageWidth - margin, 55);
      
      // Report Information Section (Centered)
      const centerX = pageWidth / 2;
      const infoStartY = 100;
      const lineSpacing = 18; // Reduced from default spacing
      
      // Client Name
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Client:', centerX - 50, infoStartY, { fontStyle: 'bold' });
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text(selectedClient.name, centerX + 10, infoStartY, { fontStyle: 'bold' });
      
      // Website URL
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Website:', centerX - 50, infoStartY + lineSpacing, { fontStyle: 'bold' });
      pdf.setFontSize(14);
      pdf.setTextColor(4, 140, 212);
      pdf.text(`https://${selectedClient.domain}`, centerX + 10, infoStartY + lineSpacing, { fontStyle: 'bold' });
      
      // Report Period
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Period:', centerX - 50, infoStartY + (lineSpacing * 2), { fontStyle: 'bold' });
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text(periodText, centerX + 10, infoStartY + (lineSpacing * 2), { fontStyle: 'bold' });
      
      // Accent bars at bottom
      pdf.setFillColor(251, 194, 16);
      pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
      pdf.setFillColor(4, 140, 212);
      pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
      
      // Footer Section
      const coverFooterY = pageHeight - 45;
      
      pdf.setFontSize(14);
      pdf.setTextColor(102, 102, 102);
      pdf.text('Helping Your Business Grow', centerX, coverFooterY, { 
        align: 'center',
        fontStyle: 'bolditalic'
      });
      
      pdf.setFontSize(10);
      pdf.setTextColor(102, 102, 102);
      pdf.text('Prepared by Nuance Digital Solutions', centerX, coverFooterY + 12, { align: 'center' });
      
      // Add new page for table
      pdf.addPage();
      
      // Add borders to new page
      pdf.setFillColor(251, 194, 16);
      pdf.rect(0, 0, 8, pageHeight, 'F');
      pdf.rect(pageWidth - 8, 0, 8, pageHeight, 'F');
      pdf.setFillColor(4, 140, 212);
      pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
      
      // Header with logo and client info
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        
        const loadPageLogo = new Promise((resolve) => {
          logoImg.onload = async () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = logoImg.width;
              canvas.height = logoImg.height;
              ctx.drawImage(logoImg, 0, 0);
              
              const logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
              pdf.addImage(logoDataUrl, 'JPEG', margin, 15, 20, 0);
              resolve(true);
            } catch (error) {
              pdf.setFontSize(12);
              pdf.setTextColor(4, 140, 212);
              pdf.text('Nuance', margin, 20);
              resolve(true);
            }
          };
          logoImg.onerror = async () => {
            pdf.setFontSize(12);
            pdf.setTextColor(4, 140, 212);
            pdf.text('Nuance', margin, 20);
            resolve(true);
          };
          logoImg.src = '/pp.jpg';
        });
        
        await loadPageLogo;
      } catch (error) {
        pdf.setFontSize(12);
        pdf.setTextColor(4, 140, 212);
        pdf.text('Nuance', margin, 20);
      }
      
      pdf.setTextColor(128, 128, 128);
      pdf.text(`${selectedClient.name} – ${format(new Date(), 'MMM dd, yyyy')}`, pageWidth - 80, 20);
      pdf.text('1', pageWidth - margin, pageHeight - 15);
      
      // Google Ranking section
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Google Ranking', margin, 50);
      
      pdf.setFontSize(12);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Showing ${clientKeywords.length} of ${clientKeywords.length} Rows`, margin, 65);
      
      // Table header
      const tableStartY = 80;
      const colWidths = [95, 40, 40];
      const rowHeight = 12;
      
      // Header background
      pdf.setFillColor(128, 128, 128); 
      const tableWidth = colWidths[0] + colWidths[1] + colWidths[2];
      const tableStartX = margin + 4;
      pdf.rect(tableStartX, tableStartY - 5, tableWidth, rowHeight + 2, 'F');
      
      // Header text
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.text('Keyword', tableStartX + 3, tableStartY + 5);
      pdf.text(previousMonthLabel, tableStartX + colWidths[0] + 3, tableStartY + 5);
      pdf.text(currentMonthLabel, tableStartX + colWidths[0] + colWidths[1] + 3, tableStartY + 5);
      
      let currentY = tableStartY + rowHeight + 5;
      let pageNumber = 1;
      
      // Table rows
      for (const [index, keyword] of clientKeywords.entries()) {
        // Check if we need a new page
        if (currentY > pageHeight - 40) {
          pdf.addPage();
          pageNumber++;
          
          // Add borders to new page
          pdf.setFillColor(251, 194, 16);
          pdf.rect(0, 0, 8, pageHeight, 'F');
          pdf.rect(pageWidth - 8, 0, 8, pageHeight, 'F');
          pdf.setFillColor(4, 140, 212);
          pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
          
          // Header for additional pages
          pdf.setFontSize(12);
          pdf.setTextColor(4, 140, 212);
          pdf.text('Nuance Digital', margin, 20);
          
          pdf.setTextColor(128, 128, 128);
          pdf.text(`${selectedClient.name} – ${format(new Date(), 'MMM dd, yyyy')}`, pageWidth - 80, 20);
          pdf.text(pageNumber.toString(), pageWidth - margin, pageHeight - 15);
          
          currentY = 40;
        }
        
        // Row background (alternating)
        if (index % 2 === 0) {
          pdf.setFillColor(245, 245, 245);
          pdf.rect(tableStartX, currentY - 8, tableWidth, rowHeight, 'F');
        }
        
        // Keyword name
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        const truncatedKeyword = keyword.text.length > 25 ? keyword.text.substring(0, 25) + '...' : keyword.text;
        pdf.text(truncatedKeyword, tableStartX + 3, currentY);
        
        // Previous month rank
        pdf.setTextColor(0, 0, 0);
        const previousRankText = keyword.previous_month_rank ? toOrdinal(keyword.previous_month_rank) : '—';
        pdf.text(previousRankText, tableStartX + colWidths[0] + 3, currentY);
        
        // Current month rank
        const currentRankColor = getRankingColor(keyword.current_month_rank, keyword.previous_month_rank);
        pdf.setTextColor(currentRankColor[0], currentRankColor[1], currentRankColor[2]);
        const currentRankText = keyword.current_month_rank ? toOrdinal(keyword.current_month_rank) : '—';
        pdf.text(currentRankText, tableStartX + colWidths[0] + colWidths[1] + 3, currentY);
        
        currentY += rowHeight;
      }
      
      // Add Analytics Screenshots Section if any exist
      if (analyticsScreenshots.length > 0) {
        pdf.addPage();
        pageNumber++;
        
        // Add borders to new page
        pdf.setFillColor(251, 194, 16);
        pdf.rect(0, 0, 8, pageHeight, 'F');
        pdf.rect(pageWidth - 8, 0, 8, pageHeight, 'F');
        pdf.setFillColor(4, 140, 212);
        pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
        
        // Header for analytics page
        pdf.setFontSize(12);
        pdf.setTextColor(4, 140, 212);
        pdf.text('Nuance', margin, 20);
        
        pdf.setTextColor(128, 128, 128);
        pdf.text(`${selectedClient.name} – ${format(new Date(), 'MMM dd, yyyy')}`, pageWidth - 80, 20);
        pdf.text(pageNumber.toString(), pageWidth - margin, pageHeight - 15);
        
        currentY = 50;
        
        // Analytics section title
        pdf.setFontSize(18);
        pdf.setTextColor(0, 0, 0);
        pdf.text('Website Traffic Report', margin, currentY);
        
        // Section divider
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.line(margin, currentY + 5, pageWidth - margin, currentY + 5);
        
        currentY += 20;
        
        // Add analytics screenshots
        const screenshotSpacing = 18;
        const availableWidth = pageWidth - (2 * margin);
        const maxScreenshotWidth = availableWidth;
        const maxScreenshotHeight = 84;
        const imagesPerPage = 2;
        
        let currentScreenshotY = currentY;
        let imagesOnCurrentPage = 0;
        
        for (let i = 0; i < analyticsScreenshots.length; i++) {
          const screenshotUrl = analyticsScreenshots[i];
          
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            const loadScreenshot = new Promise((resolve) => {
              img.onload = async () => {
                try {
                  const maxWidth = maxScreenshotWidth;
                  const maxHeight = maxScreenshotHeight;
                  
                  let imgWidth = maxWidth;
                  let imgHeight = (img.height / img.width) * maxWidth;
                  
                  if (imgHeight > maxHeight) {
                    imgHeight = maxHeight;
                    imgWidth = (img.width / img.height) * maxHeight;
                  }
                  
                  const xPos = (pageWidth - imgWidth) / 2;
                  
                  if (imagesOnCurrentPage >= imagesPerPage || currentScreenshotY + imgHeight > pageHeight - 40) {
                    pdf.addPage();
                    pageNumber++;
                    imagesOnCurrentPage = 0;
                    
                    // Add borders to new page
                    pdf.setFillColor(251, 194, 16);
                    pdf.rect(0, 0, 8, pageHeight, 'F');
                    pdf.rect(pageWidth - 8, 0, 8, pageHeight, 'F');
                    pdf.setFillColor(4, 140, 212);
                    pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
                    
                    pdf.setFontSize(12);
                    pdf.setTextColor(4, 140, 212);
                    pdf.text('Nuance Digital', margin, 20);
                    
                    pdf.setTextColor(128, 128, 128);
                    pdf.text(`${selectedClient.name} – ${format(new Date(), 'MMM dd, yyyy')}`, pageWidth - 80, 20);
                    pdf.text(pageNumber.toString(), pageWidth - margin, pageHeight - 15);
                    
                    currentScreenshotY = 40;
                  }
                  
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx.drawImage(img, 0, 0);
                  
                  const imgDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                  pdf.addImage(imgDataUrl, 'JPEG', xPos, currentScreenshotY, imgWidth, imgHeight);
                  
                  currentScreenshotY += imgHeight + screenshotSpacing;
                  imagesOnCurrentPage++;
                  
                  resolve(true);
                } catch (error) {
                  console.warn('Failed to add screenshot to PDF:', error);
                  resolve(true);
                }
              };
              img.onerror = async () => {
                console.warn('Failed to load screenshot:', screenshotUrl);
                resolve(true);
              };
              img.src = screenshotUrl;
            });
            
            await loadScreenshot;
          } catch (error) {
            console.warn('Screenshot processing error:', error);
          }
        }
      }
      
      // Save the PDF
      const fileName = `${selectedClient.name.replace(/[^a-zA-Z0-9]/g, '_')}_SEO_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);
      
      toast.success('📄 Report generated successfully!');
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
        <div className="flex gap-3">
          <button
            onClick={handleMarkAsDone}
            disabled={isMarkingDone || hasReportDoneThisMonth()}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none ${
              hasReportDoneThisMonth()
                ? 'bg-green-500 text-white cursor-not-allowed'
                : 'bg-gray-500 hover:bg-blue-500 text-white'
            }`}
          >
            {hasReportDoneThisMonth() ? '✅ Done' : isMarkingDone ? 'Marking...' : 'Mark as Done'}
          </button>
          <button
            onClick={generateReport}
            disabled={isGeneratingReport || clientKeywords.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
          >
            <Download className="w-4 h-4" />
            {isGeneratingReport ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
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