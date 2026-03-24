'use client'

import { useEffect, useState } from 'react'
import { formatTo12Hour } from '@/lib/utils';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation'
import { useCheckoutStore } from '@/stores/checkout-store'
import { CheckoutStepper } from '@/components/checkout/checkout-stepper'
import { BookingSummaryCard } from '@/components/checkout/booking-summary-card'
import { SplitPaymentControls } from '@/components/checkout/split-payment-controls'
import { PromoCodeInput } from '@/components/checkout/promo-code-input'
import { PaymentMethodSelector } from '@/components/checkout/payment-method-selector'
import { CancellationPolicy } from '@/components/checkout/cancellation-policy'
import { PaymentProcessing } from '@/components/checkout/payment-processing'
import { CancelBookingModal } from '@/components/checkout/cancel-booking-modal'
import { createClient } from '@/lib/supabase/client'

export default function CheckoutPage() {
    const router = useRouter()
    const [isHydrated, setIsHydrated] = useState(false)
    const {
        bookingData,
        bookingCart,
        currentStep,
        isSplitPayment,
        paymentMethod,
        policyAccepted,
        playerCount,
        setCurrentStep,
        resetCheckout,
        getSubtotal,
        discountAmount,
        promoDiscountAmount,
        promoCode,
        reservationId: storeReservationId,
        customDownPaymentAmount,
        downPaymentPercentage,
        platformFeeEnabled,
        platformFeePercentage,
    } = useCheckoutStore()

    // Hydration check
    useEffect(() => {
        setIsHydrated(true)
    }, [])

    // Guard: detect stale checkout state (e.g. page revisited after completed booking)
    useEffect(() => {
        if (!isHydrated) return
        if (currentStep === 'processing') {
            // If we have a stored reservationId, redirect to receipt
            if (storeReservationId) {
                resetCheckout()
                router.push(`/bookings/${storeReservationId}/receipt`)
            } else {
                // No reservationId = stale state, reset and go home
                resetCheckout()
                router.push('/courts')
            }
        }
    }, [isHydrated, currentStep, storeReservationId]) 

    // Redirect if no booking data (after hydration)
    useEffect(() => {
        if (isHydrated && !bookingData) {
            router.push('/courts')
        }
    }, [isHydrated, bookingData, router])

    const [showCancelModal, setShowCancelModal] = useState(false)
    const [courtImageUrl, setCourtImageUrl] = useState<string | null>(null)

    // Fetch court image
    useEffect(() => {
        if (!isHydrated || !bookingData) return
        const supabase = createClient()
        async function fetchImage() {
            // Try court-specific image first
            const { data: courtImg } = await supabase
                .from('court_images')
                .select('url')
                .eq('court_id', bookingData!.courtId)
                .order('is_primary', { ascending: false })
                .order('display_order', { ascending: true })
                .limit(1)
                .single()
            if (courtImg?.url) {
                setCourtImageUrl(courtImg.url)
                return
            }
            // Fall back to venue image
            const { data: venue } = await supabase
                .from('venues')
                .select('image_url')
                .eq('id', bookingData!.venueId)
                .single()
            if (venue?.image_url) {
                setCourtImageUrl(venue.image_url)
            }
        }
        fetchImage()
    }, [isHydrated, bookingData?.courtId, bookingData?.venueId])

    if (!isHydrated || !bookingData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary" />
            </div>
        )
    }

    const effectiveCart = bookingCart.length > 0 ? bookingCart : [bookingData]
    const isMultiCourt = effectiveCart.length > 1 || (effectiveCart[0]?.courts && effectiveCart[0].courts.length > 1)
    
    // Flatten the cart for display purposes if an item has multiple courts (like a queue session)
    const displayCart = effectiveCart.flatMap((item, itemIdx) => {
        if (item.courts && item.courts.length > 1) {
            return item.courts.map((court, courtIdx) => ({
                ...item,
                courtId: court.id,
                courtName: court.name,
                hourlyRate: Number(court.hourly_rate) || item.hourlyRate,
                courts: [court], // Each display item represents one court
                displayKey: `display-${item.venueId}-${item.startTime}-${court.id}-${itemIdx}-${courtIdx}`
            }))
        }
        return [{
            ...item,
            displayKey: `display-${item.courtId}-${item.startTime}-${itemIdx}`
        }]
    })

    const totalCartHours = effectiveCart.reduce((sum, item) => {
        const itemStartHour = parseInt(item.startTime.split(':')[0])
        const itemEndHour = parseInt(item.endTime.split(':')[0])
        return sum + Math.max(itemEndHour - itemStartHour, 0)
    }, 0)
    const totalCartAmount = effectiveCart.reduce((sum, item) => {
        const itemStartHour = parseInt(item.startTime.split(':')[0])
        const itemEndHour = parseInt(item.endTime.split(':')[0])
        const itemDuration = Math.max(itemEndHour - itemStartHour, 0)
        const totalHourlyRate = (item.courts && item.courts.length > 0)
            ? item.courts.reduce((isum, c) => isum + (Number(c.hourly_rate) || item.hourlyRate), 0)
            : item.hourlyRate;
        return sum + (totalHourlyRate * itemDuration)
    }, 0)
    const uniqueVenueCount = new Set(effectiveCart.map((item) => item.venueId)).size

    // Calculate duration from startTime and endTime
    const startHour = parseInt(bookingData.startTime.split(':')[0])
    const endHour = parseInt(bookingData.endTime.split(':')[0])
    const duration = endHour - startHour
    const totalBookingFee = getSubtotal() // This now includes duration

    const handleCancel = () => {
        setShowCancelModal(true)
    }

    const handleConfirmCancel = () => {
        resetCheckout()
        router.push(`/courts/${bookingData.venueId}`)
    }

    const handleContinue = () => {
        if (currentStep === 'details') {
            setCurrentStep('payment')
        } else if (currentStep === 'payment') {
            if (!paymentMethod) {
                alert('Please select a payment method')
                return
            }
            setCurrentStep('policy')
        } else if (currentStep === 'policy') {
            if (!policyAccepted) {
                alert('Please accept the cancellation policy to continue')
                return
            }
            setCurrentStep('processing')
        }
    }

    const handleBack = () => {
        if (currentStep === 'payment') {
            setCurrentStep('details')
        } else if (currentStep === 'policy') {
            setCurrentStep('payment')
        } else if (currentStep === 'processing') {
            setCurrentStep('policy')
        }
    }

    const canContinue = () => {
        if (currentStep === 'details') return true
        if (currentStep === 'payment') {
            if (!paymentMethod) return false
            if (paymentMethod === 'cash') {
                const { getTotalAmount, downPaymentPercentage, customDownPaymentAmount, cashPaymentOption } = useCheckoutStore.getState()
                if (cashPaymentOption === 'full_cash') return true

                const finalTotal = getTotalAmount()
                const isDownPaymentRequired = downPaymentPercentage ? downPaymentPercentage > 0 : false

                if (isDownPaymentRequired) {
                    const minimumDownPayment = Math.round((finalTotal * ((downPaymentPercentage ?? 20) / 100)) * 100) / 100
                    if (customDownPaymentAmount !== undefined && customDownPaymentAmount > 0 && customDownPaymentAmount < minimumDownPayment) {
                        return false
                    }
                }
            }
            return true
        }
        if (currentStep === 'policy') return policyAccepted
        return false
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={currentStep === 'details' ? handleCancel : handleBack}
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
                </div>
            </div>

            {/* Stepper */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6">
                    <CheckoutStepper currentStep={currentStep} />
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Column - Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Step 1: Details */}
                        {currentStep === 'details' && (
                            <>
                                {/* Court Card / Cart Card */}
                                {isMultiCourt ? (
                                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                                            <div>
                                                <h3 className="font-semibold text-gray-900 text-lg">Multi-Court Cart</h3>
                                                <p className="text-sm text-gray-600">{displayCart.length} court slots will be processed in one checkout.</p>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Venues</p>
                                                    <p className="text-sm font-semibold text-gray-900">{uniqueVenueCount}</p>
                                                </div>
                                                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2" title={`${totalCartHours} duration x ${displayCart.length} courts`}>
                                                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Hours</p>
                                                    <p className="text-sm font-semibold text-gray-900">{totalCartHours * (isMultiCourt && effectiveCart[0]?.courts && effectiveCart[0].courts.length > 1 ? effectiveCart[0].courts.length : 1)}</p>
                                                </div>
                                                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Total</p>
                                                    <p className="text-sm font-semibold text-gray-900">₱{totalCartAmount.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="max-h-[320px] overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                                            {displayCart.map((item, index) => {
                                                const itemStartHour = parseInt(item.startTime.split(':')[0])
                                                const itemEndHour = parseInt(item.endTime.split(':')[0])
                                                const itemDuration = Math.max(itemEndHour - itemStartHour, 0)
                                                // items in displayCart are already per-court if needed
                                                const itemTotal = item.hourlyRate * itemDuration

                                                return (
                                                    <div key={item.displayKey} className="p-4">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
                                                                        {index + 1}
                                                                    </span>
                                                                    <p className="font-medium text-gray-900 truncate">{item.courtName}</p>
                                                                </div>
                                                                <p className="text-xs text-gray-600 truncate">{item.venueName}</p>
                                                                <p className="text-xs text-gray-600 mt-1">
                                                                    {format(new Date(item.date), 'EEE, MMM d, yyyy')} • {formatTo12Hour(item.startTime)} - {formatTo12Hour(item.endTime)}
                                                                </p>
                                                            </div>
 
                                                            <div className="sm:text-right">
                                                                <p className="text-xs text-gray-500">
                                                                    {itemDuration} {itemDuration === 1 ? 'hr' : 'hrs'}
                                                                    {` @ ₱${item.hourlyRate.toFixed(2)}/hr`}
                                                                </p>
                                                                <p className="text-sm font-semibold text-gray-900 mt-0.5">₱{itemTotal.toFixed(2)}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                                        <h3 className="font-semibold text-gray-900 text-lg mb-4">Court Details</h3>
                                        <div className="flex gap-4">
                                            <div className="w-32 h-32 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                                                {courtImageUrl ? (
                                                    <img
                                                        src={courtImageUrl}
                                                        alt={bookingData.courtName}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-gray-900 text-xl mb-2">{bookingData.courtName}</h4>
                                                <p className="text-sm text-gray-600 mb-3">{bookingData.venueName}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                        🏸 Indoor
                                                    </span>
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                        Synthetic
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Detail Breakdown */}
                                <div className="bg-white border border-gray-200 rounded-xl p-6">
                                    <h3 className="font-semibold text-gray-900 text-lg mb-4">Detail Breakdown</h3>
                                    {isMultiCourt && (
                                        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                            Showing aggregate totals for {displayCart.length} court items. Per-item pricing appears in Booking Summary.
                                        </div>
                                    )}
                                    <div className="space-y-3">
                                        <div className="flex justify-between py-3 border-b border-gray-100">
                                            <span className="text-gray-600">Duration:</span>
                                            <span className="font-medium text-gray-900">{duration} {duration === 1 ? 'hour' : 'hours'}</span>
                                        </div>
                                        <div className="flex justify-between py-3 border-b border-gray-100">
                                            <span className="text-gray-600">Hourly Rate:</span>
                                            <div className="text-right">
                                                <span className="font-medium text-gray-900">₱{bookingData.hourlyRate.toFixed(2)}</span>
                                                {bookingData.courts && bookingData.courts.length > 1 && (
                                                    <span className="block text-[10px] text-gray-500">× {bookingData.courts.length} courts = ₱{(bookingData.hourlyRate * bookingData.courts.length).toFixed(2)}/hr total</span>
                                                )}
                                            </div>
                                        </div>

                                        {(bookingData.recurrenceWeeks && bookingData.recurrenceWeeks > 1) && (
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-gray-600">Recurrence:</span>
                                                <span className="font-medium text-gray-900">{bookingData.recurrenceWeeks} weeks</span>
                                            </div>
                                        )}

                                        {(bookingData.selectedDays && bookingData.selectedDays.length > 1) && (
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-gray-600">Sessions per Week:</span>
                                                <div className="text-right">
                                                    <span className="block font-medium text-gray-900">{bookingData.selectedDays.length} sessions</span>
                                                    <span className="text-xs text-gray-500">
                                                        {bookingData.selectedDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {((bookingData.recurrenceWeeks || 1) * (bookingData.selectedDays?.length || 1)) > 1 && (
                                            <div className="flex justify-between py-3 border-b border-gray-100 bg-gray-50 -mx-6 px-6">
                                                <span className="text-gray-600 font-medium">Total Sessions:</span>
                                                <span className="font-medium text-gray-900">{(bookingData.recurrenceWeeks || 1) * (bookingData.selectedDays?.length || 1)}</span>
                                            </div>
                                        )}
                                        {discountAmount !== 0 && (
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className={discountAmount < 0 ? 'text-orange-600' : 'text-primary font-medium uppercase'}>
                                                    {discountAmount < 0 ? 'Surcharge' : 'Discount'}
                                                </span>
                                                <span className={`font-bold ${discountAmount < 0 ? 'text-orange-600' : 'text-primary'}`}>
                                                    {discountAmount < 0 ? '+' : '-'}₱{Math.abs(discountAmount).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        {promoDiscountAmount > 0 && (
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-primary font-medium flex items-center gap-1.5">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                    </svg>
                                                    Promo '{promoCode}'
                                                </span>
                                                <span className="font-bold text-primary">
                                                    -₱{promoDiscountAmount.toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between py-3">
                                            <span className="text-gray-600">Booking Fee:</span>
                                            <span className="font-medium text-gray-900">₱{totalBookingFee.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Promo Code Input */}
                                <PromoCodeInput />

                                {/* Split Payment Controls (hidden for queue sessions) */}
                                {/* {!bookingData.isQueueSession && <SplitPaymentControls />} */}

                                {/* Queue Session Settings Card */}
                                {bookingData.isQueueSession && bookingData.queueSessionData && (
                                    <div className="bg-white border border-gray-200 rounded-xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 text-lg">Queue Session Settings</h3>
                                                <p className="text-sm text-gray-500">Walk-in session configuration</p>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-gray-600">Mode:</span>
                                                <span className="font-medium text-gray-900 capitalize">{bookingData.queueSessionData.mode}</span>
                                            </div>
                                            {(bookingData.queueSessionData.minSkillLevel != null || bookingData.queueSessionData.maxSkillLevel != null) && (
                                                <div className="flex justify-between py-3 border-b border-gray-100">
                                                    <span className="text-gray-600">Skill Level:</span>
                                                    <span className="font-medium text-gray-900">
                                                        {(() => {
                                                            const min = bookingData.queueSessionData.minSkillLevel;
                                                            const max = bookingData.queueSessionData.maxSkillLevel;
                                                            if (min === 1 && max === 3) return 'Beginner';
                                                            if (min === 4 && max === 6) return 'Intermediate';
                                                            if (min === 7 && max === 8) return 'Advanced';
                                                            if (min === 9 && max === 10) return 'Elite';
                                                            
                                                            const getTier = (l: number) => l <= 3 ? 'Beginner' : l <= 6 ? 'Intermediate' : l <= 8 ? 'Advanced' : 'Elite';
                                                            if (min != null && max != null) {
                                                                if (getTier(min) === getTier(max)) return getTier(min);
                                                                return `${getTier(min)} - ${getTier(max)}`;
                                                            }
                                                            return min != null ? `${getTier(min)}+` : `Up to ${getTier(max!)}`;
                                                        })()}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-gray-600">Game Format:</span>
                                                <span className="font-medium text-gray-900 capitalize">{bookingData.queueSessionData.gameFormat}</span>
                                            </div>
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-gray-600">Max Players:</span>
                                                <span className="font-medium text-gray-900">{bookingData.queueSessionData.maxPlayers}</span>
                                            </div>
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-gray-600">Cost Per Game:</span>
                                                <span className="font-medium text-gray-900">₱{bookingData.queueSessionData.costPerGame}</span>
                                            </div>
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-gray-600">Visibility:</span>
                                                <span className={`font-medium ${bookingData.queueSessionData.isPublic ? 'text-green-600' : 'text-gray-600'}`}>
                                                    {bookingData.queueSessionData.isPublic ? 'Public' : 'Private'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between py-3">
                                                <span className="text-gray-600">Join Window:</span>
                                                <span className="font-medium text-gray-900">
                                                    {bookingData.queueSessionData.joinWindowHours != null ? `${bookingData.queueSessionData.joinWindowHours}h before start` : 'Anytime'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Split Payment Breakdown (hidden for now) */}
                                {/* {!bookingData.isQueueSession && isSplitPayment && (
                                    <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-6 text-white">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-white/80 text-sm mb-1">Booking Fee:</p>
                                                <p className="text-xl font-bold">₱{totalBookingFee.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/80 text-sm mb-1">Player(s) Fee:</p>
                                                <p className="text-xl font-bold">₱{(totalBookingFee / playerCount).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/80 text-sm mb-1">Total Amount Due:</p>
                                                <p className="text-xl font-bold">₱{(totalBookingFee / playerCount).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )} */}
                            </>
                        )}

                        {/* Step 2: Payment Method */}
                        {currentStep === 'payment' && (
                            <>
                                {/* Detail Breakdown (repeated) */}
                                <div className="bg-white border border-gray-200 rounded-xl p-6">
                                    <h3 className="font-semibold text-gray-900 text-lg mb-4">Detail Breakdown</h3>
                                    {isMultiCourt && (
                                        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                            Showing aggregate totals for {effectiveCart.length} cart items. Per-item pricing appears in Booking Summary.
                                        </div>
                                    )}
                                    <div className="space-y-3">
                                        <div className="flex justify-between py-3 border-b border-gray-100">
                                            <span className="text-gray-600">Duration:</span>
                                            <span className="font-medium text-gray-900">{duration} {duration === 1 ? 'hour' : 'hours'}</span>
                                        </div>
                                        <div className="flex justify-between py-3 border-b border-gray-100">
                                            <span className="text-gray-600">Hourly Rate:</span>
                                            <span className="font-medium text-gray-900">₱{bookingData.hourlyRate.toFixed(2)}</span>
                                        </div>

                                        {(bookingData.recurrenceWeeks && bookingData.recurrenceWeeks > 1) && (
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-gray-600">Recurrence:</span>
                                                <span className="font-medium text-gray-900">{bookingData.recurrenceWeeks} weeks</span>
                                            </div>
                                        )}

                                        {(bookingData.selectedDays && bookingData.selectedDays.length > 1) && (
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-gray-600">Sessions per Week:</span>
                                                <div className="text-right">
                                                    <span className="block font-medium text-gray-900">{bookingData.selectedDays.length} sessions</span>
                                                    <span className="text-xs text-gray-500">
                                                        {bookingData.selectedDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {((bookingData.recurrenceWeeks || 1) * (bookingData.selectedDays?.length || 1)) > 1 && (
                                            <div className="flex justify-between py-3 border-b border-gray-100 bg-gray-50 -mx-6 px-6">
                                                <span className="text-gray-600 font-medium">Total Sessions:</span>
                                                <span className="font-medium text-gray-900">{(bookingData.recurrenceWeeks || 1) * (bookingData.selectedDays?.length || 1)}</span>
                                            </div>
                                        )}
                                        {discountAmount !== 0 && (
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className={discountAmount < 0 ? 'text-orange-600' : 'text-primary font-medium uppercase'}>
                                                    {discountAmount < 0 ? 'Surcharge' : 'Discount'}
                                                </span>
                                                <span className={`font-bold ${discountAmount < 0 ? 'text-orange-600' : 'text-primary'}`}>
                                                    {discountAmount < 0 ? '+' : '-'}₱{Math.abs(discountAmount).toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        {promoDiscountAmount > 0 && (
                                            <div className="flex justify-between py-3 border-b border-gray-100">
                                                <span className="text-primary font-medium flex items-center gap-1.5">
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                    </svg>
                                                    Promo '{promoCode}'
                                                </span>
                                                <span className="font-bold text-primary">
                                                    -₱{promoDiscountAmount.toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between py-3">
                                            <span className="text-gray-600">Booking Fee:</span>
                                            <span className="font-medium text-gray-900">₱{totalBookingFee.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Method Selector */}
                                <div className="bg-white border border-gray-200 rounded-xl p-6">
                                    <PaymentMethodSelector />
                                </div>
                            </>
                        )}

                        {/* Step 3: Policy */}
                        {currentStep === 'policy' && (
                            <div className="bg-white border border-gray-200 rounded-xl p-6">
                                <CancellationPolicy />
                            </div>
                        )}

                        {/* Step 4: Processing */}
                        {currentStep === 'processing' && (
                            <PaymentProcessing />
                        )}
                    </div>

                    {/* Right Column - Summary */}
                    <div className="lg:col-span-1 space-y-4">
                        <BookingSummaryCard
                            onContinue={handleContinue}
                            onBack={handleBack}
                            onCancel={handleCancel}
                            canContinue={canContinue()}
                            currentStep={currentStep}
                            showButtons={true}
                        />
                    </div>
                </div>

            </div>

            {/* Cancel Booking Modal */}
            <CancelBookingModal
                isOpen={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={handleConfirmCancel}
            />
        </div>
    )
}
