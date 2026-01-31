'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getVenues,
  getCourtAverageRating,
  formatDistance,
  isVenueOpen,
  type VenueFilters,
  type VenueWithDetails,
} from '@/lib/api/venues';
import { createClient } from '@/lib/supabase/client';

// Filter options
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
  'First Aid',
  'WiFi',
  'Canteen',
];

type SortOption = 'distance' | 'price_low' | 'price_high' | 'rating' | 'newest';

export default function CourtsPage() {
  const [venues, setVenues] = useState<VenueWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Filter states
  const [priceRange, setPriceRange] = useState<[number, number]>([100, 1000]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [courtType, setCourtType] = useState<'indoor' | 'outdoor' | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [minRating, setMinRating] = useState<number>(0);
  const [offset, setOffset] = useState(0);
  const [venueRatings, setVenueRatings] = useState<Record<string, { avg: number; count: number }>>(
    {}
  );

  const LIMIT = 12;

  useEffect(() => {
    fetchVenues(true);
  }, [search, priceRange, selectedAmenities, courtType, category, sortBy, minRating, userLocation]);

  const fetchVenues = async (reset: boolean = false) => {
    if (reset) {
      setLoading(true);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    const filters: VenueFilters = {
      searchQuery: search || undefined,
      minPrice: 0,
      maxPrice: priceRange[1],
      amenities: selectedAmenities.length > 0 ? selectedAmenities : undefined,
      category: category || undefined,
      courtType: courtType || undefined,
      rating: minRating > 0 ? minRating : undefined,
      latitude: userLocation?.lat,
      longitude: userLocation?.lng,
      sortBy,
      limit: LIMIT,
      offset: reset ? 0 : offset,
    };

    try {
      const result = await getVenues(filters);

      if (reset) {
        setVenues(result.venues);
        setOffset(LIMIT);
      } else {
        setVenues((prev) => [...prev, ...result.venues]);
        setOffset((prev) => prev + LIMIT);
      }

      setTotal(result.total);
      setHasMore(result.hasMore);

      // Fetch ratings for all courts in batch
      const venueIds = result.venues.map((v) => v.id);
      const ratingsMap: Record<string, { avg: number; count: number }> = {};

      // We need to fetch ratings for each venue's courts
      // Ideally this should be done in the getVenues API but for now we do it here
      const supabase = createClient();
      for (const venue of result.venues) {
        let totalRating = 0;
        let totalCount = 0;

        for (const court of venue.courts) {
          const { averageRating, totalReviews } = await getCourtAverageRating(court.id);
          totalRating += averageRating * totalReviews;
          totalCount += totalReviews;
        }

        ratingsMap[venue.id] = {
          avg: totalCount > 0 ? totalRating / totalCount : 0,
          count: totalCount,
        };
      }

      setVenueRatings((prev) => ({ ...prev, ...ratingsMap }));
    } catch (error) {
      console.error('Error fetching venues:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchVenues(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  const getUserLocation = () => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setSortBy('distance');
        setLocationLoading(false);
      },
      (error) => {
        setLocationError('Unable to retrieve your location');
        setLocationLoading(false);
        console.error('Location error:', error);
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Search Header */}
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative w-full md:w-96">
              <input
                type="text"
                placeholder="Search courts, venues, locations..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-lg focus:ring-2 focus:ring-primary/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border whitespace-nowrap transition-colors ${showFilters
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
                Filters
                {(selectedAmenities.length > 0 ||
                  courtType ||
                  category ||
                  minRating > 0 ||
                  priceRange[1] < 1000) && (
                    <span className="ml-1 bg-red-500 w-2 h-2 rounded-full" />
                  )}
              </button>

              <button
                onClick={getUserLocation}
                disabled={locationLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border whitespace-nowrap transition-colors ${userLocation
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                {locationLoading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    className="w-5 h-5"
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
                )}
                {userLocation ? 'Near Me' : 'Nearby'}
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="newest">Newest</option>
                <option value="rating">Highest Rated</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                {userLocation && <option value="distance">Distance</option>}
              </select>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t animate-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Price Range (₱)</h3>
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    step="50"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([0, Number(e.target.value)])}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>₱0</span>
                    <span>₱{priceRange[1]}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Court Type</h3>
                  <div className="flex gap-2">
                    {['indoor', 'outdoor'].map((type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setCourtType(courtType === type ? null : (type as 'indoor' | 'outdoor'))
                        }
                        className={`px-3 py-1.5 rounded-full text-sm capitalize border ${courtType === type
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Rating</h3>
                  <div className="flex gap-2">
                    {[4, 3, 2].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setMinRating(minRating === rating ? 0 : rating)}
                        className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-1 ${minRating === rating
                          ? 'bg-yellow-50 border-yellow-400 text-yellow-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        <span>{rating}+</span>
                        <svg
                          className="w-3 h-3 text-yellow-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {amenityOptions.slice(0, 6).map((amenity) => (
                      <button
                        key={amenity}
                        onClick={() => toggleAmenity(amenity)}
                        className={`px-2 py-1 rounded text-xs border ${selectedAmenities.includes(amenity)
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        {amenity}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-56 md:h-80 animate-pulse" />
            ))}
          </div>
        ) : venues.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
              {venues.map((venue) => {
                const rating = venueRatings[venue.id];
                const isOpen = isVenueOpen(venue.opening_hours);

                return (
                  <Link
                    key={venue.id}
                    href={`/courts/${venue.id}`}
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all group"
                  >
                    {/* Venue Image */}
                    <div className="h-28 md:h-44 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center relative overflow-hidden">
                      {(() => {
                        // Find first court with an image
                        const coverImage = venue.courts.find(c => c.images && c.images.length > 0)?.images[0]?.url

                        if (coverImage) {
                          return (
                            <img
                              src={coverImage}
                              alt={venue.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )
                        }

                        return (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100">
                            <svg className="w-8 h-8 md:w-12 md:h-12 text-primary/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )
                      })()}

                      {/* Badges - Stacked on mobile */}
                      <div className="absolute top-2 left-2 md:top-3 md:left-3 flex flex-col md:flex-row gap-1 md:gap-2">
                        <span
                          className={`px-1.5 py-0.5 md:px-2.5 md:py-1 text-white text-[10px] md:text-xs font-bold rounded md:rounded-md shadow-sm ${isOpen ? 'bg-green-500' : 'bg-gray-500'
                            }`}
                        >
                          {isOpen ? 'OPEN' : 'CLOSED'}
                        </span>
                        {venue.is_verified && (
                          <span className="px-1.5 py-0.5 md:px-2.5 md:py-1 bg-blue-500 text-white text-[10px] md:text-xs font-bold rounded md:rounded-md shadow-sm">
                            VERIFIED
                          </span>
                        )}
                      </div>

                      {/* Distance Badge (if location available) */}
                      {userLocation && venue.distance !== undefined && (
                        <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 px-1.5 py-0.5 md:px-2 md:py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] md:text-xs rounded md:rounded-md flex items-center gap-1">
                          <svg
                            className="w-3 h-3"
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
                          {formatDistance(venue.distance)}
                        </div>
                      )}
                    </div>

                    {/* Venue Details */}
                    <div className="p-3 md:p-4">
                      <div className="flex justify-between items-start mb-1 md:mb-2">
                        <div>
                          <p className="text-[10px] md:text-xs text-primary font-semibold uppercase tracking-wider mb-0.5 md:mb-1">
                            {venue.category || 'Sports Venue'}
                          </p>
                          <h3 className="font-bold text-sm md:text-lg text-gray-900 line-clamp-1 group-hover:text-primary transition-colors">
                            {venue.name}
                          </h3>
                        </div>
                        {rating && (
                          <div className="flex items-center gap-1 bg-yellow-50 px-1.5 py-0.5 md:px-2 md:py-1 rounded md:rounded-md border border-yellow-100">
                            <span className="font-bold text-xs md:text-sm text-yellow-700">
                              {rating.avg.toFixed(1)}
                            </span>
                            <svg
                              className="w-3 h-3 md:w-4 md:h-4 text-yellow-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center text-gray-500 text-[10px] md:text-sm mb-2 md:mb-3">
                        <svg
                          className="w-3 h-3 md:w-4 md:h-4 mr-1 flex-shrink-0"
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
                        <span className="truncate">{venue.location}</span>
                      </div>

                      <div className="flex items-center justify-between pt-2 md:pt-3 border-t border-gray-100">
                        <div className="flex flex-col">
                          <span className="text-[10px] md:text-xs text-gray-400">Starting from</span>
                          <span className="font-bold text-sm md:text-base text-primary">
                            ₱{Math.min(...venue.courts.map((c) => c.hourly_rate))}
                            <span className="text-[10px] md:text-sm font-normal text-gray-500">
                              /hr
                            </span>
                          </span>
                        </div>
                        <span className="text-[10px] md:text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                          {venue.courts.length} Courts
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Load More Trigger */}
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading more venues...' : 'Load More Venues'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 md:py-20">
            <div className="bg-gray-100 rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 md:w-10 md:h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">No venues found</h3>
            <p className="text-sm md:text-base text-gray-500 max-w-sm mx-auto">
              We couldn't find any venues matching your criteria. Try adjusting your filters or search
              term.
            </p>
            <button
              onClick={() => {
                setSearch('');
                setPriceRange([0, 2000]);
                setSelectedAmenities([]);
                setCourtType(null);
                setCategory(null);
                setSortBy('newest');
                setMinRating(0);
              }}
              className="mt-6 text-primary hover:text-primary/80 font-medium text-sm md:text-base"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
