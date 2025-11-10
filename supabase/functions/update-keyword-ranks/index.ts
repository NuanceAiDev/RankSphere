import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValueSERPResponse {
  organic_results?: Array<{
    position: number;
    link: string;
    title: string;
    snippet: string;
  }>;
  search_information?: {
    total_results: number;
  };
}

interface RankingData {
  rank: number | null;
  url?: string;
}

async function fetchKeywordRanking(
  domain: string, 
  keyword: string, 
  rankType: 'dubai' | 'qatar' = 'qatar'
): Promise<RankingData> {
  const VALUESERP_API_KEY = Deno.env.get('VALUESERP_API_KEY');
  
  if (!VALUESERP_API_KEY) {
    console.error('ValueSERP API key not found in environment variables');
    throw new Error('ValueSERP API key not configured');
  }

  const BASE_URL = 'https://api.valueserp.com/search';

  try {
    const baseParams = {
      api_key: VALUESERP_API_KEY,
      q: keyword,
      output: 'json',
      num: '100' // Get top 100 results to find domain
    };

    // Add location-specific parameters based on rank type
    const params = new URLSearchParams(baseParams);
    if (rankType === 'qatar') {
      params.append('google_domain', 'google.com.qa');
      params.append('location', 'Doha, Qatar');
      params.append('gl', 'qa');
      params.append('hl', 'en');
      params.append('device', 'desktop');
    } else if (rankType === 'dubai') {
      params.append('google_domain', 'google.ae');
      params.append('location', 'Dubai, United Arab Emirates');
      params.append('gl', 'ae');
      params.append('hl', 'en');
      params.append('device', 'desktop');
    } else {
      // Default fallback
      params.append('google_domain', 'google.com');
      params.append('location', 'United States');
      params.append('gl', 'us');
      params.append('hl', 'en');
      params.append('device', 'desktop');
    }
    
    const response = await fetch(`${BASE_URL}?${params}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ValueSERP API Error: ${response.status} - ${errorText}`);
    }
    
    const data: ValueSERPResponse = await response.json();
    
    // Search for the domain in organic results
    let rank = null;
    let url = null;
    
    if (data.organic_results && Array.isArray(data.organic_results)) {
      for (let i = 0; i < data.organic_results.length; i++) {
        const result = data.organic_results[i];
        if (result.link && result.link.includes(domain)) {
          rank = result.position || (i + 1);
          url = result.link;
          break;
        }
      }
    }
    
    return {
      rank,
      url
    };
  } catch (error) {
    console.error('ValueSERP API Error:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { clientId, keywords } = await req.json()

    if (!clientId || !keywords || !Array.isArray(keywords)) {
      return new Response(
        JSON.stringify({ error: 'Missing clientId or keywords array' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get client information to determine rank type and domain
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('domain, rank_type')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const results = []
    const rankType = client.rank_type || 'qatar'

    // Process each keyword
    for (const keyword of keywords) {
      try {
        // Fetch ranking data from ValueSERP
        const rankingData = await fetchKeywordRanking(client.domain, keyword.text, rankType)
        
        // Update keyword in database
        const { error: updateError } = await supabaseClient
          .from('keywords')
          .update({
            current_month_rank: rankingData.rank,
            current_month_date: new Date().toISOString().split('T')[0],
            last_checked: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', keyword.id)

        if (updateError) {
          console.error(`Error updating keyword ${keyword.text}:`, updateError)
          results.push({
            keywordId: keyword.id,
            keyword: keyword.text,
            success: false,
            error: updateError.message
          })
        } else {
          results.push({
            keywordId: keyword.id,
            keyword: keyword.text,
            success: true,
            rank: rankingData.rank,
            url: rankingData.url
          })
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Error processing keyword ${keyword.text}:`, error)
        results.push({
          keywordId: keyword.id,
          keyword: keyword.text,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        totalProcessed: keywords.length,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Edge Function Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})