'use client'

import { format } from 'date-fns';
import { formatTo12Hour } from '@/lib/utils';
import { cn } from '@/lib/utils'

export interface TimeSlot {
  time: string // HH:mm format
  available: boolean
  price?: number
}

interface TimeSlotGridProps {
  slots: TimeSlot[]
  selectedTime?: string
  duration?: number // Add duration prop to show time ranges
  onSelectTime: (time: string) => void
  className?: string
}

export function TimeSlotGrid({
  slots,
  selectedTime,
  duration = 1, // Default to 1 hour
  onSelectTime,
  className,
}: TimeSlotGridProps) {
  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No available time slots for this date
      </div>
    )
  }

  // Helper to check if duration hours are available starting from a given slot
  const isDurationAvailable = (startTime: string): boolean => {
    const startHour = parseInt(startTime.split(':')[0])
    
    for (let i = 0; i < duration; i++) {
      const hour = startHour + i
      const timeString = `${hour.toString().padStart(2, '0')}:00`
      const slot = slots.find((s) => s.time === timeString)
      
      if (!slot || !slot.available) {
        return false
      }
    }
    
    return true
  }

  // Helper to calculate end time based on start time and duration
  const getEndTime = (startTime: string): string => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const endHours = hours + duration
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Filter slots to only show ones where full duration is available
  const availableStartSlots = slots.filter(slot => isDurationAvailable(slot.time))

  // Count available and reserved slots for the legend
  const availableCount = availableStartSlots.length
  const reservedCount = slots.length - availableCount

  return (
    <div className={cn('space-y-3', className)}>
      {/* Legend */}
      {duration > 1 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-blue-900 font-medium">
            📅 {duration}-hour booking: Times shown are start times. Your reservation will be from start time to {duration} hours later.
          </p>
        </div>
      )}
      
      {reservedCount > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-600 pb-2 border-b border-gray-200">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-white border border-gray-300"></div>
            <span>Available ({availableCount})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200"></div>
            <span>Not Available ({reservedCount})</span>
          </div>
        </div>
      )}

      {/* Show message if no slots available for selected duration */}
      {availableStartSlots.length === 0 && (
        <div className="text-center py-8 bg-amber-50 border border-amber-200 rounded-lg">
          <svg className="w-12 h-12 text-amber-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-amber-900 font-medium mb-1">No {duration}-hour slots available</p>
          <p className="text-sm text-amber-700">Try selecting a shorter duration or different date</p>
        </div>
      )}

      {/* Time Slot Grid */}
      {availableStartSlots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {availableStartSlots.map((slot) => {
          const isSelected = selectedTime === slot.time
          const endTime = getEndTime(slot.time)

          return (
            <button
              key={slot.time}
              type="button"
              onClick={() => onSelectTime(slot.time)}
              className={cn(
                'px-4 py-3 rounded-lg border text-sm font-medium transition-all',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                isSelected && 'bg-primary text-white border-primary shadow-md',
                !isSelected && 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:bg-gray-50 hover:shadow-sm'
              )}
              aria-label={`Book from ${formatTime(slot.time)} to ${formatTime(endTime)}`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="font-semibold">{formatTime(slot.time)}</span>
                <span className="text-xs opacity-75">to</span>
                <span className="font-semibold">{formatTime(endTime)}</span>
                {duration > 1 && (
                  <span className="text-xs mt-1 px-2 py-0.5 bg-primary/10 rounded">
                    {duration}h
                  </span>
                )}
              </div>
            </button>
          )
        })}
        </div>
      )}
    </div>
  )
}

// Helper function to format time from 24h to 12h format
const formatTime = (timeString: string) => formatTo12Hour(timeString);
