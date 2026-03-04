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

// Custom marker icon – modern teardrop pin
const createCustomIcon = (price: number) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="vm-pin">
        <div class="vm-pin-body">
          <span class="vm-pin-price">₱${price}</span>
        </div>
        <div class="vm-pin-tail"></div>
      </div>
    `,
    iconSize: [52, 58],
    iconAnchor: [26, 58],
    popupAnchor: [0, -54]
  })
}

// Create user location icon (teal dot)
const createUserLocationIcon = () => {
  return L.divIcon({
    className: 'user-location-marker',
    html: `
      <div class="vm-user-loc">
        <div class="vm-user-ring"></div>
        <div class="vm-user-dot"></div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
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
      {/* ── Map Pin & Popup Styles ── */}
      <style>{`
        /* Pin: teardrop shape */
        .vm-pin { display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.28)); }
        .vm-pin-body {
          background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
          color: #fff;
          padding: 5px 10px;
          border-radius: 10px;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
          white-space: nowrap;
          border: 1.5px solid rgba(255,255,255,0.35);
          line-height: 1;
        }
        .vm-pin-tail {
          width: 0; height: 0;
          border-left: 7px solid transparent;
          border-right: 7px solid transparent;
          border-top: 8px solid #0f766e;
          margin-top: -1px;
        }
        .vm-pin:hover .vm-pin-body { background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%); }
        .vm-pin:hover .vm-pin-tail { border-top-color: #0d9488; }

        /* User location dot */
        .vm-user-loc { position: relative; width: 44px; height: 44px; }
        .vm-user-dot {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 16px; height: 16px;
          background: linear-gradient(135deg, #14b8a6, #0d9488);
          border: 2.5px solid #fff;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(13,148,136,0.45);
          z-index: 2;
        }
        .vm-user-ring {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 38px; height: 38px;
          border-radius: 50%;
          background: rgba(13,148,136,0.15);
          border: 1.5px solid rgba(13,148,136,0.25);
          animation: vm-pulse 2.2s ease-out infinite;
        }
        @keyframes vm-pulse {
          0%   { transform: translate(-50%,-50%) scale(0.7); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0; }
        }

        /* Leaflet popup overrides – modern floating card */
        .leaflet-popup-content-wrapper {
          border-radius: 16px !important;
          padding: 0 !important;
          box-shadow:
            0 4px 6px -1px rgba(0,0,0,0.06),
            0 10px 30px -5px rgba(0,0,0,0.12),
            0 20px 60px -10px rgba(0,0,0,0.08) !important;
          border: 1px solid rgba(0,0,0,0.06) !important;
          overflow: hidden;
          width: 50% !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          width: 100% !important;
          font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .leaflet-popup-tip {
          background: #fff !important;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08) !important;
        }
        .leaflet-popup-close-button {
          top: 10px !important; right: 10px !important;
          color: #fff !important;
          font-size: 20px !important;
          font-weight: 700 !important;
          z-index: 10;
          text-shadow: 0 1px 4px rgba(0,0,0,0.35);
          width: 24px !important; height: 24px !important;
          line-height: 24px !important;
        }

        /* Popup inner card */
        .vm-popup {
          font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .vm-popup-header {
          background: linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%);
          padding: 16px 20px 14px;
          position: relative;
        }
        .vm-popup-name {
          font-size: 1rem;
          font-weight: 800;
          color: #fff;
          line-height: 1.3;
          margin: 0;
          letter-spacing: -0.02em;
          text-shadow: 0 1px 4px rgba(0,0,0,0.18);
        }
        .vm-popup-addr {
          font-size: 0.75rem;
          font-weight: 500;
          color: rgba(255,255,255,0.80);
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: 0.01em;
        }
        .vm-popup-body {
          padding: 16px 20px 20px;
          background: #fff;
        }

        .vm-popup-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .vm-popup-rating {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.78rem;
          font-weight: 600;
          color: #374151;
        }
        .vm-popup-stars { display: inline-flex; gap: 1.5px; }
        .vm-popup-stars svg { width: 14px; height: 14px; }

        /* Pill-shaped badge */
        .vm-popup-status {
          font-size: 0.68rem;
          font-weight: 800;
          padding: 4px 12px;
          border-radius: 999px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          line-height: 1;
        }
        .vm-popup-status-open {
          background: #059669;
          color: #fff;
          box-shadow: 0 1px 4px rgba(5,150,105,0.30);
        }
        .vm-popup-status-closed {
          background: #6b7280;
          color: #fff;
          box-shadow: 0 1px 4px rgba(107,114,128,0.25);
        }

        .vm-popup-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 500;
          color: #4b5563;
        }
        .vm-popup-meta svg { width: 15px; height: 15px; color: #6b7280; flex-shrink: 0; }
        .vm-popup-price {
          font-size: 0.95rem;
          font-weight: 800;
          color: #0d9488;
          letter-spacing: -0.01em;
        }
        .vm-popup-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, #e5e7eb, transparent);
          margin: 12px 0;
        }
        .vm-popup-amenities {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 14px;
        }
        .vm-popup-amenity {
          font-size: 0.68rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 8px;
          background: rgba(13,148,136,0.07);
          color: #0f766e;
          border: 1px solid rgba(13,148,136,0.12);
          letter-spacing: 0.01em;
        }

        .vm-popup-actions { display: flex; gap: 8px; }
        .vm-popup-btn-primary {
          flex: 1;
          text-align: center;
          padding: 10px 0;
          background: #0d9488;
          color: #fff !important;
          border-radius: 12px;
          font-size: 0.82rem;
          font-weight: 700;
          text-decoration: none;
          letter-spacing: 0.01em;
          box-shadow: 0 2px 8px rgba(5,150,105,0.30);
          transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
        }
        .vm-popup-btn-primary:hover {
          background: #047857;
          box-shadow: 0 4px 14px rgba(5,150,105,0.35);
          transform: translateY(-1px);
          color: #fff;
        }
        .vm-popup-btn-dir {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          color: #374151;
          transition: background 0.18s ease, border-color 0.18s ease;
          text-decoration: none;
        }
        .vm-popup-btn-dir:hover {
          background: #e5e7eb;
          border-color: #d1d5db;
        }
        .vm-popup-btn-dir svg { width: 17px; height: 17px; }
      `}</style>

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
              <div className="vm-popup">
                <div className="vm-popup-header" style={{ padding: '14px 20px' }}>
                  <p className="vm-popup-name" style={{ fontSize: '0.85rem' }}>Your Location</p>
                </div>
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
            <Popup maxWidth={240} minWidth={200}>
              <div className="vm-popup">
                {/* Header */}
                <div className="vm-popup-header">
                  <h3 className="vm-popup-name">{venue.name}</h3>
                  <p className="vm-popup-addr">{venue.address}</p>
                </div>

                {/* Body */}
                <div className="vm-popup-body">
                  {/* Rating + Status */}
                  <div className="vm-popup-row">
                    {venue.averageRating && venue.totalReviews ? (
                      <div className="vm-popup-rating">
                        <span className="vm-popup-stars">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              viewBox="0 0 20 20"
                              fill={i < Math.round(venue.averageRating!) ? '#facc15' : '#e5e7eb'}
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </span>
                        <span>{venue.averageRating.toFixed(1)} ({venue.totalReviews})</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>No reviews yet</span>
                    )}

                    {venue.opening_hours && (
                      <span className={`vm-popup-status ${isVenueOpen(venue.opening_hours) ? 'vm-popup-status-open' : 'vm-popup-status-closed'}`}>
                        {isVenueOpen(venue.opening_hours) ? 'Open' : 'Closed'}
                      </span>
                    )}
                  </div>

                  {/* Courts + Price */}
                  <div className="vm-popup-row">
                    <div className="vm-popup-meta">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{venue.courtCount} court{venue.courtCount !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="vm-popup-price">
                      ₱{venue.minPrice}{venue.maxPrice !== venue.minPrice && `–${venue.maxPrice}`}/hr
                    </span>
                  </div>

                  {/* Distance */}
                  {venue.distance && (
                    <div className="vm-popup-meta" style={{ marginBottom: 6 }}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{formatDistance(venue.distance)} away</span>
                    </div>
                  )}

                  {/* Amenities */}
                  {venue.amenities && venue.amenities.length > 0 && (
                    <>
                      <div className="vm-popup-divider" />
                      <div className="vm-popup-amenities">
                        {venue.amenities.slice(0, 3).map((amenity) => (
                          <span key={amenity} className="vm-popup-amenity">{amenity}</span>
                        ))}
                        {venue.amenities.length > 3 && (
                          <span className="vm-popup-amenity">+{venue.amenities.length - 3}</span>
                        )}
                      </div>
                    </>
                  )}

                  <div className="vm-popup-divider" />

                  {/* Actions */}
                  <div className="vm-popup-actions">
                    <Link href={`/courts/${venue.id}`} className="vm-popup-btn-primary">
                      View Details
                    </Link>
                    <a
                      href={`https://maps.google.com/?daddr=${venue.latitude},${venue.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vm-popup-btn-dir"
                      title="Directions"
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </a>
                  </div>
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
          className="bg-white/90 backdrop-blur-sm text-gray-700 px-4 py-2.5 rounded-xl shadow-lg hover:bg-white transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200/60"
        >
          {locationLoading ? (
            <svg className="animate-spin w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
          <span className="text-sm font-semibold text-gray-700">
            {userLocation ? 'Update Location' : 'My Location'}
          </span>
        </button>
      </div>
    </div>
  )
}
