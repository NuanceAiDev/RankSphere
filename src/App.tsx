import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { Overview } from './components/Overview';
import { Keywords } from './components/Keywords';
import { Rankings } from './components/Rankings';
import { Analytics } from './components/Analytics';
import { ClientModal } from './components/ClientModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { Client, Keyword } from './types';
import { supabase, isSupabaseConfigured, retryOperation } from './lib/supabase';
import toast from 'react-hot-toast';

function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'keywords' | 'rankings'>('overview');
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  useEffect(() => {
    loadClients();
    loadKeywords();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await retryOperation(async () => {
        return await supabase
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false });
      });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('schema cache') || errorMessage.includes('PGRST002')) {
        toast.error('Database is initializing. Please wait a moment and refresh the page.');
      } else if (errorMessage.includes('not configured')) {
        toast.error('Please connect to Supabase first');
      } else {
        toast.error('Failed to load clients. Please check your connection.');
      }
    }
  };

  const loadKeywords = async () => {
    try {
      const { data, error } = await retryOperation(async () => {
        return await supabase
          .from('keywords')
          .select('*')
          .order('created_at', { ascending: false });
      });

      if (error) throw error;
      setKeywords(data || []);
    } catch (error) {
      console.error('Error loading keywords:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('schema cache') || errorMessage.includes('PGRST002')) {
        toast.error('Database is initializing. Please wait a moment and refresh the page.');
      } else if (errorMessage.includes('not configured')) {
        toast.error('Please connect to Supabase first');
      } else {
        toast.error('Failed to load keywords. Please check your connection.');
      }
    }
  };

  const handleAddClient = async (name: string, domain: string, industry?: string) => {
    if (!isSupabaseConfigured) {
      toast.error('Please connect to Supabase first');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({ name, domain, industry })
        .select()
        .single();

      if (error) throw error;

      setClients([data, ...clients]);
      toast.success('Client added successfully!');
      setShowClientModal(false);
    } catch (error) {
      console.error('Error adding client:', error);
      toast.error('Failed to add client');
    }
  };

  const handleEditClient = async (name: string, domain: string, industry?: string) => {
    if (!editingClient) return;

    try {
      const { data, error } = await supabase
        .from('clients')
        .update({ name, domain, industry })
        .eq('id', editingClient.id)
        .select()
        .single();

      if (error) throw error;

      setClients(clients.map(c => c.id === editingClient.id ? data : c));
      toast.success('Client updated successfully!');
      setShowClientModal(false);
      setEditingClient(null);
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Failed to update client');
    }
  };

  const handleDeleteClient = async (client: Client) => {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      setClients(clients.filter(c => c.id !== client.id));
      setKeywords(keywords.filter(k => k.client_id !== client.id));
      
      if (selectedClient?.id === client.id) {
        setSelectedClient(null);
      }
      
      toast.success('Client deleted successfully!');
      setClientToDelete(null);
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Failed to delete client');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'keywords', label: 'Keywords' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'rankings', label: 'Report' },
  ] as const;

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Sidebar
          clients={clients}
          selectedClient={selectedClient}
          onSelectClient={setSelectedClient}
          onAddClient={() => setShowClientModal(true)}
          onEditClient={(client) => {
            setEditingClient(client);
            setShowClientModal(true);
          }}
          onDeleteClient={setClientToDelete}
        />

        <div className="ml-80 p-8">
          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <Overview
              selectedClient={selectedClient}
              clients={clients}
              keywords={keywords}
            />
          )}

          {activeTab === 'keywords' && (
            <Keywords
              selectedClient={selectedClient}
              keywords={keywords}
              onKeywordAdded={loadKeywords}
              onClientUpdated={loadClients}
            />
          )}

          {activeTab === 'analytics' && (
            <Analytics
              selectedClient={selectedClient}
            />
          )}

          {activeTab === 'rankings' && (
            <Rankings
              selectedClient={selectedClient}
              keywords={keywords}
              onClientUpdated={loadClients}
            />
          )}
        </div>

        {/* Modals */}
        <ClientModal
          isOpen={showClientModal}
          onClose={() => {
            setShowClientModal(false);
            setEditingClient(null);
          }}
          onSubmit={editingClient ? handleEditClient : handleAddClient}
          editingClient={editingClient}
        />

        <DeleteConfirmModal
          isOpen={!!clientToDelete}
          onClose={() => setClientToDelete(null)}
          onConfirm={() => clientToDelete && handleDeleteClient(clientToDelete)}
          title="Delete Client"
          message={`Are you sure you want to delete "${clientToDelete?.name}"? This will also delete all associated keywords and cannot be undone.`}
        />

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
          }}
        />
      </div>
    </ThemeProvider>
  );
}

export default App;