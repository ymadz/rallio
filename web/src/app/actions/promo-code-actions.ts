'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface PromoCode {
    id: string
    code: string
    description: string | null
    discount_type: 'percent' | 'fixed'
    discount_value: number
    max_discount_amount: number | null
    max_uses: number | null
    max_uses_per_user: number | null
    current_uses: number
    venue_id: string | null
    valid_from: string | null
    valid_until: string | null
    is_active: boolean
    created_at: string
}

export interface PromoCodeValidationResult {
    valid: boolean
    error?: string
    promoCode?: PromoCode
    discountAmount?: number
}

// ==========================================
// PROMO CODS CRUD
// ==========================================

export async function getVenuePromoCodes(venueId: string): Promise<{ success: boolean; data?: PromoCode[]; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const { data, error } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('venue_id', venueId)
            .order('created_at', { ascending: false })

        if (error) throw error

        return { success: true, data: data as PromoCode[] }
    } catch (error: any) {
        console.error('Error fetching promo codes:', error)
        return { success: false, error: error.message || 'Failed to fetch promo codes' }
    }
}

export async function createPromoCode(
    venueId: string,
    promoData: Omit<PromoCode, 'id' | 'venue_id' | 'current_uses' | 'created_at'>
): Promise<{ success: boolean; data?: PromoCode; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        // Upper case the code directly unconditionally
        promoData.code = promoData.code.toUpperCase().trim()

        // Check if code already exists for this venue
        const { data: existingCode } = await supabase
            .from('promo_codes')
            .select('id')
            .eq('code', promoData.code)
            .eq('venue_id', venueId)
            .maybeSingle()

        if (existingCode) {
            return { success: false, error: 'A promo code with this code already exists for this venue' }
        }

        const payload = {
            ...promoData,
            venue_id: venueId,
            valid_from: promoData.valid_from || new Date('2000-01-01').toISOString(),
            valid_until: promoData.valid_until || new Date('2100-01-01').toISOString(),
            metadata: { created_by: user.id }
        }

        const { data, error } = await supabase
            .from('promo_codes')
            .insert(payload)
            .select()
            .single()

        if (error) throw error

        revalidatePath('/court-admin/promo-codes')
        return { success: true, data: data as PromoCode }
    } catch (error: any) {
        console.error('Error creating promo code:', error)
        return { success: false, error: error.message || 'Failed to create promo code' }
    }
}

export async function updatePromoCode(
    promoId: string,
    updates: Partial<Omit<PromoCode, 'id' | 'venue_id' | 'created_at'>>
): Promise<{ success: boolean; data?: PromoCode; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        if (updates.code) {
            updates.code = updates.code.toUpperCase().trim()

            // Check if code already exists and is not this promo code
            const { data: promo } = await supabase
                .from('promo_codes')
                .select('venue_id')
                .eq('id', promoId)
                .single()

            const actualVenueId = promo?.venue_id

            if (actualVenueId) {
                const { data: existingCode } = await supabase
                    .from('promo_codes')
                    .select('id')
                    .eq('code', updates.code)
                    .eq('venue_id', actualVenueId)
                    .neq('id', promoId)
                    .maybeSingle()

                if (existingCode) {
                    return { success: false, error: 'A promo code with this code already exists for this venue' }
                }
            }
        }

        const payload = { ...updates }

        // Handle explicit nulls being sent when dates are cleared/empty
        if (payload.valid_from === null) payload.valid_from = new Date('2000-01-01').toISOString()
        if (payload.valid_until === null) payload.valid_until = new Date('2100-01-01').toISOString()

        const { data, error } = await supabase
            .from('promo_codes')
            .update(payload)
            .eq('id', promoId)
            .select()
            .single()

        if (error) throw error

        revalidatePath('/court-admin/promo-codes')
        return { success: true, data: data as PromoCode }
    } catch (error: any) {
        console.error('Error updating promo code:', error)
        return { success: false, error: error.message || 'Failed to update promo code' }
    }
}

export async function deletePromoCode(promoId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const { error } = await supabase
            .from('promo_codes')
            .delete()
            .eq('id', promoId)

        if (error) throw error

        revalidatePath('/court-admin/promo-codes')
        return { success: true }
    } catch (error: any) {
        console.error('Error deleting promo code:', error)
        return { success: false, error: error.message || 'Failed to delete promo code' }
    }
}

export async function togglePromoCode(promoId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const { error } = await supabase
            .from('promo_codes')
            .update({ is_active: isActive })
            .eq('id', promoId)

        if (error) throw error

        revalidatePath('/court-admin/promo-codes')
        return { success: true }
    } catch (error: any) {
        console.error('Error toggling promo code:', error)
        return { success: false, error: error.message || 'Failed to toggle promo code' }
    }
}

// ==========================================
// VALIDATION & USAGE
// ==========================================

