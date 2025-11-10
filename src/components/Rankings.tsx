import React, { useState, useEffect } from 'react';
import { Client, Keyword } from '../types';

interface RankingsProps {
  selectedClient: Client | null;
  keywords: Keyword[];
  onClientUpdated: () => void;
}

export const Rankings: React.FC<RankingsProps> = ({
  selectedClient,
  keywords,
  onClientUpdated
}) => {
  if (!selectedClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Select a client to view rankings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Rankings for {selectedClient.name}
        </h2>
        
        {keywords.length === 0 ? (
          <p className="text-gray-500">No keywords found for this client.</p>
        ) : (
          <div className="space-y-4">
            {keywords.map((keyword) => (
              <div key={keyword.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{keyword.keyword}</span>
                  <span className="text-sm text-gray-500">
                    Rank: {keyword.rank || 'Not ranked'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};