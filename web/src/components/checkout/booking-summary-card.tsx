'use client'

import { format } from 'date-fns'
import { useCheckoutStore, CheckoutStep } from '@/stores/checkout-store'

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
  const {
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
    downPaymentPercentage,
    getDownPaymentAmount,
    getRemainingBalance,
  } = useCheckoutStore()

  if (!bookingData) return null

  const subtotal = getSubtotal()
  const platformFee = getPlatformFeeAmount()
  const total = getTotalAmount()
  const perPlayer = getPerPlayerAmount()
  const downPaymentAmount = getDownPaymentAmount()
  const remainingBalance = getRemainingBalance()
  const isCashWithDownpayment = paymentMethod === 'cash' && downPaymentPercentage && downPaymentPercentage > 0 && downPaymentAmount > 0

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
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-1.5 bg-gray-50 rounded-md border border-gray-100">
                {bookedDates.map((date, idx) => (
                  <span key={idx} className="bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md shadow-sm">
                    {format(date, 'MMM d (E)')}
                  </span>
                ))}
              </div>
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

      {/* Total */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-base font-semibold text-gray-900">
            {isSplitPayment ? 'Your Share' : 'Total Amount'}
          </span>
          <span className="text-2xl font-bold text-primary">
            ₱{(isSplitPayment ? perPlayer : (isCashWithDownpayment ? downPaymentAmount : total)).toFixed(2)}
          </span>
        </div>

        {isCashWithDownpayment && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center bg-primary/5 -mx-6 px-6 py-3">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Remaining Balance</p>
              <p className="text-xs text-gray-500">To be paid at the venue</p>
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
              Continue
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
    </div>
  )
}
