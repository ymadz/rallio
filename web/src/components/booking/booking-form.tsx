'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar } from '@/components/ui/calendar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { TimeSlotGrid } from './time-slot-grid'
import { DiscountDisplay } from './discount-display'
import { getAvailableTimeSlotsAction } from '@/app/actions/reservations'
import { useCheckoutStore } from '@/stores/checkout-store'
import { format } from 'date-fns'
import type { Venue, Court } from '@rallio/shared'
import type { TimeSlot } from '@/app/actions/reservations'

interface BookingFormProps {
  venue: Venue & { courts?: Court[] }
  courts: Court[]
  selectedCourtId: string
  userId: string
}

export function BookingForm({ venue, courts, selectedCourtId, userId }: BookingFormProps) {
  const router = useRouter()
  const { setBookingData, setDiscountDetails } = useCheckoutStore()

  // Form state
  const [courtId, setCourtId] = useState(selectedCourtId)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string | undefined>(undefined)
  const [duration, setDuration] = useState(1) // hours
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(1) // 1 = once, 4, 8
  const [notes, setNotes] = useState('')
  const [numPlayers, setNumPlayers] = useState(2) // default to 2 players

  // Discount state
  const [discountAmount, setDiscountAmount] = useState(0)
  const [finalPrice, setFinalPrice] = useState(0)
  const [discountType, setDiscountType] = useState<string | undefined>()
  const [discountReason, setDiscountReason] = useState<string | undefined>()

  // UI state
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCourt = courts.find((c) => c.id === courtId)

  // Load time slots when date or court changes
  useEffect(() => {
    if (!selectedDate || !courtId) {
      setTimeSlots([])
      return
    }

    setIsLoadingSlots(true)
    setError(null)
    setSelectedTime(undefined)

    getAvailableTimeSlotsAction(courtId, format(selectedDate, 'yyyy-MM-dd'))
      .then((slots) => {
        setTimeSlots(slots)
        setIsLoadingSlots(false)
      })
      .catch((err) => {
        console.error('Error loading time slots:', err)
        setError('Failed to load available time slots')
        setIsLoadingSlots(false)
      })
  }, [selectedDate, courtId])

  // Calculate total price
  const hourlyPrice = selectedCourt ? selectedCourt.hourlyRate : 0
  const sessionPrice = hourlyPrice * duration
  const totalSeriesPrice = sessionPrice * recurrenceWeeks

  // Format time for display
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Calculate end time based on start time and duration
  const getEndTime = (startTime: string, durationHours: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const endHours = hours + durationHours
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Check if selected duration is available
  const isDurationAvailable = (): boolean => {
    if (!selectedTime || !timeSlots.length) return false

    const startHour = parseInt(selectedTime.split(':')[0])

    // Check if all consecutive slots are available
    for (let i = 0; i < duration; i++) {
      const hour = startHour + i
      const timeString = `${hour.toString().padStart(2, '0')}:00`
      const slot = timeSlots.find((s) => s.time === timeString)

      if (!slot || !slot.available) {
        return false
      }
    }

    return true
  }

  const handleDiscountCalculated = (discount: number, final: number, type?: string, reason?: string) => {
    setDiscountAmount(discount)
    setFinalPrice(final)
    setDiscountType(type)
    setDiscountReason(reason)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedDate || !selectedTime || !selectedCourt) {
      setError('Please select a date, time, and court')
      return
    }

    if (!isDurationAvailable()) {
      setError(`The selected ${duration}-hour slot is not fully available`)
      return
    }

    const endTime = getEndTime(selectedTime, duration)

    // Save booking data to checkout store
    setBookingData({
      courtId: courtId,
      courtName: selectedCourt.name,
      venueId: venue.id,
      venueName: venue.name,
      date: selectedDate,
      startTime: selectedTime,
      endTime: endTime,

      // NOTE: hourlyRate in store seems to be strictly "hourly" but usage says "baseRate = bookingData.hourlyRate * duration".
      // Wait, let's look at store again: "baseRate = bookingData.hourlyRate * duration". 
      // So `hourlyRate` should indeed be the PER HOUR rate.
      // But if finalPrice is calculated by discount module (which might return TOTAL discounted price for the session),
      // we need to be careful.
      // If no discount: hourlyRate = selectedCourt.hourlyRate.
      // If discount: We pass `hourlyRate` as the *effective* hourly rate?
      // Let's keep it simple: Pass the RAW hourly rate. 
      // The store calculates subtotal then subtracts discountAmount.
      // So here we pass `selectedCourt.hourlyRate`. 

      hourlyRate: selectedCourt.hourlyRate, // Fix: Pass actual hourly rate, handle discount separately
      capacity: selectedCourt.capacity,
      recurrenceWeeks: recurrenceWeeks
    })

    // Save discount details
    if (discountAmount !== 0) {
      // If recurrence > 1, the discountAmount returned by `DiscountDisplay` (which calculates for 1 session usually)
      // needs to be multiplied?
      // Actually `DiscountDisplay` calculates based on inputs.
      // If we didn't update `DiscountDisplay` to know about recurrence, it calculates for 1 session.
      // So `discountAmount` is per session.
      // Store `discountAmount` is treated as TOTAL discount in `getSubtotal`.
      // So we should multiply it by weeks.

      setDiscountDetails({
        amount: discountAmount * recurrenceWeeks,
        type: discountType,
        reason: discountReason,
      })
    }

    // Navigate to checkout
    router.push('/checkout')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Details</h2>

        {/* Court Selection */}
        <div className="mb-6">
          <Label className="block mb-2">Select Court</Label>
          <Select
            value={courtId}
            onValueChange={setCourtId}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a court" />
            </SelectTrigger>
            <SelectContent>
              {courts.map((court) => (
                <SelectItem key={court.id} value={court.id}>
                  {court.name} - ₱{court.hourlyRate}/hour ({court.courtType})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Selection */}
        <div className="mb-6">
          <Label className="block mb-2">Select Date</Label>
          <div className="border border-gray-200 rounded-lg inline-block">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => {
                // Disable past dates
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return date < today
              }}
              className="rounded-lg"
            />
          </div>
        </div>

        {/* Duration & Recurrence */}
        {selectedDate && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="duration" className="block mb-2">
                Duration
              </Label>
              <Select
                value={duration.toString()}
                onValueChange={(val) => {
                  setDuration(parseInt(val))
                  setSelectedTime(undefined) // Reset time selection when duration changes
                }}
                required
              >
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((hours) => (
                    <SelectItem key={hours} value={hours.toString()}>
                      {hours} {hours === 1 ? 'hour' : 'hours'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recurrence" className="block mb-2">
                Repeat Booking
              </Label>
              <Select
                value={recurrenceWeeks.toString()}
                onValueChange={(val) => setRecurrenceWeeks(parseInt(val))}
              >
                <SelectTrigger id="recurrence">
                  <SelectValue placeholder="Do not repeat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Week (One-time)</SelectItem>
                  <SelectItem value="2">2 Weeks</SelectItem>
                  <SelectItem value="3">3 Weeks</SelectItem>
                  <SelectItem value="4">4 Weeks</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-blue-600 mt-1">
                {recurrenceWeeks > 1 ? `Same time for ${recurrenceWeeks} consecutive weeks` : 'Single session only'}
              </p>
            </div>
          </div>
        )}

        {/* Time Selection */}
        {selectedDate && (
          <div className="mb-6">
            <Label className="block mb-3">
              Select Start Time {duration > 1 && <span className="text-primary">({duration}-hour booking)</span>}
            </Label>
            {isLoadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="lg" />
                <span className="ml-2 text-gray-600">Loading available times...</span>
              </div>
            ) : (
              <TimeSlotGrid
                slots={timeSlots}
                selectedTime={selectedTime}
                duration={duration}
                onSelectTime={setSelectedTime}
              />
            )}
          </div>
        )}

        {/* Number of Players */}
        {selectedDate && selectedTime && selectedCourt && (
          <div className="mb-6">
            <Label htmlFor="players" className="block mb-2">
              Number of Players
            </Label>
            <Input
              id="players"
              type="number"
              min="1"
              max={selectedCourt.capacity}
              value={numPlayers}
              onChange={(e) => setNumPlayers(parseInt(e.target.value) || 2)}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              This affects group booking discounts
            </p>
          </div>
        )}

        {/* Notes */}
        <div className="mb-6">
          <Label htmlFor="notes" className="block mb-2">
            Notes (Optional)
          </Label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special requests or notes for the venue..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={3}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Discount Display */}
      {selectedDate && selectedTime && selectedCourt && (
        <DiscountDisplay
          venueId={venue.id}
          courtId={courtId}
          startDate={selectedDate.toISOString()}
          endDate={selectedDate.toISOString()}
          numberOfDays={duration} // Note: This might need to adjust for multi-day vs duration logic but "numberOfDays" param often means hours for hourly booking
          numberOfPlayers={numPlayers}
          basePrice={sessionPrice} // Pass price PER session for discount calc, then we multiply later
          onDiscountCalculated={handleDiscountCalculated}
        />
      )}

      {/* Price Summary & Submit */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Selected Time Range Display */}
        {selectedDate && selectedTime && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  {recurrenceWeeks > 1 ? 'Recurring Series Selected' : 'Selected Time'}
                </p>
                <p className="text-lg font-bold text-blue-700">
                  {formatTime(selectedTime)} - {formatTime(getEndTime(selectedTime, duration))}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Starting: {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                {recurrenceWeeks > 1 && (
                  <p className="text-sm font-bold text-blue-800 mt-1">
                    Repeating for {recurrenceWeeks} weeks
                  </p>
                )}
                <p className="text-sm text-blue-600">
                  Duration: {duration} {duration === 1 ? 'hour' : 'hours'} per session
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center text-gray-600">
            <span>Base Price (per session)</span>
            <span>₱{sessionPrice.toFixed(2)}</span>
          </div>

          {recurrenceWeeks > 1 && (
            <div className="flex justify-between items-center text-gray-600">
              <span>Weeks</span>
              <span>x {recurrenceWeeks}</span>
            </div>
          )}

          {discountAmount !== 0 && (
            <div className={`flex justify-between items-center font-medium ${discountAmount < 0 ? 'text-orange-600' : 'text-green-600'
              }`}>
              <span>{discountAmount < 0 ? 'Surcharge' : 'Discount'} (per session)</span>
              <span>{discountAmount < 0 ? '+' : '-'}₱{Math.abs(discountAmount).toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-lg font-semibold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-gray-900">
              {/* If finalPrice is > 0, it means it's the discounted price PER SESSION. We must multiply by recurrence. */}
              ₱{((finalPrice > 0 ? finalPrice : sessionPrice) * recurrenceWeeks).toFixed(2)}
            </span>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={!selectedDate || !selectedTime || !isDurationAvailable() || isLoadingSlots}
        >
          {recurrenceWeeks > 1 ? `Book Series (${recurrenceWeeks} weeks)` : 'Continue to Payment'}
        </Button>

        <p className="text-xs text-gray-500 text-center mt-3">
          You'll review and confirm your booking before payment
        </p>
      </div>
    </form>
  )
}

// Helper function to format time
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}
