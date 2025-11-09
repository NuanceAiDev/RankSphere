import { createClient } from '@supabase/supabase-js';

// --- START OF HARD-CODED FIX ---
// We are bypassing the .env file to fix the 401 error

export const supabaseUrl = 'https://ehbagbwhldczdyhpckbt.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoYmFnYndobGRjemR5aHBja2J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNTM4MjgsImV4cCI6MjA3MDkyOTgyOH0.k09U97UbG9ZTTQXT4Ah37-1B2s01c8uYBXG7Uo6TdZU'; // <-- PASTE THE REAL KEY

// --- END OF HARD-CODED FIX ---

console.log('=== SUPABASE INITIALIZATION ===');
console.log('URL:', supabaseUrl);
console.log('Key exists:', !!supabaseAnonKey);
console.log('Key length:', supabaseAnonKey?.length);

// Retry utility for database operations
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isRetryableError = 
        error?.message?.includes('schema cache') ||
        error?.message?.includes('PGRST002') ||
        error?.message?.includes('column') ||
        error?.message?.includes('does not exist') ||
        error?.code === 'PGRST002';
      
      if (attempt === maxRetries || !isRetryableError) {
        throw error;
      }
      
      console.warn(`Attempt ${attempt} failed (schema/column issue), retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error('Max retries exceeded');
};

// Create a mock client when environment variables are not configured
const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not configured. Using mock client.');
    // Return a mock client that throws helpful errors
    return {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: new Error('Supabase not configured. Please connect to Supabase first.') }),
        insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured. Please connect to Supabase first.') }),
        update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured. Please connect to Supabase first.') }),
        delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured. Please connect to Supabase first.') }),
        eq: function() { return this; },
        order: function() { return this; },
        single: function() { return this; }
      })
    } as any;
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = createSupabaseClient();

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);