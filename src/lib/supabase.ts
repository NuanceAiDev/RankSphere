import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('=== SUPABASE INITIALIZATION ===');
console.log('URL:', supabaseUrl);
console.log('Key exists:', !!supabaseAnonKey);
console.log('Key length:', supabaseAnonKey?.length);

// Create a mock client when environment variables are not configured
const createSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not configured. Using mock client.');
    // Return a mock client that throws helpful errors
    return {
      from: () => ({
        select: () => Promise.resolve({ data: [], error: new Error('Supabase not configured. Please connect to Supabase.') }),
        insert: () => Promise.resolve({ data: null, error: new Error('Supabase not configured. Please connect to Supabase.') }),
        update: () => Promise.resolve({ data: null, error: new Error('Supabase not configured. Please connect to Supabase.') }),
        delete: () => Promise.resolve({ data: null, error: new Error('Supabase not configured. Please connect to Supabase.') }),
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