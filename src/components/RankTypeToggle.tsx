import React from 'react';
import { Client } from '../types';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface RankTypeToggleProps {
  client: Client;
  onUpdate: () => void;
}

export function RankTypeToggle({ client, onUpdate }: RankTypeToggleProps) {
  const [localRankType, setLocalRankType] = React.useState(client.rank_type || 'qatar');

  // Update local state when client prop changes
  React.useEffect(() => {
    setLocalRankType(client.rank_type || 'qatar');
  }, [client.rank_type]);

  const handleToggle = async (rankType: 'dubai' | 'qatar') => {
    // Update UI immediately
    setLocalRankType(rankType);
    
    try {
      const { error } = await supabase
        .from('clients')
        .update({ rank_type: rankType })
        .eq('id', client.id);

      if (error) throw error;

      toast.success(`Rank type updated to ${rankType === 'qatar' ? 'Qatar' : 'Dubai'}`);
      onUpdate();
    } catch (error) {
      console.error('Error updating rank type:', error);
      toast.error('Failed to update rank type');
      // Revert local state on error
      setLocalRankType(client.rank_type || 'qatar');
    }
  };

  return (
    <div className="flex items-center gap-4 mb-6">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Rank Type:</span>
      <div className="flex bg-gray-100 dark:bg-zinc-900 rounded-lg p-1 border border-transparent dark:border-zinc-800">
        <button
          onClick={() => handleToggle('qatar')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            localRankType === 'qatar'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'
          }`}
        >
          Qatar
        </button>
        <button
          onClick={() => handleToggle('dubai')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
            localRankType === 'dubai'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200'
          }`}
        >
          Dubai
        </button>
      </div>
    </div>
  );
}