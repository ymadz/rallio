import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getServerNow } from '@/lib/time-server'
import { OPEN_BEFORE_START_HOURS } from '@/lib/queue-status'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const supabase = createServiceClient()
        const now = await getServerNow()
        const nowIso = now.toISOString()
        
        // Calculate the time threshold for opening sessions (2 hours before start)
        const openThreshold = new Date(now.getTime() + OPEN_BEFORE_START_HOURS * 60 * 60 * 1000)
        const openThresholdIso = openThreshold.toISOString()

        // =====================
        // RESERVATION LIFECYCLE
        // =====================

        // 1. Start Games: confirmed -> ongoing
        // We look for reservations that are 'confirmed' and start_time has passed
        const startResult = await supabase
            .from('reservations')
            .update({ status: 'ongoing' })
            .eq('status', 'confirmed')
            .lte('start_time', nowIso)
            .gt('end_time', nowIso)
            .select('id')

        if (startResult.error) {
            throw new Error(`Failed to start games: ${startResult.error.message}`)
        }

        // 2. End Games: ongoing -> completed
        // We look for reservations that are 'ongoing' and end_time has passed
        const endResult = await supabase
            .from('reservations')
            .update({ status: 'completed' })
            .eq('status', 'ongoing')
            .lte('end_time', nowIso)
            .select('id')

        if (endResult.error) {
            throw new Error(`Failed to end games: ${endResult.error.message}`)
        }

        // 2b. Also complete confirmed reservations whose end_time has passed
        // (edge case: start_time was never caught, or very short booking)
        const completedConfirmedResult = await supabase
            .from('reservations')
            .update({ status: 'completed' })
            .eq('status', 'confirmed')
            .lte('end_time', nowIso)
            .select('id')

        if (completedConfirmedResult.error) {
            throw new Error(`Failed to complete confirmed: ${completedConfirmedResult.error.message}`)
        }

        // 3. Revert Games (Time Travel Support): ongoing -> confirmed
        // If we travelled back in time, we need to revert active games to confirmed
        const revertResult = await supabase
            .from('reservations')
            .update({ status: 'confirmed' })
            .eq('status', 'ongoing')
            .gt('start_time', nowIso)
            .select('id')

        if (revertResult.error) {
            throw new Error(`Failed to revert games: ${revertResult.error.message}`)
        }

        // =========================
        // QUEUE SESSION LIFECYCLE
        // =========================
        // Lifecycle: pending_payment → upcoming → open → active → completed
        // - pending_payment: Waiting for payment (cash or failed e-wallet)
        // - upcoming: Paid, but more than 2 hours before start
        // - open: Within 2 hours of start, players can join
        // - active: Session is live (start_time has passed)
        // - completed: Session ended (end_time has passed)

        // 4. Complete expired queue sessions: active/open → completed
        const completeSessionsResult = await supabase
            .from('queue_sessions')
            .update({ status: 'completed', updated_at: nowIso })
            .in('status', ['open', 'active', 'paused'])
            .lte('end_time', nowIso)
            .select('id')

        if (completeSessionsResult.error) {
            console.error('[ProcessBookings] Failed to complete sessions:', completeSessionsResult.error)
        }

        // 5. Activate queue sessions: open → active (at start_time)
        const activateSessionsResult = await supabase
            .from('queue_sessions')
            .update({ status: 'active', updated_at: nowIso })
            .eq('status', 'open')
            .lte('start_time', nowIso)
            .gt('end_time', nowIso)
            .select('id')

        if (activateSessionsResult.error) {
            console.error('[ProcessBookings] Failed to activate sessions:', activateSessionsResult.error)
        }

        // 6. Open queue sessions: upcoming → open (2 hours before start)
        const openSessionsResult = await supabase
            .from('queue_sessions')
            .update({ status: 'open', updated_at: nowIso })
            .eq('status', 'upcoming')
            .lte('start_time', openThresholdIso) // start_time is within 2 hours from now
            .gt('end_time', nowIso)
            .select('id')

        if (openSessionsResult.error) {
            console.error('[ProcessBookings] Failed to open sessions:', openSessionsResult.error)
        }

        // =========================
        // TIME TRAVEL SUPPORT
        // =========================
        // Revert sessions if we traveled back in time

        // 7. Revert completed → active if end_time is still in the future
        const revertCompletedResult = await supabase
            .from('queue_sessions')
            .update({ status: 'active', updated_at: nowIso })
            .eq('status', 'completed')
            .lte('start_time', nowIso)
            .gt('end_time', nowIso)
            .select('id')

        if (revertCompletedResult.error) {
            console.error('[ProcessBookings] Failed to revert completed sessions:', revertCompletedResult.error)
        }

        // 8. Revert active → open if start_time is still in the future (but within 2h)
        const revertActiveResult = await supabase
            .from('queue_sessions')
            .update({ status: 'open', updated_at: nowIso })
            .eq('status', 'active')
            .gt('start_time', nowIso)
            .lte('start_time', openThresholdIso)
            .select('id')

        if (revertActiveResult.error) {
            console.error('[ProcessBookings] Failed to revert active sessions:', revertActiveResult.error)
        }

        // 9. Revert open/active → upcoming if start_time is more than 2h away
        const revertToUpcomingResult = await supabase
            .from('queue_sessions')
            .update({ status: 'upcoming', updated_at: nowIso })
            .in('status', ['open', 'active'])
            .gt('start_time', openThresholdIso)
            .select('id')

        if (revertToUpcomingResult.error) {
            console.error('[ProcessBookings] Failed to revert to upcoming:', revertToUpcomingResult.error)
        }

        // Note: The DB trigger trg_queue_session_closed (migration 039) will
        // automatically complete linked reservations when sessions complete above.

        return NextResponse.json({
            success: true,
            processedAt: nowIso,
            // Reservations
            started: startResult.data.length,
            ended: endResult.data.length + (completedConfirmedResult.data?.length || 0),
            reverted: revertResult.data.length,
            // Queue Sessions
            sessionsCompleted: completeSessionsResult.data?.length || 0,
            sessionsActivated: activateSessionsResult.data?.length || 0,
            sessionsOpened: openSessionsResult.data?.length || 0,
            sessionsRevertedToActive: revertCompletedResult.data?.length || 0,
            sessionsRevertedToOpen: revertActiveResult.data?.length || 0,
            sessionsRevertedToUpcoming: revertToUpcomingResult.data?.length || 0,
            // IDs for debugging
            startedIds: startResult.data.map(r => r.id),
            endedIds: [
                ...endResult.data.map(r => r.id),
                ...(completedConfirmedResult.data?.map(r => r.id) || []),
            ],
            revertedIds: revertResult.data.map(r => r.id),
        })

    } catch (error: any) {
        console.error('[ProcessBookings] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
