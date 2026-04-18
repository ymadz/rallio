// Supabase Edge Function: Expire Stale Bookings
// Purpose: Automatically cancels bookings/reservations that have been pending payment for too long
// Trigger: Scheduled (cron) or manual invocation
// Schedule: Recommended to run every 5-10 minutes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[expire-bookings] 🚀 Starting stale booking expiration process...')

    // Create Supabase client with service role key
    // This bypasses RLS and allows the function to cancel bookings
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Call the database function to cancel stale bookings
    const { data, error } = await supabaseClient.rpc('expire_stale_bookings')

    if (error) {
      console.error('[expire-bookings] ❌ Database error:', error)
      throw error
    }

    console.log('[expire-bookings] ✅ Process completed:', data)

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data,
        message: 'Successfully ran expire_stale_bookings',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[expire-bookings] ❌ Error:', error)

    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
