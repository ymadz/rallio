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

        // Check if code already exists
        const { data: existingCode } = await supabase
            .from('promo_codes')
            .select('id')
            .eq('code', promoData.code)
            .single()

        if (existingCode) {
            return { success: false, error: 'A promo code with this code already exists' }
        }

        const { data, error } = await supabase
            .from('promo_codes')
            .insert({
                ...promoData,
                venue_id: venueId,
                metadata: { created_by: user.id }
            })
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
            const { data: existingCode } = await supabase
                .from('promo_codes')
                .select('id')
                .eq('code', updates.code)
                .neq('id', promoId)
                .single()

            if (existingCode) {
                return { success: false, error: 'A promo code with this code already exists' }
            }
        }

        const { data, error } = await supabase
            .from('promo_codes')
            .update(updates)
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
        const { data: promoCode, error: fetchError } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', code)
            .single()

        if (fetchError || !promoCode) {
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
