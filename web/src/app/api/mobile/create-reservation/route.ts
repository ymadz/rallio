
import { NextRequest, NextResponse } from 'next/server'
import { createReservation } from '@/lib/services/reservations'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')

        if (!authHeader) {
            return NextResponse.json({ success: false, error: 'Missing Authorization header' }, { status: 401 })
        }

        // Initialize Supabase client with the Authorization header
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: { headers: { Authorization: authHeader } }
            }
        )

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const {
            courtId,
            startTimeISO,
            endTimeISO,
            totalAmount,
            numPlayers,
            paymentType,
            paymentMethod,
            notes,
            recurrenceWeeks,
            selectedDays
        } = body

        // Call the shared service
        const result = await createReservation(supabase, {
            courtId,
            userId: user.id,
            startTimeISO,
            endTimeISO,
            totalAmount,
            numPlayers,
            paymentType,
            paymentMethod,
            notes,
            recurrenceWeeks,
            selectedDays
        })

        if (!result.success) {
            return NextResponse.json(result, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('API Create Reservation Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
