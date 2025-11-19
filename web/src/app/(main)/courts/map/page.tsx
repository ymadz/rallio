'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'

interface Venue {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  courtCount: number
  minPrice: number
  maxPrice: number
}

// Dynamically import the map component to avoid SSR issues with Leaflet
const MapComponent = dynamic(
  () => import('@/components/map/venue-map'),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
)

export default function MapViewPage() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)

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
        latitude,
        longitude,
        courts(
          id,
          hourly_rate,
          is_active
        )
      `)
      .eq('is_active', true)

    if (!error && data) {
      const transformedData = data.map(venue => {
        const activeCourts = venue.courts?.filter((c: any) => c.is_active) || []
        const prices = activeCourts.map((c: any) => c.hourly_rate).filter(Boolean)
        return {
          id: venue.id,
          name: venue.name,
          address: venue.address || '',
          latitude: venue.latitude || 0,
          longitude: venue.longitude || 0,
          courtCount: activeCourts.length,
          minPrice: prices.length > 0 ? Math.min(...prices) : 0,
          maxPrice: prices.length > 0 ? Math.max(...prices) : 0
        }
      }).filter(v => v.latitude && v.longitude)

      setVenues(transformedData)
    } else if (error) {
      console.error('Error fetching venues:', error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/courts" className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Map</h1>
            <p className="text-xs text-gray-500">Showing Courts in Zamboanga</p>
          </div>
        </div>
        <span className="text-sm text-gray-500">{venues.length} results</span>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <MapComponent venues={venues} />
        )}

        {/* List Toggle Button */}
        <Link
          href="/courts"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white text-gray-900 px-6 py-3 rounded-full shadow-lg flex items-center gap-2 hover:bg-gray-50 transition-colors z-[1000]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <span className="font-medium">List View</span>
        </Link>
      </div>
    </div>
  )
}
