'use client'

import { useState } from 'react'
import { formatTo12Hour } from '@/lib/utils'

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
  courts: Court[]
}

export function CourtHoursTabs({ 
  venueOpeningHours, 
  courts 
}: CourtHoursTabsProps) {
  const [selectedCourtId, setSelectedCourtId] = useState(courts[0]?.id)

  // Using shared utility via the name mapping
  const formatTime = (time: string) => formatTo12Hour(time)

  const selectedCourt = courts.find(c => c.id === selectedCourtId)
  const currentHours = selectedCourt?.opening_hours || venueOpeningHours

  if (!currentHours || !courts.length) return null

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  return (
    <div className="w-full">
      {/* Segmented Control */}
      <div className="flex p-1 bg-gray-100 rounded-xl mb-4 gap-1">
        {courts.map(court => (
          <button
            key={court.id}
            type="button"
            onClick={() => setSelectedCourtId(court.id)}
            className={`flex-1 py-1.5 px-2 text-[10px] font-bold rounded-lg transition-all truncate ${
              selectedCourtId === court.id 
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
              className="flex items-center justify-between px-3 py-2 rounded-xl border bg-primary/5 border-primary/10 transition-colors"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                {day.slice(0, 3)}
              </span>
              <span className="text-[10px] font-bold text-primary">
                {formatTime(hours.open)} – {formatTime(hours.close)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
