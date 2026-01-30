'use client'

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Check, X, Navigation } from 'lucide-react'

// Fix for default marker icon not showing
// We use a custom icon instead to avoid issues with webpack/nextjs image imports for leaflet
const createPickerIcon = () => {
    return L.divIcon({
        className: 'picker-marker',
        html: `
      <div style="
        position: relative;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" stroke="#7f1d1d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3" fill="white"></circle>
        </svg>
      </div>
    `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    })
}

function LocationMarker({ position, setPosition }: { position: L.LatLng | null, setPosition: (pos: L.LatLng) => void }) {
    const map = useMapEvents({
        click(e) {
            setPosition(e.latlng)
        },
    })

    // On mount, if we have a position, fly to it
    useEffect(() => {
        if (position) {
            map.flyTo(position, map.getZoom(), {
                animate: true,
                duration: 1
            })
        } else {
            // Default to Zamboanga City if no position
            map.flyTo([6.9214, 122.0790], 13)
        }
    }, [map]) // Run once on mount if we want strict behavior, but running on position change might be annoying if user pans away.
    // Actually, we usually want to center on the marker when it's set initially, but let the user pan afterwards.
    // So we'll skip the dependency on 'position' to avoid locking the view.

    // Initial center hook
    useEffect(() => {
        if (position) {
            map.setView(position, 15)
        }
    }, [])

    return position === null ? null : (
        <Marker position={position} icon={createPickerIcon()} />
    )
}

function LocateControl({ onLocate }: { onLocate: (pos: L.LatLng) => void }) {
    const map = useMap()
    const [loading, setLoading] = useState(false)

    const handleLocate = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setLoading(true)
        map.locate().on("locationfound", function (e) {
            onLocate(e.latlng)
            map.flyTo(e.latlng, map.getZoom())
            setLoading(false)
        }).on("locationerror", function (e) {
            console.error(e)
            setLoading(false)
            alert("Could not access your location")
        })
    }

    return (
        <div className="absolute top-4 right-4 z-[1000]">
            <button
                type="button"
                onClick={handleLocate}
                className="bg-white p-2 rounded-lg shadow-md hover:bg-gray-50 text-gray-700 transition-colors"
                title="Use my location"
            >
                {loading ? (
                    <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                ) : (
                    <Navigation className="w-5 h-5" />
                )}
            </button>
        </div>
    )
}

interface LocationPickerProps {
    initialLatitude?: number
    initialLongitude?: number
    onConfirm: (lat: number, lng: number, address: string) => void
    onCancel: () => void
}

export default function LocationPicker({
    initialLatitude,
    initialLongitude,
    onConfirm,
    onCancel
}: LocationPickerProps) {
    const [position, setPosition] = useState<L.LatLng | null>(
        initialLatitude && initialLongitude
            ? new L.LatLng(initialLatitude, initialLongitude)
            : null
    )
    const [address, setAddress] = useState<string>('')
    const [isFetchingAddress, setIsFetchingAddress] = useState(false)

    // Reverse geocoding effect
    useEffect(() => {
        if (position) {
            const fetchAddress = async () => {
                setIsFetchingAddress(true)
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}`
                    )
                    const data = await response.json()
                    if (data && data.display_name) {
                        setAddress(data.display_name)
                    }
                } catch (error) {
                    console.error('Failed to fetch address:', error)
                    setAddress('Address unavailable')
                } finally {
                    setIsFetchingAddress(false)
                }
            }

            // Debounce the fetch slightly to avoid spamming if user clicks rapidly
            const timeoutId = setTimeout(fetchAddress, 500)
            return () => clearTimeout(timeoutId)
        } else {
            setAddress('')
        }
    }, [position])

    const handleConfirm = () => {
        if (position) {
            onConfirm(position.lat, position.lng, address)
        }
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    Pick Location
                </h3>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="relative flex-1 min-h-[400px]">
                <MapContainer
                    center={position || [6.9214, 122.0790]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationMarker position={position} setPosition={setPosition} />
                    <LocateControl onLocate={setPosition} />
                </MapContainer>

                {/* Helper Text Overlay */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg text-sm font-medium text-gray-700 pointer-events-none transition-opacity duration-300">
                    {isFetchingAddress ? 'Fetching address...' : 'Tap anywhere on the map to set location'}
                </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">Selected Location</p>
                    {position ? (
                        <div>
                            <p className="text-sm font-medium text-gray-900 truncate" title={address}>
                                {address || `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`}
                            </p>
                            {address && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Lat: {position.lat.toFixed(6)}, Lng: {position.lng.toFixed(6)}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic">No location selected</p>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!position}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Check className="w-4 h-4" />
                        Confirm Location
                    </button>
                </div>
            </div>
        </div>
    )
}
