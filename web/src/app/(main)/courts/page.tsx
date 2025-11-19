'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// Filter options
const amenityOptions = [
  'AC', 'Lighting', 'Parking', 'Restroom', 'Shower', 'Water', 'Lockers', 'Waiting Area'
]

export default function CourtsPage() {
  const [venues, setVenues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [showFilters, setShowFilters] = useState(false)

  // Filter states
  const [priceRange, setPriceRange] = useState<number>(1000)
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])
  const [hasIndoor, setHasIndoor] = useState(false)
  const [hasOutdoor, setHasOutdoor] = useState(false)

  useEffect(() => {
    fetchVenues()
  }, [])

  const fetchVenues = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('venues')
      .select(`
        id,
        name,
        address,
        phone,
        is_active,
        courts(
          id,
          name,
          court_type,
          hourly_rate,
          is_active,
          court_amenity_map(
            amenity:court_amenities(id, name)
          )
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!error && data) {
      const transformedData = data.map(venue => {
        const activeCourts = venue.courts?.filter((c: any) => c.is_active) || []
        const prices = activeCourts.map((c: any) => c.hourly_rate).filter(Boolean)
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0
        const hasIndoorCourt = activeCourts.some((c: any) => c.court_type === 'indoor')
        const hasOutdoorCourt = activeCourts.some((c: any) => c.court_type === 'outdoor')

        const amenities = new Set<string>()
        activeCourts.forEach((court: any) => {
          court.court_amenity_map?.forEach((mapping: any) => {
            if (mapping.amenity?.name) {
              amenities.add(mapping.amenity.name)
            }
          })
        })

        return {
          ...venue,
          courtCount: activeCourts.length,
          minPrice,
          maxPrice,
          hasIndoor: hasIndoorCourt,
          hasOutdoor: hasOutdoorCourt,
          amenities: Array.from(amenities)
        }
      })
      setVenues(transformedData)
    } else if (error) {
      console.error('Error fetching venues:', error)
    }
    setLoading(false)
  }

  const filteredVenues = venues.filter((venue) => {
    if (search) {
      const searchLower = search.toLowerCase()
      const matchesSearch =
        venue.name?.toLowerCase().includes(searchLower) ||
        venue.address?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }

    if (hasIndoor && !venue.hasIndoor) return false
    if (hasOutdoor && !venue.hasOutdoor) return false
    if (venue.minPrice > priceRange) return false

    if (selectedAmenities.length > 0) {
      const hasAllAmenities = selectedAmenities.every(amenity =>
        venue.amenities.some((a: string) => a.toLowerCase() === amenity.toLowerCase())
      )
      if (!hasAllAmenities) return false
    }

    return true
  })

  const clearFilters = () => {
    setPriceRange(1000)
    setSelectedAmenities([])
    setHasIndoor(false)
    setHasOutdoor(false)
  }

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Search Bar and View Toggle */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative max-w-md">
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

            <span className="text-sm text-gray-500 whitespace-nowrap">
              {filteredVenues.length} results
            </span>

            {/* View Toggle */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 text-sm font-medium flex items-center gap-2 ${
                  viewMode === 'list'
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
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

          {/* Venues Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse" />
              ))}
            </div>
          ) : filteredVenues.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVenues.map((venue) => (
                <div
                  key={venue.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Venue Image */}
                  <div className="h-36 bg-gray-100 flex items-center justify-center relative">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="absolute top-3 left-3 px-2 py-1 bg-primary text-white text-xs font-medium rounded">
                      OPEN
                    </span>
                  </div>

                  {/* Venue Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                      {venue.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                      {venue.address}
                    </p>

                    <Link
                      href={`/courts/${venue.id}`}
                      className="block w-full text-center py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors"
                    >
                      See Court
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">No venues found</p>
              <button
                onClick={clearFilters}
                className="mt-2 text-primary text-sm hover:underline"
              >
                Clear filters
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

              {/* Amenities */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {amenityOptions.map((amenity) => (
                    <button
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
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

              {/* Places */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Places</h3>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by city or area"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
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

              {/* Amenities */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {amenityOptions.map((amenity) => (
                    <button
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
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
                  onClick={() => setShowFilters(false)}
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
          </div>
        )}
      </div>
    </div>
  )
}
