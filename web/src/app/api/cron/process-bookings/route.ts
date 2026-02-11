import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getServerNow } from '@/lib/time-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const supabase = createServiceClient()
        const now = await getServerNow()
        const nowIso = now.toISOString()

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

        // 4. Auto-close expired queue sessions
        // Close sessions that are past their end_time
        const closeSessionsResult = await supabase
            .from('queue_sessions')
            .update({ status: 'closed', updated_at: nowIso })
            .in('status', ['open', 'active', 'paused'])
            .lte('end_time', nowIso)
            .select('id')

        if (closeSessionsResult.error) {
            console.error('[ProcessBookings] Failed to close sessions:', closeSessionsResult.error)
        }

        // 5. Auto-activate queue sessions whose start_time has arrived
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

        // Note: The DB trigger trg_queue_session_closed (migration 039) will
        // automatically complete linked reservations when sessions close above.

        return NextResponse.json({
            success: true,
            processedAt: nowIso,
            started: startResult.data.length,
            ended: endResult.data.length + (completedConfirmedResult.data?.length || 0),
            reverted: revertResult.data.length,
            sessionsClosed: closeSessionsResult.data?.length || 0,
            sessionsActivated: activateSessionsResult.data?.length || 0,
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
