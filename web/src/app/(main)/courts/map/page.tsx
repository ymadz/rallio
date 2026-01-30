'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { ErrorBoundary } from '@/components/error-boundary'

interface Venue {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  courtCount: number
  minPrice: number
  maxPrice: number
  averageRating?: number
  totalReviews?: number
  opening_hours?: Record<string, { open: string; close: string }> | null
  distance?: number
  amenities?: string[]
}

// Dynamically import the map component to avoid SSR issues with Leaflet
const VenueMap = dynamic(
  () => import('@/components/map/venue-map'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
)

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

export default function MapViewPage() {
  const [allVenues, setAllVenues] = useState<Venue[]>([]) // Store original unfiltered data
  const [venues, setVenues] = useState<Venue[]>([]) // Store filtered data for display
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(true)
  const [priceRange, setPriceRange] = useState([100, 1000])
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])
  const [minRating, setMinRating] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchVenues()
  }, [])

  // Apply filters when filter state changes
  useEffect(() => {
    applyFilters()
  }, [allVenues, priceRange, selectedAmenities, minRating, searchQuery])

  const fetchVenues = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('venues')
        .select(`
          id,
          name,
          address,
          latitude,
          longitude,
          opening_hours,
          courts(
            id,
            hourly_rate,
            is_active,
            court_ratings(
              overall_rating
            ),
            court_amenities(
              amenity:amenities(
                name
              )
            )
          )
        `)
        .eq('is_active', true)
        .eq('is_verified', true) // Only show verified/approved venues

      if (error) {
        console.error('Error fetching venues:', error)
        setLoading(false)
        return
      }

      if (data) {
        const transformedData = data.map(venue => {
          const activeCourts = venue.courts?.filter((c: any) => c.is_active) || []
          const prices = activeCourts.map((c: any) => c.hourly_rate).filter(Boolean)

          // Calculate average rating across all courts
          const allRatings = activeCourts.flatMap((c: any) =>
            c.court_ratings?.map((r: any) => r.overall_rating) || []
          )
          const averageRating = allRatings.length > 0
            ? allRatings.reduce((sum: number, r: number) => sum + r, 0) / allRatings.length
            : undefined

          // Collect unique amenities from all courts
          const amenitiesSet = new Set<string>()
          activeCourts.forEach((c: any) => {
            c.court_amenities?.forEach((ca: any) => {
              if (ca.amenity?.name) {
                amenitiesSet.add(ca.amenity.name)
              }
            })
          })

          return {
            id: venue.id,
            name: venue.name,
            address: venue.address || '',
            latitude: venue.latitude || 0,
            longitude: venue.longitude || 0,
            courtCount: activeCourts.length,
            minPrice: prices.length > 0 ? Math.min(...prices) : 0,
            maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
            averageRating,
            totalReviews: allRatings.length,
            opening_hours: venue.opening_hours,
            amenities: Array.from(amenitiesSet)
          }
        }).filter(v => v.latitude && v.longitude)

        // Store original unfiltered data
        setAllVenues(transformedData)
        setVenues(transformedData) // Initially show all
      }
      setLoading(false)
    } catch (error) {
      console.error('Unexpected error fetching venues:', error)
      setAllVenues([])
      setVenues([])
      setLoading(false)
    }
  }

  const applyFilters = () => {
    if (allVenues.length === 0) return

    let filtered = [...allVenues]

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(v =>
        v.name.toLowerCase().includes(query) ||
        v.address.toLowerCase().includes(query)
      )
    }

    // Price range filter
    filtered = filtered.filter(v =>
      v.minPrice <= priceRange[1] && v.maxPrice >= priceRange[0]
    )

    // Amenities filter
    if (selectedAmenities.length > 0) {
      filtered = filtered.filter(v =>
        selectedAmenities.every(amenity => v.amenities?.includes(amenity))
      )
    }

    // Rating filter
    if (minRating > 0) {
      filtered = filtered.filter(v =>
        v.averageRating && Math.floor(v.averageRating) === minRating
      )
    }

    setVenues(filtered)
  }

  const handleClearFilters = () => {
    setPriceRange([100, 1000])
    setSelectedAmenities([])
    setMinRating(0)
    setSearchQuery('')
    // Filters will auto-apply via useEffect, showing all venues
  }

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    )
  }

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 md:left-20 bg-gray-50 flex flex-col overflow-hidden z-10">
        {/* Header - Mobile Optimized */}
        <header className="bg-white border-b border-gray-200 flex-shrink-0 z-20">
          {/* Top Row - Title and Actions */}
          <div className="px-4 pt-4 pb-3 md:px-6 md:pt-4 md:pb-4">
            <div className="flex items-center justify-between mb-3 md:mb-0">
              <div className="md:hidden">
                <h1 className="text-xl font-bold text-gray-900">Map View</h1>
                <p className="text-sm text-gray-500">Find courts on the map</p>
              </div>

              {/* Desktop: Search Bar inline */}
              <div className="hidden md:flex flex-1 max-w-md relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search courts, city, or area"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Results Count - Desktop */}
              <span className="text-sm text-gray-600 hidden md:block mx-4">
                {venues.length} {venues.length === 1 ? 'result' : 'results'} found
              </span>

              {/* Right Side Actions - Desktop */}
              <div className="hidden md:flex items-center gap-3">
                {/* Near Me Button */}
                <button
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Near Me</span>
                </button>

                {/* Sort Dropdown */}
                <select
                  className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium text-gray-700"
                >
                  <option value="newest">Newest</option>
                  <option value="distance">Distance</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="rating">Rating</option>
                </select>

                {/* View Toggle */}
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <Link
                    href="/courts"
                    className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50 transition-colors border-r border-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span>List</span>
                  </Link>
                  <button
                    className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 bg-primary text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span>Map</span>
                  </button>
                </div>
              </div>

              {/* Mobile: Filter Toggle Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`md:hidden flex items-center justify-center w-10 h-10 rounded-full transition-colors ${showFilters
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            </div>

            {/* Mobile: Search Bar */}
            <div className="md:hidden flex gap-2">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search courts, city, or area"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Mobile: View Toggle & Results */}
          <div className="md:hidden overflow-x-auto scrollbar-hide border-t border-gray-100">
            <div className="flex items-center gap-2 px-4 py-2.5 min-w-max">
              {/* View Toggle - Mobile */}
              <Link
                href="/courts"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </Link>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Map
              </button>

              {/* Results count - Mobile */}
              <span className="text-xs text-gray-500 ml-auto pl-2">
                {venues.length} found
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Map Container */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : venues.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <p className="text-gray-600 font-medium mb-2">No venues found</p>
                <p className="text-sm text-gray-500">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="w-full h-full" style={{ minHeight: 'calc(100vh - 80px)' }}>
                <VenueMap venues={venues} />
              </div>
            )}
          </div>

          {/* Filters Sidebar */}
          <div
            className={`bg-white border-l border-gray-200 transition-all duration-300 flex-shrink-0 overflow-hidden relative z-20 ${showFilters ? 'w-80' : 'w-0'
              }`}
          >
            <div className="w-80 h-full overflow-y-auto p-6">
              {/* Filters Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-primary hover:text-primary-dark font-medium"
                >
                  Clear All
                </button>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">Price Range</label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>₱{priceRange[0]}</span>
                    <span>₱{priceRange[1]}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>₱100</span>
                    <span>₱1000</span>
                  </div>
                </div>
              </div>

              {/* Amenities */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {amenityOptions.map((amenity) => (
                    <button
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${selectedAmenities.includes(amenity)
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Rating */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-3">Customer Review</label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setMinRating(rating === minRating ? 0 : rating)}
                        className="focus:outline-none transition-transform hover:scale-110"
                      >
                        <svg
                          className={`w-8 h-8 ${rating <= minRating ? 'text-primary fill-primary' : 'text-gray-300 fill-gray-300'
                            }`}
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {minRating > 0 ? `${minRating} Stars & Up` : 'Any Rating'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Toggle Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-l-lg p-2 shadow-lg hover:bg-gray-50 transition-colors z-30"
            style={{ right: showFilters ? '320px' : '0' }}
          >
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform ${showFilters ? '' : 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </ErrorBoundary>
  )
}
