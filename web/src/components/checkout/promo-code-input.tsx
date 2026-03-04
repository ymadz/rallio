'use client';

import { useState } from 'react';
import { useCheckoutStore } from '@/stores/checkout-store';
import { validatePromoCodeAction } from '@/app/actions/promo-actions';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, X, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function PromoCodeInput() {
    const { user } = useAuth();
    const {
        bookingData,
        getTotalAmount,
        discountCode,
        setDiscountDetails,
        applicableDiscounts,
        discountAmount
    } = useCheckoutStore();

    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    if (!bookingData) return null;

    const handleApplyPromo = async () => {
        if (!code.trim()) return;
        if (!user) {
            toast.error('Please log in to use promo codes.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await validatePromoCodeAction(
                code,
                bookingData.venueId,
                getTotalAmount(),
                user.id
            );

            if (result.success && result.data) {
                const newPromoDiscount = {
                    type: 'promo' as const,
                    name: `Promo: ${result.data.code}`,
                    description: result.data.description || 'Promo code applied',
                    amount: result.data.discountAmount,
                    isIncrease: false,
                    priority: 95
                };

                let nextDiscounts = applicableDiscounts || [];
                let nextAmount = discountAmount;

                if (result.data.isExclusive) {
                    // CONFLICT RESOLUTION: Exclusive promo overrides all standard discounts
                    nextDiscounts = [newPromoDiscount];
                    nextAmount = result.data.discountAmount;
                    toast.info('Exclusive promo code applied. Other discounts removed.');
                } else {
                    // STACKABLE: Standard discounts + Promo
                    nextDiscounts = [...nextDiscounts, newPromoDiscount];
                    nextAmount = discountAmount + result.data.discountAmount;
                }

                setDiscountDetails({
                    amount: nextAmount,
                    type: 'promo',
                    reason: result.data.code,
                    promoCodeId: result.data.promoCodeId,
                    isExclusive: result.data.isExclusive,
                    discounts: nextDiscounts
                });

                setIsSuccess(true);
                toast.success(`Promo code ${result.data.code} applied!`);
                setCode('');
            } else {
                toast.error(result.error || 'Failed to apply promo code.');
            }
        } catch (error) {
            toast.error('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemovePromo = () => {
        const promoDiscount = applicableDiscounts?.find(d => d.type === 'promo');
        if (!promoDiscount) return;

        const remainingDiscounts = applicableDiscounts?.filter(d => d.type !== 'promo') || [];
        const remainingAmount = discountAmount - promoDiscount.amount;

        setDiscountDetails({
            amount: remainingAmount,
            type: remainingDiscounts.length > 0 ? remainingDiscounts[0].type : undefined,
            reason: remainingDiscounts.length > 0 ? remainingDiscounts[0].name : undefined,
            discounts: remainingDiscounts
        });

        setIsSuccess(false);
        toast.info('Promo code removed.');
    };

    const hasPromoApplied = applicableDiscounts?.some(d => d.type === 'promo');

    if (hasPromoApplied) {
        const promo = applicableDiscounts?.find(d => d.type === 'promo');
        return (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-green-800 uppercase">{promo?.name}</span>
                        <span className="text-xs text-green-600">-₱{promo?.amount.toFixed(2)}</span>
                    </div>
                </div>
                <button
                    onClick={handleRemovePromo}
                    className="p-1 hover:bg-green-100 rounded-full transition-colors"
                >
                    <X className="w-4 h-4 text-green-600" />
                </button>
            </div>
        );
    }

    return (
        <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Promo Code</p>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Enter code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="pl-9 h-10 border-gray-200 focus:ring-primary focus:border-primary"
                        disabled={isLoading}
                    />
                </div>
                <Button
                    onClick={handleApplyPromo}
                    disabled={isLoading || !code.trim()}
                    variant="outline"
                    className="h-10 border-primary text-primary hover:bg-primary/5 px-4"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
            </div>
        </div>
    );
}
