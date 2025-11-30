'use client'

import { format } from 'date-fns'
import { useCheckoutStore } from '@/stores/checkout-store'

export function BookingSummaryCard() {
  const {
    bookingData,
    isSplitPayment,
    playerCount,
    getSubtotal,
    getTotalAmount,
    getPerPlayerAmount,
    discountAmount,
    applicableDiscounts,
  } = useCheckoutStore()

  if (!bookingData) return null

  const subtotal = getSubtotal()
  const total = getTotalAmount()
  const perPlayer = getPerPlayerAmount()

  const formatTime = (timeString: string) => {
    try {
      return format(new Date(timeString), 'h:mm a')
    } catch {
      return timeString
    }
  }

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
          <p className="text-sm text-gray-600">
            {formatTime(bookingData.startTime)} - {formatTime(bookingData.endTime)}
          </p>
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
          <span className="text-gray-600">Booking Fee</span>
          <span className="font-medium text-gray-900">₱{subtotal.toFixed(2)}</span>
        </div>

        {discountAmount !== 0 && (
          <div className="space-y-1">
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
            ₱{(isSplitPayment ? perPlayer : total).toFixed(2)}
          </span>
        </div>
        {isSplitPayment && (
          <p className="text-xs text-gray-500 mt-1">
            Total: ₱{total.toFixed(2)} split among {playerCount} players
          </p>
        )}
      </div>
    </div>
  )
}
