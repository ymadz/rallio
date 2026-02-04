
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createGCashCheckout } from '@/lib/paymongo'

// Only POST method is supported
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization')
        console.log('[MobileAPI] Auth Header present:', !!authHeader);
        if (authHeader) console.log('[MobileAPI] Token snippet:', authHeader.substring(0, 20) + '...');

        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
        }

        // Initialize Supabase client with the Authorization header
        // We use the anon key because the token contains the permissions
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: { headers: { Authorization: authHeader } }
            }
        )

        // Verify user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError) {
            console.error('[MobileAPI] Auth Error:', authError.message);
        }
        if (!user) {
            console.error('[MobileAPI] No user found from token');
        }

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized: ' + (authError?.message || 'No user') }, { status: 401 })
        }

        console.log('[MobileAPI] Authenticated User:', user.id);

        const { reservationId, amount, description, successUrl, cancelUrl, recurrenceGroupId } = await req.json()

        if (!reservationId || !amount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Verify reservation ownership
        const { data: reservation, error: resError } = await supabase
            .from('reservations')
            .select('user_id, status, recurrence_group_id')
            .eq('id', reservationId)
            .single()

        if (resError || !reservation) {
            return NextResponse.json({ error: 'Reservation not found' }, { status: 404 })
        }

        if (reservation.user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // 2. Calculate correct total amount if recurring
        let amountToCharge = amount;
        let finalDescription = description;

        if (recurrenceGroupId) {
            // Fetch all pending reservations in the group to sum them up
            // This protects against client-side math errors
            const { data: groupReservations } = await supabase
                .from('reservations')
                .select('total_amount, status')
                .eq('recurrence_group_id', recurrenceGroupId)
                .in('status', ['pending', 'pending_payment'])

            if (groupReservations && groupReservations.length > 0) {
                amountToCharge = groupReservations.reduce((sum, res) => sum + (res.total_amount || 0), 0)
                finalDescription += ` (Recurring: ${groupReservations.length} sessions)`
            }
        }



        // 3. Prepare Metadata
        // PayMongo requires metadata values to be strings.
        // We must sanitize 'recurrenceGroupId' which might be null.
        const metadata: Record<string, string> = {
            payment_reference: `RES-${reservationId}`,
            reservation_id: String(reservationId),
            platform_source: 'mobile',
            description: finalDescription
        }

        if (recurrenceGroupId) {
            metadata.recurrence_group_id = String(recurrenceGroupId)
        }

        // 4. Create Payment Record (Pending)
        // This is crucial for matching the payment later
        const paymentData = {
            id: crypto.randomUUID(),
            amount: amountToCharge,
            currency: 'PHP',
            status: 'pending',
            payment_method: 'gcash', // Default for mobile flow currently
            provider: 'paymongo',
            description: finalDescription,
            reservation_id: reservationId,
            user_id: user.id,
            metadata: metadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        const { error: paymentError } = await supabase
            .from('payments')
            .insert(paymentData)

        if (paymentError) {
            console.error('[MobileAPI] Failed to create payment record:', paymentError)
            return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 })
        }

        // 5. Update Reservation Status
        await supabase
            .from('reservations')
            .update({
                status: 'pending_payment',
                metadata: {
                    ...reservation.metadata,
                    payment_reference: metadata.payment_reference
                }
            })
            .eq('id', reservationId)

        // 6. Create PayMongo Payload
        // Construct Bridge URL
        // We use the 'host' header to ensure valid redirect even if env var is missing/localhost
        const host = req.headers.get('host') || 'localhost:3000';
        const protocol = host.includes('localhost') || host.includes('192.168.') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        // Create Bridge URLs
        // PayMongo will redirect here -> We then deep link to app
        const bridgeSuccessUrl = `${baseUrl}/mobile-payment/callback?status=success`;
        const bridgeFailedUrl = `${baseUrl}/mobile-payment/callback?status=failed`;

        console.log('[MobileAPI] Bridge URLs:', { bridgeSuccessUrl, bridgeFailedUrl });

        console.log('[MobileAPI] Creating GCash Checkout with metadata:', metadata);

        // Add our internal payment ID to metadata so webhook can match it
        metadata.payment_id = paymentData.id

        const result = await createGCashCheckout({
            amount: amountToCharge,
            description: finalDescription,
            successUrl: bridgeSuccessUrl,
            failedUrl: bridgeFailedUrl,
            metadata: metadata
        })

        // Update payment with provider external ID
        if (result && result.checkoutUrl) {
            // Note: We might not get the payment intent ID immediately here for GCash sources,
            // but if we did, we'd update it. For now, rely on webhook to match via metadata.payment_id
        }

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Mobile checkout error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
