'use client'

import { useState } from 'react'
import { format, differenceInDays, startOfDay } from 'date-fns'
import { useCheckoutStore, CheckoutStep } from '@/stores/checkout-store'
import { Switch } from '@/components/ui/switch'

interface BookingSummaryCardProps {
  onContinue?: () => void
  onBack?: () => void
  canContinue?: boolean
  currentStep?: CheckoutStep
  showButtons?: boolean
}

export function BookingSummaryCard({
  onContinue,
  onBack,
  canContinue = true,
  currentStep = 'details',
  showButtons = false,
}: BookingSummaryCardProps) {
  const [showReserveModal, setShowReserveModal] = useState(false);

  const {
    isReserved,
    setIsReserved,
    bookingData,
    isSplitPayment,
    playerCount,
    getSubtotal,
    getPlatformFeeAmount,
    getTotalAmount,
    getPerPlayerAmount,
    discountAmount,
    applicableDiscounts,
    platformFeePercentage,
    platformFeeEnabled,
    paymentMethod,
    isDownPayment,
    getDownPaymentAmount,
    getRemainingBalance,
  } = useCheckoutStore()

  if (!bookingData) return null

  const today = startOfDay(new Date())
  const bookingDate = startOfDay(new Date(bookingData.date))
  const daysInAdvance = differenceInDays(bookingDate, today)
  const canReserve = daysInAdvance >= 7

  const subtotal = getSubtotal()
  const platformFee = getPlatformFeeAmount()
  const total = getTotalAmount()
  const perPlayer = getPerPlayerAmount()
  const downPaymentAmount = getDownPaymentAmount()
  const remainingBalance = getRemainingBalance()
  const isDownPaymentVisible = isDownPayment && downPaymentAmount > 0

  let duration = 1
  try {
    const startHour = parseInt(bookingData.startTime.split(':')[0])
    const endHour = parseInt(bookingData.endTime.split(':')[0])
    duration = Math.max(1, endHour - startHour)
  } catch (e) { }

  const formatTime = (timeString: string) => {
    try {
      return format(new Date(timeString), 'h:mm a')
    } catch {
      return timeString
    }
  }

  // Calculate ACTUAL future slots that will be created (matching checkout-store logic)
  const getActualBookedDates = () => {
    if (!bookingData) return []

    const initialStartTime = new Date(bookingData.date)
    const [startH, startM] = bookingData.startTime.split(':')
    initialStartTime.setHours(parseInt(startH), parseInt(startM || '0'), 0, 0)
    const startDayIndex = initialStartTime.getDay()

    const recurrenceWeeks = bookingData.recurrenceWeeks || 1
    const selectedDays = bookingData.selectedDays || []

    const uniqueSelectedDays = selectedDays.length > 0
      ? Array.from(new Set(selectedDays)).sort((a, b) => a - b)
      : [startDayIndex]

    const bookedDates: Date[] = []

    for (let i = 0; i < recurrenceWeeks; i++) {
      for (const dayIndex of uniqueSelectedDays) {
        const dayOffset = (dayIndex - startDayIndex + 7) % 7

        const slotStartTime = new Date(initialStartTime.getTime())
        slotStartTime.setDate(slotStartTime.getDate() + (i * 7) + dayOffset)

        bookedDates.push(slotStartTime)
      }
    }

    return bookedDates
  }

  const bookedDates = getActualBookedDates()

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>

      {/* Court Details */}
      <div className="space-y-3 pb-4 border-b border-gray-200">
        <div>
          <p className="text-sm text-gray-500">Court</p>
          <p className="font-medium text-gray-900">{bookingData.courtName}</p>
          <p className="text-xs text-gray-500">{bookingData.venueName}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Date & Time</p>
          <p className="font-medium text-gray-900">
            {format(new Date(bookingData.date), 'EEEE, MMM d, yyyy')}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            {formatTime(bookingData.startTime)} - {formatTime(bookingData.endTime)}
          </p>

          {bookedDates.length > 0 && (
            <div className="mt-2 text-xs">
              <p className="font-medium text-gray-700 mb-1">Booked Dates ({bookedDates.length}):</p>
              
                {bookedDates.map((date, idx) => (
                  <span key={idx} className="bg-[#0d9488] border border-gray-200 text-white px-2 py-0.5 rounded-md shadow-sm">
                    {format(date, 'MMM d (E)')}
                  </span>
                ))}
            </div>
          )}

          {bookingData.recurrenceWeeks && bookingData.recurrenceWeeks > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {bookingData.recurrenceWeeks} Weeks Selection
              </span>
              {(bookingData.selectedDays?.length || 0) > 1 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  {bookingData.selectedDays?.length}x Weekly
                </span>
              )}
            </div>
          )}
        </div>

        {isSplitPayment && (
          <div>
            <p className="text-sm text-gray-500">Players</p>
            <p className="font-medium text-gray-900">{playerCount} players</p>
          </div>
        )}
      </div>

      {/* Price Breakdown */}
      <div className="space-y-2 py-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            Court Fee (₱{bookingData.hourlyRate.toFixed(2)} × {duration} {duration > 1 ? 'hrs' : 'hr'})
            {bookedDates.length > 1 ? ` × ${bookedDates.length} sessions` : ''}
          </span>
          <span className="font-medium text-gray-900">
            ₱{(subtotal + discountAmount).toFixed(2)}
          </span>
        </div>

        {discountAmount !== 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            {applicableDiscounts && applicableDiscounts.length > 0 ? (
              applicableDiscounts.map((discount, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className={discount.isIncrease ? 'text-orange-600' : 'text-green-600'}>
                    {discount.name}
                  </span>
                  <span className={`font-medium ${discount.isIncrease ? 'text-orange-600' : 'text-green-600'}`}>
                    {discount.isIncrease ? '+' : '-'}₱{discount.amount.toFixed(2)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-sm">
                <span className={discountAmount < 0 ? 'text-orange-600' : 'text-green-600'}>
                  {discountAmount < 0 ? 'Surcharge' : 'Discount'}
                </span>
                <span className={`font-medium ${discountAmount < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {discountAmount < 0 ? '+' : '-'}₱{Math.abs(discountAmount).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2">
              <span className="text-gray-600 font-medium">Subtotal</span>
              <span className="font-medium text-gray-900">₱{subtotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        {platformFeeEnabled && platformFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Platform Fee ({platformFeePercentage}%)
            </span>
            <span className="font-medium text-gray-900">₱{platformFee.toFixed(2)}</span>
          </div>
        )}

        {isSplitPayment && (
          <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
            <span className="text-gray-600">Per Player</span>
            <span className="font-medium text-gray-900">₱{perPlayer.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Reserve Toggle */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <span className={`text-base font-semibold ${canReserve ? 'text-gray-900' : 'text-gray-400'}`}>Reserve</span>
            <p className="text-xs text-gray-500 mb-4">
              {canReserve ? 'Reserve your booking' : 'Available for bookings 7+ days in advance'}
            </p>
          </div>
          <span className="text-2xl font-bold text-primary">
            <Switch
              checked={canReserve ? isReserved : false}
              onCheckedChange={(checked) => {
                setIsReserved(checked);
                if (checked) setShowReserveModal(true);
              }}
              disabled={!canReserve}
              className="data-[state=checked]:bg-primary"
            />
          </span>
        </div>
      </div>

      {/* Total */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-base font-semibold text-gray-900">
            {isSplitPayment ? 'Your Share' : 'Total Amount'}
          </span>
          <span className="text-2xl font-bold text-primary">
            ₱{(isSplitPayment ? perPlayer : (isDownPaymentVisible ? downPaymentAmount : total)).toFixed(2)}
          </span>
        </div>

        {isDownPaymentVisible && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center bg-primary/5 -mx-6 px-6 py-3">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Remaining Balance</p>
            </div>
            <p className="text-xl font-bold text-gray-900">₱{remainingBalance.toFixed(2)}</p>
          </div>
        )}

        {isSplitPayment && (
          <p className="text-xs text-gray-500 mt-1">
            Total: ₱{total.toFixed(2)} split among {playerCount} players
          </p>
        )}
      </div>

      {/* Navigation Buttons */}
      {
        showButtons && currentStep !== 'processing' && (
          <div className="pt-4 mt-4 border-t border-gray-200 flex flex-col gap-3">
            <button
              onClick={onContinue}
              disabled={!canContinue}
              className="w-full px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReserved && currentStep === 'details' ? 'Continue to Reserve' : 'Continue'}
            </button>
            {currentStep !== 'details' && (
              <button
                onClick={onBack}
                className="w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
          </div>
        )}

      {/* Reservation Info Modal */}
      {showReserveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { e.stopPropagation(); setShowReserveModal(false); }}>
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-8 pb-4 flex justify-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="px-6 pb-6 text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Reservation Conditions</h3>
              <p className="text-gray-600 text-sm">
                The reservation feature only saves this timeslot in your bookings. This does not mean the date cannot be booked by another user—they can still reserve for that day and time.
              </p>
            </div>
            <div className="px-6 pb-6 flex justify-center">
              <button
                onClick={() => setShowReserveModal(false)}
                className="w-full px-4 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
