import { isVenueOpen } from '@/lib/api/venues'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReviewsSection } from '@/components/venue/reviews-section'
import { VenueDetailsClient } from './venue-details-client'
import { ImageGallery } from '@/components/venue/image-gallery'
import { DiscountIndicator } from '@/components/venue/discount-indicator'

// Server-side venue fetch
async function getVenueByIdServer(venueId: string) {
  const supabase = await createClient()

  const { data: venue, error } = await supabase
    .from('venues')
    .select(`
      id,
      name,
      description,
      owner_id,
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
      image_url,
      courts (
        id,
        name,
        description,
        surface_type,
        court_type,
        capacity,
        hourly_rate,
        is_active,
        is_verified,
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
    .maybeSingle()

  // Fetch active discount rules and holiday pricing
  const { data: discountRules } = await supabase
    .from('discount_rules')
    .select('*')
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .order('priority', { ascending: false })

  const { data: holidayPricing } = await supabase
    .from('holiday_pricing')
    .select('*')
    .eq('venue_id', venueId)
    .eq('is_active', true)
    .gte('end_date', new Date().toISOString()) // Only future/current holidays

  const activeDiscountCount = (discountRules?.length || 0) + (holidayPricing?.length || 0)

  if (error) {
    console.error('🔍 [getVenueByIdServer] Error:', JSON.stringify(error, null, 2))
    return null
  }

  if (!venue) {
    return null
  }

  // Check visibility if not active or not verified
  if (!venue.is_active || !venue.is_verified) {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // Check if user is owner
    if (user.id !== venue.owner_id) {
      // Check if user is global admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role:roles(name)')
        .eq('user_id', user.id)

      const isGlobalAdmin = roles?.some((r: any) => r.role?.name === 'global_admin')
      if (!isGlobalAdmin) return null
    }
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
    image_url: venue.image_url,
    courts: processedCourts,
    hasActiveDiscounts: activeDiscountCount > 0,
    discountRules,
    holidayPricing
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

  // Filter active and verified courts
  const activeCourts = venue.courts?.filter((c: any) => c.is_active && c.is_verified) || []

  // Get venue status
  const isOpen = isVenueOpen(venue.opening_hours)

  // Collect all unique amenities from active courts
  const uniqueAmenityNames = new Set<string>()
  activeCourts.forEach(court => {
    court.amenities?.forEach((amenity: any) => {
      if (amenity?.name) uniqueAmenityNames.add(amenity.name)
    })
  })
  const allAmenities = Array.from(uniqueAmenityNames)

  // Parse opening hours if it's a JSONB object
  const formatTo12Hour = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hour12 = hours % 12 || 12
    return `${hour12}${minutes ? `:${minutes.toString().padStart(2, '0')}` : ''} ${period}`
  }

  const formatOpeningHours = (hours: any) => {
    if (!hours) return null
    if (typeof hours === 'string') return hours

    // Format JSONB opening hours with structured data
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const dayAbbrev: Record<string, string> = {
      monday: 'Mon',
      tuesday: 'Tue',
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat',
      sunday: 'Sun'
    }

    const formatted = days.map(day => {
      const schedule = hours[day]
      if (!schedule) return { day: dayAbbrev[day], closed: true }
      return {
        day: dayAbbrev[day],
        open: formatTo12Hour(schedule.open),
        close: formatTo12Hour(schedule.close),
        closed: false
      }
    })

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

  // Mix venue image + court images
  const venueImages = []
  if (venue.image_url) {
    venueImages.push(venue.image_url)
  }
  if (venue.metadata?.images && Array.isArray(venue.metadata.images)) {
    venueImages.push(...venue.metadata.images)
  }
  venueImages.push(...allCourtImages)

  // Fallback if absolutely no images
  if (venueImages.length === 0) {
    venueImages.push('https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=2070')
  }

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
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">{venue.name}</h2>
                <DiscountIndicator discounts={{
                  rules: venue.discountRules || [],
                  holidays: venue.holidayPricing || []
                }} />
              </div>
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
              discounts={{
                rules: venue.discountRules || [],
                holidays: venue.holidayPricing || []
              }}
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
              {/* Venue Status Banner */}
              <div className={`rounded-xl p-4 mb-4 ${isOpen
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                : 'bg-gradient-to-r from-red-50 to-orange-50 border border-red-200'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOpen ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                    {isOpen ? (
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-base ${isOpen ? 'text-green-700' : 'text-red-700'}`}>
                        {isOpen ? 'Open Now' : 'Currently Closed'}
                      </span>
                      <div className={`w-2 h-2 rounded-full animate-pulse ${isOpen ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                    </div>
                    <p className={`text-xs mt-0.5 ${isOpen ? 'text-green-600' : 'text-red-600'}`}>
                      {isOpen ? 'Ready to accept bookings' : 'Check operating hours below'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Operating Hours */}
              {openingHours && (
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="font-semibold text-gray-900 text-sm">Operating Hours</h4>
                  </div>
                  {Array.isArray(openingHours) && typeof openingHours[0] === 'object' ? (
                    <div className="space-y-1.5">
                      {openingHours.map((schedule: any, index: number) => (
                        <div
                          key={index}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg ${schedule.closed
                            ? 'bg-gray-50'
                            : 'bg-primary/5'
                            }`}
                        >
                          <span className={`text-xs font-semibold ${schedule.closed ? 'text-gray-400' : 'text-gray-700'
                            }`}>
                            {schedule.day}
                          </span>
                          {schedule.closed ? (
                            <span className="text-xs text-gray-400">Closed</span>
                          ) : (
                            <span className="text-xs text-primary font-medium">
                              {schedule.open} – {schedule.close}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : Array.isArray(openingHours) ? (
                    <div className="space-y-1">
                      {openingHours.map((schedule, index) => (
                        <p key={index} className="text-gray-600 text-xs">{String(schedule)}</p>
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
                        {venue.website.replace(/^https?:\/\//, '')}
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
