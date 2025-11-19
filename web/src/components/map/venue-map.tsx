'use client'

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import MarkerClusterGroup from '@changey/react-leaflet-markercluster'
import Link from 'next/link'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

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

  // Default center on Zamboanga City
  const defaultCenter: [number, number] = [6.9214, 122.0790]
  const defaultZoom = 13

  const handleGetLocation = () => {
    setLocationLoading(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude])
          setLocationLoading(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          setLocationLoading(false)
        }
      )
    } else {
      setLocationLoading(false)
    }
  }

  return (
    <>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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

        {/* Venue Markers with Clustering */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={60}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
        >
          {venues.map((venue) => (
          <Marker
            key={venue.id}
            position={[venue.latitude, venue.longitude]}
            icon={createCustomIcon(venue.minPrice)}
            eventHandlers={{
              click: () => setSelectedVenue(venue)
            }}
          >
            <Popup>
              <div className="p-1 min-w-[180px]">
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">{venue.name}</h3>
              <p className="text-xs text-gray-500 mb-2">{venue.address}</p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">
                  {venue.courtCount} court{venue.courtCount !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-medium text-primary">
                  ₱{venue.minPrice}{venue.maxPrice !== venue.minPrice && ` - ₱${venue.maxPrice}`}/hr
                </span>
              </div>
              <Link
                href={`/courts/${venue.id}`}
                className="block w-full text-center py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                View Details
              </Link>
            </div>
          </Popup>
        </Marker>
          ))}
        </MarkerClusterGroup>
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

      {/* Add pulse animation to global styles */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </>
  )
}
