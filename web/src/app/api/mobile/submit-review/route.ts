import { NextRequest, NextResponse } from 'next/server'
import { submitCourtReview } from '@/app/actions/review-actions'
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
        const { courtId, reservationId, overallRating, qualityRating, cleanlinessRating, facilitiesRating, valueRating, review } = body

        if (!courtId || !overallRating) {
            return NextResponse.json(
                { success: false, error: 'courtId and overallRating are required' },
                { status: 400 }
            )
        }

        const result = await submitCourtReview({
            courtId,
            reservationId,
            overallRating,
            qualityRating,
            cleanlinessRating,
            facilitiesRating,
            valueRating,
            review,
        })

        if (!result.success) {
            return NextResponse.json(result, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('API Submit Review Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
