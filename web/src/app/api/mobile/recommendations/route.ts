import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    try {
        // Auth - Pattern A
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const limit = parseInt(request.nextUrl.searchParams.get('limit') || '5');

        // Try ML service first
        const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';

        try {
            const mlResponse = await fetch(
                `${mlServiceUrl}/api/recommendations/${user.id}?limit=${limit}`,
                { signal: AbortSignal.timeout(3000) }
            );

            if (mlResponse.ok) {
                const mlData = await mlResponse.json();
                const courtIds = mlData.recommended_court_ids || [];

                if (courtIds.length > 0) {
                    // Fetch full court details with venue info
                    const { data: courts } = await supabase
                        .from('courts')
                        .select(`
                            id, name, hourly_rate, court_type, surface_type,
                            venues (id, name, address, image_url)
                        `)
                        .in('id', courtIds)
                        .eq('is_active', true);

                    return NextResponse.json({
                        success: true,
                        courts: courts || [],
                        method: mlData.methodaries || 'ml',
                    });
                }
            }
        } catch {
            // ML service unavailable, fall through to fallback
        }

        // Fallback: return popular courts based on booking count
        const { data: popularCourts } = await supabase
            .from('courts')
            .select(`
                id, name, hourly_rate, court_type, surface_type,
                venues (id, name, address, image_url)
            `)
            .eq('is_active', true)
            .limit(limit);

        return NextResponse.json({
            success: true,
            courts: popularCourts || [],
            method: 'popular',
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to get recommendations' },
            { status: 500 }
        );
    }
}