export async function validatePromoCode(
    code: string,
    venueId: string,
    totalAmountDue: number
): Promise<PromoCodeValidationResult> {
    try {
        code = code.toUpperCase().trim()
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { valid: false, error: 'Log in to apply promo codes' }

        // 1. Find the promo code (venue specific or platform wide)
        const { data: promoCodes, error: fetchError } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', code)
            .or(`venue_id.eq.${venueId},venue_id.is.null`)

        if (fetchError || !promoCodes || promoCodes.length === 0) {
            return { valid: false, error: 'Invalid or expired promo code' }
        }

        // Prefer venue-specific over platform-wide if both exist
        const promoCode = promoCodes.find((p) => p.venue_id === venueId) || promoCodes.find((p) => p.venue_id === null)

        if (!promoCode) {
            return { valid: false, error: 'Invalid or expired promo code' }
        }

        if (!promoCode.is_active) {
            return { valid: false, error: 'This promo code is no longer active' }
        }

        if (promoCode.venue_id && promoCode.venue_id !== venueId) {
            return { valid: false, error: 'This promo code is not valid for this venue' }
        }

        // 2. Check Dates
        const now = new Date()

        if (promoCode.valid_from) {
            const validFrom = new Date(promoCode.valid_from)
            if (now < validFrom) {
                return { valid: false, error: 'This promo code is not yet valid' }
            }
        }

        if (promoCode.valid_until) {
            const validUntil = new Date(promoCode.valid_until)
            if (now > validUntil) {
                return { valid: false, error: 'This promo code has expired' }
            }
        }

        // 3. Check Max Uses (Global)
        if (promoCode.max_uses && promoCode.current_uses >= promoCode.max_uses) {
            return { valid: false, error: 'This promo code has reached its usage limit' }
        }

        // 4. Check Max Uses (Per User)
        if (promoCode.max_uses_per_user) {
            const { count: userUses, error: usageError } = await supabase
                .from('promo_code_usage')
                .select('*', { count: 'exact', head: true })
                .eq('promo_code_id', promoCode.id)
                .eq('user_id', user.id)

            if (usageError) throw usageError

            if (userUses !== null && userUses >= promoCode.max_uses_per_user) {
                return { valid: false, error: `You have reached the usage limit for this code (${promoCode.max_uses_per_user} uses max)` }
            }
        }

        // 5. Calculate Discount Amount
        let discountAmount = 0
        if (promoCode.discount_type === 'percent') {
            discountAmount = (totalAmountDue * promoCode.discount_value) / 100

            // Cap percentage discount based on max_discount_amount if applicable
            if (promoCode.max_discount_amount !== null && promoCode.max_discount_amount > 0) {
                discountAmount = Math.min(discountAmount, promoCode.max_discount_amount)
            }
        } else {
            discountAmount = promoCode.discount_value
        }

        // Cap discount to total amount (can't have negative price)
        discountAmount = Math.min(discountAmount, totalAmountDue)

        return {
            valid: true,
            promoCode: promoCode as PromoCode,
            discountAmount
        }
    } catch (error: any) {
        console.error('Error validating promo code:', error)
        return { valid: false, error: 'Failed to validate promo code. Please try again.' }
    }
}

// NOTE: applyPromoCode logic should typically be handled in the reservation creation step 
// to ensure atomicity via an RPC, or by applying it immediately after reservation creation.
// A reference to it will be implemented alongside creating the reservation.

export async function consumeDeferredPromoCode(
    promoCodeStr: string,
    userId: string,
    reservationIds: string[],
    venueId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        if (!promoCodeStr || !userId || reservationIds.length === 0) return { success: true }

        // We use the service client since this is often called from webhooks or admin actions
        const { createServiceClient } = await import('@/lib/supabase/service')
        const adminDb = createServiceClient()

        // Find promo code candidates (same code may exist as venue-specific + platform-wide)
        const { data: promoCandidates, error: fetchError } = await adminDb
            .from('promo_codes')
            .select('id, current_uses, venue_id')
            .eq('code', promoCodeStr.toUpperCase())
            .eq('is_active', true)

        if (fetchError || !promoCandidates || promoCandidates.length === 0) {
            console.error('[consumeDeferredPromoCode] Promo code not found for consumption:', promoCodeStr)
            return { success: false, error: 'Promo code not found' }
        }

        let promoData = venueId
            ? promoCandidates.find((p: any) => p.venue_id === venueId)
            : undefined

        if (!promoData) {
            promoData = promoCandidates.find((p: any) => p.venue_id === null) || promoCandidates[0]
        }

        // Ensure we haven't already inserted for these reservations to prevent double consumption
        const { data: existingUsages, error: checkError } = await adminDb
            .from('promo_code_usage')
            .select('reservation_id')
            .eq('promo_code_id', promoData.id)
            .in('reservation_id', reservationIds)

        if (checkError) {
            console.error('[consumeDeferredPromoCode] Error checking existing usages:', checkError)
        }

        const existingReservationIds = new Set(existingUsages?.map(u => u.reservation_id) || [])
        const newReservationIds = reservationIds.filter(id => !existingReservationIds.has(id))

        if (newReservationIds.length === 0) {
            console.log(`[consumeDeferredPromoCode] No new usages to record for promo code ${promoCodeStr}`)
            return { success: true }
        }

        // Insert usage records
        const usageRecords = newReservationIds.map(resId => ({
            promo_code_id: promoData.id,
            user_id: userId,
            reservation_id: resId,
        }))

        const { error: usageError } = await adminDb.from('promo_code_usage').insert(usageRecords)
        if (usageError) throw usageError

        // Increment current_uses
        const { error: updateError } = await adminDb
            .from('promo_codes')
            .update({ current_uses: promoData.current_uses + newReservationIds.length })
            .eq('id', promoData.id)

        if (updateError) throw updateError

        console.log(`[consumeDeferredPromoCode] ✅ Successfully consumed promo code ${promoCodeStr} for ${newReservationIds.length} reservations.`)
        return { success: true }
    } catch (error: any) {
        console.error('[consumeDeferredPromoCode] ❌ Failed to consume deferred promo code:', error)
        return { success: false, error: error.message || 'Failed to consume promo code' }
    }
}
