'use client'

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatDistanceMetric } from '@rallio/shared'
import 'leaflet/dist/leaflet.css'

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

interface VenueMapProps {
  venues: Venue[]
}

// Custom marker icon
const createCustomIcon = (price: number) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: #4A9B8E;
        color: white;
        padding: 4px 8px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        white-space: nowrap;
      ">
        ₱${price}
      </div>
      <div style="
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid #4A9B8E;
        margin: 0 auto;
      "></div>
    `,
    iconSize: [50, 30],
    iconAnchor: [25, 30],
    popupAnchor: [0, -30]
  })
}

// Create user location icon (blue dot)
const createUserLocationIcon = () => {
  return L.divIcon({
    className: 'user-location-marker',
    html: `
      <div style="
        position: relative;
      ">
        <div style="
          width: 20px;
          height: 20px;
          background-color: #3B82F6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background-color: rgba(59, 130, 246, 0.2);
          border-radius: 50%;
          animation: pulse 2s infinite;
        "></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  })
}

// Helper function to check if venue is currently open
function isVenueOpen(openingHours: Record<string, { open: string; close: string }> | null | undefined): boolean {
  if (!openingHours) return false

  const now = new Date()
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const currentTime = format(now, 'HH:mm')

  const todayHours = openingHours[dayOfWeek]
  if (!todayHours) return false

  return currentTime >= todayHours.open && currentTime <= todayHours.close
}

// Helper function to format distance (converts km to meters for shared utility)
function formatDistance(distance?: number): string {
  if (!distance) return ''
  return formatDistanceMetric(distance * 1000) // Convert km to meters
}

// Component to fit map bounds to all markers
function FitBounds({ venues, userLocation }: { venues: Venue[]; userLocation: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (venues.length === 0) return

    const bounds = L.latLngBounds([])
    venues.forEach(venue => {
      bounds.extend([venue.latitude, venue.longitude])
    })
    if (userLocation) {
      bounds.extend(userLocation)
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }
  }, [venues, userLocation, map])

  return null
}

export default function VenueMap({ venues }: VenueMapProps) {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  // Default center on Zamboanga City
  const defaultCenter: [number, number] = [6.9214, 122.0790]
  const defaultZoom = 13

  // Validate venues data
  if (!Array.isArray(venues)) {
    console.error('Venues is not an array:', venues)
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-8">
          <p className="text-red-600 font-medium">Error loading map data</p>
          <p className="text-sm text-gray-600 mt-2">Invalid venues data format</p>
        </div>
      </div>
    )
  }

  const handleGetLocation = () => {
    setLocationLoading(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude])
          setLocationLoading(false)
        },
        (error: GeolocationPositionError) => {
          const errorMessages: Record<number, string> = {
            1: 'Location permission denied',
            2: 'Position unavailable',
            3: 'Location request timed out'
          }
          console.warn('Geolocation unavailable:', errorMessages[error.code] || error.message)
          setLocationLoading(false)
        }
      )
    } else {
      setLocationLoading(false)
    }
  }

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center p-8">
          <p className="text-red-600 font-medium">Error loading map</p>
          <p className="text-sm text-gray-600 mt-2">{mapError}</p>
          <button
            onClick={() => {
              setMapError(null)
              window.location.reload()
            }}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Reload Map
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
        zoomControl={true}
        whenReady={() => console.log('Map is ready')}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            tileerror: () => setMapError('Failed to load map tiles')
          }}
        />

        <FitBounds venues={venues} userLocation={userLocation} />

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={createUserLocationIcon()}>
            <Popup>
              <div className="p-1">
                <p className="text-sm font-medium text-gray-900">Your Location</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Venue Markers */}
        {venues.map((venue) => (
          <Marker
            key={venue.id}
            position={[venue.latitude, venue.longitude]}
            icon={createCustomIcon(venue.minPrice)}
            eventHandlers={{
              click: () => setSelectedVenue(venue)
            }}
          >
            <Popup maxWidth={280} minWidth={240}>
              <div className="p-2">
                {/* Venue Name */}
                <h3 className="font-semibold text-gray-900 mb-1 text-base leading-tight">
                  {venue.name}
                </h3>

                {/* Rating and Status Row */}
                <div className="flex items-center justify-between mb-2">
                  {venue.averageRating && venue.totalReviews ? (
                    <div className="flex items-center gap-1">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-3.5 h-3.5 ${i < Math.round(venue.averageRating!)
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-gray-300 fill-gray-300'
                              }`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-xs text-gray-600 ml-0.5">
                        {venue.averageRating.toFixed(1)} ({venue.totalReviews})
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">No reviews</span>
                  )}

                  {venue.opening_hours && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isVenueOpen(venue.opening_hours)
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                      {isVenueOpen(venue.opening_hours) ? 'Open Now' : 'Closed'}
                    </span>
                  )}
                </div>

                {/* Address */}
                <p className="text-xs text-gray-500 mb-2 line-clamp-1">{venue.address}</p>

                {/* Courts and Price */}
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>{venue.courtCount} court{venue.courtCount !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    ₱{venue.minPrice}{venue.maxPrice !== venue.minPrice && `-${venue.maxPrice}`}/hr
                  </span>
                </div>

                {/* Distance (if available) */}
                {venue.distance && (
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{formatDistance(venue.distance)} away</span>
                  </div>
                )}

                {/* Amenities (show first 3) */}
                {venue.amenities && venue.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {venue.amenities.slice(0, 3).map((amenity) => (
                      <span
                        key={amenity}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {amenity}
                      </span>
                    ))}
                    {venue.amenities.length > 3 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        +{venue.amenities.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Link
                    href={`/courts/${venue.id}`}
                    className="flex-1 text-center py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    View Details
                  </Link>
                  <a
                    href={`https://maps.google.com/?daddr=${venue.latitude},${venue.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Get Directions"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Control Buttons */}
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        <button
          onClick={handleGetLocation}
          disabled={locationLoading}
          className="bg-white text-gray-700 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            {userLocation ? 'Update Location' : 'My Location'}
          </span>
        </button>
      </div>
    </div>
  )
}
