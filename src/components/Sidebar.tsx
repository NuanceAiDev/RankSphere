import React, { useState } from 'react';
import { Plus, Moon, Sun, Users, TrendingUp, CreditCard as Edit2, Trash2, Search, Filter } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Client, Keyword } from '../types';

interface SidebarProps {
  clients: Client[];
  keywords: Keyword[];
  selectedClient: Client | null;
  onSelectClient: (client: Client | null) => void;
  onAddClient: () => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (client: Client) => void;
}

export function Sidebar({ 
  clients, 
  keywords,
  selectedClient, 
  onSelectClient, 
  onAddClient, 
  onEditClient, 
  onDeleteClient 
}: SidebarProps) {
  const { isDark, toggleTheme } = useTheme();
  const [hoveredClient, setHoveredClient] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportFilter, setReportFilter] = useState<'all' | 'generated' | 'pending'>('all');

  // Check if client has report done for current month
  const hasReportDoneThisMonth = (client: Client): boolean => {
    if (!client.report_done_month) return false;
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const currentMonthYear = `${currentYear}-${currentMonth}`;
    
    return client.report_done_month === currentMonthYear;
  };

  // Filter clients based on search term and report status
  const filteredClients = clients.filter(client => {
    // Search filter
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.domain.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Report status filter
    if (reportFilter === 'generated') {
      return hasReportDoneThisMonth(client);
    } else if (reportFilter === 'pending') {
      return !hasReportDoneThisMonth(client);
    }
    
    return true; // 'all' filter
  });

  // Get status indicator for client based on report_done_month
  const getClientStatusIndicator = (clientId: string): string => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return '🔴';
    
    return hasReportDoneThisMonth(client) ? '🟢' : '🔴';
  };

  return (
    <div className="fixed left-0 top-0 h-full w-80 bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-zinc-800">
        {/* Logo */}
        <div className="flex items-center justify-center mb-3">
          <img
            src="/pp-logo.png"
            alt="Nuance Digital"
            className="h-12 w-auto object-contain"
          />
        </div>

        <button
          onClick={onAddClient}
          className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-xl transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-1">
          <button
            onClick={() => onSelectClient(null)}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors duration-150 ${
              !selectedClient
                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                : 'hover:bg-gray-100 dark:hover:bg-zinc-900 text-gray-600 dark:text-zinc-400'
            }`}
          >
            <div className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center ${
              !selectedClient
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                : 'bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
            }`}>
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Agency Overview</div>
              <div className="text-xs text-gray-400 dark:text-zinc-500 leading-tight">All clients summary</div>
            </div>
          </button>

          {clients.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="px-2 py-1 text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                  Clients ({filteredClients.length})
                </h3>
              </div>
              
              {/* Report Status Filter */}
              <div className="mb-3">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={reportFilter}
                    onChange={(e) => setReportFilter(e.target.value as 'all' | 'generated' | 'pending')}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-200 appearance-none"
                  >
                    <option value="all">All Clients</option>
                    <option value="generated">Reports Generated (This Month)</option>
                    <option value="pending">Reports Pending (This Month)</option>
                  </select>
                </div>
              </div>

              {/* Search Bar — sleek, borderless, Apple-style */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-xl bg-gray-100 dark:bg-zinc-900 text-gray-900 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-400/40 border dark:border-zinc-800"
                />
              </div>

              <div className="space-y-0.5">
                {[...filteredClients].sort((a, b) => a.name.localeCompare(b.name)).map((client) => (
                  <div
                    key={client.id}
                    className="relative group"
                    onMouseEnter={() => setHoveredClient(client.id)}
                    onMouseLeave={() => setHoveredClient(null)}
                  >
                    <button
                      onClick={() => onSelectClient(client)}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors duration-150 ${
                        selectedClient?.id === client.id
                          ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-zinc-900 text-gray-700 dark:text-zinc-300'
                      }`}
                    >
                      {/* Compact avatar */}
                      <div className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                        selectedClient?.id === client.id
                          ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                      }`}>
                        {client.name.charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0 pr-8">
                        <div className="text-sm font-semibold truncate leading-tight flex items-center gap-1">
                          <span className="text-xs leading-none">{getClientStatusIndicator(client.id)}</span>
                          {client.name}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-zinc-500 truncate leading-tight">{client.domain}</div>
                      </div>
                    </button>

                    {/* Action buttons — visible on hover */}
                    {hoveredClient === client.id && (
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditClient(client); }}
                          className="p-1 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteClient(client); }}
                          className="p-1 rounded-md bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-800 text-red-500 dark:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {filteredClients.length === 0 && searchTerm && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 dark:text-zinc-400">No clients found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer — Theme Toggle */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-zinc-800">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-gray-500 dark:text-zinc-300 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors duration-150"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-yellow-500" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}