// Supabase Edge Function: Auto-Close Expired Queue Sessions
// Purpose: Automatically closes queue sessions that have passed their end_time
// Trigger: Scheduled (cron) or manual invocation
// Schedule: Recommended to run every 5-10 minutes

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutoCloseResult {
  success: boolean
  processedAt: string
  closedCount: number
  failedCount: number
  closedSessions: Array<{
    sessionId: string
    courtId: string
    endTime: string
    summary: {
      totalGames: number
      totalRevenue: number
      totalParticipants: number
      unpaidBalances: number
      closedAt: string
      closedBy: string
      closedReason: string
    }
  }>
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[auto-close-sessions] 🚀 Starting session closure process...')

    // Create Supabase client with service role key
    // This bypasses RLS and allows the function to close sessions
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

    // Call the database function that handles the closing logic
    const { data, error } = await supabaseClient.rpc('auto_close_expired_sessions')

    if (error) {
      console.error('[auto-close-sessions] ❌ Database error:', error)
      throw error
    }

    const result = data as AutoCloseResult

    console.log('[auto-close-sessions] ✅ Process completed:', {
      closedCount: result.closedCount,
      failedCount: result.failedCount,
    })

    // Log details of closed sessions
    if (result.closedSessions && result.closedSessions.length > 0) {
      console.log('[auto-close-sessions] 📊 Closed sessions:')
      result.closedSessions.forEach((session) => {
        console.log(`  - Session ${session.sessionId}:`, {
          courtId: session.courtId,
          endTime: session.endTime,
          totalGames: session.summary.totalGames,
          totalRevenue: session.summary.totalRevenue,
          participants: session.summary.totalParticipants,
        })
      })
    } else {
      console.log('[auto-close-sessions] ℹ️ No expired sessions found')
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        message: `Successfully closed ${result.closedCount} session(s)`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('[auto-close-sessions] ❌ Error:', error)

    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        processedAt: new Date().toISOString(),
        closedCount: 0,
        failedCount: 0,
        closedSessions: [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
