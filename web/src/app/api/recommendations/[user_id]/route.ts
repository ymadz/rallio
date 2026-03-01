import { NextRequest, NextResponse } from 'next/server';
import { getRecommendationsForUser } from '@/lib/api/recommendations';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ user_id: string }> }
) {
    try {
        const { user_id } = await params;
        const userId = user_id;
        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Pass the request to the central lib utility
        const recommendations = await getRecommendationsForUser(userId, 4);

        return NextResponse.json(recommendations);
    } catch (error) {
        console.error('Error fetching recommendations map in route:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
