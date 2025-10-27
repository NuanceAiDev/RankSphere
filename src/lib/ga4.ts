// Legacy file - all GA4 functionality has been moved to src/services/ga4.ts
// This file is kept for backwards compatibility but should not be used

export function isGA4Configured(): boolean {
  return !!(
    import.meta.env.VITE_SUPABASE_FUNCTIONS_URL && 
    import.meta.env.VITE_SUPABASE_ANON_KEY && 
    import.meta.env.VITE_GA4_PROPERTY_ID
  );
}

// Deprecated - use fetchGA4Data from src/services/ga4.ts instead
export async function fetchGA4Analytics(): Promise<any> {
  throw new Error('fetchGA4Analytics is deprecated. Use fetchGA4Data from src/services/ga4.ts instead.');
}