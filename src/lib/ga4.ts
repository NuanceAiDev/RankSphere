// Legacy file - kept for backwards compatibility
// All GA4 functionality has been moved to src/services/ga4.ts

export { fetchGA4Data } from '../services/ga4';

export function isGA4Configured(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_FUNCTIONS_URL && import.meta.env.VITE_SUPABASE_ANON_KEY && import.meta.env.VITE_GA4_PROPERTY_ID);
}

// Remove old unused exports
export async function fetchGA4Analytics(): Promise<any> {
  throw new Error('fetchGA4Analytics is deprecated. Use fetchGA4Data from src/services/ga4.ts instead.');
}