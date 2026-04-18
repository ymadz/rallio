'use client';

import { format } from 'date-fns';
import { formatTo12Hour } from '@/lib/utils';
import { useCheckoutStore, CheckoutStep } from '@/stores/checkout-store';
import { useEffect, useState } from 'react';
import { checkCartAvailabilityAction } from '@/app/actions/reservations';

interface BookingSummaryCardProps {
  onContinue?: () => void;
  onBack?: () => void;
  onCancel?: () => void;
  canContinue?: boolean;
  currentStep?: CheckoutStep;
  showButtons?: boolean;
}

export function BookingSummaryCard({
  onContinue,
  onBack,
  onCancel,
  canContinue = true,
  currentStep = 'details',
  showButtons = false,
}: BookingSummaryCardProps) {
  const {
    bookingData,
    bookingCart,
    isSplitPayment,
    playerCount,
    getSubtotal,
    getPlatformFeeAmount,
    getTotalAmount,
    getPerPlayerAmount,
    discountAmount,
    applicableDiscounts,
    promoDiscountAmount,
    promoCode,
    platformFeePercentage,
    platformFeeEnabled,
    paymentMethod,
    customDownPaymentAmount,
    getDownPaymentAmount,
    getMinimumDownPaymentAmount,
    getDownPaymentBreakdown,
    getRemainingBalance,
    setConflictingSlots,
  } = useCheckoutStore();

  const [availability, setAvailability] = useState<{
    loading: boolean;
    available: boolean;
    conflicts: any[];
    totalSlots: number;
    availableSlots: number;
  }>({
    loading: false,
    available: true,
    conflicts: [],
    totalSlots: 0,
    availableSlots: 0,
  });
  const [showAllCartItems, setShowAllCartItems] = useState(false);
  const [showAllDownPaymentItems, setShowAllDownPaymentItems] = useState(false);

  useEffect(() => {
    if (!bookingData) return;

    const checkAvailability = async () => {
      setAvailability(prev => ({ ...prev, loading: true }));
      const effectiveCart = bookingCart.length > 0 ? bookingCart : [bookingData];
      
      try {
        const result = await checkCartAvailabilityAction(effectiveCart.map(item => ({
          courtId: item.courtId,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          recurrenceWeeks: item.recurrenceWeeks,
          selectedDays: item.selectedDays
        })));
        
        setAvailability({
          loading: false,
          available: result.available,
          conflicts: result.conflicts,
          totalSlots: result.totalSlots,
          availableSlots: result.availableSlots
        });
        
        // Sync with store for price calculation
        setConflictingSlots(result.conflicts);
      } catch (error) {
        console.error('Failed to check availability:', error);
        setAvailability(prev => ({ ...prev, loading: false }));
        setConflictingSlots([]);
      }
    };

    checkAvailability();
  }, [bookingData, bookingCart]);

  if (!bookingData) return null;

  const effectiveCart = bookingCart.length > 0 ? bookingCart : [bookingData]
  const isMultiCourt = effectiveCart.length > 1 || (effectiveCart[0]?.courts && effectiveCart[0].courts.length > 1)

  const displayCart = effectiveCart.flatMap((item, itemIdx) => {
    if (item.courts && item.courts.length > 1) {
      return item.courts.map((court, courtIdx) => ({
        ...item,
        courtId: court.id,
        courtName: court.name,
        courts: [court],
        displayKey: `summary-${item.venueId}-${item.startTime}-${court.id}-${itemIdx}-${courtIdx}`
      }));
    }
    return [{
      ...item,
      displayKey: `summary-${item.courtId}-${item.startTime}-${itemIdx}`
    }];
  });

  const subtotal = getSubtotal();
  const platformFee = getPlatformFeeAmount();
  const total = getTotalAmount();
  const perPlayer = getPerPlayerAmount();
  const downPaymentAmount = getDownPaymentAmount();
  const downPaymentBreakdown = getDownPaymentBreakdown();
  const minimumDownPayment = getMinimumDownPaymentAmount();
  const remainingBalance = getRemainingBalance();
  const isCashWithDownpayment =
    paymentMethod === 'cash' &&
    downPaymentAmount > 0 &&
    downPaymentAmount < total;

  let duration = 1;
  try {
    const [startH, startM] = bookingData.startTime.split(':').map(Number);
    const [endH, endM] = bookingData.endTime.split(':').map(Number);
    
    let calcDuration = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60);
    if (calcDuration <= 0) calcDuration += 24; // Handle overnight
    
    duration = calcDuration;
  } catch (e) {}

  const formatTime = (timeString: string) => formatTo12Hour(timeString);

  // Calculate ACTUAL future slots that will be created (matching checkout-store logic)
  const getActualBookedDates = () => {
    if (!bookingData) return [];

    const initialStartTime = new Date(bookingData.date);
    const [startH, startM] = bookingData.startTime.split(':');
    initialStartTime.setHours(parseInt(startH), parseInt(startM || '0'), 0, 0);
    const startDayIndex = initialStartTime.getDay();

    const recurrenceWeeks = bookingData.recurrenceWeeks || 1;
    const selectedDays = bookingData.selectedDays || [];

    const uniqueSelectedDays =
      selectedDays.length > 0
        ? Array.from(new Set(selectedDays)).sort((a, b) => a - b)
        : [startDayIndex];

    const bookedDates: Date[] = [];

    for (let i = 0; i < recurrenceWeeks; i++) {
      for (const dayIndex of uniqueSelectedDays) {
        const dayOffset = (dayIndex - startDayIndex + 7) % 7;

        const slotStartTime = new Date(initialStartTime.getTime());
        slotStartTime.setDate(slotStartTime.getDate() + i * 7 + dayOffset);

        bookedDates.push(slotStartTime);
      }
    }

    return bookedDates;
  };

  const bookedDates = getActualBookedDates();
  const MAX_VISIBLE_CART_ITEMS = 5;
  const MAX_VISIBLE_DP_ITEMS = 4;
  const visibleDisplayCart = showAllCartItems ? displayCart : displayCart.slice(0, MAX_VISIBLE_CART_ITEMS);
  const visibleDownPaymentBreakdown = showAllDownPaymentItems
    ? downPaymentBreakdown
    : downPaymentBreakdown.slice(0, MAX_VISIBLE_DP_ITEMS);

  return (
    <div className="summary-scroll-container bg-white border border-gray-200 rounded-xl p-4 md:p-5 sticky top-6 max-h-[calc(100vh-3rem)] flex flex-col overflow-x-hidden">
      <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Booking Summary</h3>

      <div className="summary-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 space-y-4">

      {/* Court Details */}
      <div className="space-y-3 pb-3 border-b border-gray-200">
        {isMultiCourt ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">Cart Items</p>
              <p className="text-sm font-medium text-gray-900">{displayCart.length} slots</p>
            </div>
            <div className="summary-scrollbar max-h-[180px] overflow-y-auto overflow-x-hidden rounded-md border border-gray-100 divide-y divide-gray-100">
              {visibleDisplayCart.map((item, index) => (
                <div key={item.displayKey} className="px-2.5 py-2 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.courtName}</p>
                  <p className="text-xs text-gray-600 truncate">
                    {format(new Date(item.date), 'EEE, MMM d')} • {formatTime(item.startTime)} - {formatTime(item.endTime)}
                  </p>
                </div>
              ))}
            </div>
            {displayCart.length > MAX_VISIBLE_CART_ITEMS && (
              <button
                type="button"
                onClick={() => setShowAllCartItems(!showAllCartItems)}
                className="mt-2 text-xs font-medium text-primary hover:text-primary/80"
              >
                {showAllCartItems
                  ? 'Show fewer cart items'
                  : `Show ${displayCart.length - MAX_VISIBLE_CART_ITEMS} more item(s)`}
              </button>
            )}
          </div>
        ) : (
          <>
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
                  <div className="summary-scrollbar flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto p-1.5 bg-gray-50 rounded-md border border-gray-100">
                    {bookedDates.map((date, idx) => (
                      <span
                        key={idx}
                        className="bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md shadow-sm"
                      >
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
          </>
        )}

        {isSplitPayment && (
          <div>
            <p className="text-sm text-gray-500">Players</p>
            <p className="font-medium text-gray-900">{playerCount} players</p>
          </div>
        )}
      </div>

      {/* Price Breakdown */}
      <div className="space-y-2 py-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {isMultiCourt
              ? `Court Fees (${displayCart.length} items)`
              : `Court Fee (₱${bookingData.hourlyRate.toFixed(2)} × ${duration} ${duration > 1 ? 'hrs' : 'hr'})${bookingData.courts && bookingData.courts.length > 1 ? ` × ${bookingData.courts.length} courts` : ''}${bookedDates.length > 1 ? ` × ${bookedDates.length} sessions` : ''}`}
          </span>
          <span className="font-medium text-gray-900">
            ₱{(subtotal + discountAmount + promoDiscountAmount).toFixed(2)}
          </span>
        </div>

        {discountAmount !== 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            {applicableDiscounts && applicableDiscounts.length > 0 ? (
              applicableDiscounts.map((discount, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span
                    className={
                      discount.isIncrease ? 'text-orange-600' : 'text-primary font-medium uppercase'
                    }
                  >
                    {discount.name}
                  </span>
                  <span
                    className={`font-bold ${discount.isIncrease ? 'text-orange-600' : 'text-primary'}`}
                  >
                    {discount.isIncrease ? '+' : '-'}₱{discount.amount.toFixed(2)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex justify-between text-sm">
                <span
                  className={
                    discountAmount < 0 ? 'text-orange-600' : 'text-primary font-medium uppercase'
                  }
                >
                  {discountAmount < 0 ? 'Surcharge' : 'Discount'}
                </span>
                <span
                  className={`font-bold ${discountAmount < 0 ? 'text-orange-600' : 'text-primary'}`}
                >
                  {discountAmount < 0 ? '+' : '-'}₱{Math.abs(discountAmount).toFixed(2)}
                </span>
              </div>
            )}
            {promoDiscountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-primary font-medium flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  Promo Code ({promoCode})
                </span>
                <span className="font-bold text-primary">-₱{promoDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
              <span className="text-gray-600 font-medium">Subtotal</span>
              <span className="font-medium text-gray-900">₱{subtotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        {discountAmount === 0 && promoDiscountAmount > 0 && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-primary font-medium flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                Promo Code ({promoCode})
              </span>
              <span className="font-bold text-primary">-₱{promoDiscountAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
              <span className="text-gray-600 font-medium">Subtotal</span>
              <span className="font-medium text-gray-900">₱{subtotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        {platformFeeEnabled && platformFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Platform Fee ({platformFeePercentage}%)</span>
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

      {isCashWithDownpayment && downPaymentBreakdown.length > 0 && (
        <div className="pt-3 border-t border-gray-100 space-y-1.5">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Down Payment Breakdown</p>
          {visibleDownPaymentBreakdown.map((item, index) => (
            <div key={`summary-dp-${item.courtId}-${index}`} className="flex justify-between text-xs gap-2 min-w-0">
              <span className="text-gray-600 truncate pr-2 min-w-0">{item.courtName} ({item.percentage}%)</span>
              <span className="font-medium text-gray-900 shrink-0">₱{item.amount.toFixed(2)}</span>
            </div>
          ))}
          {downPaymentBreakdown.length > MAX_VISIBLE_DP_ITEMS && (
            <button
              type="button"
              onClick={() => setShowAllDownPaymentItems(!showAllDownPaymentItems)}
              className="text-xs font-medium text-primary hover:text-primary/80"
            >
              {showAllDownPaymentItems
                ? 'Show fewer down payment lines'
                : `Show ${downPaymentBreakdown.length - MAX_VISIBLE_DP_ITEMS} more line(s)`}
            </button>
          )}
          <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
            <span className="text-gray-700 font-medium">Minimum Required</span>
            <span className="font-semibold text-gray-900">₱{minimumDownPayment.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-primary font-semibold">Total Due Today</span>
            <span className="font-bold text-primary">₱{downPaymentAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Remaining at Venue</span>
            <span className="font-semibold text-gray-900">₱{remainingBalance.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Total */}
      <div className="pt-3 border-t border-gray-200">
        {!availability.loading && !availability.available && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {availability.availableSlots === 0 
                    ? 'All Selected Slots Unavailable' 
                    : 'Partial Availability Alert'}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {availability.availableSlots === 0 
                    ? 'None of your selected slots are available. Please choose a different date or court.'
                    : `Only ${availability.availableSlots} of ${availability.totalSlots} slots are available. Conflicted dates will be skipped:`}
                </p>
                {availability.availableSlots > 0 && (
                  <ul className="mt-2 text-xs text-amber-700 list-disc list-inside space-y-0.5">
                    {availability.conflicts.slice(0, 3).map((c, i) => (
                      <li key={i}>
                        <span className="font-semibold">{c.date}</span> • {formatTime(c.startTime)} - {formatTime(c.endTime)}
                      </li>
                    ))}
                    {availability.conflicts.length > 3 && <li>...and {availability.conflicts.length - 3} more</li>}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-base font-semibold text-gray-900">
            {isSplitPayment ? 'Your Share' : 'Total Amount'}
          </span>
          <span className="text-xl md:text-2xl font-bold text-primary">
            ₱
            {(isSplitPayment
              ? perPlayer
              : isCashWithDownpayment
                ? downPaymentAmount
                : total
            ).toFixed(2)}
          </span>
        </div>

        {isCashWithDownpayment && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center bg-primary/5 px-3 py-3 rounded-lg gap-2 min-w-0">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Remaining Balance
              </p>
              <p className="text-xs text-gray-500">To be paid at the venue</p>
            </div>
            <p className="text-xl font-bold text-gray-900 shrink-0">₱{remainingBalance.toFixed(2)}</p>
          </div>
        )}

        {isSplitPayment && (
          <p className="text-xs text-gray-500 mt-1">
            Total: ₱{total.toFixed(2)} split among {playerCount} players
          </p>
        )}
      </div>
      </div>

      {/* Navigation Buttons */}
      {showButtons && currentStep !== 'processing' && (
        <div className="pt-3 mt-3 border-t border-gray-200 flex flex-col gap-2">
          <button
            onClick={onContinue}
            disabled={!canContinue}
            className="w-full px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
          {currentStep === 'details' ? (
            <button
              onClick={onCancel}
              className="w-full px-5 py-2.5 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
            >
              Cancel Booking
            </button>
          ) : (
            <button
              onClick={onBack}
              className="w-full px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
        </div>
      )}
    </div>
  );
}
