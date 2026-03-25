'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Tag, X, CheckCircle, Loader2 } from 'lucide-react'
import { useCheckoutStore } from '@/stores/checkout-store'
import { validatePromoCode } from '@/app/actions/promo-code-actions'
import { calculateApplicableDiscounts } from '@/app/actions/discount-actions'
import { format } from 'date-fns'

export function PromoCodeInput() {
    const [code, setCode] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const lastDiscountRecalcKeyRef = useRef<string | null>(null)

    const {
        bookingData,
        bookingCart,
        promoDiscountAmount,
        promoCode,
        promoDiscountType,
        promoTargetVenueId,
        setPromoDiscount,
        setDiscountDetails,
        removePromoDiscount,
        discountAmount,
        discountType,
        discountReason,
        applicableDiscounts,
    } = useCheckoutStore()

    const effectiveCart = useMemo(() => {
        if (!bookingData) return []
        return bookingCart.length > 0 ? bookingCart : [bookingData]
    }, [bookingCart, bookingData])

    const getItemBasePrice = useCallback((item: typeof effectiveCart[number]) => {
        const [startH, startM] = item.startTime.split(':').map(Number)
        const [endH, endM] = item.endTime.split(':').map(Number)

        let duration = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60)
        if (duration <= 0) duration += 24

        const recurrenceWeeks = item.recurrenceWeeks || 1
        const selectedDays = item.selectedDays || []
        const baseSessions = selectedDays.length > 0 ? selectedDays.length : 1
        const totalSessions = Math.max(1, recurrenceWeeks * baseSessions)

        const totalHourlyRate = (item.courts && item.courts.length > 0)
            ? item.courts.reduce((sum, c) => sum + (Number(c.hourly_rate) || item.hourlyRate), 0)
            : item.hourlyRate

        return totalHourlyRate * duration * totalSessions
    }, [effectiveCart])

    const getVenueBasePrice = useCallback((venueId: string) => {
        return effectiveCart
            .filter(item => item.venueId === venueId)
            .reduce((sum, item) => sum + getItemBasePrice(item), 0)
    }, [effectiveCart, getItemBasePrice])

    // Recalculate all discounts using the unified backend function, scoped to a single venue.
    const recalculateDiscounts = useCallback(async (promoCodeStr?: string, targetVenueId?: string) => {
        if (!bookingData) return null

        const venueId = targetVenueId || promoTargetVenueId || bookingData.venueId
        const scopedItems = effectiveCart.filter(item => item.venueId === venueId)
        const anchorItem = scopedItems[0]
        if (!anchorItem) return null

        // Compute scoped base price so promo applies only to the chosen venue.
        const basePrice = getVenueBasePrice(venueId)
        if (basePrice <= 0) return null

        const dateStr = format(new Date(anchorItem.date), 'yyyy-MM-dd')
        const startDateTime = `${dateStr}T${anchorItem.startTime}:00+08:00`
        const endDateTime = `${dateStr}T${anchorItem.endTime}:00+08:00`

        // For target date count, combine recurrence and selected days.
        const uniqueDates = new Set(scopedItems.map(item => new Date(item.date).toDateString()))
        let actualSlotCount = uniqueDates.size
        const recurrenceWeeks = anchorItem.recurrenceWeeks || 1
        const selectedDays = anchorItem.selectedDays || []
        const uniqueSelectedDays = selectedDays.length > 0
            ? Array.from(new Set(selectedDays))
            : [new Date(anchorItem.date).getDay()]
        actualSlotCount = Math.max(actualSlotCount, uniqueSelectedDays.length * recurrenceWeeks)

        const unifiedResult = await calculateApplicableDiscounts({
            venueId,
            courtId: anchorItem.courtId,
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

            const hasExistingQueueDiscount =
                bookingData.isQueueSession &&
                Math.abs(discountAmount) > 0 &&
                ((applicableDiscounts && applicableDiscounts.length > 0) || !!discountType || !!discountReason)

            // Do not wipe queue-session non-promo discounts if backend recalc returns only promo entries.
            if (venueDiscounts.length > 0 || !hasExistingQueueDiscount) {
                setDiscountDetails({
                    amount: venueTotal,
                    type: venueDiscounts[0]?.name,
                    reason: venueDiscounts.map(d => d.description).join(', '),
                    discounts: venueDiscounts
                })
            }

            return { promoDiscounts, venueDiscounts, venueId }
        }
        return null
    }, [bookingData, promoTargetVenueId, effectiveCart, getVenueBasePrice, setDiscountDetails, applicableDiscounts, discountAmount, discountReason, discountType])

    const discountRecalcKey = useMemo(() => {
        if (!effectiveCart.length) return 'none'
        const cartSignature = effectiveCart
            .map(item => `${item.courtId}|${new Date(item.date).toISOString()}|${item.startTime}|${item.endTime}|${item.recurrenceWeeks || 1}|${(item.selectedDays || []).join(',')}`)
            .join('||')

        return `${cartSignature}|promo:${promoCode || ''}|promoVenue:${promoTargetVenueId || ''}`
    }, [effectiveCart, promoCode, promoTargetVenueId])

    useEffect(() => {
        if (!bookingData) return
        if (lastDiscountRecalcKeyRef.current === discountRecalcKey) return

        let isCancelled = false
        lastDiscountRecalcKeyRef.current = discountRecalcKey

        const run = async () => {
            try {
                await recalculateDiscounts(promoCode, promoTargetVenueId)
            } catch (recalcError) {
                if (!isCancelled) {
                    console.error('Failed to recalculate checkout discounts:', recalcError)
                }
            }
        }

        run()

        return () => {
            isCancelled = true
        }
    }, [bookingData, discountRecalcKey, promoCode, promoTargetVenueId, recalculateDiscounts])

    // Wait for booking data
    if (!bookingData) return null

    // If a promotion is already applied, show success state
    if (promoCode && promoDiscountAmount > 0) {
        const promoVenueName = effectiveCart.find(item => item.venueId === promoTargetVenueId)?.venueName
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
                            {promoVenueName && (
                                <p className="text-xs text-gray-500 mt-0.5">Applied to: {promoVenueName}</p>
                            )}
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
            // Validate against venue subtotals and bind promo to the matching venue only.
            const uniqueVenueIds = Array.from(new Set(effectiveCart.map(item => item.venueId).filter(Boolean)))

            let result: Awaited<ReturnType<typeof validatePromoCode>> | null = null
            let matchedVenueId: string | null = null

            for (const venueId of uniqueVenueIds) {
                const venueSubtotal = getVenueBasePrice(venueId)
                if (venueSubtotal <= 0) continue

                const validation = await validatePromoCode(code, venueId, venueSubtotal)
                if (validation.valid && validation.promoCode) {
                    result = validation
                    matchedVenueId = venueId
                    break
                }
            }

            if (!result || !result.valid || !result.promoCode || !matchedVenueId) {
                setError(result?.error || 'Invalid promo code for selected venues')
                return
            }

            // Recalculate ALL discounts together (matching backend priority logic)
            const recalcResult = await recalculateDiscounts(code, matchedVenueId)

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
                    reason: result.promoCode.description || undefined,
                    venueId: recalcResult.venueId || matchedVenueId,
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
                    reason: result.promoCode.description || undefined,
                    venueId: matchedVenueId,
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
