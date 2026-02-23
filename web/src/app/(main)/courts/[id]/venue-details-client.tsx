'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AvailabilityModal } from '@/components/venue/availability-modal'
import { EmptyCourtsState } from '@/components/courts/empty-courts-state'

interface Court {
  id: string
  name: string
  description: string | null
  surface_type: string
  court_type: string
  capacity: number
  hourly_rate: number
  is_active: boolean
}

interface VenueDetailsClientProps {
  courts: Court[]
  venueId: string
  venueName: string
  discounts?: {
    rules: any[]
    holidays: any[]
  }
}

export function VenueDetailsClient({ courts, venueId, venueName, discounts }: VenueDetailsClientProps) {
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleViewAvailability = (court: Court) => {
    setSelectedCourt(court)
    setIsModalOpen(true)
  }

  // Show empty state if no courts available
  if (courts.length === 0) {
    return <EmptyCourtsState venueName={venueName} />
  }

  return (
    <>
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Available Courts</h3>
        <div className="space-y-3">
          {courts.map((court) => (
            <div
              key={court.id}
              className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{court.name}</h4>
                  {court.description && (
                    <p className="text-sm text-gray-500 mt-1">{court.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded capitalize">
                      {court.surface_type}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${court.court_type === 'indoor'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-green-50 text-green-600'
                      }`}>
                      {court.court_type}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-lg font-bold text-primary">₱{court.hourly_rate}</p>
                  <p className="text-xs text-gray-500">/hour</p>
                </div>
              </div>

              {/* Court Actions */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleViewAvailability(court)}
                  className="bg-primary text-white text-center py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  View Schedule
                </button>
                <Link
                  href={`/queue/${court.id}`}
                  className="border border-gray-300 text-gray-700 text-center py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Queue
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Availability Modal */}
      {selectedCourt && (
        <AvailabilityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedCourt(null)
          }}
          courtId={selectedCourt.id}
          courtName={selectedCourt.name}
          hourlyRate={selectedCourt.hourly_rate}
          venueId={venueId}
          venueName={venueName}
          capacity={selectedCourt.capacity}
        />
      )}

      {/* Availability Modal */}
      {selectedCourt && (
        <AvailabilityModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedCourt(null)
          }}
          courtId={selectedCourt.id}
          courtName={selectedCourt.name}
          hourlyRate={selectedCourt.hourly_rate}
          venueId={venueId}
          venueName={venueName}
          capacity={selectedCourt.capacity}
        />
      )}
    </>
  )
}
