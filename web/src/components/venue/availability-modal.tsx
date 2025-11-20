'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { format, addDays, startOfDay } from 'date-fns'
import 'react-day-picker/dist/style.css'
import { createClient } from '@/lib/supabase/client'
import { useCheckoutStore } from '@/stores/checkout-store'

interface TimeSlot {
  id: string
  start_time: string
  end_time: string
  is_reserved: boolean
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
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  // Fetch available time slots for the selected date
  useEffect(() => {
    async function fetchTimeSlots() {
      if (!selectedDate || !isOpen) return

      setLoading(true)
      try {
        const supabase = createClient()
        const startOfSelectedDay = startOfDay(selectedDate)
        const endOfSelectedDay = addDays(startOfSelectedDay, 1)

        const { data, error } = await supabase
          .from('court_availabilities')
          .select('*')
          .eq('court_id', courtId)
          .gte('start_time', startOfSelectedDay.toISOString())
          .lt('start_time', endOfSelectedDay.toISOString())
          .order('start_time', { ascending: true })

        if (error) {
          console.error('Error fetching time slots:', error)
          setTimeSlots([])
        } else {
          setTimeSlots(data || [])
        }
      } catch (error) {
        console.error('Error:', error)
        setTimeSlots([])
      } finally {
        setLoading(false)
      }
    }

    fetchTimeSlots()
  }, [selectedDate, courtId, isOpen])

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'h:mm a')
  }

  const handleBook = () => {
    if (selectedSlot) {
      // Set booking data in checkout store
      setBookingData({
        courtId,
        courtName,
        venueId,
        venueName,
        date: selectedDate,
        startTime: selectedSlot.start_time,
        endTime: selectedSlot.end_time,
        hourlyRate,
        capacity,
      })

      // Navigate to checkout page
      router.push('/checkout')
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
                  ) : (
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => !slot.is_reserved && setSelectedSlot(slot)}
                          disabled={slot.is_reserved}
                          className={`w-full px-4 py-3 text-left transition-colors ${
                            slot.is_reserved
                              ? 'bg-gray-50 cursor-not-allowed opacity-60'
                              : selectedSlot?.id === slot.id
                              ? 'bg-primary text-white'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <svg 
                                className={`w-5 h-5 ${selectedSlot?.id === slot.id ? 'text-white' : 'text-gray-400'}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <p className={`font-medium ${selectedSlot?.id === slot.id ? 'text-white' : 'text-gray-900'}`}>
                                  {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                </p>
                                {slot.is_reserved && (
                                  <p className="text-xs text-gray-500">Reserved</p>
                                )}
                              </div>
                            </div>
                            <span className={`text-sm font-semibold ${selectedSlot?.id === slot.id ? 'text-white' : 'text-gray-700'}`}>
                              ₱{hourlyRate}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
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
                    {format(selectedDate, 'MMM d, yyyy')} · {formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}
                  </p>
                  <p className="text-lg font-bold text-primary mt-1">₱{hourlyRate}</p>
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
                disabled={!selectedSlot}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Book This Slot
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
