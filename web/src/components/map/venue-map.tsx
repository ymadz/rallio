'use client'

import { useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'
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

export default function VenueMap({ venues }: VenueMapProps) {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)

  // Default center on Zamboanga City
  const defaultCenter: [number, number] = [6.9214, 122.0790]
  const defaultZoom = 13

  return (
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
    </MapContainer>
  )
}
