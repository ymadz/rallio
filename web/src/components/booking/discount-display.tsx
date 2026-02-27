'use client';

import { useEffect, useState } from 'react';
import { Tag, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { calculateApplicableDiscounts, type ApplicableDiscount } from '@/app/actions/discount-actions';

interface DiscountDisplayProps {
  venueId: string;
  courtId: string;
  startDate: string;
  endDate: string;
  recurrenceWeeks: number;
  basePrice: number;
  onDiscountCalculated?: (totalDiscount: number, finalPrice: number, discountType?: string, discountReason?: string) => void;
}

export function DiscountDisplay({
  venueId,
  courtId,
  startDate,
  endDate,
  recurrenceWeeks,
  basePrice,
  onDiscountCalculated,
}: DiscountDisplayProps) {
  const [discounts, setDiscounts] = useState<ApplicableDiscount[]>([]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [finalPrice, setFinalPrice] = useState(basePrice);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const calculateDiscounts = async () => {
      if (!venueId || !courtId || !startDate || basePrice <= 0) {
        setDiscounts([]);
        setTotalDiscount(0);
        setFinalPrice(basePrice);
        return;
      }

      setLoading(true);

      try {
        const result = await calculateApplicableDiscounts({
          venueId,
          courtId,
          startDate,
          endDate,
          recurrenceWeeks,
          basePrice,
        });

        if (result.success) {
          setDiscounts(result.discounts);
          setTotalDiscount(result.totalDiscount);
          setFinalPrice(result.finalPrice);

          // Notify parent component
          if (onDiscountCalculated) {
            const discountType = result.discounts.length > 0 ? result.discounts[0].type : undefined;
            const discountReason = result.discounts.map(d => d.name).join(', ');
            onDiscountCalculated(result.totalDiscount, result.finalPrice, discountType, discountReason);
          }
        }
      } catch (error) {
        console.error('[DiscountDisplay] Error calculating discounts:', error);
      } finally {
        setLoading(false);
      }
    };

    calculateDiscounts();
  }, [venueId, courtId, startDate, endDate, recurrenceWeeks, basePrice, onDiscountCalculated]);

  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
        <p className="text-sm text-blue-700">Calculating discounts...</p>
      </div>
    );
  }

  if (discounts.length === 0) {
    return null;
  }

  const hasSurcharge = discounts.some(d => d.isIncrease);

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${hasSurcharge ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
      }`}>
      <div className="flex items-center gap-2">
        {hasSurcharge ? (
          <TrendingUp className="h-5 w-5 text-orange-600" />
        ) : (
          <TrendingDown className="h-5 w-5 text-green-600" />
        )}
        <h3 className={`font-semibold ${hasSurcharge ? 'text-orange-900' : 'text-green-900'}`}>
          {hasSurcharge ? 'Price Adjustments' : 'Discounts Applied'}
        </h3>
      </div>

      <div className="space-y-2">
        {discounts.map((discount, index) => (
          <div key={index} className="flex items-start justify-between text-sm">
            <div className="flex items-start gap-2">
              <Tag className={`h-4 w-4 mt-0.5 flex-shrink-0 ${discount.isIncrease ? 'text-orange-600' : 'text-green-600'
                }`} />
              <div>
                <p className={`font-medium ${discount.isIncrease ? 'text-orange-900' : 'text-green-900'
                  }`}>
                  {discount.name}
                </p>
                <p className={`text-xs ${discount.isIncrease ? 'text-orange-700' : 'text-green-700'
                  }`}>
                  {discount.description}
                </p>
              </div>
            </div>
            <span className={`font-semibold whitespace-nowrap ${discount.isIncrease ? 'text-orange-900' : 'text-green-900'
              }`}>
              {discount.isIncrease ? '+' : '-'}₱{discount.amount.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <div className={`pt-3 border-t flex items-center justify-between ${hasSurcharge ? 'border-orange-200' : 'border-green-200'
        }`}>
        <span className={`font-semibold ${hasSurcharge ? 'text-orange-900' : 'text-green-900'
          }`}>
          {totalDiscount < 0 ? 'Additional Charge' : 'Total Savings'}
        </span>
        <span className={`text-lg font-bold ${hasSurcharge ? 'text-orange-900' : 'text-green-900'
          }`}>
          {totalDiscount < 0 ? '+' : '-'}₱{Math.abs(totalDiscount).toFixed(2)}
        </span>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-300">
        <span className="text-base font-semibold text-gray-900">Final Price</span>
        <span className="text-xl font-bold text-gray-900">
          ₱{finalPrice.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
