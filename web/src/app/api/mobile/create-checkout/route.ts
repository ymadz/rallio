
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

        // 3. Create PayMongo Payload

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

        console.log('[MobileAPI] Creating GCash Checkout with metadata:', metadata);

        const result = await createGCashCheckout({
            amount: amountToCharge,
            description: finalDescription,
            successUrl: bridgeSuccessUrl,
            failedUrl: bridgeFailedUrl,
            metadata: metadata
        })

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Mobile checkout error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
