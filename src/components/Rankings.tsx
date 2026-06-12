import React, { useState, useEffect } from 'react';
import { Download, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Client, Keyword } from '../types';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { RankTypeToggle } from './RankTypeToggle';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RankingsProps {
  selectedClient: Client | null;
  keywords: Keyword[];
  onClientUpdated: () => void;
}

export function Rankings({ selectedClient, keywords, onClientUpdated }: RankingsProps) {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [isReportDone, setIsReportDone] = useState(false);
  const [reportSortOrder, setReportSortOrder] = useState<'default' | 'asc' | 'desc'>('asc');

  // Update local state when selectedClient changes
  useEffect(() => {
    if (selectedClient) {
      setIsReportDone(hasReportDoneThisMonth());
    }
  }, [selectedClient]);

  const generateClientSlug = (clientName: string): string => {
    return clientName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const getCurrentMonthPath = (): string => {
    return format(new Date(), 'yyyy-MM');
  };

  const fetchAnalyticsScreenshots = async (): Promise<string[]> => {
    if (!selectedClient) return [];

    try {
      const clientSlug = generateClientSlug(selectedClient.name);
      const monthPath = getCurrentMonthPath();
      const folderPath = `${clientSlug}/${monthPath}`;

      const { data: files, error } = await supabase.storage
        .from('analytics_screenshots')
        .list(folderPath);

      if (error || !files) {
        console.warn('No analytics screenshots found:', error);
        return [];
      }

      // Filter out .keep files and get public URLs
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
      console.error('Error fetching analytics screenshots:', error);
      return [];
    }
  };

  // Check if client has report marked done for current month
  const hasReportDoneThisMonth = (): boolean => {
    if (!selectedClient?.report_done_month) return false;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const currentMonthYear = `${currentYear}-${currentMonth}`;

    return selectedClient.report_done_month === currentMonthYear;
  };

  const handleMarkAsDone = async () => {
    if (!selectedClient) return;

    setIsMarkingDone(true);
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
      const monthYear = `${currentYear}-${currentMonth}`;

      const { error } = await supabase
        .from('clients')
        .update({ report_done_month: monthYear })
        .eq('id', selectedClient.id);

      if (error) throw error;

      // Immediately update local state
      setIsReportDone(true);
      toast.success('Marked as Done');
      onClientUpdated(); // Refresh client data to update sidebar indicators
    } catch (error) {
      console.error('Error marking report as done:', error);
      toast.error('Failed to mark report as done');
    } finally {
      setIsMarkingDone(false);
    }
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

  // Safe rank extractor: treats null, undefined, and 0 as "not ranked"
  const getRank = (val: any): number => { const num = Number(val); return isNaN(num) || num <= 0 ? 0 : num; };

  // Calculate improvements vs declines (includes new/lost ranking edge cases)
  const improvements = clientKeywords.filter(k => {
    const current = getRank(k.current_month_rank);
    const previous = getRank(k.previous_month_rank);
    // Rank improved (lower number) OR keyword newly appeared in rankings
    return (current > 0 && previous > 0 && current < previous) || (previous === 0 && current > 0);
  }).length;

  const declines = clientKeywords.filter(k => {
    const current = getRank(k.current_month_rank);
    const previous = getRank(k.previous_month_rank);
    // Rank worsened (higher number) OR keyword dropped out of rankings entirely
    return (current > 0 && previous > 0 && current > previous) || (previous > 0 && current === 0);
  }).length;

  const noChange = clientKeywords.filter(k => {
    const current = getRank(k.current_month_rank);
    const previous = getRank(k.previous_month_rank);
    // Both months have a valid rank and it hasn't moved
    return current > 0 && previous > 0 && current === previous;
  }).length;

  const noPieData = improvements === 0 && declines === 0 && noChange === 0;

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

  // Helper function to convert number to ordinal (1st, 2nd, 3rd, etc.)
  const toOrdinal = (num: number): string => {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = num % 100;
    return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
  };

  // Helper function to get ranking color based on change
  const getRankingColor = (current: number | null, previous: number | null): [number, number, number] => {
    if (!current || !previous) return [0, 0, 0]; // Black for no data

    if (previous > current) return [0, 128, 0]; // Green for improvement
    if (previous < current) return [255, 0, 0]; // Red for decline
    return [128, 128, 128]; // Gray for no change
  };

  const generateReport = async () => {
    setIsGeneratingReport(true);
    try {
      // Fetch analytics screenshots
      const analyticsScreenshots = await fetchAnalyticsScreenshots();

      // --- Sort keywords for report ---
      const getRankVal = (rank: number | null | undefined): number =>
        rank === null || rank === undefined || rank === 0 ? Infinity : rank;

      const reportKeywords = [...clientKeywords].sort((a, b) => {
        if (reportSortOrder === 'default') return 0;
        const aVal = getRankVal(a.current_month_rank);
        const bVal = getRankVal(b.current_month_rank);
        if (aVal < bVal) return reportSortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return reportSortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      // Detect if this client's keywords contain Arabic (U+0600–U+06FF)
      // Used to conditionally right-align the keyword column (RTL) vs. left-align (LTR)
      const isArabicReport = reportKeywords.some(k => /[\u0600-\u06FF]/.test(k.text));

      // --- Load Amiri Arabic font from CDN and inject into jsPDF ---
      // Amiri supports Arabic Unicode; jsPDF requires a TTF as base64
      let arabicFontLoaded = false;
      const pdf = new jsPDF();

      try {
        // Verified working URL: Amiri TTF from Google Fonts' official GitHub repo via jsDelivr
        const ttfResponse = await fetch(
          'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf'
        );
        if (ttfResponse.ok) {
          const ttfBuffer = await ttfResponse.arrayBuffer();
          // btoa() only handles 0-255 codepoints; Uint8Array ensures correct byte mapping
          const ttfBase64 = btoa(
            new Uint8Array(ttfBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          pdf.addFileToVFS('Amiri-Regular.ttf', ttfBase64);
          pdf.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
          arabicFontLoaded = true;
        } else {
          console.warn('Amiri font CDN returned:', ttfResponse.status, '— Arabic text may not render.');
        }
      } catch (fontErr) {
        console.warn('Amiri font could not be loaded, Arabic may not render correctly:', fontErr);
      }
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15; // Reduced from 20 to 15 for ~12% more width

      // Calculate date ranges — report covers the previous month
      const currentDate = new Date();
      const reportMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const previousReportMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1);

      const currentMonthLabel = format(reportMonthDate, 'MMM-yy');
      const previousMonthLabel = format(previousReportMonthDate, 'MMM-yy');

      // ===== FIRST PAGE - PREMIUM AGENCY COVER =====

      // --- Brand colors ---
      const darkBlue: [number, number, number] = [15, 45, 82];
      const brandYellow: [number, number, number] = [255, 192, 0];
      const centerX = pageWidth / 2;

      // Layer 1: White top band for the logo (0 -> 60mm)
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, 60, 'F');

      // Logo centered inside the white band, max height 40mm, aspect-ratio safe
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
              const logoDataUrl = canvas.toDataURL('image/jpeg', 0.9);
              const maxImgW = pageWidth - margin * 2;
              const maxImgH = 40;
              const ratio = Math.min(maxImgW / logoImg.width, maxImgH / logoImg.height);
              const finalW = logoImg.width * ratio;
              const finalH = logoImg.height * ratio;
              const imgX = (pageWidth - finalW) / 2;
              const imgY = (60 - finalH) / 2; // vertically centered in 60mm band
              pdf.addImage(logoDataUrl, 'JPEG', imgX, imgY, finalW, finalH);
              resolve(true);
            } catch {
              pdf.setFontSize(16);
              pdf.setTextColor(...darkBlue);
              pdf.text('Nuance Digital', centerX, 30, { align: 'center' });
              resolve(true);
            }
          };
          logoImg.onerror = () => {
            pdf.setFontSize(16);
            pdf.setTextColor(...darkBlue);
            pdf.text('Nuance Digital', centerX, 30, { align: 'center' });
            resolve(true);
          };
          logoImg.src = '/pp.jpg';
        });
        await loadLogo;
      } catch {
        pdf.setFontSize(16);
        pdf.setTextColor(...darkBlue);
        pdf.text('Nuance Digital', centerX, 30, { align: 'center' });
      }

      // Layer 2: Dark blue title band (60 -> 100mm)
      pdf.setFillColor(...darkBlue);
      pdf.rect(0, 60, pageWidth, 40, 'F');
      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text('MONTHLY SEO REPORT', centerX, 85, {
        align: 'center',
        fontStyle: 'bold',
      });

      // Layer 3: Yellow accent line (100 -> 105mm)
      pdf.setFillColor(...brandYellow);
      pdf.rect(0, 100, pageWidth, 5, 'F');

      // ── 4. "PREPARED FOR" label ───────────────────────────────────────────
      let cursorY = 123; // 18mm below the yellow accent line bottom (105mm)
      pdf.setFontSize(9);
      pdf.setTextColor(160, 160, 160);
      pdf.text('PREPARED FOR', centerX, cursorY, { align: 'center' });

      // ── 5. CLIENT NAME (large, dark blue) ────────────────────────────────
      cursorY += 10;
      pdf.setFontSize(22);
      pdf.setTextColor(...darkBlue);
      const clientNameMaxW = pageWidth - margin * 2;
      const clientNameLines = pdf.splitTextToSize(selectedClient.name, clientNameMaxW);
      pdf.text(clientNameLines, centerX, cursorY, { align: 'center', fontStyle: 'bold' });

      // Move cursor past wrapped client name (approx 9pt per line at fontSize 22)
      cursorY += (clientNameLines.length - 1) * 9;

      // ── 6. YELLOW ACCENT LINE below client name ───────────────────────────
      cursorY += 6;
      const accentLineW = 40;
      pdf.setDrawColor(...brandYellow);
      pdf.setLineWidth(1.5);
      pdf.line(centerX - accentLineW / 2, cursorY, centerX + accentLineW / 2, cursorY);
      pdf.setLineWidth(0.5); // reset

      // ── 7. METADATA GRID (Website / Period / Prepared By) ─────────────────
      const periodText = format(reportMonthDate, 'MMM yyyy');
      const metaRows: [string, string][] = [
        ['Website', `https://${selectedClient.domain}`],
        ['Period', periodText],
        ['Prepared By', 'Nuance Digital Solutions'],
      ];
      const labelX = centerX - 28;
      const valueX = centerX + 4;

      cursorY += 14;
      metaRows.forEach(([label, value]) => {
        // Label
        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text(label.toUpperCase(), labelX, cursorY, { align: 'right' });

        // Value — wrap if long
        pdf.setFontSize(10);
        pdf.setTextColor(...darkBlue);
        const valueLines = pdf.splitTextToSize(value, pageWidth - valueX - margin);
        pdf.text(valueLines, valueX, cursorY);

        cursorY += valueLines.length > 1 ? valueLines.length * 5.5 + 4 : 11;
      });

      // ── 8. BOTTOM METRIC CARDS ────────────────────────────────────────────
      const numOneRankings = reportKeywords.filter(k => k.current_month_rank === 1).length;
      const top3Count = reportKeywords.filter(k => k.current_month_rank != null && k.current_month_rank >= 1 && k.current_month_rank <= 3).length;
      const top10Count = reportKeywords.filter(k => k.current_month_rank != null && k.current_month_rank >= 1 && k.current_month_rank <= 10).length;

      const cards: { label: string; value: string }[] = [
        { label: 'Keywords #1', value: String(numOneRankings) },
        { label: 'Top 3 Rankings', value: String(top3Count) },
        { label: 'Top 10 Rankings', value: String(top10Count) },
      ];

      const cardW = (pageWidth - margin * 2 - 8) / 3; // 8px total gap for 2 gutters
      const cardH = 36;
      const cardY = pageHeight - cardH - 18;
      const cardGap = 4;

      cards.forEach((card, i) => {
        const cardX = margin + i * (cardW + cardGap);

        // Card background
        pdf.setFillColor(...darkBlue);
        pdf.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'F');

        // Yellow accent stripe at top of card
        pdf.setFillColor(...brandYellow);
        pdf.rect(cardX, cardY, cardW, 3, 'F');

        // Big number / value
        pdf.setFontSize(18);
        pdf.setTextColor(...brandYellow);
        pdf.text(card.value, cardX + cardW / 2, cardY + 18, {
          align: 'center',
          fontStyle: 'bold',
        });

        // Small label below
        pdf.setFontSize(7.5);
        pdf.setTextColor(255, 255, 255);
        pdf.text(card.label.toUpperCase(), cardX + cardW / 2, cardY + 28, {
          align: 'center',
        });
      });

      // ── 9. THIN YELLOW BOTTOM STRIPE ─────────────────────────────────────
      pdf.setFillColor(...brandYellow);
      pdf.rect(0, pageHeight - 6, pageWidth, 6, 'F');

      // Add new page for table
      pdf.addPage();

      // Add borders to new page
      pdf.setFillColor(251, 194, 16);
      pdf.rect(0, 0, 8, pageHeight, 'F');
      pdf.rect(pageWidth - 8, 0, 8, pageHeight, 'F'); // Right-side yellow accent
      pdf.rect(pageWidth - 8, 0, 8, pageHeight, 'F'); // Right-side yellow accent
      pdf.setFillColor(4, 140, 212);
      pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');

      // Header with logo and client info
      try {
        // Add smaller logo for table pages
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
              pdf.addImage(logoDataUrl, 'JPEG', margin, 15, 20, 0); // Auto height to maintain aspect ratio
              resolve(true);
            } catch (error) {
              pdf.setFontSize(12);
              pdf.setTextColor(4, 140, 212);
              // Add logo instead of text
              try {
                const logoImg = new Image();
                logoImg.crossOrigin = 'anonymous';

                const loadFallbackLogo = new Promise((resolve) => {
                  logoImg.onload = async () => {
                    try {
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      canvas.width = logoImg.width;
                      canvas.height = logoImg.height;
                      ctx.drawImage(logoImg, 0, 0);

                      const logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                      pdf.addImage(logoDataUrl, 'JPEG', margin + 8, 12, 15, 0);
                      resolve(true);
                    } catch (error) {
                      pdf.text('Nuance', margin + 8, 20);
                      resolve(true);
                    }
                  };
                  logoImg.onerror = async () => {
                    pdf.text('Nuance', margin + 8, 20);
                    resolve(true);
                  };
                  logoImg.src = '/pp.jpg';
                });

                await loadFallbackLogo;
              } catch (error) {
                pdf.text('Nuance', margin + 8, 20);
              }
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

      // FIX FOR PAGE 2: Consistent size, format, and alignment
      pdf.setFontSize(10);
      pdf.setTextColor(128, 128, 128);
      const headerText2 = `${selectedClient.name} – ${format(reportMonthDate, 'MMM yyyy')}`;
      const headerMaxWidth2 = pageWidth - (margin * 2) - 25; // reserve space left of right margin
      const headerLines2 = pdf.splitTextToSize(headerText2, headerMaxWidth2);
      pdf.text(headerLines2, pageWidth - margin, 20, { align: 'right' });

      // Page number
      pdf.text('1', pageWidth - margin, pageHeight - 15);

      // Google Ranking section
      pdf.setFontSize(18);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Google Ranking', margin, 50);

      pdf.setFontSize(12);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Showing ${reportKeywords.length} of ${reportKeywords.length} Rows`, margin, 65);

      // Table header
      const tableStartY = 80;
      const colWidths = [95, 40, 40]; // Further reduced to prevent right border overlap
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
      for (const [index, keyword] of reportKeywords.entries()) {
        // Check if we need a new page
        if (currentY > pageHeight - 40) {
          pdf.addPage();
          pageNumber++;

          // Add borders to new page
          pdf.setFillColor(251, 194, 16);
          pdf.rect(0, 0, 8, pageHeight, 'F');
          pdf.rect(pageWidth - 8, 0, 8, pageHeight, 'F'); // Right-side yellow accent
          pdf.setFillColor(4, 140, 212);
          pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');

          // Header for additional pages
          pdf.setFontSize(12);
          pdf.setTextColor(4, 140, 212);

          // Add logo to additional pages
          try {
            const logoImg = new Image();
            logoImg.crossOrigin = 'anonymous';

            const loadAdditionalPageLogo = new Promise((resolve) => {
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
                  pdf.text('Nuance Digital', margin, 20);
                  resolve(true);
                }
              };
              logoImg.onerror = async () => {
                pdf.text('Nuance Digital', margin, 20);
                resolve(true);
              };
              logoImg.src = '/pp.jpg';
            });

            await loadAdditionalPageLogo;
          } catch (error) {
            pdf.setFontSize(12);
            pdf.setTextColor(4, 140, 212);
            pdf.text('Nuance Digital', margin, 20);
          }

          pdf.setFontSize(10); // Explicitly set size so it matches every page
          pdf.setTextColor(128, 128, 128);
          const headerTextOvf = `${selectedClient.name} – ${format(reportMonthDate, 'MMM yyyy')}`;
          const headerMaxWidthOvf = pageWidth - (margin * 2) - 25;
          const headerLinesOvf = pdf.splitTextToSize(headerTextOvf, headerMaxWidthOvf);
          pdf.text(headerLinesOvf, pageWidth - margin, 20, { align: 'right' });
          pdf.text(pageNumber.toString(), pageWidth - margin, pageHeight - 15);

          // Repeat table header row on overflow page
          currentY = 40;
          pdf.setFillColor(128, 128, 128);
          pdf.rect(tableStartX, currentY - 5, tableWidth, rowHeight + 2, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(12);
          pdf.text('Keyword', tableStartX + 3, currentY + 5);
          pdf.text(previousMonthLabel, tableStartX + colWidths[0] + 3, currentY + 5);
          pdf.text(currentMonthLabel, tableStartX + colWidths[0] + colWidths[1] + 3, currentY + 5);
          currentY += rowHeight + 5;
        }

        // Keyword name — switch to Amiri for Arabic support
        // Use splitTextToSize (equiv. overflow:'linebreak') so full text wraps instead of truncating
        if (arabicFontLoaded) {
          pdf.setFont('Amiri', 'normal');
        }
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);

        // Allow full text to fill col-0 width, wrapping to new lines as needed
        const keywordColInnerWidth = colWidths[0] - 6; // 3px padding each side
        const keywordLines: string[] = pdf.splitTextToSize(keyword.text, keywordColInnerWidth);
        const wrappedLineCount = keywordLines.length;
        const lineSpacing = 4.5; // pt between wrapped lines
        const effectiveRowHeight = Math.max(rowHeight, wrappedLineCount * lineSpacing + 4);

        // Draw alternating row background sized to actual row height
        if (index % 2 === 0) {
          pdf.setFillColor(245, 245, 245);
          pdf.rect(tableStartX, currentY - 8, tableWidth, effectiveRowHeight, 'F');
        }

        // Align keyword text: right-anchor for Arabic (RTL), left-anchor for English (LTR)
        const keywordTextX = isArabicReport
          ? tableStartX + colWidths[0] - 3  // right edge of col-0
          : tableStartX + 3;                // left edge of col-0
        const keywordTextAlign = isArabicReport ? 'right' : 'left';
        pdf.text(keywordLines, keywordTextX, currentY, { align: keywordTextAlign });

        // Reset to default font for rank numbers (ASCII-safe, no Arabic needed)
        if (arabicFontLoaded) {
          pdf.setFont('helvetica', 'normal');
        }

        // Rank columns align vertically to the first keyword line
        // Previous month rank
        pdf.setTextColor(0, 0, 0); // Always black for previous month
        const previousRankText = keyword.previous_month_rank ? toOrdinal(keyword.previous_month_rank) : '—';
        pdf.text(previousRankText, tableStartX + colWidths[0] + 3, currentY);

        // Current month rank
        const currentRankColor = getRankingColor(keyword.current_month_rank, keyword.previous_month_rank);
        pdf.setTextColor(currentRankColor[0], currentRankColor[1], currentRankColor[2]);
        const currentRankText = keyword.current_month_rank ? toOrdinal(keyword.current_month_rank) : '—';
        pdf.text(currentRankText, tableStartX + colWidths[0] + colWidths[1] + 3, currentY);

        currentY += effectiveRowHeight;
      }

      // Footer on last page
      const footerY = pageHeight - 25;

      // Add Analytics Screenshots Section if any exist
      if (analyticsScreenshots.length > 0) {
        // Always start Website Traffic Report on a new page
        pdf.addPage();
        pageNumber++;

        // Add borders to new page
        pdf.setFillColor(251, 194, 16);
        pdf.rect(0, 0, 8, pageHeight, 'F');
        pdf.rect(pageWidth - 8, 0, 8, pageHeight, 'F'); // Right-side yellow accent
        pdf.setFillColor(4, 140, 212);
        pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');

        // Header for analytics page
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';

          const loadAnalyticsPageLogo = new Promise((resolve) => {
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
              // Add logo instead of text
              try {
                const logoImg = new Image();
                logoImg.src = '/pp.jpg';

                const loadFallbackLogo = new Promise((resolve) => {
                  logoImg.onload = async () => {
                    try {
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      canvas.width = logoImg.width;
                      canvas.height = logoImg.height;
                      ctx.drawImage(logoImg, 0, 0);

                      const logoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                      pdf.addImage(logoDataUrl, 'JPEG', margin + 8, 12, 15, 0);
                      resolve(true);
                    } catch (error) {
                      pdf.text('Nuance', margin + 8, 20);
                      resolve(true);
                    }
                  };
                  logoImg.onerror = async () => {
                    pdf.text('Nuance', margin + 8, 20);
                    resolve(true);
                  };
                  logoImg.src = '/pp.jpg';
                });

                await loadFallbackLogo;
              } catch (error) {
                pdf.text('Nuance Digital', margin, 20);
              }
              resolve(true);
            };
            logoImg.src = '/pp.jpg';
          });

          await loadAnalyticsPageLogo;
        } catch (error) {
          pdf.setFontSize(12);
          pdf.setTextColor(4, 140, 212);
          pdf.text('Nuance', margin, 20);
        }

        pdf.setFontSize(10); // Explicitly set size so it matches every page
        pdf.setTextColor(128, 128, 128);
        const headerTextAnalytics = `${selectedClient.name} – ${format(reportMonthDate, 'MMM yyyy')}`;
        const headerMaxWidthAnalytics = pageWidth - (margin * 2) - 25;
        const headerLinesAnalytics = pdf.splitTextToSize(headerTextAnalytics, headerMaxWidthAnalytics);
        pdf.text(headerLinesAnalytics, pageWidth - margin, 20, { align: 'right' });
        pdf.text(pageNumber.toString(), pageWidth - margin, pageHeight - 15);

        currentY = 50; // Start content lower on the page

        // Analytics section title
        pdf.setFontSize(18);
        pdf.setTextColor(0, 0, 0);
        pdf.text('Website Traffic Report', margin, currentY);

        // Section divider
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.line(margin, currentY + 5, pageWidth - margin, currentY + 5);

        currentY += 20;

        // Add analytics screenshots with proper page overflow handling
        const screenshotSpacing = 18; // Consistent 18px vertical spacing between images
        const imagesPerPage = 2; // Exactly 2 images per page

        let currentScreenshotY = currentY;
        let imagesOnCurrentPage = 0;

        for (let i = 0; i < analyticsScreenshots.length; i++) {
          const screenshotUrl = analyticsScreenshots[i];

          try {
            // Load and add screenshot
            const img = new Image();
            img.crossOrigin = 'anonymous';

            const loadScreenshot = new Promise((resolve) => {
              img.onload = async () => {
                try {
                  // Scale image to fit within page content width, preserving aspect ratio
                  const contentWidth = pageWidth - (margin * 2); // strict margin-to-margin width
                  const aspectRatio = img.width / img.height;
                  let imgWidth = contentWidth;
                  let imgHeight = contentWidth / aspectRatio;

                  // Secondary cap: if height is still too tall for the page, scale down from height
                  const maxImgHeight = pageHeight - 80; // leave room for header/footer
                  if (imgHeight > maxImgHeight) {
                    imgHeight = maxImgHeight;
                    imgWidth = maxImgHeight * aspectRatio;
                  }

                  // Always start from left margin (image fills full content width)
                  const xPos = margin;

                  // Check if we need a new page (when we have 2 images or exceed page height)
                  if (imagesOnCurrentPage >= imagesPerPage || currentScreenshotY + imgHeight > pageHeight - 40) {
                    pdf.addPage();
                    pageNumber++;
                    imagesOnCurrentPage = 0;

                    // Add borders to new page
                    pdf.setFillColor(251, 194, 16);
                    pdf.rect(0, 0, 8, pageHeight, 'F');
                    pdf.rect(pageWidth - 8, 0, 8, pageHeight, 'F'); // Right-side yellow accent
                    pdf.rect(pageWidth - 8, 0, 8, pageHeight, 'F'); // Right-side yellow accent
                    pdf.setFillColor(4, 140, 212);
                    pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');

                    // Header for additional analytics pages
                    pdf.setFontSize(12);
                    pdf.setTextColor(4, 140, 212);

                    // Add logo to additional analytics pages
                    try {
                      const logoImg = new Image();
                      logoImg.crossOrigin = 'anonymous';

                      const loadContinuationLogo = new Promise((resolve) => {
                        logoImg.onload = () => {
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
                            pdf.text('Nuance Digital', margin, 20);
                            resolve(true);
                          }
                        };
                        logoImg.onerror = () => {
                          pdf.text('Nuance Digital', margin, 20);
                          resolve(true);
                        };
                        logoImg.src = '/pp.jpg';
                      });

                      await loadContinuationLogo;
                    } catch (error) {
                      pdf.text('Nuance Digital', margin, 20);
                    }

                    pdf.setTextColor(128, 128, 128);
                    const headerTextCont = `${selectedClient.name} – ${format(reportMonthDate, 'MMM yyyy')}`;
                    const headerMaxWidthCont = pageWidth - (margin * 2) - 25;
                    const headerLinesCont = pdf.splitTextToSize(headerTextCont, headerMaxWidthCont);
                    pdf.text(headerLinesCont, pageWidth - margin, 20, { align: 'right' });
                    pdf.text(pageNumber.toString(), pageWidth - margin, pageHeight - 15);

                    // Reset Y position for new page
                    currentScreenshotY = 40;
                  }

                  // Create canvas and draw image
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  ctx.drawImage(img, 0, 0);

                  const imgDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                  pdf.addImage(imgDataUrl, 'JPEG', xPos, currentScreenshotY, imgWidth, imgHeight);

                  // Update Y position for next image
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
            console.warn('Error processing screenshot:', error);
          }
        }
      }

      // Save the PDF
      pdf.save(`${selectedClient.name}_SEO_Report_${format(new Date(), 'yyyy-MM')}.pdf`);
      toast.success('Report generated successfully!');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const { role } = useAuth();
  const isAdmin = role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Rankings for {selectedClient.name}
        </h1>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={handleMarkAsDone}
              disabled={isMarkingDone || isReportDone}
              className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors whitespace-nowrap disabled:opacity-50 ${isReportDone
                ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700'
                }`}
            >
              {isReportDone ? 'Done' : isMarkingDone ? 'Marking...' : 'Mark as Done'}
            </button>
          )}
          <select
            value={reportSortOrder === 'default' ? 'asc' : reportSortOrder}
            onChange={(e) => setReportSortOrder(e.target.value as 'default' | 'asc' | 'desc')}
            className="py-2 px-4 text-sm rounded-full border bg-white border-gray-300 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
          >
            <option value="default">Sort: Default</option>
            <option value="asc">Rank: Low to High (Ascending)</option>
            <option value="desc">Rank: High to Low (Descending)</option>
          </select>
          {isAdmin && (
            <button
              onClick={generateReport}
              disabled={isGeneratingReport || clientKeywords.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Download className="w-4 h-4" />
              {isGeneratingReport ? 'Generating...' : 'Generate Report'}
            </button>
          )}
        </div>
      </div>

      <RankTypeToggle client={selectedClient} onUpdate={onClientUpdated} />

      {clientKeywords.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-12 shadow-none border border-gray-200 dark:border-white/5 text-center">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Keywords to Track</h3>
          <p className="text-gray-500 dark:text-gray-400">Add keywords in the Keywords tab to start tracking rankings</p>
        </div>
      ) : (
        <>
          {/* Performance Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-none border border-gray-200 dark:border-white/5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Distribution</h3>
              {noPieData ? (
                <div className="flex items-center justify-center h-[250px]">
                  <div className="text-center">
                    <TrendingUp className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No trend data available yet</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Rankings need both a previous and current month value to compute trends</p>
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-none border border-gray-200 dark:border-white/5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ranking Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-none border border-gray-200 dark:border-white/5">
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

            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-none border border-gray-200 dark:border-white/5">
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

            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-none border border-gray-200 dark:border-white/5">
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
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-none border border-gray-200 dark:border-white/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Keyword Rankings</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-zinc-800">
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
                            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${keyword.previous_month_rank
                              ? keyword.previous_month_rank <= 10
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                : keyword.previous_month_rank <= 30
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-300'
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
                            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${keyword.current_month_rank
                              ? keyword.current_month_rank <= 10
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                : keyword.current_month_rank <= 30
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-300'
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
                            <div className={`flex items-center gap-2 ${rankChange > 0 ? 'text-green-600' : rankChange < 0 ? 'text-red-600' : 'text-gray-500'
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