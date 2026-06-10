import React, { useState, useRef, useMemo } from 'react';
import { Plus, Upload, RefreshCw, Target, Trash2, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, Pencil } from 'lucide-react';
import { Client, Keyword } from '../types';
import { fetchKeywordRanking } from '../lib/valueserp';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { RankTypeToggle } from './RankTypeToggle';
import { useAuth } from '../contexts/AuthContext';

// Splits an array into sequential chunks of a given size for batch processing
const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const chunked: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

interface KeywordsProps {
  selectedClient: Client | null;
  keywords: Keyword[];
  onKeywordAdded: () => void;
  onClientUpdated: () => void;
}

export function Keywords({ selectedClient, keywords, onKeywordAdded, onClientUpdated }: KeywordsProps) {
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingRanks, setIsFetchingRanks] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [fetchingKeywordId, setFetchingKeywordId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>(
    { key: 'current_month_rank', direction: 'asc' }
  );

  // --- Manual Override (Edit) modal state ---
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [editCurrentRank, setEditCurrentRank] = useState<string>('');
  const [editPreviousRank, setEditPreviousRank] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0 });

  // Check if current date is within the allowed range for monthly refresh (27th to 13th)
  const isMonthlyRefreshAllowed = (): boolean => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    // Allow from 27th of current month to 13th of next month
    return dayOfMonth >= 27 || dayOfMonth <= 13;
  };

  const monthlyRefreshAllowed = isMonthlyRefreshAllowed();
  if (!selectedClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Client Selected</h3>
          <p className="text-gray-500 dark:text-gray-400">Select a client to manage their keywords</p>
        </div>
      </div>
    );
  }

  const clientKeywords = keywords.filter(k => k.client_id === selectedClient.id);

  // Helper: treat null/0 ranks as Infinity so they always sink to the bottom on asc sort
  const getRankValue = (rank: number | null | undefined): number => {
    if (rank === null || rank === undefined || rank === 0) return Infinity;
    return rank;
  };

  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const sortedKeywords = useMemo(() => {
    const sorted = [...clientKeywords];
    sorted.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortConfig.key === 'current_month_rank') {
        aVal = getRankValue(a.current_month_rank);
        bVal = getRankValue(b.current_month_rank);
      } else if (sortConfig.key === 'previous_month_rank') {
        aVal = getRankValue(a.previous_month_rank);
        bVal = getRankValue(b.previous_month_rank);
      } else if (sortConfig.key === 'text') {
        aVal = a.text.toLowerCase();
        bVal = b.text.toLowerCase();
      } else {
        return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [clientKeywords, sortConfig]);

  const checkDuplicateKeyword = (keywordText: string): boolean => {
    return clientKeywords.some(k => k.text.toLowerCase() === keywordText.toLowerCase());
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    const trimmedKeyword = newKeyword.trim();
    
    if (checkDuplicateKeyword(trimmedKeyword)) {
      toast.error('This keyword already exists for this client');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('keywords')
        .insert({
          client_id: selectedClient.id,
          text: trimmedKeyword
        });

      if (error) throw error;

      toast.success('Keyword added successfully!');
      setNewKeyword('');
      setIsAddingKeyword(false);
      onKeywordAdded();
    } catch (error) {
      console.error('Error adding keyword:', error);
      toast.error('Failed to add keyword');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const keywordsToAdd = lines.map(line => line.trim()).filter(Boolean);

      if (keywordsToAdd.length === 0) {
        toast.error('No valid keywords found in CSV');
        return;
      }

      // Check for duplicates
      const duplicates = keywordsToAdd.filter(keyword => checkDuplicateKeyword(keyword));
      const uniqueKeywords = keywordsToAdd.filter(keyword => !checkDuplicateKeyword(keyword));

      if (duplicates.length > 0) {
        toast.error(`${duplicates.length} duplicate keywords skipped`);
      }

      if (uniqueKeywords.length === 0) {
        toast.error('All keywords already exist for this client');
        return;
      }

      const keywordData = uniqueKeywords.map(keyword => ({
        client_id: selectedClient.id,
        text: keyword
      }));

      const { error } = await supabase
        .from('keywords')
        .insert(keywordData);

      if (error) throw error;

      toast.success(`Successfully added ${uniqueKeywords.length} keywords!`);
      if (duplicates.length > 0) {
        toast(`${duplicates.length} duplicates were skipped`, { icon: 'ℹ️' });
      }
      onKeywordAdded();
    } catch (error) {
      console.error('Error uploading CSV:', error);
      toast.error('Failed to upload keywords');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteKeyword = async (keywordId: string) => {
    try {
      const { error } = await supabase
        .from('keywords')
        .delete()
        .eq('id', keywordId);

      if (error) throw error;

      toast.success('Keyword deleted successfully!');
      setSelectedKeywords(prev => {
        const newSet = new Set(prev);
        newSet.delete(keywordId);
        return newSet;
      });
      onKeywordAdded();
    } catch (error) {
      console.error('Error deleting keyword:', error);
      toast.error('Failed to delete keyword');
    }
  };

  const handleOpenEdit = (keyword: Keyword) => {
    setEditingKeyword(keyword);
    setEditCurrentRank(keyword.current_month_rank != null ? String(keyword.current_month_rank) : '');
    setEditPreviousRank(keyword.previous_month_rank != null ? String(keyword.previous_month_rank) : '');
  };

  const handleSaveEdit = async () => {
    if (!editingKeyword) return;
    setIsSavingEdit(true);
    try {
      // Parse inputs — empty or 0 becomes null ("Not Ranked") in the database
      const parseRank = (val: string): number | null => {
        const n = parseInt(val, 10);
        return isNaN(n) || n <= 0 ? null : n;
      };

      const { error } = await supabase
        .from('keywords')
        .update({
          current_month_rank:  parseRank(editCurrentRank),
          previous_month_rank: parseRank(editPreviousRank),
          updated_at: new Date().toISOString()
        })
        .eq('id', editingKeyword.id);

      if (error) throw error;

      toast.success(`Rankings updated for "${editingKeyword.text}"`);
      setEditingKeyword(null);
      onKeywordAdded(); // re-fetch so the table and Change arrow update instantly
    } catch (error) {
      console.error('Error saving manual rank override:', error);
      toast.error('Failed to save rank override');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleFetchSingleKeyword = async (keyword: Keyword) => {
    setFetchingKeywordId(keyword.id);
    
    try {
      const rankType = selectedClient.rank_type || 'qatar';
      const rankingData = await fetchKeywordRanking(
        selectedClient.domain,
        keyword.text,
        rankType,
        selectedClient.name   // passed for Map Pack title fallback
      );
      
      const { error } = await supabase
        .from('keywords')
        .update({
          current_month_rank: rankingData.rank,
          current_month_date: new Date().toISOString(),
          last_checked: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', keyword.id);

      if (error) throw error;

      toast.success(`Updated ranking for "${keyword.text}"`);
      onKeywordAdded();
    } catch (error) {
      console.error('Error fetching single keyword:', error);
      toast.error(`Failed to fetch ranking for "${keyword.text}"`);
    } finally {
      setFetchingKeywordId(null);
    }
  };

  const handleFetchSelectedKeywords = async () => {
    if (selectedKeywords.size === 0) {
      toast.error('No keywords selected');
      return;
    }

    const keywordsToFetch = clientKeywords.filter(k => selectedKeywords.has(k.id));
    const total = keywordsToFetch.length;
    setIsFetchingRanks(true);
    setRefreshProgress({ current: 0, total });

    const BATCH_SIZE = 4;
    let elapsed = 0;
    const progressInterval = setInterval(() => {
      elapsed += BATCH_SIZE;
      setRefreshProgress(prev => ({ ...prev, current: Math.min(elapsed, total) }));
    }, 1000);

    try {
      toast.loading(`Fetching rankings for ${total} selected keywords...`, { id: 'fetch-selected' });

      const rankType = selectedClient.rank_type || 'qatar';

      // Send all keywords to the backend in one request — server-side concurrency bypasses
      // the browser's 6-connection limit and keeps the tab-switch problem off the table.
      const response = await fetch(`/api/bulk-refresh?_t=${Date.now()}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywordsToFetch.map(k => ({
            id: k.id,
            text: k.text,
            last_checked: k.last_checked,
            current_month_rank: k.current_month_rank,
            previous_month_rank: k.previous_month_rank,
            previous_month_date: k.previous_month_date
          })),
          domain: selectedClient.domain,
          rankType,
          brandName: selectedClient.name,
          applyMonthGuard: false  // Selected fetch updates current rank only
        })
      });

      toast.dismiss('fetch-selected');

      if (!response.ok) throw new Error(`Bulk refresh failed: ${response.status}`);

      const { successCount, errorCount } = await response.json();

      if (successCount > 0) {
        toast.success(`Successfully updated ${successCount} keywords!`);
        onKeywordAdded();
      }
      if (errorCount > 0) {
        toast.error(`Failed to update ${errorCount} keywords`);
      }
    } catch (error) {
      console.error('Error fetching selected keywords:', error);
      toast.dismiss('fetch-selected');
      toast.error('Failed to fetch rankings');
    } finally {
      clearInterval(progressInterval);
      setIsFetchingRanks(false);
      setRefreshProgress({ current: 0, total: 0 });
      setSelectedKeywords(new Set());
    }
  };

  const handleMonthlyRefresh = async () => {
    if (clientKeywords.length === 0) {
      toast.error('No keywords to refresh');
      return;
    }

    const total = clientKeywords.length;
    setIsFetchingRanks(true);
    setRefreshProgress({ current: 0, total });

    const BATCH_SIZE = 4;
    let elapsed = 0;
    const progressInterval = setInterval(() => {
      elapsed += BATCH_SIZE;
      setRefreshProgress(prev => ({ ...prev, current: Math.min(elapsed, total) }));
    }, 1000);

    try {
      toast.loading(`Monthly refresh for ${total} keywords...`, { id: 'monthly-refresh' });

      const rankType = selectedClient.rank_type || 'qatar';

      // Delegate the entire refresh to the backend — all ValueSERP fetches run sequentially
      // in Node with a 1s delay per keyword to prevent 503 proxy overload.
      const response = await fetch(`/api/bulk-refresh?_t=${Date.now()}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: clientKeywords.map(k => ({
            id: k.id,
            text: k.text,
            last_checked: k.last_checked,
            current_month_rank: k.current_month_rank,
            previous_month_rank: k.previous_month_rank,
            previous_month_date: k.previous_month_date
          })),
          domain: selectedClient.domain,
          rankType,
          brandName: selectedClient.name,
          applyMonthGuard: true  // Monthly refresh must protect historical previous_month data
        })
      });

      toast.dismiss('monthly-refresh');

      if (!response.ok) throw new Error(`Bulk refresh failed: ${response.status}`);

      const { successCount, errorCount } = await response.json();

      if (successCount > 0) {
        toast.success(`Monthly refresh completed! Updated ${successCount} keywords.`);
        onKeywordAdded();
      }
      if (errorCount > 0) {
        toast.error(`Failed to update ${errorCount} keywords`);
      }
    } catch (error) {
      console.error('Error during monthly refresh:', error);
      toast.dismiss('monthly-refresh');
      toast.error('Failed to complete monthly refresh');
    } finally {
      clearInterval(progressInterval);
      setIsFetchingRanks(false);
      setRefreshProgress({ current: 0, total: 0 });
    }
  };

  const toggleKeywordSelection = (keywordId: string) => {
    setSelectedKeywords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keywordId)) {
        newSet.delete(keywordId);
      } else {
        newSet.add(keywordId);
      }
      return newSet;
    });
  };

  const selectAllKeywords = () => {
    if (selectedKeywords.size === clientKeywords.length) {
      setSelectedKeywords(new Set());
    } else {
      setSelectedKeywords(new Set(clientKeywords.map(k => k.id)));
    }
  };

  const { role } = useAuth();
  const isAdmin = role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Keywords for {selectedClient.name}
        </h1>
      </div>

      <RankTypeToggle client={selectedClient} onUpdate={onClientUpdated} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsAddingKeyword(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Plus className="w-4 h-4" />
              Add Keyword
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Upload CSV
            </button>
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            {selectedKeywords.size > 0 && (
              <button
                onClick={handleFetchSelectedKeywords}
                disabled={isFetchingRanks}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed ${
                  isFetchingRanks
                    ? 'animate-pulse bg-green-50 text-green-700 border-green-300 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
                    : 'bg-white text-green-700 border-green-300 hover:bg-green-50 dark:bg-zinc-800 dark:text-green-400 dark:border-zinc-700 dark:hover:bg-zinc-700'
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${isFetchingRanks ? 'animate-spin' : ''}`} />
                {isFetchingRanks && refreshProgress.total > 0
                  ? `Updating ${refreshProgress.current} of ${refreshProgress.total}...`
                  : `Fetch Selected (${selectedKeywords.size})`
                }
              </button>
            )}
            <button
              onClick={handleMonthlyRefresh}
              disabled={isFetchingRanks || clientKeywords.length === 0 || !monthlyRefreshAllowed}
              title={!monthlyRefreshAllowed ? "Monthly refresh is available only between the 27th and 13th of each month." : ""}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed ${
                isFetchingRanks
                  ? 'animate-pulse bg-orange-50 text-orange-600 border-orange-300 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20'
                  : monthlyRefreshAllowed
                    ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 dark:bg-zinc-800 dark:text-orange-400 dark:border-zinc-700 dark:hover:bg-zinc-700'
                    : 'bg-white text-gray-400 border-gray-200 cursor-not-allowed dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800'
              }`}
            >
              <RotateCcw className={`w-4 h-4 ${isFetchingRanks ? 'animate-spin' : ''}`} />
              {isFetchingRanks && refreshProgress.total > 0
                ? `Updating ${refreshProgress.current} of ${refreshProgress.total}...`
                : 'Monthly Refresh'
              }
            </button>
          </div>
        )}
      </div>


      {/* Hidden file input for CSV upload — admin only */}
      {isAdmin && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleCSVUpload}
          className="hidden"
        />
      )}

      {isAdmin && isAddingKeyword && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-none border border-gray-200 dark:border-white/5">
          <form onSubmit={handleAddKeyword} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Enter keyword (e.g., 'digital marketing')"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingKeyword(false);
                  setNewKeyword('');
                }}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {clientKeywords.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-12 shadow-none border border-gray-200 dark:border-white/5 text-center">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Keywords Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Start by adding keywords to track for this client</p>
          {isAdmin && (
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setIsAddingKeyword(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                Add Keyword
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
              >
                <Upload className="w-4 h-4" />
                Upload CSV
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-none border border-gray-200 dark:border-white/5 overflow-hidden">
          <div className="max-h-[calc(100vh-14rem)] overflow-auto shadow-md relative">
            <table className="w-full">
              <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedKeywords.size === clientKeywords.length && clientKeywords.length > 0}
                      onChange={selectAllKeywords}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('text')}
                      className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Keyword
                      {sortConfig.key === 'text' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('previous_month_rank')}
                      className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Previous Rank
                      {sortConfig.key === 'previous_month_rank' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('current_month_rank')}
                      className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Current Rank
                      {sortConfig.key === 'current_month_rank' ? (
                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Change
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Last Checked
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {sortedKeywords.map((keyword) => {
                  const rankChange = keyword.current_month_rank && keyword.previous_month_rank
                    ? keyword.previous_month_rank - keyword.current_month_rank
                    : null;

                  return (
                    <tr key={keyword.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedKeywords.has(keyword.id)}
                          onChange={() => toggleKeywordSelection(keyword.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {keyword.text}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            keyword.previous_month_rank 
                              ? keyword.previous_month_rank <= 10
                                ? 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400'
                                : keyword.previous_month_rank <= 30
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {keyword.previous_month_rank ? `#${keyword.previous_month_rank}` : '—'}
                          </span>
                          {keyword.previous_month_date && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {format(new Date(keyword.previous_month_date), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            keyword.current_month_rank 
                              ? keyword.current_month_rank <= 10
                                ? 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400'
                                : keyword.current_month_rank <= 30
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {keyword.current_month_rank ? `#${keyword.current_month_rank}` : 'Not ranked'}
                          </span>
                          {keyword.last_checked && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {format(new Date(keyword.last_checked), 'MMM d')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {rankChange !== null ? (
                          <div className={`flex items-center gap-1 ${
                            rankChange > 0 ? 'text-green-600' : rankChange < 0 ? 'text-red-600' : 'text-gray-500'
                          }`}>
                            {rankChange > 0 ? '↗' : rankChange < 0 ? '↘' : '→'}
                            <span className="text-sm font-medium">
                              {Math.abs(rankChange)}
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleFetchSingleKeyword(keyword)}
                            disabled={fetchingKeywordId === keyword.id}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-4 h-4 ${fetchingKeywordId === keyword.id ? 'animate-spin' : ''}`} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenEdit(keyword)}
                              title="Manual rank override"
                              className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteKeyword(keyword.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Manual Override Modal                                               */}
      {/* ------------------------------------------------------------------ */}
      {editingKeyword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditingKeyword(null)}
          />

          {/* Dialog */}
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-gray-200 dark:border-white/5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Manual Rank Override
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 truncate">
              {editingKeyword.text}
            </p>

            <div className="space-y-4">
              {/* Current Rank */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Rank
                </label>
                <input
                  id="edit-current-rank"
                  type="number"
                  min="1"
                  placeholder="Leave blank for Not Ranked"
                  value={editCurrentRank}
                  onChange={e => setEditCurrentRank(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                />
              </div>

              {/* Previous Rank */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Previous Rank
                </label>
                <input
                  id="edit-previous-rank"
                  type="number"
                  min="1"
                  placeholder="Leave blank for Not Ranked"
                  value={editPreviousRank}
                  onChange={e => setEditPreviousRank(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              Clear a field (or enter 0) to mark as "Not Ranked".
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors text-sm"
              >
                {isSavingEdit ? 'Saving…' : 'Save Override'}
              </button>
              <button
                onClick={() => setEditingKeyword(null)}
                disabled={isSavingEdit}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium py-2 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}