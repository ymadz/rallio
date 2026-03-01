// Supabase Edge Function: Reservation Maintenance
// Purpose: Runs periodic maintenance on reservations:
//   1. Expires stale pending_payment reservations (e-wallet timeout, cash deadline)
//   2. Marks confirmed reservations as ongoing when start_time arrives
//   3. Auto-completes past reservations after end_time
//   4. Closes expired queue sessions
// Trigger: Scheduled cron (every 5 minutes) or manual invocation
// Schedule: */5 * * * *

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MaintenanceResult {
  success: boolean
  processedAt: string
  expiredReservations: number
  markedOngoing: number
  autoCompleted: number
  error?: string
  details?: Record<string, unknown>
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const processedAt = new Date().toISOString()
  console.log(`[reservation-maintenance] Starting at ${processedAt}`)

  try {
    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Call the combined maintenance function from migration 037
    const { data, error } = await supabase.rpc('run_reservation_maintenance')

    if (error) {
      console.error('[reservation-maintenance] RPC error:', error)

      // Fallback: run individual operations if RPC not available (migration not applied yet)
      console.log('[reservation-maintenance] Falling back to direct queries...')

      const result = await runMaintenanceFallback(supabase)

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const result: MaintenanceResult = {
      success: true,
      processedAt,
      expiredReservations: data?.expired_reservations ?? 0,
      markedOngoing: data?.marked_ongoing ?? 0,
      autoCompleted: data?.auto_completed ?? 0,
      details: data,
    }

    console.log('[reservation-maintenance] Result:', JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[reservation-maintenance] Error:', errorMessage)

    return new Response(
      JSON.stringify({
        success: false,
        processedAt,
        error: errorMessage,
        expiredReservations: 0,
        markedOngoing: 0,
        autoCompleted: 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

/**
 * Fallback implementation if the RPC function is not available.
 * Runs the same logic as run_reservation_maintenance() but via direct queries.
 */
async function runMaintenanceFallback(
  supabase: ReturnType<typeof createClient>
): Promise<MaintenanceResult> {
  const processedAt = new Date().toISOString()
  const now = new Date().toISOString()
  let expiredCount = 0
  let ongoingCount = 0
  let completedCount = 0

  // 1. Expire e-wallet reservations (> 20 min without payment)
  const { data: expiredEwallet } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancellation_reason: 'Payment expired - e-wallet payment not completed within time limit',
    })
    .eq('status', 'pending_payment')
    .eq('payment_method', 'e-wallet')
    .lt('created_at', new Date(Date.now() - 20 * 60 * 1000).toISOString())
    .select('id')

  expiredCount += expiredEwallet?.length ?? 0

  // 2. Expire cash reservations past their deadline
  const { data: expiredCash } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancellation_reason: 'Cash payment deadline expired',
    })
    .eq('status', 'pending_payment')
    .eq('payment_method', 'cash')
    .not('cash_payment_deadline', 'is', null)
    .lt('cash_payment_deadline', now)
    .select('id')

  expiredCount += expiredCash?.length ?? 0

  // 3. Expire cash reservations past start_time (no deadline set, 30 min grace)
  const { data: expiredCashNoDeadline } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancellation_reason: 'Cash payment not received - session start time passed',
    })
    .eq('status', 'pending_payment')
    .eq('payment_method', 'cash')
    .is('cash_payment_deadline', null)
    .lt('start_time', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .select('id')

  expiredCount += expiredCashNoDeadline?.length ?? 0

  // 4. Expire stale reservations with no payment method (> 24 hours)
  const { data: expiredStale } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: now,
      cancellation_reason: 'Reservation expired - no payment activity',
    })
    .eq('status', 'pending_payment')
    .is('payment_method', null)
    .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .select('id')

  expiredCount += expiredStale?.length ?? 0

  // 5. Mark confirmed → ongoing (start_time arrived)
  const { data: markedOngoing } = await supabase
    .from('reservations')
    .update({ status: 'ongoing' })
    .eq('status', 'confirmed')
    .lte('start_time', now)
    .gt('end_time', now)
    .select('id')

  ongoingCount = markedOngoing?.length ?? 0

  // 6. Auto-complete past reservations
  const { data: autoCompleted } = await supabase
    .from('reservations')
    .update({ status: 'completed' })
    .in('status', ['confirmed', 'ongoing'])
    .lt('end_time', now)
    .select('id')

  completedCount = autoCompleted?.length ?? 0

  // 7. Close expired queue sessions
  await supabase
    .from('queue_sessions')
    .update({ status: 'closed', updated_at: now })
    .in('status', ['open', 'active', 'paused'])
    .lt('end_time', now)

  return {
    success: true,
    processedAt,
    expiredReservations: expiredCount,
    markedOngoing: ongoingCount,
    autoCompleted: completedCount,
    details: {
      expired_ewallet: expiredEwallet?.length ?? 0,
      expired_cash_deadline: expiredCash?.length ?? 0,
      expired_cash_no_deadline: expiredCashNoDeadline?.length ?? 0,
      expired_stale: expiredStale?.length ?? 0,
    },
  }
}
