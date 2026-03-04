'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface PromoCode {
    id: string;
    venue_id: string | null; // NULL = Sitewide
    code: string;
    description: string | null;
    endorser_name: string | null; // For tracking influencers
    discount_type: 'percent' | 'fixed';
    discount_value: number;
    min_spend: number;
    max_discount_amount: number | null;
    usage_limit: number | null;
    is_active: boolean;
    is_exclusive: boolean; // If true, overrides other discounts
    valid_from: string;
    valid_until: string | null;
    created_at: string;
    usage_count?: number;
}

/**
 * Get all available promo codes for a venue/sitewide (Stored in venue metadata)
 */
export async function getVenuePromoCodes(venueId?: string) {
    try {
        const supabase = await createClient();

        // Fetch all venues to composite sitewide codes + specific codes
        const { data: venues, error: venueError } = await supabase
            .from('venues')
            .select('id, metadata');

        if (venueError) throw venueError;

        let allPromos: PromoCode[] = [];
        venues.forEach(v => {
            const promos = (v.metadata?.promo_codes || []) as PromoCode[];
            allPromos = [...allPromos, ...promos];
        });

        // Fetch usage counts from reservations to augment the data
        const { data: usageData } = await supabase
            .from('reservations')
            .select('metadata')
            .filter('metadata->>promo_code_id', 'not.is', null);

        // Remove duplicates and filter by venue relevance if requested
        const relevantPromos = allPromos.filter(p => !venueId || !p.venue_id || p.venue_id === venueId);

        const promosWithUsage = relevantPromos.map(p => {
            const count = usageData?.filter(r => (r.metadata as any)?.promo_code_id === p.id).length || 0;
            return { ...p, usage_count: count };
        });

        return { success: true, data: promosWithUsage };
    } catch (error: any) {
        console.error('[getVenuePromoCodes] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Add a new promo code to venue metadata
 */
export async function createPromoCode(data: Omit<PromoCode, 'id' | 'created_at'>) {
    try {
        const supabase = await createClient();

        // If venue_id is null, we store it in a special "Global Configuration" venue or just pick one for metadata storage
        // For simplicity in this Zero-SQL setup, we store sitewide codes in the venue that created it, but marked as sitewide (venue_id: null)
        const targetVenueId = data.venue_id;
        if (!targetVenueId) {
            return { success: false, error: 'Venue ID is required for metadata storage.' };
        }

        const { data: venue, error: fetchError } = await supabase
            .from('venues')
            .select('metadata')
            .eq('id', targetVenueId)
            .single();

        if (fetchError) throw fetchError;

        const currentMetadata = venue.metadata || {};
        const currentPromos = (currentMetadata.promo_codes || []) as PromoCode[];

        if (currentPromos.some(p => p.code === data.code)) {
            return { success: false, error: 'A promo code with this name already exists.' };
        }

        const newPromo: PromoCode = {
            ...data,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
        };

        const updatedMetadata = {
            ...currentMetadata,
            promo_codes: [...currentPromos, newPromo]
        };

        const { error: updateError } = await supabase
            .from('venues')
            .update({ metadata: updatedMetadata })
            .eq('id', targetVenueId);

        if (updateError) throw updateError;

        revalidatePath(`/court-admin/venues/${targetVenueId}`);
        return { success: true, data: newPromo };
    } catch (error: any) {
        console.error('[createPromoCode] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Validate a promo code (Shopee/Lazada style with Conflict Resolution)
 */
export async function validatePromoCodeAction(
    code: string,
    venueId: string,
    totalAmount: number,
    userId: string
) {
    try {
        const supabase = await createClient();

        // Fetch all venues to find the promo code (could be sitewide or specific)
        const { data: venues, error: venueError } = await supabase
            .from('venues')
            .select('id, metadata');

        if (venueError) throw venueError;

        let promo: PromoCode | undefined;
        for (const v of venues) {
            const found = (v.metadata?.promo_codes || []) as PromoCode[];
            promo = found.find(p => p.code === code.toUpperCase() && p.is_active);
            if (promo) break;
        }

        if (!promo) {
            return { success: false, error: 'Invalid or inactive promo code.' };
        }

        // Check venue scope
        if (promo.venue_id && promo.venue_id !== venueId) {
            return { success: false, error: 'This promo code is not valid for this venue.' };
        }

        // Constraints Validation
        const now = new Date();
        if (new Date(promo.valid_from) > now) return { success: false, error: 'Promo not active yet.' };
        if (promo.valid_until && new Date(promo.valid_until) < now) return { success: false, error: 'Promo expired.' };
        if (totalAmount < promo.min_spend) {
            return { success: false, error: `Minimum spend of ₱${promo.min_spend} required.` };
        }

        // Global Usage Limit Check
        const { count, error: countError } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .filter('metadata->>promo_code_id', 'eq', promo.id);

        if (!countError && promo.usage_limit && count !== null && count >= promo.usage_limit) {
            return { success: false, error: 'Promo code usage limit reached.' };
        }

        // Single User Usage Check
        const { data: existingUsage } = await supabase
            .from('reservations')
            .select('id')
            .eq('user_id', userId)
            .filter('metadata->>promo_code_id', 'eq', promo.id)
            .limit(1);

        if (existingUsage && existingUsage.length > 0) {
            return { success: false, error: 'You have already used this promo code.' };
        }

        // Calculate Discount
        let discountAmount = 0;
        if (promo.discount_type === 'percent') {
            discountAmount = (totalAmount * promo.discount_value) / 100;
            if (promo.max_discount_amount) {
                discountAmount = Math.min(discountAmount, promo.max_discount_amount);
            }
        } else {
            discountAmount = Math.min(promo.discount_value, totalAmount);
        }

        return {
            success: true,
            data: {
                promoCodeId: promo.id,
                code: promo.code,
                discountAmount: Math.round(discountAmount * 100) / 100,
                discountType: promo.discount_type,
                isExclusive: promo.is_exclusive,
                endorser: promo.endorser_name,
                description: promo.description
            }
        };
    } catch (error: any) {
        console.error('[validatePromoCodeAction] Error:', error);
        return { success: false, error: 'Failed to validate promo code.' };
    }
}
