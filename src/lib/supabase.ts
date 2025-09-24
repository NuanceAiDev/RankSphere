import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('=== SUPABASE INITIALIZATION ===');
console.log('URL:', supabaseUrl);
console.log('Key exists:', !!supabaseAnonKey);
console.log('Key length:', supabaseAnonKey?.length);

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);