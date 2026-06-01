import React, { useState, useRef, useMemo } from 'react';
import { Plus, Upload, RefreshCw, Target, Trash2, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Client, Keyword } from '../types';
import { fetchKeywordRanking } from '../lib/valueserp';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { RankTypeToggle } from './RankTypeToggle';

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
          current_month_date: new Date().toISOString().split('T')[0],
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
    setIsFetchingRanks(true);

    try {
      toast.loading(`Fetching rankings for ${keywordsToFetch.length} selected keywords...`, { id: 'fetch-selected' });

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
      setIsFetchingRanks(false);
      setSelectedKeywords(new Set());
    }
  };

  const handleMonthlyRefresh = async () => {
    if (clientKeywords.length === 0) {
      toast.error('No keywords to refresh');
      return;
    }

    setIsFetchingRanks(true);

    try {
      toast.loading(`Monthly refresh for ${clientKeywords.length} keywords...`, { id: 'monthly-refresh' });

      const rankType = selectedClient.rank_type || 'qatar';

      // Delegate the entire refresh to the backend — all ValueSERP fetches run concurrently
      // in Node (no browser connection cap) and Supabase updates are written server-side.
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
      setIsFetchingRanks(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Keywords for {selectedClient.name}
        </h1>
      </div>

      <RankTypeToggle client={selectedClient} onUpdate={onClientUpdated} />

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={() => setIsAddingKeyword(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Add Keyword
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Upload CSV
          </button>
        </div>

        <div className="flex gap-3">
          {selectedKeywords.size > 0 && (
            <button
              onClick={handleFetchSelectedKeywords}
              disabled={isFetchingRanks}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingRanks ? 'animate-spin' : ''}`} />
              Fetch Selected ({selectedKeywords.size})
            </button>
          )}
          <button
            onClick={handleMonthlyRefresh}
            disabled={isFetchingRanks || clientKeywords.length === 0 || !monthlyRefreshAllowed}
            title={!monthlyRefreshAllowed ? "Monthly refresh is available only between the 27th and 13th of each month." : ""}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 transform disabled:opacity-50 disabled:transform-none ${
              monthlyRefreshAllowed 
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white hover:scale-105' 
                : 'bg-gray-400 text-gray-600 cursor-not-allowed'
            }`}
          >
            <RotateCcw className={`w-4 h-4 ${isFetchingRanks ? 'animate-spin' : ''}`} />
            Monthly Refresh
          </button>
        </div>
      </div>

      {/* Hidden file input for CSV upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleCSVUpload}
        className="hidden"
      />

      {isAddingKeyword && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleAddKeyword} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Enter keyword (e.g., 'digital marketing')"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Keywords Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Start by adding keywords to track for this client</p>
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
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="max-h-[calc(100vh-14rem)] overflow-auto shadow-md relative">
            <table className="w-full">
              <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedKeywords.size === clientKeywords.length && clientKeywords.length > 0}
                      onChange={selectAllKeywords}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Change
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Checked
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedKeywords.map((keyword) => {
                  const rankChange = keyword.current_month_rank && keyword.previous_month_rank
                    ? keyword.previous_month_rank - keyword.current_month_rank
                    : null;

                  return (
                    <tr key={keyword.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
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
                              {format(new Date(keyword.current_month_date), 'MMM d')}
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
                          <button
                            onClick={() => handleDeleteKeyword(keyword.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
    </div>
  );
}