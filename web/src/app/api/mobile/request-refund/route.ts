import { NextRequest, NextResponse } from 'next/server'
import { requestRefundAction } from '@/app/actions/refund-actions'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader) {
            return NextResponse.json({ success: false, error: 'Missing Authorization header' }, { status: 401 })
        }

        // Initialize Supabase client with the Authorization header (mobile sends Bearer token)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: authHeader } } }
        )

        // Verify authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { reservationId, reason, reasonCode } = body

        if (!reservationId) {
            return NextResponse.json({ success: false, error: 'Reservation ID is required' }, { status: 400 })
        }

        if (!reason) {
            return NextResponse.json({ success: false, error: 'Refund reason is required' }, { status: 400 })
        }

        // Call the shared server action
        const result = await requestRefundAction({
            reservationId,
            reason,
            reasonCode: reasonCode || 'requested_by_customer', // Default reason code
        })

        if (!result.success) {
            return NextResponse.json(result, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('API Request Refund Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
