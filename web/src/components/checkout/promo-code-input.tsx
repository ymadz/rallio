'use client'

import { useState } from 'react'
import { Tag, X, CheckCircle, Loader2 } from 'lucide-react'
import { useCheckoutStore } from '@/stores/checkout-store'
import { validatePromoCode } from '@/app/actions/promo-code-actions'
import { calculateApplicableDiscounts } from '@/app/actions/discount-actions'
import { format } from 'date-fns'

export function PromoCodeInput() {
    const [code, setCode] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const {
        bookingData,
        bookingCart,
        getSubtotal,
        promoDiscountAmount,
        promoCode,
        promoDiscountType,
        setPromoDiscount,
        setDiscountDetails,
        removePromoDiscount,
        discountAmount
    } = useCheckoutStore()

    // Wait for booking data
    if (!bookingData) return null

    const effectiveCart = bookingCart.length > 0 ? bookingCart : [bookingData]



    // Recalculate all discounts using the unified backend function
    // Defined before early returns so it's available in all code paths
    const recalculateDiscounts = async (promoCodeStr?: string) => {
        if (!bookingData) return

        // Compute the full base price (before any discounts)
        const basePrice = getSubtotal() + discountAmount + promoDiscountAmount

        const dateStr = format(new Date(bookingData.date), 'yyyy-MM-dd')
        const startDateTime = `${dateStr}T${bookingData.startTime}:00+08:00`
        const endDateTime = `${dateStr}T${bookingData.endTime}:00+08:00`

        // For target date count, combine recurrence logic and multi-cart unique dates
        const uniqueDates = new Set(effectiveCart.map(item => new Date(item.date).toDateString()))
        let actualSlotCount = uniqueDates.size
        const recurrenceWeeks = bookingData.recurrenceWeeks || 1

        if (bookingData.recurrenceWeeks && bookingData.recurrenceWeeks > 1) {
             const selectedDays = bookingData.selectedDays || []
             const uniqueSelectedDays = selectedDays.length > 0
                ? Array.from(new Set(selectedDays))
                : [new Date(bookingData.date).getDay()]
             actualSlotCount = Math.max(actualSlotCount, uniqueSelectedDays.length * bookingData.recurrenceWeeks)
        }

        const unifiedResult = await calculateApplicableDiscounts({
            venueId: bookingData.venueId,
            courtId: bookingData.courtId,
            startDate: startDateTime,
            endDate: endDateTime,
            recurrenceWeeks,
            targetDateCount: actualSlotCount,
            basePrice,
            promoCode: promoCodeStr
        })

        if (unifiedResult.success) {
            // Split results into promo vs non-promo
            const promoDiscounts = unifiedResult.discounts.filter(d => d.type === 'promo_code')
            const venueDiscounts = unifiedResult.discounts.filter(d => d.type !== 'promo_code')
            const venueTotal = venueDiscounts.reduce((sum, d) => d.isIncrease ? sum - d.amount : sum + d.amount, 0)

            setDiscountDetails({
                amount: venueTotal,
                type: venueDiscounts[0]?.name,
                reason: venueDiscounts.map(d => d.description).join(', '),
                discounts: venueDiscounts
            })

            return { promoDiscounts, venueDiscounts }
        }
        return null
    }

    // If a promotion is already applied, show success state
    if (promoCode && promoDiscountAmount > 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900">
                                {promoCode.toUpperCase()} applied
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {promoDiscountType === 'percent' ? 'Percentage' : 'Fixed amount'} discount
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            removePromoDiscount()
                            setCode('')
                            // Recalculate venue discounts without promo (amounts may differ)
                            await recalculateDiscounts()
                        }}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                        title="Remove promo code"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        )
    }

    const handleApply = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!code.trim()) return

        setIsLoading(true)
        setError(null)

        try {
            // First validate the promo code (checks validity, dates, usage limits)
            const discountedSubtotal = getSubtotal() + promoDiscountAmount
            const result = await validatePromoCode(
                code,
                bookingData.venueId,
                discountedSubtotal
            )

            if (!result.valid || !result.promoCode) {
                setError(result.error || 'Invalid promo code')
                return
            }

            // Recalculate ALL discounts together (matching backend priority logic)
            const recalcResult = await recalculateDiscounts(code)

            if (recalcResult) {
                const promoTotal = recalcResult.promoDiscounts.reduce((sum, d) => sum + d.amount, 0)
                const effectivePromoAmount = promoTotal > 0 ? promoTotal : (result.discountAmount || 0)

                if (effectivePromoAmount <= 0) {
                    setError('Promo code is valid but does not affect this booking total.')
                    return
                }

                setPromoDiscount({
                    amount: effectivePromoAmount,
                    code: result.promoCode.code,
                    type: result.promoCode.discount_type,
                    reason: result.promoCode.description || undefined
                })
            } else {
                // Fallback: use the validation result amount
                if (!result.discountAmount || result.discountAmount <= 0) {
                    setError('Promo code is valid but does not affect this booking total.')
                    return
                }
                setPromoDiscount({
                    amount: result.discountAmount!,
                    code: result.promoCode.code,
                    type: result.promoCode.discount_type,
                    reason: result.promoCode.description || undefined
                })
            }
            setCode('')
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
                <Tag className="w-4 h-4 text-primary" />
                <span className="font-semibold text-gray-900 text-lg">Promo Code</span>
            </div>
            <p className="text-sm text-gray-500 mb-4">Have a promo code? Apply it for a discount!</p>

            <form onSubmit={handleApply} className="relative">
                <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                        setCode(e.target.value.toUpperCase().replace(/\s/g, ''))
                        setError(null)
                    }}
                    placeholder="ENTER CODE HERE"
                    className="w-full pl-4 pr-24 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono font-bold uppercase transition-all placeholder:text-gray-300 text-sm"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading || !code.trim()}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-6 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </button>
            </form>

            {error && (
                <p className="text-xs text-red-600 mt-2 flex items-center gap-1.5 bg-red-50 p-2 rounded-lg border border-red-100 font-medium">
                    <span className="shrink-0 font-bold text-red-400">!</span>
                    {error}
                </p>
            )}
        </div>
    )
}
