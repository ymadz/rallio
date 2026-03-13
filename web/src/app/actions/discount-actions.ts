'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ==========================================
// TYPES
// ==========================================

export type RuleDiscountType = 'recurring' | 'early_bird' | 'multi_day';
export type CalculatedDiscountType = RuleDiscountType | 'seasonal' | 'holiday_surcharge' | 'promo_code';

export interface DiscountRule {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  discount_type: RuleDiscountType;
  discount_value: number;
  discount_unit: 'percent' | 'fixed';
  min_weeks?: number | null;
  min_days?: number | null;
  advance_days?: number | null;
  is_active: boolean;
  priority: number;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface HolidayPricing {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  price_multiplier: number;
  fixed_surcharge: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscountCalculationInput {
  venueId: string;
  courtId: string;
  startDate: string;
  endDate: string;
  recurrenceWeeks: number;
  targetDateCount?: number;
  basePrice: number;
  promoCode?: string;
}

export interface ApplicableDiscount {
  type: CalculatedDiscountType;
  name: string;
  description: string;
  amount: number;
  isIncrease: boolean; // true for surcharges
  priority: number;
}

// ==========================================
// DISCOUNT RULES CRUD
// ==========================================

export async function getVenueDiscountRules(venueId: string) {
  try {
    const supabase = await createClient();

    const { data: rules, error } = await supabase
      .from('discount_rules')
      .select('*')
      .eq('venue_id', venueId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getVenueDiscountRules] Error:', error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: rules as DiscountRule[] };
  } catch (error) {
    console.error('[getVenueDiscountRules] Exception:', error);
    return { success: false, error: 'Failed to fetch discount rules', data: [] };
  }
}

export async function createDiscountRule(
  venueId: string,
  ruleData: Omit<DiscountRule, 'id' | 'venue_id' | 'created_at' | 'updated_at'>
) {
  try {
    const supabase = await createClient();

    const { data: rule, error } = await supabase
      .from('discount_rules')
      .insert({
        venue_id: venueId,
        ...ruleData,
      })
      .select()
      .single();

    if (error) {
      console.error('[createDiscountRule] Error:', error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/court-admin/venues/${venueId}`);
    return { success: true, data: rule as DiscountRule };
  } catch (error) {
    console.error('[createDiscountRule] Exception:', error);
    return { success: false, error: 'Failed to create discount rule' };
  }
}

export async function updateDiscountRule(
  ruleId: string,
  updates: Partial<Omit<DiscountRule, 'id' | 'venue_id' | 'created_at' | 'updated_at'>>
) {
  try {
    const supabase = await createClient();

    const { data: rule, error } = await supabase
      .from('discount_rules')
      .update(updates)
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      console.error('[updateDiscountRule] Error:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/court-admin/venues');
    return { success: true, data: rule as DiscountRule };
  } catch (error) {
    console.error('[updateDiscountRule] Exception:', error);
    return { success: false, error: 'Failed to update discount rule' };
  }
}

export async function deleteDiscountRule(ruleId: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('discount_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      console.error('[deleteDiscountRule] Error:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/court-admin/venues');
    return { success: true };
  } catch (error) {
    console.error('[deleteDiscountRule] Exception:', error);
    return { success: false, error: 'Failed to delete discount rule' };
  }
}

export async function toggleDiscountRule(ruleId: string, isActive: boolean) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('discount_rules')
      .update({ is_active: isActive })
      .eq('id', ruleId);

    if (error) {
      console.error('[toggleDiscountRule] Error:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/court-admin/venues');
    return { success: true };
  } catch (error) {
    console.error('[toggleDiscountRule] Exception:', error);
    return { success: false, error: 'Failed to toggle discount rule' };
  }
}

// ==========================================
// HOLIDAY PRICING CRUD
// ==========================================

export async function getVenueHolidayPricing(venueId: string) {
  try {
    const supabase = await createClient();

    const { data: pricing, error } = await supabase
      .from('holiday_pricing')
      .select('*')
      .eq('venue_id', venueId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('[getVenueHolidayPricing] Error:', error);
      return { success: false, error: error.message, data: [] };
    }

    return { success: true, data: pricing as HolidayPricing[] };
  } catch (error) {
    console.error('[getVenueHolidayPricing] Exception:', error);
    return { success: false, error: 'Failed to fetch holiday pricing', data: [] };
  }
}

export async function createHolidayPricing(
  venueId: string,
  pricingData: Omit<HolidayPricing, 'id' | 'venue_id' | 'created_at' | 'updated_at'>
) {
  try {
    const supabase = await createClient();

    const { data: pricing, error } = await supabase
      .from('holiday_pricing')
      .insert({
        venue_id: venueId,
        ...pricingData,
      })
      .select()
      .single();

    if (error) {
      console.error('[createHolidayPricing] Error:', error);
      return { success: false, error: error.message };
    }

    revalidatePath(`/court-admin/venues/${venueId}`);
    return { success: true, data: pricing as HolidayPricing };
  } catch (error) {
    console.error('[createHolidayPricing] Exception:', error);
    return { success: false, error: 'Failed to create holiday pricing' };
  }
}

export async function updateHolidayPricing(
  pricingId: string,
  updates: Partial<Omit<HolidayPricing, 'id' | 'venue_id' | 'created_at' | 'updated_at'>>
) {
  try {
    const supabase = await createClient();

    const { data: pricing, error } = await supabase
      .from('holiday_pricing')
      .update(updates)
      .eq('id', pricingId)
      .select()
      .single();

    if (error) {
      console.error('[updateHolidayPricing] Error:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/court-admin/venues');
    return { success: true, data: pricing as HolidayPricing };
  } catch (error) {
    console.error('[updateHolidayPricing] Exception:', error);
    return { success: false, error: 'Failed to update holiday pricing' };
  }
}

export async function deleteHolidayPricing(pricingId: string) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('holiday_pricing')
      .delete()
      .eq('id', pricingId);

    if (error) {
      console.error('[deleteHolidayPricing] Error:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/court-admin/venues');
    return { success: true };
  } catch (error) {
    console.error('[deleteHolidayPricing] Exception:', error);
    return { success: false, error: 'Failed to delete holiday pricing' };
  }
}

export async function toggleHolidayPricing(pricingId: string, isActive: boolean) {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('holiday_pricing')
      .update({ is_active: isActive })
      .eq('id', pricingId);

    if (error) {
      console.error('[toggleHolidayPricing] Error:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/court-admin/venues');
    return { success: true };
  } catch (error) {
    console.error('[toggleHolidayPricing] Exception:', error);
    return { success: false, error: 'Failed to toggle holiday pricing' };
  }
}

// ==========================================
// DISCOUNT CALCULATION
// ==========================================

export async function calculateApplicableDiscounts(
  input: DiscountCalculationInput
): Promise<{ success: boolean; discounts: ApplicableDiscount[]; totalDiscount: number; finalPrice: number }> {
  try {
    const supabase = await createClient();
    const applicableDiscounts: ApplicableDiscount[] = [];

    const bookingDate = new Date(input.startDate);
    const today = new Date();
    const daysInAdvance = Math.floor((bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    interface RawDiscount {
      type: CalculatedDiscountType;
      name: string;
      description: string;
      unit: 'percent' | 'fixed';
      value: number;
      maxAmount?: number;
      isIncrease: boolean;
      priority: number;
    }
    const rawDiscounts: RawDiscount[] = [];

    // 1. Check for holiday pricing (surcharges or seasonal discounts)
    // We should use an admin service client here if the user isn't authenticated, but server actions mostly work?
    // Wait, the client used here is the authenticated user's client, which can read holiday pricing and rules because of RLS:
    // "Active promo codes are viewable by everyone" - this means user can fetch them
    const { data: holidayPricing } = await supabase
      .from('holiday_pricing')
      .select('*')
      .eq('venue_id', input.venueId)
      .eq('is_active', true)
      .lte('start_date', input.startDate)
      .gte('end_date', input.endDate);

    if (holidayPricing && holidayPricing.length > 0) {
      // Use the first matching holiday pricing (most specific)
      const holiday = holidayPricing[0];
      const isIncrease = holiday.price_multiplier > 1.0;

      if (holiday.fixed_surcharge) {
        rawDiscounts.push({
          type: isIncrease ? 'holiday_surcharge' : 'seasonal',
          name: holiday.name,
          description: holiday.description || (isIncrease ? `Holiday surcharge` : `Seasonal discount`),
          unit: 'fixed',
          value: Math.abs(holiday.fixed_surcharge),
          isIncrease,
          priority: isIncrease ? 100 : 80, // Surcharges have highest priority
        });
      } else {
        rawDiscounts.push({
          type: isIncrease ? 'holiday_surcharge' : 'seasonal',
          name: holiday.name,
          description: holiday.description || (isIncrease
            ? `${Math.round((holiday.price_multiplier - 1) * 100)}% holiday surcharge`
            : `${Math.round((1 - holiday.price_multiplier) * 100)}% seasonal discount`),
          unit: 'percent',
          value: Math.round(Math.abs(holiday.price_multiplier - 1.0) * 100),
          isIncrease,
          priority: isIncrease ? 100 : 80,
        });
      }
    }

    // 2. Check for discount rules
    const { data: discountRules } = await supabase
      .from('discount_rules')
      .select('*')
      .eq('venue_id', input.venueId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (discountRules && discountRules.length > 0) {
      const targetDateStr = input.startDate;

      for (const rule of discountRules) {
        if (rule.valid_from && rule.valid_from > targetDateStr) continue;
        if (rule.valid_until && rule.valid_until < targetDateStr) continue;

        let isApplicable = false;

        switch (rule.discount_type) {
          case 'recurring':
            if (rule.min_weeks && Number(input.recurrenceWeeks) >= Number(rule.min_weeks)) {
              isApplicable = true;
            }
            break;

          case 'early_bird':
            if (rule.advance_days && daysInAdvance >= Number(rule.advance_days)) {
              isApplicable = true;
            }
            break;

          case 'multi_day':
            if (rule.min_days && input.targetDateCount && input.targetDateCount >= Number(rule.min_days)) {
              isApplicable = true;
            }
            break;

          default:
            break;
        }

        if (isApplicable) {
          rawDiscounts.push({
            type: rule.discount_type,
            name: rule.name,
            description: rule.description || `${rule.discount_value}${rule.discount_unit === 'percent' ? '%' : ' PHP'} discount`,
            unit: rule.discount_unit,
            value: Number(rule.discount_value),
            isIncrease: false,
            priority: Number(rule.priority),
          });
        }
      }
    }

    // 3. Check for Promo Code
    if (input.promoCode) {
      const { data: promoCodes } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', input.promoCode.toUpperCase())
        .eq('is_active', true)
        .or(`venue_id.eq.${input.venueId},venue_id.is.null`);

      const promoData = promoCodes?.find((p) => p.venue_id === input.venueId)
        || promoCodes?.find((p) => p.venue_id === null);

      if (promoData) {
        const now = new Date();
        const validFrom = promoData.valid_from ? new Date(promoData.valid_from) : null;
        const validUntil = promoData.valid_until ? new Date(promoData.valid_until) : null;
        const isValidDate = (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil);
        const isValidVenue = !promoData.venue_id || promoData.venue_id === input.venueId;
        const hasUsesLeft = promoData.max_uses === null || promoData.current_uses < promoData.max_uses;

        if (isValidDate && isValidVenue && hasUsesLeft) {
          rawDiscounts.push({
            type: 'promo_code',
            name: `Promo Code: ${promoData.code}`,
            description: promoData.description || `Special promo discount`,
            unit: promoData.discount_type,
            value: Number(promoData.discount_value),
            maxAmount: promoData.max_discount_amount ? Number(promoData.max_discount_amount) : undefined,
            isIncrease: false,
            priority: -100, // Promo codes apply after venue discounts/surcharges
          });
        }
      }
    }

    // Sort all applicable raw discounts by priority
    rawDiscounts.sort((a, b) => b.priority - a.priority);

    // Calculate sequential impacts on running price
    let currentPrice = input.basePrice;

    for (const raw of rawDiscounts) {
      let amount = 0;
      if (raw.unit === 'fixed') {
        amount = raw.value;
      } else if (raw.unit === 'percent') {
        amount = currentPrice * (raw.value / 100);
        if (raw.maxAmount && amount > raw.maxAmount) {
          amount = raw.maxAmount;
        }
      }

      if (amount > 0) {
        if (raw.isIncrease) {
          currentPrice += amount;
        } else {
          currentPrice -= amount;
        }

        // Prevent price from dropping below zero
        if (currentPrice < 0) currentPrice = 0;

        applicableDiscounts.push({
          type: raw.type,
          name: raw.name,
          description: raw.description,
          amount: amount,
          isIncrease: raw.isIncrease,
          priority: raw.priority
        });
      }
    }

    let totalDiscount = input.basePrice - currentPrice;

    return {
      success: true,
      discounts: applicableDiscounts,
      totalDiscount,
      finalPrice: currentPrice,
    };
  } catch (error) {
    console.error('[calculateApplicableDiscounts] Exception:', error);
    return {
      success: false,
      discounts: [],
      totalDiscount: 0,
      finalPrice: input.basePrice,
    };
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

export async function getActiveDiscountSummary(venueId: string) {
  try {
    const supabase = await createClient();

    const [rulesResult, holidayResult] = await Promise.all([
      supabase
        .from('discount_rules')
        .select('discount_type, is_active')
        .eq('venue_id', venueId),
      supabase
        .from('holiday_pricing')
        .select('is_active')
        .eq('venue_id', venueId),
    ]);

    const activeRules = rulesResult.data?.filter(r => r.is_active).length || 0;
    const activeHolidays = holidayResult.data?.filter(h => h.is_active).length || 0;

    return {
      success: true,
      data: {
        totalActiveRules: activeRules,
        totalActiveHolidays: activeHolidays,
        hasActiveDiscounts: activeRules > 0 || activeHolidays > 0,
      },
    };
  } catch (error) {
    console.error('[getActiveDiscountSummary] Exception:', error);
    return {
      success: false,
      data: {
        totalActiveRules: 0,
        totalActiveHolidays: 0,
        hasActiveDiscounts: false,
      },
    };
  }
}
