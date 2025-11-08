// /supabase/functions/test-ga4/index.ts

import { serve } from 'https"deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts' // Importing the shared file

serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const data = { message: `Hello from test-ga4! CORS is enabled.` }
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})