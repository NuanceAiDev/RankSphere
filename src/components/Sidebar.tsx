import React, { useState } from 'react';
import { Plus, Moon, Sun, Users, TrendingUp, CreditCard as Edit2, Trash2, Search, Filter } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Client, Keyword } from '../types';
import { isReportDone, cleanupOldStatuses } from '../utils/reportStatus';

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

  // Cleanup old statuses on component mount
  React.useEffect(() => {
    cleanupOldStatuses();
  }, []);

  // Check if client has report done for current month
  const hasReportDoneThisMonth = (client: Client): boolean => {
    return isReportDone(client.id);
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
    <div className="fixed left-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img 
              src="/pp-new.png" 
              alt="Nuance Digital" 
              className="h-18 w-auto"
            />
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>
        
        <button
          onClick={onAddClient}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-3 rounded-lg transition-all duration-200 transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          Add Client
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <button
            onClick={() => onSelectClient(null)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              !selectedClient
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 shadow-md'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <div>
              <div className="font-medium">Agency Overview</div>
              <div className="text-sm opacity-75">All clients summary</div>
            </div>
          </button>

          {clients.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="px-4 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none"
                  >
                    <option value="all">All Clients</option>
                    <option value="generated">Reports Generated (This Month)</option>
                    <option value="pending">Reports Pending (This Month)</option>
                  </select>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="relative group"
                    onMouseEnter={() => setHoveredClient(client.id)}
                    onMouseLeave={() => setHoveredClient(null)}
                  >
                    <button
                      onClick={() => onSelectClient(client)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                        selectedClient?.id === client.id
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate flex items-center gap-2">
                          <span className="text-xs">{getClientStatusIndicator(client.id)}</span>
                          {client.name}
                        </div>
                        <div className="text-sm opacity-75 truncate">{client.domain}</div>
                      </div>
                    </button>
                    
                    {/* Action buttons */}
                    {hoveredClient === client.id && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditClient(client);
                          }}
                          className="p-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClient(client);
                          }}
                          className="p-1.5 rounded bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-400 transition-colors"
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">No clients found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}