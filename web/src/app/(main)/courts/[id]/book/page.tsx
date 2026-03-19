import { getVenueById } from '@/lib/api/venues'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BookingForm } from '@/components/booking/booking-form'
import { PlatformFeeLoader } from '@/components/checkout/platform-fee-loader'
import { CourtHoursTabs } from '@/components/venue/court-hours-tabs'

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ court?: string }>
}) {
  const { id } = await params
  const venue = await getVenueById(id)

  return {
    title: venue ? `Book ${venue.name} | Rallio` : 'Book Court | Rallio',
    description: 'Select a date and time to book your badminton court',
  }
}

export default async function BookingPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ court?: string }>
}) {
  const { id: venueId } = await params
  const { court: courtId } = await searchParams

  // Fetch venue details
  const venue = await getVenueById(venueId)

  if (!venue) {
    notFound()
  }

  // Get active courts
  const activeCourts = (venue.courts?.filter((c) => c.is_active) || []).map(court => ({
    ...court,
    opening_hours: (court as any).opening_hours || {}
  }))

  const courtsWithOverrides = activeCourts.filter((c: any) => c.opening_hours && Object.keys(c.opening_hours).length > 0)
  const hasOverrides = courtsWithOverrides.length > 0

  if (activeCourts.length === 0) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">No Courts Available</h1>
          <p className="text-gray-600">
            This venue doesn't have any active courts at the moment. Please check back later.
          </p>
        </div>
      </div>
    )
  }

  // Get authenticated user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h1>
          <p className="text-gray-600">
            Please log in to book a court.
          </p>
        </div>
      </div>
    )
  }

  // Find selected court or default to first court
  const selectedCourt = courtId
    ? activeCourts.find(c => c.id === courtId) || activeCourts[0]
    : activeCourts[0]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Load platform fee settings */}
      <PlatformFeeLoader />
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <a
              href={`/courts/${venueId}`}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Book a Court</h1>
              <p className="text-gray-600 mt-1">{venue.name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Booking Form - Takes up 2 columns on large screens */}
          <div className="lg:col-span-2">
            <BookingForm
              venue={venue as any}
              courts={activeCourts as any}
              selectedCourtId={selectedCourt.id}
              userId={user.id}
            />
          </div>

          {/* Venue Info Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-6">
              <h3 className="font-semibold text-lg text-gray-900 mb-4">Venue Details</h3>

              {/* Address */}
              {venue.address && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Location</p>
                  <p className="text-gray-900">{venue.address}</p>
                  {venue.city && <p className="text-gray-600">{venue.city}</p>}
                </div>
              )}

              {/* Contact */}
              {venue.phone && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Contact</p>
                  <p className="text-gray-900">{venue.phone}</p>
                </div>
              )}

              {/* Operating Hours */}
              {venue.opening_hours && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">Operating Hours</p>
                    {hasOverrides && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        Custom per court
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {hasOverrides ? (
                      <CourtHoursTabs 
                        venueOpeningHours={venue.opening_hours} 
                        courtsWithOverrides={courtsWithOverrides as any} 
                      />
                    ) : (
                      <div>
                        <div className="space-y-1">
                          {Object.entries(venue.opening_hours).map(([day, hours]: [string, any]) => (
                            <div key={day} className="flex justify-between text-sm">
                              <span className="text-gray-600 capitalize">{day}</span>
                              <span className="text-gray-900">
                                {hours.open} - {hours.close}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
