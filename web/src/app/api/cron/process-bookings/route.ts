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

        // =====================
        // RESERVATION LIFECYCLE
        // =====================

        // 1. Start Games: confirmed -> ongoing
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
        // Lifecycle: pending_payment → open → active → completed
        // - pending_payment: Waiting for payment (cash or e-wallet)
        // - open: Paid, players can join (within join window)
        // - active: Session is live (start_time has passed)
        // - completed: Session ended (end_time has passed) or QM manually closed

        // 4. Complete expired queue sessions: open/active → completed
        // IMPORTANT: Skip sessions that were manually closed by QM (settings.manually_closed = true)
        // Those are already 'completed' and shouldn't be touched.
        const completeSessionsResult = await supabase
            .from('queue_sessions')
            .update({ status: 'completed', updated_at: nowIso })
            .in('status', ['open', 'active'])
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

        // =========================
        // TIME TRAVEL SUPPORT
        // =========================
        // Revert sessions if we traveled back in time

        // 6. Revert completed → active if end_time is still in the future
        // BUT skip manually closed sessions — QM closed them intentionally
        // We fetch candidates first and filter out manually_closed ones
        const { data: completedCandidates } = await supabase
            .from('queue_sessions')
            .select('id, settings')
            .eq('status', 'completed')
            .lte('start_time', nowIso)
            .gt('end_time', nowIso)

        const revertableCompleted = (completedCandidates || [])
            .filter(s => !s.settings?.manually_closed)
            .map(s => s.id)

        let revertCompletedCount = 0
        if (revertableCompleted.length > 0) {
            const revertCompletedResult = await supabase
                .from('queue_sessions')
                .update({ status: 'active', updated_at: nowIso })
                .in('id', revertableCompleted)
                .select('id')

            if (revertCompletedResult.error) {
                console.error('[ProcessBookings] Failed to revert completed sessions:', revertCompletedResult.error)
            }
            revertCompletedCount = revertCompletedResult.data?.length || 0
        }

        // 7. Revert active → open if start_time is still in the future
        const revertActiveResult = await supabase
            .from('queue_sessions')
            .update({ status: 'open', updated_at: nowIso })
            .eq('status', 'active')
            .gt('start_time', nowIso)
            .select('id')

        if (revertActiveResult.error) {
            console.error('[ProcessBookings] Failed to revert active sessions:', revertActiveResult.error)
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
            sessionsRevertedToActive: revertCompletedCount,
            sessionsRevertedToOpen: revertActiveResult.data?.length || 0,
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
