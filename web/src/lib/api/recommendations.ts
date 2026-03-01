import { createServiceClient } from '../supabase/server';

export interface RecommendationResponse {
    user_id: string;
    recommended_court_ids: string[];
    methodaries: string;
}

const ML_SERVICE_URL = process.env.NEXT_PUBLIC_ML_SERVICE_URL || 'http://127.0.0.1:8000';

/**
 * Fetches recommended courts for a specific user from the ML microservice.
 */
export async function getRecommendationsForUser(userId: string, limit: number = 5): Promise<any[]> {
    try {
        const res = await fetch(`${ML_SERVICE_URL}/api/recommendations/${userId}?limit=${limit}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // If you add basic API key auth to the python service later, insert here
            },
            // Don't cache personalized recommendations heavily
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!res.ok) {
            console.error("ML service returned an error:", res.statusText);
            return [];
        }

        const data: RecommendationResponse = await res.json();
        const courtIds = data.recommended_court_ids;

        if (!courtIds || courtIds.length === 0) {
            return [];
        }

        // Now fetch the actual court details from Supabase using those IDs
        const supabase = createServiceClient();

        const { data: courts, error } = await supabase
            .from('courts')
            .select(`
        *,
        venue:venues(id, name, city, address, latitude, longitude),
        images:court_images(id, url, alt_text, is_primary)
      `)
            .in('id', courtIds)
            .eq('is_active', true);

        if (error) {
            console.error('Supabase Error fetching recommended court details:', error.message, error.details, error.hint);
            return [];
        }

        // Maintain the order returned by the ML service
        // Construct a map for O(1) lookups
        const courtMap = new Map((courts as any[]).map(c => [c.id, c]));

        // Map back keeping the sorted order
        const sortedCourts = courtIds
            .map(id => courtMap.get(id))
            .filter(Boolean) as any[];

        // Transform raw data to match Court type
        return sortedCourts.map((court) => ({
            ...court,
            amenities: court.court_amenities?.map((ca: any) => ca.amenities).filter(Boolean) || [],
            images: court.images || [],
            venue_name: court.venue?.name,
            average_rating:
                court.court_ratings && court.court_ratings.length > 0
                    ? court.court_ratings.reduce((acc: number, curr: any) => acc + curr.overall_rating, 0) /
                    court.court_ratings.length
                    : undefined,
            review_count: court.court_ratings?.length || 0,
        } as any));

    } catch (error) {
        console.error("Error connecting to ML recommendation service:", error);
        return [];
    }
}
