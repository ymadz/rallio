'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import 'react-day-picker/dist/style.css'
import { useCheckoutStore } from '@/stores/checkout-store'
import { getAvailableTimeSlotsAction } from '@/app/actions/reservations'

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
  const [duration, setDuration] = useState(1) // hours
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [isBooking, setIsBooking] = useState(false)

  // Fetch available time slots for the selected date
  useEffect(() => {
    async function fetchTimeSlots() {
      if (!selectedDate || !isOpen) return

      setLoading(true)
      setSelectedSlot(null) // Clear selection when date changes
      try {
        const slots = await getAvailableTimeSlotsAction(courtId, selectedDate.toISOString())
        console.log('Fetched slots:', slots) // Debug log
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

  const getEndTime = (startTime: string, durationHours: number = 1): string => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const endHours = hours + durationHours
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Check if selected duration is available starting from a given time
  const isDurationAvailable = (startTime: string, durationHours: number): boolean => {
    const startHour = parseInt(startTime.split(':')[0])
    
    // Check if all consecutive slots are available
    for (let i = 0; i < durationHours; i++) {
      const hour = startHour + i
      const timeString = `${hour.toString().padStart(2, '0')}:00`
      const slot = timeSlots.find((s) => s.time === timeString)
      
      if (!slot || !slot.available) {
        return false
      }
    }
    
    return true
  }

  // Get available start times for the selected duration
  const getAvailableStartTimes = (): TimeSlot[] => {
    if (duration === 1) return timeSlots
    
    return timeSlots.filter(slot => 
      slot.available && isDurationAvailable(slot.time, duration)
    )
  }

  const handleBook = () => {
    if (selectedSlot && !isBooking) {
      setIsBooking(true)

      try {
        const endTime = getEndTime(selectedSlot.time, duration)

        // Set booking data in checkout store
        setBookingData({
          courtId,
          courtName,
          venueId,
          venueName,
          date: selectedDate,
          startTime: selectedSlot.time,
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

  if (!isOpen) return null

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
              <p className="text-sm text-white/80 mt-1">Select date and time slot</p>
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
            {/* Duration Selector */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Booking Duration
              </label>
              <select
                value={duration}
                onChange={(e) => {
                  setDuration(Number(e.target.value))
                  setSelectedSlot(null) // Reset selection when duration changes
                }}
                className="w-full md:w-64 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value={1}>1 hour</option>
                <option value={2}>2 hours</option>
                <option value={3}>3 hours</option>
                <option value={4}>4 hours</option>
                <option value={5}>5 hours</option>
                <option value={6}>6 hours</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select how many consecutive hours you want to book
              </p>
            </div>

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
                      <div className="w-4 h-4 bg-gray-200 rounded" />
                      <span className="text-gray-600">Reserved</span>
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
                  Available Times - {format(selectedDate, 'EEEE, MMM d')}
                </h4>
                
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {loading ? (
                    <div className="p-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary" />
                      <p className="text-sm text-gray-500 mt-3">Loading time slots...</p>
                    </div>
                  ) : timeSlots.length === 0 ? (
                    <div className="p-8 text-center">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-gray-500">No time slots available</p>
                      <p className="text-xs text-gray-400 mt-1">Please select another date</p>
                    </div>
                  ) : (() => {
                    const availableStartTimes = getAvailableStartTimes()
                    
                    if (availableStartTimes.length === 0) {
                      return (
                        <div className="p-8 text-center">
                          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-gray-500">No {duration}-hour slots available</p>
                          <p className="text-xs text-gray-400 mt-1">Try a shorter duration or different date</p>
                        </div>
                      )
                    }
                    
                    return (
                      <>
                        {duration > 1 && (
                          <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
                            <p className="text-xs text-blue-700">
                              <span className="font-semibold">Multi-hour booking:</span> Select a start time - your booking will span {duration} consecutive hours
                            </p>
                          </div>
                        )}
                        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                          {availableStartTimes.map((slot, index) => {
                            const endTime = getEndTime(slot.time, duration)
                            const isSelected = selectedSlot?.time === slot.time
                            const totalPrice = (slot.price || hourlyRate) * duration
                            
                            return (
                              <button
                                key={`${slot.time}-${index}`}
                                onClick={() => setSelectedSlot(slot)}
                                className={`w-full px-4 py-3 text-left transition-colors ${
                                  isSelected
                                    ? 'bg-primary text-white'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <svg
                                      className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-400'}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div>
                                      <p className={`font-medium ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                        {formatTime(slot.time)} to {formatTime(endTime)}
                                      </p>
                                      {duration > 1 && (
                                        <p className={`text-xs font-medium ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                                          {duration} hours
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <span className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                    ₱{totalPrice}
                                  </span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
            <div>
              {selectedSlot && (
                <div className="text-sm">
                  <p className="text-gray-600">
                    <span className="font-medium text-gray-900">Selected:</span>{' '}
                    {format(selectedDate, 'MMM d, yyyy')} · {formatTime(selectedSlot.time)} to {formatTime(getEndTime(selectedSlot.time, duration))}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Duration: {duration} {duration === 1 ? 'hour' : 'hours'}
                  </p>
                  <p className="text-lg font-bold text-primary mt-1">₱{((selectedSlot.price || hourlyRate) * duration).toLocaleString()}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={!selectedSlot || isBooking}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isBooking && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                )}
                {isBooking ? 'Processing...' : 'Book This Slot'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
