import { NextRequest, NextResponse } from 'next/server'
import { rescheduleReservationAction } from '@/app/actions/reschedule-actions'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader) {
            return NextResponse.json({ success: false, error: 'Missing Authorization header' }, { status: 401 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { reservationId, newDate, newStartTime } = body

        if (!reservationId || !newDate || !newStartTime) {
            return NextResponse.json(
                { success: false, error: 'reservationId, newDate, and newStartTime are required' },
                { status: 400 }
            )
        }

        const result = await rescheduleReservationAction(
            reservationId,
            new Date(newDate),
            newStartTime
        )

        if (!result.success) {
            return NextResponse.json(result, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('API Reschedule Reservation Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
