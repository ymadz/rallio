import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/mobile/get-receipt?reservationId=<uuid>
 *
 * Returns reservation details + payment records + venue info for receipt display.
 */
export async function GET(request: NextRequest) {
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

        const searchParams = request.nextUrl.searchParams
        const reservationId = searchParams.get('reservationId')

        if (!reservationId) {
            return NextResponse.json(
                { success: false, error: 'reservationId is required' },
                { status: 400 }
            )
        }

        // Fetch reservation with court and venue details
        const { data: reservation, error: resError } = await supabase
            .from('reservations')
            .select(`
                *,
                courts (
                    name,
                    hourly_rate,
                    court_type,
                    venues (
                        name,
                        address,
                        phone,
                        email,
                        website,
                        opening_hours
                    )
                )
            `)
            .eq('id', reservationId)
            .single()

        if (resError || !reservation) {
            return NextResponse.json({ success: false, error: 'Reservation not found' }, { status: 404 })
        }

        // Verify ownership
        if (reservation.user_id !== user.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
        }

        // Fetch payment records
        const { data: payments } = await supabase
            .from('payments')
            .select('*')
            .eq('reservation_id', reservationId)
            .order('created_at', { ascending: true })

        return NextResponse.json({
            success: true,
            reservation,
            payments: payments || [],
        })
    } catch (error: any) {
        console.error('API Get Receipt Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
