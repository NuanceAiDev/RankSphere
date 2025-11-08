// /supabase/functions/_shared/cors.ts

// IMPORTANT: Add your Bolt preview URL and Vercel URL here.
const ALLOWED_ORIGINS = [
  'https://rank-sphere.vercel.app', // Your Vercel app
  'https://zplv56uxy8rdx5ypatb0ockb9tr6a-oci3--5173--cf284e50.local-credentialless.webcontainer-api.io', // Your Bolt URL
  'http://localhost:5173' // Your local dev environment
]

export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.join(', '), 
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}