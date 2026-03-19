'use client'

import { useState } from 'react'

interface OpeningHoursEntry {
  open: string
  close: string
}

interface Court {
  id: string
  name: string
  opening_hours: Record<string, OpeningHoursEntry>
}

interface CourtHoursTabsProps {
  venueOpeningHours: Record<string, OpeningHoursEntry>
  courtsWithOverrides: Court[]
}

export function CourtHoursTabs({ venueOpeningHours, courtsWithOverrides }: CourtHoursTabsProps) {
  const [selectedTarget, setSelectedTarget] = useState('venue')

  const formatTo12Hour = (time: string) => {
    if (!time) return ''
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    return `${hour12}${minutes ? `:${minutes.toString().padStart(2, '0')}` : ''} ${period}`
  }

  const currentHours = selectedTarget === 'venue'
    ? venueOpeningHours
    : courtsWithOverrides.find(c => c.id === selectedTarget)?.opening_hours

  if (!currentHours) return null

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  return (
    <div className="w-full">
      {/* Segmented Control */}
      <div className="flex p-1 bg-gray-100 rounded-xl mb-4 gap-1">
        <button
          type="button"
          onClick={() => setSelectedTarget('venue')}
          className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all ${
            selectedTarget === 'venue' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
          }`}
        >
          Venue
        </button>
        {courtsWithOverrides.map(court => (
          <button
            key={court.id}
            type="button"
            onClick={() => setSelectedTarget(court.id)}
            className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all truncate ${
              selectedTarget === court.id 
                ? 'bg-white text-primary shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
            title={court.name}
          >
            {court.name}
          </button>
        ))}
      </div>

      {/* Schedule List */}
      <div className="space-y-1.5">
        {days.map(day => {
          const hours = currentHours[day]
          if (!hours) return null

          return (
            <div 
              key={day} 
              className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-colors ${
                selectedTarget === 'venue' 
                  ? 'bg-primary/5 border-primary/10' 
                  : 'bg-amber-50/50 border-amber-100'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                selectedTarget === 'venue' ? 'text-gray-600' : 'text-amber-800'
              }`}>
                {day.slice(0, 3)}
              </span>
              <span className={`text-[10px] font-bold ${
                selectedTarget === 'venue' ? 'text-primary' : 'text-amber-700'
              }`}>
                {formatTo12Hour(hours.open)} – {formatTo12Hour(hours.close)}
              </span>
            </div>
          )
        })}
      </div>

      {selectedTarget !== 'venue' && (
        <p className="mt-3 text-[9px] text-center text-amber-600 font-medium animate-pulse">
          Showing custom schedule for {courtsWithOverrides.find(c => c.id === selectedTarget)?.name}
        </p>
      )}
    </div>
  )
}
