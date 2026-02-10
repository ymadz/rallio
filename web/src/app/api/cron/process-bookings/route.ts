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

        return NextResponse.json({
            success: true,
            processedAt: nowIso,
            started: startResult.data.length,
            ended: endResult.data.length,
            reverted: revertResult.data.length,
            startedIds: startResult.data.map(r => r.id),
            endedIds: endResult.data.map(r => r.id),
            revertedIds: revertResult.data.map(r => r.id)
        })

    } catch (error: any) {
        console.error('[ProcessBookings] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
