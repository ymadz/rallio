import { NextRequest, NextResponse } from 'next/server'
import { canUserReviewCourt } from '@/app/actions/review-actions'
import { createClient } from '@supabase/supabase-js'

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
        const courtId = searchParams.get('courtId')

        if (!courtId) {
            return NextResponse.json(
                { success: false, error: 'courtId is required' },
                { status: 400 }
            )
        }

        const result = await canUserReviewCourt(courtId)

        return NextResponse.json({ success: true, ...result })
    } catch (error: any) {
        console.error('API Can Review Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
