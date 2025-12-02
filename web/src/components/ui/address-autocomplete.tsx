'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Loader2, X } from 'lucide-react'

interface PlaceResult {
  address: string
  city: string
  latitude: number
  longitude: number
}

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string) => void
  onPlaceSelect?: (place: PlaceResult) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

declare global {
  interface Window {
    google?: typeof google
    initGooglePlaces?: () => void
  }
}

// Singleton to track if script is loading/loaded
let isScriptLoading = false
let isScriptLoaded = false

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Enter address',
  className = '',
  disabled = false
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) return

    try {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ['address'],
          componentRestrictions: { country: 'ph' }, // Restrict to Philippines
          fields: ['address_components', 'geometry', 'formatted_address']
        }
      )

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace()
        
        if (!place?.geometry?.location) {
          console.warn('No location data for selected place')
          return
        }

        const latitude = place.geometry.location.lat()
        const longitude = place.geometry.location.lng()
        const formattedAddress = place.formatted_address || ''

        // Extract city from address components
        // Philippines addresses may use different component types
        let city = ''
        if (place.address_components) {
          for (const component of place.address_components) {
            // Try different types that could represent the city
            if (component.types.includes('locality')) {
              city = component.long_name
              break
            } else if (component.types.includes('administrative_area_level_2') && !city) {
              city = component.long_name
            } else if (component.types.includes('administrative_area_level_1') && !city) {
              // Fallback to province/region if no city found
              city = component.long_name
            } else if (component.types.includes('sublocality_level_1') && !city) {
              city = component.long_name
            }
          }
        }

        // Log for debugging
        console.log('🔍 Place selected:', { formattedAddress, city, latitude, longitude })

        onChange(formattedAddress)
        onPlaceSelect?.({
          address: formattedAddress,
          city,
          latitude,
          longitude
        })
      })

      setError(null)
    } catch (err) {
      console.error('Error initializing autocomplete:', err)
      setError('Failed to initialize address autocomplete')
    }
  }, [onChange, onPlaceSelect])

  const loadGoogleScript = useCallback(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      setError('Google Maps API key not configured')
      return
    }

    if (isScriptLoaded && window.google?.maps?.places) {
      initAutocomplete()
      return
    }

    if (isScriptLoading) {
      // Wait for script to load
      const checkInterval = setInterval(() => {
        if (isScriptLoaded && window.google?.maps?.places) {
          clearInterval(checkInterval)
          initAutocomplete()
        }
      }, 100)
      return
    }

    isScriptLoading = true
    setIsLoading(true)

    const script = document.createElement('script')
    // Use the legacy places library - requires "Places API" to be enabled in Google Cloud Console
    // NOT "Places API (New)" - they are different APIs
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
    script.async = true
    script.defer = true

    script.onload = () => {
      isScriptLoaded = true
      isScriptLoading = false
      setIsLoading(false)
      initAutocomplete()
    }

    script.onerror = () => {
      isScriptLoading = false
      setIsLoading(false)
      setError('Failed to load Google Maps')
    }

    document.head.appendChild(script)
  }, [initAutocomplete])

  useEffect(() => {
    loadGoogleScript()

    return () => {
      // Cleanup autocomplete listener
      if (autocompleteRef.current && window.google?.maps?.event) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [loadGoogleScript])

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  if (error && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    // Fallback to simple text input if API key not configured
    return (
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <MapPin className="w-4 h-4 text-gray-400" />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${className}`}
        />
        <p className="mt-1 text-xs text-amber-600">
          Address autocomplete unavailable. Enter address manually.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        ) : (
          <MapPin className="w-4 h-4 text-gray-400" />
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        className={`w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
