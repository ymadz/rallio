'use client'

import { useState, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, addDays, startOfDay } from 'date-fns'
import 'react-day-picker/dist/style.css'
import { createClient } from '@/lib/supabase/client'

interface TimeSlot {
  id: string
  start_time: string
  end_time: string
  is_reserved: boolean
}

interface AvailabilityCalendarProps {
  courtId: string
  courtName: string
  hourlyRate: number
}

export function AvailabilityCalendar({ courtId, courtName, hourlyRate }: AvailabilityCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  // Fetch available time slots for the selected date
  useEffect(() => {
    async function fetchTimeSlots() {
      if (!selectedDate) return

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
  }, [selectedDate, courtId])

  const formatTime = (timeString: string) => {
    // If it's a full date string (ISO), use date-fns
    if (timeString.includes('T')) {
      try {
        return format(new Date(timeString), 'h:mm a')
      } catch {
        return timeString
      }
    }

    // If it's just HH:mm or HH:mm:ss
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

  const disabledDays = { before: new Date() }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-primary/5 px-4 py-3 border-b border-gray-200">
        <h4 className="font-semibold text-gray-900 text-sm">{courtName} - Availability</h4>
        <p className="text-xs text-gray-600 mt-0.5">
          ₱{hourlyRate}/hour · Select a date to view available time slots
        </p>
      </div>

      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
        {/* Calendar */}
        <div className="p-4">
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
        </div>

        {/* Time Slots */}
        <div className="p-4">
          <h5 className="font-medium text-gray-900 text-sm mb-3">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </h5>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : timeSlots.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {timeSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => !slot.is_reserved && setSelectedSlot(slot)}
                  disabled={slot.is_reserved}
                  className={`w-full p-3 rounded-lg text-left transition-all ${slot.is_reserved
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : selectedSlot?.id === slot.id
                        ? 'bg-primary text-white ring-2 ring-primary ring-offset-2'
                        : 'bg-white border border-gray-200 text-gray-700 hover:border-primary hover:bg-primary/5'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 ${slot.is_reserved ? 'text-gray-400' : selectedSlot?.id === slot.id ? 'text-white' : 'text-gray-500'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium">
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {slot.is_reserved ? (
                        <span className="text-xs font-medium">Reserved</span>
                      ) : (
                        <span className="text-xs font-medium">₱{hourlyRate}</span>
                      )}
                      {!slot.is_reserved && selectedSlot?.id === slot.id && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg
                className="w-12 h-12 text-gray-300 mx-auto mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-gray-500 text-sm">No time slots available</p>
              <p className="text-gray-400 text-xs mt-1">Try selecting a different date</p>
            </div>
          )}

          {/* Selected Slot Info */}
          {selectedSlot && !selectedSlot.is_reserved && (
            <div className="mt-4 p-3 bg-primary/10 rounded-lg">
              <p className="text-xs font-medium text-primary mb-2">Selected Time Slot</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">
                  {formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}
                </span>
                <span className="text-sm font-bold text-gray-900">₱{hourlyRate}</span>
              </div>
              <button className="w-full mt-3 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                Book This Slot
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-white border border-gray-300 rounded" />
            <span className="text-gray-600">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-200 rounded" />
            <span className="text-gray-600">Reserved</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded" />
            <span className="text-gray-600">Selected</span>
          </div>
        </div>
      </div>
    </div>
  )
}
