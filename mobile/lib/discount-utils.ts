import { supabase } from '@/lib/supabase';

// ==========================================
// TYPES
// ==========================================

export type DiscountType = 'multi_day' | 'group' | 'early_bird' | 'seasonal' | 'holiday_surcharge';

export interface DiscountRule {
    id: string;
    venue_id: string;
    name: string;
    description: string | null;
    discount_type: DiscountType;
    discount_value: number;
    discount_unit: 'percent' | 'fixed';
    min_days?: number | null;
    min_players?: number | null;
    advance_days?: number | null;
    is_active: boolean;
    priority: number;
    valid_from: string | null;
    valid_until: string | null;
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
}

export interface DiscountCalculationInput {
    venueId: string;
    startDate: string; // ISO string
    endDate: string;   // ISO string
    numberOfDays: number;
    numberOfPlayers: number;
    basePrice: number;
}

export interface ApplicableDiscount {
    type: DiscountType | 'holiday_surcharge';
    name: string;
    description: string;
    amount: number;
    isIncrease: boolean; // true for surcharges
    priority: number;
}

// ==========================================
// DISCOUNT CALCULATION
// ==========================================

export async function calculateApplicableDiscounts(
    input: DiscountCalculationInput
): Promise<{ success: boolean; discounts: ApplicableDiscount[]; totalDiscount: number; finalPrice: number }> {
    try {
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
            const now = new Date().toISOString();

            for (const rule of discountRules) {
                // Check validity dates
                if (rule.valid_from && rule.valid_from > now) continue;
                if (rule.valid_until && rule.valid_until < now) continue;

                let isApplicable = false;
                let discountAmount = 0;

                switch (rule.discount_type) {
                    case 'multi_day':
                        if (rule.min_days && input.numberOfDays >= rule.min_days) {
                            isApplicable = true;
                            discountAmount = rule.discount_unit === 'percent'
                                ? (input.basePrice * input.numberOfDays * rule.discount_value) / 100
                                : rule.discount_value;
                        }
                        break;

                    case 'group':
                        if (rule.min_players && input.numberOfPlayers >= rule.min_players) {
                            isApplicable = true;
                            discountAmount = rule.discount_unit === 'percent'
                                ? (input.basePrice * rule.discount_value) / 100
                                : rule.discount_value;
                        }
                        break;

                    case 'early_bird':
                        if (rule.advance_days && daysInAdvance >= rule.advance_days) {
                            isApplicable = true;
                            discountAmount = rule.discount_unit === 'percent'
                                ? (input.basePrice * rule.discount_value) / 100
                                : rule.discount_value;
                        }
                        break;

                    case 'seasonal':
                        // Already handled by holiday_pricing table
                        break;

                    default:
                        break;
                }

                if (isApplicable && discountAmount > 0) {
                    applicableDiscounts.push({
                        type: rule.discount_type,
                        name: rule.name,
                        description: rule.description || `${rule.discount_value}${rule.discount_unit === 'percent' ? '%' : ' PHP'} discount`,
                        amount: discountAmount,
                        isIncrease: false,
                        priority: rule.priority,
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
                totalDiscount -= discount.amount; // Negative discount = surcharge
            } else {
                totalDiscount += discount.amount;
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
