'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import 'react-day-picker/dist/style.css'
import { useCheckoutStore } from '@/stores/checkout-store'
import { getAvailableTimeSlotsAction } from '@/app/actions/reservations'
import { cn } from '@/lib/utils'

interface TimeSlot {
  time: string
  available: boolean
  price?: number
}

interface AvailabilityModalProps {
  isOpen: boolean
  onClose: () => void
  courtId: string
  courtName: string
  hourlyRate: number
  venueId: string
  venueName: string
  capacity: number
}

export function AvailabilityModal({
  isOpen,
  onClose,
  courtId,
  courtName,
  hourlyRate,
  venueId,
  venueName,
  capacity
}: AvailabilityModalProps) {
  const router = useRouter()
  const { setBookingData } = useCheckoutStore()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // Selection state
  const [startSlot, setStartSlot] = useState<TimeSlot | null>(null)
  const [endSlot, setEndSlot] = useState<TimeSlot | null>(null)

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [isBooking, setIsBooking] = useState(false)

  // Fetch available time slots for the selected date
  useEffect(() => {
    async function fetchTimeSlots() {
      if (!selectedDate || !isOpen) return

      setLoading(true)
      // Reset selection when date changes
      setStartSlot(null)
      setEndSlot(null)

      try {
        const slots = await getAvailableTimeSlotsAction(courtId, selectedDate.toISOString())
        setTimeSlots(slots)
      } catch (error) {
        console.error('Error fetching time slots:', error)
        setTimeSlots([])
      } finally {
        setLoading(false)
      }
    }

    fetchTimeSlots()
  }, [selectedDate, courtId, isOpen])

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Calculate duration based on start and end slots
  const getDuration = (): number => {
    if (!startSlot) return 0
    if (!endSlot) return 1 // Single slot selected means 1 hour

    const startIndex = timeSlots.findIndex(s => s.time === startSlot.time)
    const endIndex = timeSlots.findIndex(s => s.time === endSlot.time)

    // Safety check
    if (startIndex === -1 || endIndex === -1) return 0

    return endIndex - startIndex + 1
  }

  const getEndTime = (): string => {
    const targetSlot = endSlot || startSlot
    if (!targetSlot) return ''

    const [hours, minutes] = targetSlot.time.split(':').map(Number)
    const endHour = hours + 1
    return `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const getNextHour = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const nextHour = hours + 1
    return `${nextHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Check if a range is valid (all slots in between are available)
  const isRangeValid = (start: TimeSlot, end: TimeSlot): boolean => {
    const startIndex = timeSlots.findIndex(s => s.time === start.time)
    const endIndex = timeSlots.findIndex(s => s.time === end.time)

    if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return false

    // Check availability of all slots in range
    for (let i = startIndex; i <= endIndex; i++) {
      if (!timeSlots[i].available) return false
    }
    return true
  }

  const handleSlotClick = (clickedSlot: TimeSlot) => {
    if (!clickedSlot.available) return

    // Case 1: New selection or restarting selection
    if (!startSlot || (startSlot && endSlot)) {
      setStartSlot(clickedSlot)
      setEndSlot(null)
      return
    }

    // Case 2: Selecting end slot
    const startIndex = timeSlots.findIndex(s => s.time === startSlot.time)
    const clickedIndex = timeSlots.findIndex(s => s.time === clickedSlot.time)

    if (clickedIndex < startIndex) {
      // User clicked a slot BEFORE the start slot -> New start slot
      setStartSlot(clickedSlot)
      setEndSlot(null)
    } else if (clickedIndex === startIndex) {
      // User clicked the start slot again -> Deselect? Or just keep as start?
      // Let's keep it as is (single hour)
      setEndSlot(null)
    } else {
      // User clicked a slot AFTER start slot -> Attempt to set range
      if (isRangeValid(startSlot, clickedSlot)) {
        setEndSlot(clickedSlot)
      } else {
        // Range blocked by unavailable slot -> Reset and make this new start
        setStartSlot(clickedSlot)
        setEndSlot(null)
      }
    }
  }

  const handleBook = () => {
    if (startSlot && !isBooking) {
      setIsBooking(true)

      try {
        const duration = getDuration()
        const endTime = getEndTime()

        // Set booking data in checkout store
        setBookingData({
          courtId,
          courtName,
          venueId,
          venueName,
          date: selectedDate,
          startTime: startSlot.time,
          endTime: endTime,
          hourlyRate,
          capacity,
        })

        // Navigate to checkout page
        router.push('/checkout')
      } catch (error) {
        console.error('Error setting booking data:', error)
        setIsBooking(false)
      }
    }
  }

  const disabledDays = { before: new Date() }

  // Helpers for styling
  const isSlotSelected = (slot: TimeSlot) => {
    if (!startSlot) return false
    if (startSlot.time === slot.time) return true
    if (endSlot && endSlot.time === slot.time) return true
    return false
  }

  const isSlotInRange = (slot: TimeSlot) => {
    if (!startSlot || !endSlot) return false
    const startIndex = timeSlots.findIndex(s => s.time === startSlot.time)
    const endIndex = timeSlots.findIndex(s => s.time === endSlot.time)
    const currentIndex = timeSlots.findIndex(s => s.time === slot.time)

    return currentIndex > startIndex && currentIndex < endIndex
  }

  if (!isOpen) return null

  const duration = getDuration()
  const totalPrice = (startSlot?.price || hourlyRate) * duration

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary/80 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">{courtName}</h3>
              <p className="text-sm text-white/80 mt-1">Select time range</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">

            <div className="grid md:grid-cols-2 gap-6">
              {/* Calendar */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Choose Date</h4>
                <div className="border border-gray-200 rounded-xl p-4">
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    disabled={disabledDays}
                    className="mx-auto"
                    modifiersClassNames={{
                      selected: 'bg-primary text-white hover:bg-primary',
                      today: 'font-bold text-primary',
                    }}
                  />

                  {/* Legend */}
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-4 h-4 bg-white border-2 border-gray-300 rounded" />
                      <span className="text-gray-600">Available</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-4 h-4 bg-gray-100 text-gray-400 flex items-center justify-center rounded text-[10px]">✕</div>
                      <span className="text-gray-600">Reserved / Unavailable</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-4 h-4 bg-primary rounded" />
                      <span className="text-gray-600">Selected</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Select Time Range
                </h4>

                <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col h-[400px]">
                  {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary" />
                      <p className="text-sm text-gray-500 mt-3">Loading time slots...</p>
                    </div>
                  ) : timeSlots.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                      <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-gray-500">No time slots available</p>
                      <p className="text-xs text-gray-400 mt-1">Please select another date</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 shrink-0">
                        <p className="text-xs text-blue-700">
                          {!startSlot ? (
                            "Tap a time to start your booking"
                          ) : !endSlot ? (
                            "Tap another time to end your booking, or book 1 hour"
                          ) : (
                            `${duration} hours selected`
                          )}
                        </p>
                      </div>
                      <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
                        {timeSlots.map((slot, index) => {
                          const isSelected = isSlotSelected(slot)
                          const inRange = isSlotInRange(slot)
                          const disabled = !slot.available

                          return (
                            <button
                              key={`${slot.time}-${index}`}
                              onClick={() => handleSlotClick(slot)}
                              disabled={disabled}
                              className={cn(
                                "w-full px-4 py-3 text-left transition-all",
                                disabled && "bg-gray-100 cursor-not-allowed opacity-60",
                                isSelected && "bg-primary text-white",
                                inRange && "bg-primary/10 text-primary-900",
                                !disabled && !isSelected && !inRange && "hover:bg-gray-50"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                    disabled ? "border-gray-300 bg-gray-200" : isSelected ? "border-white bg-white" : "border-gray-300"
                                  )}>
                                    {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                                  </div>
                                  <div>
                                    <p className={cn(
                                      "font-medium",
                                      isSelected ? "text-white" : disabled ? "text-gray-400" : "text-gray-900"
                                    )}>
                                      {formatTime(slot.time)} - {formatTime(getNextHour(slot.time))}
                                    </p>
                                    {disabled && <span className="text-xs text-red-500 font-medium">Reserved</span>}
                                  </div>
                                </div>
                                <span className={cn(
                                  "text-sm font-semibold",
                                  isSelected ? "text-white" : disabled ? "text-gray-400" : "text-gray-700"
                                )}>
                                  ₱{slot.price || hourlyRate}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
            <div>
              {startSlot && (
                <div className="text-sm">
                  <p className="text-gray-600">
                    <span className="font-medium text-gray-900">Selected:</span>{' '}
                    {format(selectedDate, 'MMM d, yyyy')}
                  </p>
                  <p className="text-gray-600">
                    {formatTime(startSlot.time)} - {formatTime(getEndTime())}
                  </p>
                  <p className="text-lg font-bold text-primary mt-1">₱{totalPrice.toLocaleString()}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                disabled={isBooking}
              >
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={!startSlot || isBooking}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isBooking && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                )}
                {isBooking ? 'Processing...' : `Book (${duration} hr${duration > 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
