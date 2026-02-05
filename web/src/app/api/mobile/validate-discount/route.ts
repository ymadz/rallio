
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// POST /api/mobile/validate-discount
// Body: { code, venueId, amount }
export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: { headers: { Authorization: authHeader } }
            }
        )

        // Verify user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { code, venueId, amount } = await req.json()

        if (!code) {
            return NextResponse.json({ error: 'Promo code is required' }, { status: 400 })
        }

        // Test/Demo Code (hardcoded for immediate parity demonstration if DB is empty)
        if (code.toUpperCase() === 'TEST20') {
            const discountAmount = amount ? (amount * 0.20) : 0;
            return NextResponse.json({
                valid: true,
                discountAmount: Math.round(discountAmount * 100) / 100,
                type: 'percent',
                value: 20,
                description: 'Test 20% Discount'
            });
        }

        // Query promo_codes table
        const now = new Date().toISOString()

        let query = supabase
            .from('promo_codes')
            .select('*')
            .ilike('code', code)
            .eq('is_active', true)
            .lte('valid_from', now)
            .gte('valid_until', now)
            .single()

        const { data: promo, error } = await query

        if (error || !promo) {
            return NextResponse.json({ error: 'Invalid or expired promo code' }, { status: 400 })
        }

        // Check Venue Restriction
        if (promo.venue_id && promo.venue_id !== venueId) {
            return NextResponse.json({ error: 'This promo code is not valid for this venue' }, { status: 400 })
        }

        // Check Usage Limits
        if (promo.max_uses && promo.current_uses >= promo.max_uses) {
            return NextResponse.json({ error: 'Promo code usage limit reached' }, { status: 400 })
        }

        // Check per-user limit (Optional, requires promo_code_usage check)
        // For MVP parity fix, we skip complex usage check unless critical. 
        // We will do a basic check if `max_uses_per_user` is set.
        if (promo.max_uses_per_user) {
            const { count } = await supabase
                .from('promo_code_usage')
                .select('*', { count: 'exact', head: true })
                .eq('promo_code_id', promo.id)
                .eq('user_id', user.id)

            if (count && count >= promo.max_uses_per_user) {
                return NextResponse.json({ error: 'You have already used this promo code' }, { status: 400 })
            }
        }

        // Calculate Discount
        let discountAmount = 0
        if (promo.discount_type === 'percent') {
            discountAmount = (amount * promo.discount_value) / 100
        } else {
            discountAmount = promo.discount_value
        }

        // Ensure discount doesn't exceed total
        if (discountAmount > amount) {
            discountAmount = amount
        }

        return NextResponse.json({
            valid: true,
            discountAmount: discountAmount,
            type: promo.discount_type,
            value: promo.discount_value,
            description: promo.description || 'Promo Code Applied',
            promoId: promo.id
        })

    } catch (error: any) {
        console.error('[ValidateDiscount] Error:', error)
        return NextResponse.json({ error: 'Failed to validate discount' }, { status: 500 })
    }
}
