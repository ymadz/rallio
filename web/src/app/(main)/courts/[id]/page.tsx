import { isVenueOpen } from '@/lib/api/venues'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReviewsSection } from '@/components/venue/reviews-section'
import { VenueDetailsClient } from './venue-details-client'
import { ImageGallery } from '@/components/venue/image-gallery'

// Server-side venue fetch
async function getVenueByIdServer(venueId: string) {
  const supabase = await createClient()
  
  const { data: venue, error } = await supabase
    .from('venues')
    .select(`
      id,
      name,
      description,
      address,
      city,
      latitude,
      longitude,
      phone,
      email,
      website,
      opening_hours,
      is_active,
      is_verified,
      metadata,
      created_at,
      courts (
        id,
        name,
        description,
        surface_type,
        court_type,
        capacity,
        hourly_rate,
        is_active,
        metadata,
        court_amenities (
          amenities (
            id,
            name,
            icon
          )
        ),
        court_images (
          id,
          url,
          alt_text,
          is_primary,
          display_order
        )
      )
    `)
    .eq('id', venueId)
    .eq('is_active', true)
    .eq('is_verified', true)
    .single()

  if (error || !venue) {
    console.error('🔍 [getVenueByIdServer] Error:', error)
    return null
  }

  console.log('🔍 [getVenueByIdServer] Fetched venue:', venue.name, 'Courts:', venue.courts?.length)

  // Process courts to add images array
  const processedCourts = (venue.courts || []).map((court: any) => ({
    ...court,
    venue_id: venue.id,
    amenities: court.court_amenities?.map((m: any) => m.amenities) || [],
    images: court.court_images || [],
  }))

  return {
    ...venue,
    courts: processedCourts,
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const venue = await getVenueByIdServer(id)

  return {
    title: venue ? `${venue.name} | Rallio` : 'Venue | Rallio',
    description: venue?.description || 'View venue details and available courts',
  }
}

export default async function VenueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const venue = await getVenueByIdServer(id)

  if (!venue) {
    notFound()
  }

  // Filter active courts
  const activeCourts = venue.courts?.filter((c) => c.is_active) || []

  // Get venue status
  const isOpen = isVenueOpen(venue.opening_hours)

  // Collect all unique amenities from venue
  const allAmenities = venue.amenities || []

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

  // Collect all court images from active courts
  const allCourtImages: string[] = []
  activeCourts.forEach(court => {
    if (court.images && court.images.length > 0) {
      // Sort by display_order and is_primary
      const sortedImages = [...court.images].sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1
        if (!a.is_primary && b.is_primary) return 1
        return (a.display_order || 0) - (b.display_order || 0)
      })
      allCourtImages.push(...sortedImages.map(img => img.url))
    }
  })

  // Use court images if available, otherwise use placeholder
  const venueImages = allCourtImages.length > 0 ? allCourtImages : [
    'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=2070',
  ]

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

      {/* Image Gallery */}
      <ImageGallery images={venueImages} venueName={venue.name} />

      {/* Content - Two Column Layout */}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2">
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

            {/* Courts List - Pass to Client Component */}
            <VenueDetailsClient
              courts={activeCourts}
              venueId={venue.id}
              venueName={venue.name}
            />

            {/* Reviews Section */}
            <ReviewsSection
              courtIds={activeCourts.map((c) => c.id)}
              venueName={venue.name}
              firstCourtName={activeCourts[0]?.name}
            />
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Venue Status Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-3 h-3 rounded-full ${isOpen ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={`font-semibold text-sm ${isOpen ? 'text-green-700' : 'text-red-700'}`}>
                  {isOpen ? 'Open Now' : 'Closed'}
                </span>
              </div>

              {/* Operating Hours */}
              {openingHours && (
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Operating Hours</h4>
                  {Array.isArray(openingHours) ? (
                    <div className="space-y-1">
                      {openingHours.map((schedule, index) => (
                        <p key={index} className="text-gray-600 text-xs">{schedule}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-xs">{openingHours}</p>
                  )}
                </div>
              )}

              {/* Contact */}
              <div className="mb-4 pb-4 border-b border-gray-100">
                <h4 className="font-semibold text-gray-900 text-sm mb-2">Contact</h4>
                <div className="space-y-2">
                  {venue.phone && (
                    <div className="flex items-center gap-2 text-xs">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-gray-600">{venue.phone}</span>
                    </div>
                  )}
                  {venue.email && (
                    <div className="flex items-center gap-2 text-xs">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="text-gray-600 break-all">{venue.email}</span>
                    </div>
                  )}
                  {venue.website && (
                    <div className="flex items-center gap-2 text-xs">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 919-9" />
                      </svg>
                      <a href={venue.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                        {venue.website.replace(/^https?:\/\//,'')}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Amenities */}
              {allAmenities.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-2">Amenities</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {allAmenities.map((amenity: string) => (
                      <span
                        key={amenity}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>


          </div>
        </div>
      </div>
    </div>
  )
}
