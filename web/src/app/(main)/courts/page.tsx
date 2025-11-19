'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  getVenues,
  getCourtAverageRating,
  formatDistance,
  isVenueOpen,
  type VenueFilters,
  type VenueWithDetails,
} from '@/lib/api/venues'
import { createClient } from '@/lib/supabase/client'

// Filter options
const amenityOptions = [
  'Parking',
  'Restroom',
  'Shower',
  'Lockers',
  'Water',
  'Air Conditioning',
  'Lighting',
  'Waiting Area',
  'Equipment Rental',
  'WiFi',
  'Canteen',
]

type SortOption = 'distance' | 'price_low' | 'price_high' | 'rating' | 'newest'

export default function CourtsPage() {
  const [venues, setVenues] = useState<VenueWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Filter states
  const [priceRange, setPriceRange] = useState<number>(1000)
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])
  const [courtType, setCourtType] = useState<'indoor' | 'outdoor' | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [offset, setOffset] = useState(0)
  const [venueRatings, setVenueRatings] = useState<Record<string, { avg: number; count: number }>>({})

  const LIMIT = 12

  useEffect(() => {
    fetchVenues(true)
  }, [search, priceRange, selectedAmenities, courtType, sortBy, userLocation])

  const fetchVenues = async (reset: boolean = false) => {
    if (reset) {
      setLoading(true)
      setOffset(0)
    } else {
      setLoadingMore(true)
    }

    const filters: VenueFilters = {
      searchQuery: search || undefined,
      minPrice: 0,
      maxPrice: priceRange,
      amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
      courtType: courtType || undefined,
      latitude: userLocation?.lat,
      longitude: userLocation?.lng,
      sortBy,
      limit: LIMIT,
      offset: reset ? 0 : offset,
    }

    try {
      const result = await getVenues(filters)
      
      if (reset) {
        setVenues(result.venues)
        setOffset(LIMIT)
      } else {
        setVenues(prev => [...prev, ...result.venues])
        setOffset(prev => prev + LIMIT)
      }
      
      setTotal(result.total)
      setHasMore(result.hasMore)

      // Fetch ratings for all courts in batch
      const allCourtIds = result.venues.flatMap(venue => venue.courts.map(court => court.id))
      
      if (allCourtIds.length > 0) {
        const supabase = createClient()
        const { data: allRatings } = await supabase
          .from('court_ratings')
          .select('court_id, overall_rating')
          .in('court_id', allCourtIds)

        // Group ratings by venue
        const ratings: Record<string, { avg: number; count: number }> = {}
        for (const venue of result.venues) {
          const venueRatings = allRatings?.filter((r: any) => 
            venue.courts.some(c => c.id === r.court_id)
          ) || []
          
          if (venueRatings.length > 0) {
            const totalRating = venueRatings.reduce((sum: number, r: any) => sum + r.overall_rating, 0)
            ratings[venue.id] = {
              avg: totalRating / venueRatings.length,
              count: venueRatings.length,
            }
          }
        }
        setVenueRatings(prev => ({ ...prev, ...ratings }))
      }
    } catch (error) {
      console.error('Error fetching venues:', error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleLoadMore = () => {
    fetchVenues(false)
  }

  const handleGetLocation = () => {
    setLocationLoading(true)
    setLocationError(null)

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      setLocationLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setSortBy('distance')
        setLocationLoading(false)
      },
      (error) => {
        setLocationError('Unable to retrieve your location')
        setLocationLoading(false)
        console.error('Geolocation error:', error)
      }
    )
  }

  const clearFilters = () => {
    setPriceRange(1000)
    setSelectedAmenities([])
    setCourtType(null)
    setSortBy('newest')
    setUserLocation(null)
    setSearch('')
  }

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    )
  }

  const renderStars = (rating: number) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg key={`full-${i}`} className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )
    }

    if (hasHalfStar) {
      stars.push(
        <svg key="half" className="w-4 h-4 fill-yellow-400" viewBox="0 0 20 20">
          <defs>
            <linearGradient id="half">
              <stop offset="50%" stopColor="rgb(250 204 21)" />
              <stop offset="50%" stopColor="rgb(229 231 235)" />
            </linearGradient>
          </defs>
          <path fill="url(#half)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )
    }

    const emptyStars = 5 - Math.ceil(rating)
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <svg key={`empty-${i}`} className="w-4 h-4 fill-gray-200" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )
    }

    return stars
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Search Bar, Sort, and Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
            <div className="flex-1 relative w-full sm:max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search courts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              />
            </div>

            {/* Near Me Button */}
            <button
              onClick={handleGetLocation}
              disabled={locationLoading}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors whitespace-nowrap ${
                userLocation
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } ${locationLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {locationLoading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              <span className="text-sm font-medium">
                {userLocation ? 'Near Me ✓' : 'Near Me'}
              </span>
            </button>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="newest">Newest</option>
              <option value="distance" disabled={!userLocation}>
                Distance {!userLocation && '(Enable location)'}
              </option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>

            {/* View Toggle */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                className="px-4 py-2 text-sm font-medium flex items-center gap-2 bg-primary text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </button>
              <Link
                href="/courts/map"
                className="px-4 py-2 text-sm font-medium flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Map
              </Link>
            </div>
          </div>

          {/* Results Count and Active Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-sm text-gray-600">
              {loading ? 'Loading...' : `${total} ${total === 1 ? 'venue' : 'venues'} found`}
            </span>
            
            {userLocation && (
              <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                Within {formatDistance(50)}
              </span>
            )}
            
            {selectedAmenities.length > 0 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                {selectedAmenities.length} amenities
              </span>
            )}
            
            {courtType && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full capitalize">
                {courtType} only
              </span>
            )}
          </div>

          {/* Venues Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-gray-100 rounded-xl h-80 animate-pulse" />
              ))}
            </div>
          ) : venues.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {venues.map((venue) => {
                  const rating = venueRatings[venue.id]
                  const isOpen = isVenueOpen(venue.opening_hours)

                  return (
                    <Link
                      key={venue.id}
                      href={`/courts/${venue.id}`}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all group"
                    >
                      {/* Venue Image */}
                      <div className="h-44 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative overflow-hidden">
                        {venue.courts[0]?.images?.[0]?.url ? (
                          <img
                            src={venue.courts[0].images[0].url}
                            alt={venue.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <svg className="w-12 h-12 text-primary/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                        
                        <div className="absolute top-3 left-3 flex gap-2">
                          <span className={`px-2.5 py-1 text-white text-xs font-bold rounded-md shadow-sm ${
                            isOpen ? 'bg-green-500' : 'bg-gray-500'
                          }`}>
                            {isOpen ? 'OPEN' : 'CLOSED'}
                          </span>
                          {venue.is_verified && (
                            <span className="px-2.5 py-1 bg-blue-500 text-white text-xs font-bold rounded-md shadow-sm">
                              VERIFIED
                            </span>
                          )}
                        </div>

                        {venue.distance !== undefined && (
                          <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/60 text-white text-xs font-medium rounded-md backdrop-blur-sm">
                            {formatDistance(venue.distance)}
                          </div>
                        )}
                      </div>

                      {/* Venue Info */}
                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 mb-1.5 line-clamp-1 group-hover:text-primary transition-colors">
                          {venue.name}
                        </h3>

                        {/* Rating */}
                        {rating && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="flex items-center gap-0.5">
                              {renderStars(rating.avg)}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {rating.avg.toFixed(1)}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({rating.count} {rating.count === 1 ? 'review' : 'reviews'})
                            </span>
                          </div>
                        )}

                        <p className="text-sm text-gray-600 mb-3 line-clamp-2 flex items-start gap-1.5">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {venue.address}
                        </p>

                        {/* Court Info */}
                        <div className="flex items-center justify-between text-sm mb-4 pb-4 border-b border-gray-100">
                          <span className="text-gray-600">
                            {venue.totalCourts} {venue.totalCourts === 1 ? 'court' : 'courts'}
                          </span>
                          <span className="font-bold text-primary">
                            ₱{venue.minPrice}{venue.maxPrice !== venue.minPrice && ` - ₱${venue.maxPrice}`}/hr
                          </span>
                        </div>

                        {/* Amenities Preview */}
                        {venue.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {venue.amenities.slice(0, 3).map((amenity) => (
                              <span
                                key={amenity}
                                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                              >
                                {amenity}
                              </span>
                            ))}
                            {venue.amenities.length > 3 && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md">
                                +{venue.amenities.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-8 py-3 bg-white border-2 border-primary text-primary font-semibold rounded-lg hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No venues found</h3>
              <p className="text-gray-500 mb-4">
                {locationError || 'Try adjusting your filters or search query'}
              </p>
              <button
                onClick={clearFilters}
                className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </main>

        {/* Right Sidebar - Filters (Collapsible) */}
        <aside className={`hidden lg:block bg-white border-l border-gray-200 transition-all duration-300 ${showFilters ? 'w-80' : 'w-0 overflow-hidden'}`}>
          {showFilters && (
            <div className="p-6 h-full overflow-y-auto">
              <h2 className="text-lg font-bold text-primary mb-6">FILTERS</h2>

              {/* Category */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Category</h3>
                <select className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                  <option>Badminton</option>
                </select>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Price Range</h3>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={priceRange}
                  onChange={(e) => setPriceRange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-2">
                  <span>₱100</span>
                  <span>₱{priceRange}</span>
                </div>
              </div>

              {/* Court Type */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Court Type</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCourtType(courtType === 'indoor' ? null : 'indoor')}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      courtType === 'indoor'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    🏠 Indoor
                  </button>
                  <button
                    onClick={() => setCourtType(courtType === 'outdoor' ? null : 'outdoor')}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      courtType === 'outdoor'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    🌤️ Outdoor
                  </button>
                </div>
              </div>

              {/* Amenities */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {amenityOptions.map((amenity) => (
                    <button
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selectedAmenities.includes(amenity)
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => {}}
                  className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  onClick={clearFilters}
                  className="w-full text-primary py-2 text-sm font-medium hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Filter Toggle Button (Fixed on right edge) */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 bg-primary text-white p-2 rounded-l-lg shadow-lg hover:bg-primary/90 transition-colors z-30"
          style={{ right: showFilters ? '320px' : '0' }}
        >
          <svg
            className={`w-5 h-5 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Mobile Filters Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="lg:hidden fixed bottom-20 right-4 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-primary/90 transition-colors z-30"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>

        {/* Mobile Filter Panel */}
        {showFilters && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setShowFilters(false)}>
            <div
              className="absolute right-0 top-0 bottom-0 w-80 bg-white p-6 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-primary">FILTERS</h2>
                <button onClick={() => setShowFilters(false)} className="p-1">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Category */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Category</h3>
                <select className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                  <option>Badminton</option>
                </select>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Price Range</h3>
                <input
                  type="range"
                  min="100"
                  max="1000"
                  step="50"
                  value={priceRange}
                  onChange={(e) => setPriceRange(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-2">
                  <span>₱100</span>
                  <span>₱{priceRange}</span>
                </div>
              </div>

              {/* Court Type */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Court Type</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCourtType(courtType === 'indoor' ? null : 'indoor')}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      courtType === 'indoor'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    🏠 Indoor
                  </button>
                  <button
                    onClick={() => setCourtType(courtType === 'outdoor' ? null : 'outdoor')}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                      courtType === 'outdoor'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    🌤️ Outdoor
                  </button>
                </div>
              </div>

              {/* Amenities */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {amenityOptions.map((amenity) => (
                    <button
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selectedAmenities.includes(amenity)
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowFilters(false)}
                  className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Show Results ({total})
                </button>
                <button
                  onClick={() => {
                    clearFilters()
                    setShowFilters(false)
                  }}
                  className="w-full text-primary py-2 text-sm font-medium hover:underline"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
