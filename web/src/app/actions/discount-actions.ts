'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ==========================================
// TYPES
// ==========================================

export type RuleDiscountType = 'recurring' | 'early_bird';
export type CalculatedDiscountType = RuleDiscountType | 'seasonal' | 'holiday_surcharge';

export interface DiscountRule {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  discount_type: RuleDiscountType;
  discount_value: number;
  discount_unit: 'percent' | 'fixed';
  min_weeks?: number | null;
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
  basePrice: number;
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

    // 1. Check for holiday pricing (surcharges or seasonal discounts)
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

      let amount = 0;
      if (holiday.fixed_surcharge) {
        amount = holiday.fixed_surcharge;
      } else {
        amount = input.basePrice * (holiday.price_multiplier - 1.0);
      }

      applicableDiscounts.push({
        type: isIncrease ? 'holiday_surcharge' : 'seasonal',
        name: holiday.name,
        description: isIncrease
          ? `${Math.round((holiday.price_multiplier - 1) * 100)}% holiday surcharge`
          : `${Math.round((1 - holiday.price_multiplier) * 100)}% seasonal discount`,
        amount: Math.abs(amount),
        isIncrease,
        priority: isIncrease ? 100 : 80, // Surcharges have highest priority
      });
    }

    // 2. Check for discount rules
    const { data: discountRules } = await supabase
      .from('discount_rules')
      .select('*')
      .eq('venue_id', input.venueId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (discountRules && discountRules.length > 0) {
      // Use input.startDate for validity check to align with local booking time and intended target date
      const targetDateStr = input.startDate;

      for (const rule of discountRules) {
        // Check validity dates
        if (rule.valid_from && rule.valid_from > targetDateStr) continue;
        if (rule.valid_until && rule.valid_until < targetDateStr) continue;

        let isApplicable = false;
        let discountAmount = 0;

        switch (rule.discount_type) {
          case 'recurring':
            if (rule.min_weeks && Number(input.recurrenceWeeks) >= Number(rule.min_weeks)) {
              isApplicable = true;
              discountAmount = rule.discount_unit === 'percent'
                ? (Number(input.basePrice) * Number(rule.discount_value)) / 100
                : Number(rule.discount_value);
            }
            break;

          case 'early_bird':
            if (rule.advance_days && daysInAdvance >= Number(rule.advance_days)) {
              isApplicable = true;
              discountAmount = rule.discount_unit === 'percent'
                ? (Number(input.basePrice) * Number(rule.discount_value)) / 100
                : Number(rule.discount_value);
            }
            break;

          default:
            break;
        }

        if (isApplicable && discountAmount > 0) {
          applicableDiscounts.push({
            type: rule.discount_type,
            name: rule.name,
            description: rule.description || `${rule.discount_value}${rule.discount_unit === 'percent' ? '%' : ' PHP'} discount`,
            amount: Number(discountAmount),
            isIncrease: false,
            priority: Number(rule.priority),
          });
        }
      }
    }

    // Sort by priority (highest first)
    applicableDiscounts.sort((a, b) => b.priority - a.priority);

    // Calculate total discount (subtract discounts, add surcharges)
    let totalDiscount = 0;
    for (const discount of applicableDiscounts) {
      if (discount.isIncrease) {
        totalDiscount -= Number(discount.amount); // Negative discount = surcharge
      } else {
        totalDiscount += Number(discount.amount);
      }
    }

    const finalPrice = Math.max(0, input.basePrice - totalDiscount);

    return {
      success: true,
      discounts: applicableDiscounts,
      totalDiscount,
      finalPrice,
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
