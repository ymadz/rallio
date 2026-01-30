'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { searchNearby, formatDistance, isVenueOpen } from '@/lib/api/venues';
import type { VenueWithDetails } from '@/lib/api/venues';
import { Spinner } from '@/components/ui/spinner';

export function NearbyVenues() {
  const [venues, setVenues] = useState<VenueWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    const fetchNearbyVenues = async () => {
      try {
        // Get user's current location
        if (!navigator.geolocation) {
          setError('Geolocation is not supported by your browser');
          setIsLoading(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;

            try {
              // Fetch venues near the user (within 10km)
              const nearbyVenues = await searchNearby(latitude, longitude, 10, 4);
              setVenues(nearbyVenues);
            } catch (err) {
              console.error('Error fetching nearby venues:', err);
              setError('Failed to load nearby venues');
            } finally {
              setIsLoading(false);
            }
          },
          (error) => {
            setLocationDenied(true);
            setIsLoading(false);

            if (process.env.NODE_ENV !== 'production') {
              console.error('Geolocation error:', error);
            }
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000, // Cache position for 5 minutes
          }
        );
      } catch (err) {
        console.error('Error in fetchNearbyVenues:', err);
        setError('Failed to load nearby venues');
        setIsLoading(false);
      }
    };

    fetchNearbyVenues();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-100 rounded-xl overflow-hidden animate-pulse">
            <div className="h-24 bg-gray-200" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-8 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (locationDenied) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <svg
          className="w-12 h-12 text-gray-400 mx-auto mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <h3 className="font-medium text-gray-900 mb-1">Location Access Required</h3>
        <p className="text-sm text-gray-500 mb-3">Enable location access to see courts near you</p>
        <Link
          href="/courts"
          className="inline-block text-sm font-medium text-primary hover:text-primary/80"
        >
          Browse All Courts
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500">No courts found near you</p>
        <Link
          href="/courts"
          className="inline-block mt-2 text-sm font-medium text-primary hover:text-primary/80"
        >
          Browse All Courts
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {venues.slice(0, 4).map((venue) => {
        const isOpen = isVenueOpen(venue.opening_hours);
        const primaryImage = venue.courts?.[0]?.images?.find((img) => img.is_primary);
        const imageUrl = primaryImage?.url || venue.courts?.[0]?.images?.[0]?.url;

        return (
          <div
            key={venue.id}
            className="bg-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="relative h-24 bg-gray-200 flex items-center justify-center">
              {imageUrl ? (
                <img src={imageUrl} alt={venue.name} className="w-full h-full object-cover" />
              ) : (
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              )}
              {isOpen !== null && (
                <span
                  className={`absolute top-2 right-2 ${isOpen ? 'bg-primary' : 'bg-gray-500'
                    } text-white text-[10px] px-2 py-0.5 rounded font-medium`}
                >
                  {isOpen ? 'OPEN' : 'CLOSED'}
                </span>
              )}
            </div>
            <div className="p-3">
              <h3 className="font-medium text-sm text-gray-900 truncate">{venue.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{venue.address}</p>
              {venue.distance !== undefined && (
                <p className="text-xs text-primary font-medium mt-1">
                  {formatDistance(venue.distance)} away
                </p>
              )}
              <Link
                href={`/courts/${venue.id}`}
                className="mt-3 block text-center border border-gray-300 text-gray-700 text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                See Court
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
