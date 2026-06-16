// Supabase Edge Function — deletes records older than 2 years
// Deploy via Supabase Dashboard → Edge Functions
// Call manually OR set up a cron webhook to call it monthly

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role key so it can bypass RLS for cleanup
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Optional: pass years_old in request body (default 2)
    let yearsOld = 2;
    try {
      const body = await req.json();
      if (body?.years_old && typeof body.years_old === 'number') {
        yearsOld = Math.max(1, Math.min(10, body.years_old)); // clamp 1-10
      }
    } catch { /* no body is fine */ }

    // Call the DB function we created in SQL
    const { data, error } = await supabaseAdmin.rpc('delete_old_records', {
      years_old: yearsOld,
    });

    if (error) {
      console.error('Cleanup error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Cleanup result:', data);
    return new Response(
      JSON.stringify({ success: true, result: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
