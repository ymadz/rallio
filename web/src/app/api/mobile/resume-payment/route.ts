import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createGCashCheckout } from '@/lib/paymongo'

/**
 * POST /api/mobile/resume-payment
 *
 * Re-initiates payment for a pending_payment or partially_paid reservation.
 * Creates a PayMongo checkout session and returns the checkout URL.
 */
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
        const { reservationId } = body

        if (!reservationId) {
            return NextResponse.json(
                { success: false, error: 'reservationId is required' },
                { status: 400 }
            )
        }

        // Fetch reservation
        const { data: reservation, error: resError } = await supabase
            .from('reservations')
            .select(`
                *,
                courts (
                    name,
                    venues (
                        name
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

        // Verify status allows payment
        const payableStatuses = ['pending_payment', 'partially_paid']
        if (!payableStatuses.includes(reservation.status)) {
            return NextResponse.json(
                { success: false, error: `Cannot resume payment for status: ${reservation.status}` },
                { status: 400 }
            )
        }

        // Calculate amount to charge
        const amountPaid = reservation.amount_paid || 0
        const totalAmount = reservation.total_amount
        const remainingAmount = totalAmount - amountPaid

        if (remainingAmount <= 0) {
            return NextResponse.json(
                { success: false, error: 'No remaining balance to pay' },
                { status: 400 }
            )
        }

        const courtName = reservation.courts?.name || 'Court'
        const venueName = reservation.courts?.venues?.name || 'Venue'
        const description = `Payment for ${courtName} at ${venueName}`

        // Build bridge URLs (same pattern as create-checkout)
        const host = request.headers.get('host') || 'localhost:3000'
        const protocol = host.includes('localhost') || host.includes('192.168.') ? 'http' : 'https'
        const baseUrl = `${protocol}://${host}`

        const bridgeSuccessUrl = `${baseUrl}/mobile-payment/callback?status=success`
        const bridgeFailedUrl = `${baseUrl}/mobile-payment/callback?status=failed`

        // Create payment record
        const paymentId = crypto.randomUUID()
        const metadata: Record<string, string> = {
            payment_reference: `RES-${reservationId}`,
            reservation_id: String(reservationId),
            platform_source: 'mobile',
            payment_id: paymentId,
            is_resume_payment: 'true',
            description,
        }

        await supabase.from('payments').insert({
            id: paymentId,
            reference: `RES-${reservationId}-${Date.now()}`,
            user_id: user.id,
            reservation_id: reservationId,
            amount: remainingAmount,
            currency: 'PHP',
            status: 'pending',
            payment_method: 'gcash',
            payment_provider: 'paymongo',
            created_at: new Date().toISOString(),
            metadata: {
                ...metadata,
                is_resume_payment: true,
            },
        })

        // Create PayMongo checkout
        const result = await createGCashCheckout({
            amount: remainingAmount,
            description,
            successUrl: bridgeSuccessUrl,
            failedUrl: bridgeFailedUrl,
            metadata,
        })

        return NextResponse.json({
            success: true,
            checkoutUrl: result.checkoutUrl,
            amount: remainingAmount,
        })
    } catch (error: any) {
        console.error('API Resume Payment Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
