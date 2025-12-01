'use client'

import { useCheckoutStore } from '@/stores/checkout-store'

export function SplitPaymentControls() {
  const {
    bookingData,
    isSplitPayment,
    playerCount,
    setSplitPayment,
    setPlayerCount,
  } = useCheckoutStore()

  if (!bookingData) return null

  const capacity = bookingData.capacity
  const isDisabled = true // Split payment feature temporarily disabled

  const handleToggle = () => {
    // Feature disabled - do nothing
    if (isDisabled) return
    setSplitPayment(!isSplitPayment)
  }

  const handleDecrement = () => {
    if (playerCount > 2) {
      setPlayerCount(playerCount - 1)
    }
  }

  const handleIncrement = () => {
    if (playerCount < capacity) {
      setPlayerCount(playerCount + 1)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 opacity-60 relative">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">Play Together, Pay Together!</h4>
            {isSplitPayment && (
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-white text-xs font-bold">
                {playerCount}
              </span>
            )}
          </div>
        </div>
        
        {/* Coming Soon Badge & Toggle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            Coming Soon
          </span>
          <button
          onClick={handleToggle}
          disabled={isDisabled}
          className={`
            relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent
            transition-colors duration-200 ease-in-out
            ${isDisabled ? 'cursor-not-allowed bg-gray-300' : 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'}
            ${isSplitPayment ? 'bg-primary' : 'bg-gray-200'}
          `}
          role="switch"
          aria-checked={isSplitPayment}
          aria-disabled={isDisabled}
        >
          <span
            className={`
              pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0
              transition duration-200 ease-in-out
              ${isSplitPayment ? 'translate-x-5' : 'translate-x-0'}
            `}
          />
          </button>
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-600 mb-2">
          Divide the total fee among your group — fair and simple.
        </p>
        <p className="text-xs text-gray-500 italic">
          This feature is under development. For now, the booking creator pays the full amount.
        </p>
      </div>

      {/* Player Counter - Hidden when disabled */}
      {isSplitPayment && !isDisabled && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Add Players</p>
              <p className="text-xs text-gray-500">
                Maximum {capacity} allowed players
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleDecrement}
                disabled={playerCount <= 2}
                className="h-9 w-9 rounded-full border-2 border-gray-300 flex items-center justify-center
                  hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                  disabled:hover:border-gray-300 disabled:hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                </svg>
              </button>

              <span className="text-2xl font-bold text-gray-900 w-8 text-center">
                {playerCount}
              </span>

              <button
                onClick={handleIncrement}
                disabled={playerCount >= capacity}
                className="h-9 w-9 rounded-full border-2 border-gray-300 flex items-center justify-center
                  hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                  disabled:hover:border-gray-300 disabled:hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
