'use client'

import { format } from 'date-fns'
import { useCheckoutStore } from '@/stores/checkout-store'
import { useRouter } from 'next/navigation'

export function BookingConfirmation() {
  const router = useRouter()
  const {
    bookingData,
    isSplitPayment,
    playerCount,
    paymentMethod,
    getTotalAmount,
    getPerPlayerAmount,
    resetCheckout,
  } = useCheckoutStore()

  if (!bookingData) return null

  const totalAmount = getTotalAmount()
  const perPlayerAmount = getPerPlayerAmount()

  // Generate mock booking reference
  const bookingReference = `RLL-${Date.now().toString().slice(-8)}`

  const formatTime = (timeString: string) => {
    // If it's a full date string (ISO), use date-fns
    if (timeString.includes('T')) {
      try {
        return format(new Date(timeString), 'h:mm a')
      } catch {
        return timeString
      }
    }

    // If it's just HH:mm
    if (timeString.includes(':')) {
      const [hours, minutes] = timeString.split(':').map(Number)
      if (!isNaN(hours)) {
        const period = hours >= 12 ? 'PM' : 'AM'
        const displayHours = hours % 12 || 12
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
      }
    }

    return timeString
  }

  const handleDone = () => {
    resetCheckout()
    router.push('/home')
  }

  const handleDownloadReceipt = () => {
    // TODO: Implement PDF receipt generation
    alert('Receipt download feature coming soon!')
  }

  const handleAddToCalendar = () => {
    // TODO: Implement calendar integration
    alert('Calendar integration coming soon!')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Success Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold mb-2">
            {paymentMethod === 'e-wallet' ? 'Payment Accepted!' : 'Booking Reserved!'}
          </h2>
          <p className="text-white/90">
            {paymentMethod === 'e-wallet'
              ? 'Your court has been successfully booked and paid for.'
              : 'Your court has been reserved. Please complete payment at the venue.'
            }
          </p>
        </div>

        {/* Booking Reference */}
        <div className="bg-gray-50 border-b border-gray-200 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Booking Reference</p>
            <p className="text-3xl font-bold text-gray-900 tracking-wider font-mono">{bookingReference}</p>
            <p className="text-xs text-gray-500 mt-2">
              Save this reference number for your records
            </p>
          </div>
        </div>

        {/* Booking Details */}
        <div className="p-6 space-y-6">
          {/* Court Info */}
          <div>
            <h3 className="font-semibold text-gray-900 text-lg mb-3">Court Details</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Court</span>
                <span className="text-sm font-medium text-gray-900">{bookingData.courtName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Venue</span>
                <span className="text-sm font-medium text-gray-900">{bookingData.venueName}</span>
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div>
            <h3 className="font-semibold text-gray-900 text-lg mb-3">Date & Time</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Date</span>
                <span className="text-sm font-medium text-gray-900">
                  {format(new Date(bookingData.date), 'EEEE, MMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Time</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatTime(bookingData.startTime)} - {formatTime(bookingData.endTime)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div>
            <h3 className="font-semibold text-gray-900 text-lg mb-3">Payment Summary</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Payment Method</span>
                <span className="text-sm font-medium text-gray-900">
                  {paymentMethod === 'e-wallet' ? 'E-Wallet' : 'Cash'}
                </span>
              </div>

              {isSplitPayment && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Players</span>
                    <span className="text-sm font-medium text-gray-900">{playerCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Per Player</span>
                    <span className="text-sm font-medium text-gray-900">₱{perPlayerAmount.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-900">
                    {isSplitPayment ? 'Total Amount' : 'Amount'}
                  </span>
                  <span className="text-2xl font-bold text-primary">₱{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">
                    {paymentMethod === 'e-wallet' ? 'Payment Confirmed' : 'Pending Payment at Venue'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          {paymentMethod === 'cash' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-orange-900 mb-1">Important Reminder</p>
                  <p className="text-xs text-orange-800">
                    Please arrive at least 15 minutes before your scheduled time and complete payment at the venue.
                    Failure to pay may result in booking cancellation and account restrictions.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">What's Next?</p>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>You'll receive a confirmation email shortly</li>
                  <li>Add this booking to your calendar</li>
                  <li>Arrive 10-15 minutes before your scheduled time</li>
                  <li>Show your booking reference to the venue staff</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-white transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Receipt
            </button>
          </div>
          <button
            onClick={handleDone}
            className="w-full px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
