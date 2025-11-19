import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: venue } = await supabase
    .from('venues')
    .select('name')
    .eq('id', id)
    .single()

  return {
    title: venue ? `${venue.name} | Rallio` : 'Venue | Rallio',
    description: 'View venue details and available courts',
  }
}

export default async function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch venue with its courts and amenities
  const { data: venue, error } = await supabase
    .from('venues')
    .select(`
      *,
      owner:users(id, display_name, avatar_url),
      courts(
        id,
        name,
        description,
        surface_type,
        court_type,
        hourly_rate,
        capacity,
        is_active,
        court_amenity_map(
          amenity:court_amenities(id, name, icon)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !venue) {
    notFound()
  }

  // Filter active courts and get unique amenities
  const activeCourts = venue.courts?.filter((c: any) => c.is_active) || []

  // Collect all unique amenities from all courts
  const allAmenities = new Map()
  activeCourts.forEach((court: any) => {
    court.court_amenity_map?.forEach((mapping: any) => {
      if (mapping.amenity) {
        allAmenities.set(mapping.amenity.name, mapping.amenity)
      }
    })
  })
  const uniqueAmenities = Array.from(allAmenities.values())

  // Parse opening hours if it's a JSONB object
  const formatOpeningHours = (hours: any) => {
    if (!hours) return null
    if (typeof hours === 'string') return hours

    // Format JSONB opening hours
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const formatted = days.map(day => {
      const schedule = hours[day]
      if (!schedule) return null
      return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${schedule.open} - ${schedule.close}`
    }).filter(Boolean)

    return formatted
  }

  const openingHours = formatOpeningHours(venue.opening_hours)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-100 flex items-center gap-4">
        <Link href="/courts" className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Venue Details</h1>
      </header>

      {/* Venue Image */}
      <div className="h-48 md:h-64 bg-gray-100 flex items-center justify-center">
        <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </div>

      {/* Content */}
      <div className="p-6 max-w-3xl">
        {/* Title and Address */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{venue.name}</h2>
          <p className="text-gray-500 mt-1">{venue.address}</p>
          <p className="text-sm text-gray-400 mt-1">
            {activeCourts.length} {activeCourts.length === 1 ? 'court' : 'courts'} available
          </p>
        </div>

        {/* About */}
        {venue.description && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">About</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              {venue.description}
            </p>
          </div>
        )}

        {/* Courts List */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Available Courts</h3>
          <div className="space-y-3">
            {activeCourts.map((court: any) => (
              <div
                key={court.id}
                className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
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
                      <span className={`text-xs px-2 py-1 rounded ${
                        court.court_type === 'indoor'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-green-50 text-green-600'
                      }`}>
                        {court.court_type}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {court.capacity} players max
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-bold text-primary">₱{court.hourly_rate}</p>
                    <p className="text-xs text-gray-500">/hour</p>
                  </div>
                </div>

                {/* Court Actions */}
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/courts/${venue.id}/book?court=${court.id}`}
                    className="flex-1 bg-primary text-white text-center py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Book
                  </Link>
                  <Link
                    href={`/courts/${venue.id}/queue?court=${court.id}`}
                    className="flex-1 border border-primary text-primary text-center py-2 rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors"
                  >
                    Join Queue
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Amenities */}
        {uniqueAmenities.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
            <div className="flex flex-wrap gap-2">
              {uniqueAmenities.map((amenity: any) => (
                <span
                  key={amenity.name}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  {amenity.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Operating Hours */}
        {openingHours && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Operating Hours</h3>
            {Array.isArray(openingHours) ? (
              <div className="space-y-1">
                {openingHours.map((schedule, index) => (
                  <p key={index} className="text-gray-600 text-sm">{schedule}</p>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm">{openingHours}</p>
            )}
          </div>
        )}

        {/* Contact */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
          <div className="space-y-2">
            {venue.phone && (
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="text-gray-600">{venue.phone}</span>
              </div>
            )}
            {venue.email && (
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-600">{venue.email}</span>
              </div>
            )}
            {venue.website && (
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {venue.website}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Venue Owner/Manager */}
        {venue.owner && (
          <div className="mb-8 p-4 bg-primary rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
                {venue.owner.avatar_url ? (
                  <img src={venue.owner.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-lg font-medium">
                    {(venue.owner.display_name || 'M').charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <p className="text-white font-medium">
                  {venue.owner.display_name || 'Venue Manager'}
                </p>
                <p className="text-white/70 text-sm">Venue Manager</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
