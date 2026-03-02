import { NextRequest, NextResponse } from 'next/server'
import { getAvailableTimeSlotsAction } from '@/app/actions/reservations'

/**
 * GET /api/mobile/get-time-slots?courtId=<uuid>&date=<yyyy-MM-dd>
 *
 * Returns available time slots for a court on a given date.
 * Uses the service client internally so it correctly accounts for:
 *  - All reservation statuses (bypasses RLS)
 *  - Active queue sessions on the same court
 *  - Venue operating hours (open / closed days)
 *  - Asia/Manila timezone for accurate same-day "past slot" detection
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const courtId = searchParams.get('courtId')
        const date = searchParams.get('date') // expected format: yyyy-MM-dd

        if (!courtId || !date) {
            return NextResponse.json(
                { error: 'Missing required query params: courtId, date' },
                { status: 400 }
            )
        }

        const slots = await getAvailableTimeSlotsAction(courtId, date)

        return NextResponse.json({ slots })
    } catch (error: any) {
        console.error('[get-time-slots] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
