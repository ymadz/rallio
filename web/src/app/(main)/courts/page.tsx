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
import { useAuthStore } from '@/stores/auth-store';
import { Sparkles } from 'lucide-react';

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
  const [fetchError, setFetchError] = useState(false);
  const { user } = useAuthStore();
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
      setFetchError(false);
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
      let targetVenues = result.venues;

      if (reset) {
        let finalVenues = result.venues;

        // Only inject recommendations on the default un-filtered feed!
        const isDefaultFeed = !search && !category && !courtType && minRating === 0 && selectedAmenities.length === 0;

        if (isDefaultFeed) {
          // Fetch ML Recommendations to inject at the top of the grid
          try {
            // Temporarily hardcode for demo exactly like RecommendedCourts
            const testUserId = user?.id || '85ac56b1-fd7a-4f63-9d29-b01bcde1dcd0';
            const recRes = await fetch(`/api/recommendations/${testUserId}`);

            if (recRes.ok) {
              const recommendedData = await recRes.json();
              if (Array.isArray(recommendedData) && recommendedData.length > 0) {
                // Deduplicate multiple recommended courts belonging to the same venue
                const uniqueVenuesMap = new Map();
                recommendedData.forEach((court: any) => {
                  const vId = court.venue?.id || court.venue_id;
                  if (vId && !uniqueVenuesMap.has(vId)) {
                    uniqueVenuesMap.set(vId, court);
                  }
                });

                // Convert raw courts from ML response back into VenueWithDetails format
                // so the standard grid can render them seamlessly
                const recVenues: VenueWithDetails[] = Array.from(uniqueVenuesMap.values()).map((court: any) => {
                  const venueObj = court.venue || {};

                  return {
                    id: venueObj.id || court.venue_id, // Use actual venue ID for /courts/{id} routing!
                    name: venueObj.name || court.venue_name || 'Recommended Venue',
                    description: venueObj.description || null,
                    address: venueObj.address || '',
                    city: venueObj.city || '',
                    latitude: venueObj.latitude || 0,
                    longitude: venueObj.longitude || 0,
                    phone: null,
                    email: null,
                    website: null,
                    opening_hours: null,
                    is_active: true,
                    is_verified: true,
                    metadata: null,
                    created_at: new Date().toISOString(),
                    courts: [court],
                    minPrice: court.hourly_rate || 0,
                    maxPrice: court.hourly_rate || 0,
                    totalCourts: 1,
                    activeCourtCount: 1,
                    amenities: court.amenities || [],
                    averageRating: court.average_rating,
                    totalReviews: court.review_count || 0,
                    category: 'Recommended for You',
                    location: venueObj.city || venueObj.address,
                    image_url: court.images?.[0]?.url || venueObj.image_url || null,
                    is_ml_recommendation: true // The flag for the sparkbadge!
                  };
                });

                // Push the raw ML data into the main generic UI list!
                // Filter out duplicates from finalVenues to avoid React key collisions
                const recVenueIds = new Set(recVenues.map(v => v.id));
                finalVenues = [
                  ...recVenues,
                  ...finalVenues.filter((v: any) => !recVenueIds.has(v.id))
                ];
              }
            }
          } catch (e) {
            console.error('Failed to load inline recommendations', e);
          }
        } // Close isDefaultFeed block!

        targetVenues = finalVenues;
        setVenues(finalVenues);
        setOffset(LIMIT);
      } else {
        setVenues((prev) => [...prev, ...result.venues]);
        setOffset((prev) => prev + LIMIT);
      }

      setTotal(result.total);
      setHasMore(result.hasMore);

      // Use the averageRating and totalReviews that is already calculated efficiently by the getVenues API
      const ratingsMap: Record<string, { avg: number; count: number }> = {};

      for (const venue of targetVenues) {
        ratingsMap[venue.id] = {
          avg: venue.averageRating || 0,
          count: venue.totalReviews || 0,
        };
      }

      setVenueRatings((prev) => ({ ...prev, ...ratingsMap }));
    } catch (error) {
      console.error('Error fetching venues:', error);
      setFetchError(true);
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
      <header className="bg-white border-b border-gray-200 sticky top-[81px] z-10 shadow-sm">
        <div className="container mx-auto px-4 pt-4 pb-3 md:pt-4 md:pb-4">
          <div className="flex items-center justify-between mb-3 md:mb-0">
            {/* Mobile Title */}


            {/* Desktop: Search Bar inline */}
            <div className="hidden md:flex flex-1 max-w-md relative mr-4">
              <input
                type="text"
                placeholder="Search courts, venues, locations..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
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

            {/* Results Count - Desktop */}
            <span className="text-sm text-gray-600 hidden md:block mr-4 whitespace-nowrap">
              {total} {total === 1 ? 'result' : 'results'} found
            </span>

            {/* Right Side Actions - Desktop */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border whitespace-nowrap transition-colors ${showFilters
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border whitespace-nowrap transition-colors ${userLocation
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
                <span className="text-sm font-medium">{userLocation ? 'Near Me' : 'Nearby'}</span>
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="newest">Newest</option>
                <option value="rating">Highest Rated</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                {userLocation && <option value="distance">Distance</option>}
              </select>

              {/* View Toggle */}
              <div className="flex rounded-lg border border-gray-300 overflow-hidden bg-white shrink-0">
                <button
                  className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 bg-primary text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span>List</span>
                </button>
                <Link
                  href="/courts/map"
                  className="px-4 py-2.5 text-sm font-medium flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50 transition-colors border-l border-gray-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span>Map</span>
                </Link>
              </div>
            </div>

            {/* Mobile: Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`md:hidden flex items-center justify-center w-10 h-10 rounded-full transition-colors ${showFilters
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>

          {/* Mobile: Search Bar */}
          <div className="md:hidden flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search courts..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
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
          </div>
        </div>

        {/* Mobile: View Toggle & Results */}
        <div className="md:hidden overflow-x-auto scrollbar-hide border-t border-gray-100">
          <div className="flex items-center gap-2 px-4 py-2.5 min-w-max">
            {/* View Toggle - Mobile */}
            <Link
              href="/courts"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </Link>
            <Link
              href="/courts/map"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Map
            </Link>

            {/* Results count - Mobile */}
            <span className="text-xs text-gray-500 ml-auto pl-2">
              {total} found
            </span>
          </div>
        </div>

        {/* Expanded Filters Panel */}
        {showFilters && (
          <div className="container mx-auto px-4 pb-4 border-t animate-in slide-in-from-top-2">
            <div className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* ML Recommendations are now injected directly into the venues grid via state */}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl animate-pulse" style={{ height: 280, background: 'linear-gradient(135deg, #dde4e2, #ccfbf1)' }} />
            ))}
          </div>
        ) : venues.length > 0 ? (
          <>
            <style>{`
            .cv-card {
              position: relative;
              border-radius: 1rem;
              overflow: hidden;
              border: 1px solid rgba(13,148,136,0.18);
              box-shadow: none;
              text-decoration: none;
              display: block;
              height: 260px;
              background: linear-gradient(135deg, #ccfbf1 0%, #d1fae5 100%);
              transition: transform 0.30s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.30s ease;
            }
            .cv-card .cv-badges { transition: opacity 0.25s ease; }
            .cv-card:hover .cv-badges { opacity: 0; }
            @media (min-width: 768px) { .cv-card { height: 300px; } }
            .cv-card:hover {
              transform: translateY(-4px) scale(1.012);
              box-shadow: 0 2px 6px rgba(0,0,0,0.08), 0 8px 28px rgba(13,148,136,0.18), 0 16px 48px rgba(0,0,0,0.10);
            }
            .cv-card-img {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
              transition: transform 0.40s cubic-bezier(0.34,1.56,0.64,1);
            }
            .cv-card:hover .cv-card-img { transform: scale(1.06); }
            .cv-card-placeholder {
              position: absolute;
              inset: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background: linear-gradient(135deg, #ccfbf1 0%, #a7f3d0 100%);
            }
            .cv-fog-gradient {
              position: absolute;
              left: 0; right: 0; bottom: 0;
              height: 60%;
              pointer-events: none;
              z-index: 2;
              background: linear-gradient(to bottom, transparent 0%, rgba(5,46,40,0.20) 25%, rgba(5,46,40,0.62) 60%, rgba(5,46,40,0.84) 100%);
              transition: opacity 0.25s ease;
            }
            .cv-card:hover .cv-fog-gradient { opacity: 0; }
            .cv-fog-blur {
              position: absolute;
              left: 0; right: 0; bottom: 0;
              height: 42%;
              pointer-events: none;
              z-index: 3;
              backdrop-filter: blur(16px) saturate(1.4);
              -webkit-backdrop-filter: blur(16px) saturate(1.4);
              mask-image: linear-gradient(to bottom, transparent 0%, black 55%);
              -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 55%);
              transition: opacity 0.25s ease;
            }
            .cv-card:hover .cv-fog-blur { opacity: 0; }
            .cv-content {
              position: absolute;
              left: 0; right: 0; bottom: 0;
              z-index: 5;
              padding: 0.75rem;
              transition: opacity 0.25s ease;
            }
            .cv-card:hover .cv-content { opacity: 0; }
            @media (min-width: 768px) { .cv-content { padding: 1rem; } }
            .cv-category {
              font-size: 0.6rem;
              font-weight: 700;
              color: rgba(153,246,228,0.85);
              text-transform: uppercase;
              letter-spacing: 0.06em;
              margin-bottom: 2px;
            }
            @media (min-width: 768px) { .cv-category { font-size: 0.7rem; } }
            .cv-name {
              font-size: 0.875rem;
              font-weight: 700;
              color: #fff;
              line-height: 1.25;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              letter-spacing: -0.01em;
              text-shadow: 0 1px 4px rgba(0,0,0,0.40);
              margin-bottom: 3px;
            }
            @media (min-width: 768px) { .cv-name { font-size: 1.05rem; } }
            .cv-location {
              font-size: 0.6875rem;
              color: rgba(204,251,241,0.80);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              margin-bottom: 6px;
            }
            .cv-footer {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-top: 6px;
              border-top: 1px solid rgba(255,255,255,0.15);
            }
            .cv-price-label { font-size: 0.6rem; color: rgba(204,251,241,0.65); }
            .cv-price {
              font-size: 0.875rem;
              font-weight: 700;
              color: #fff;
            }
            .cv-price-sub { font-size: 0.65rem; font-weight: 400; color: rgba(255,255,255,0.65); }
            .cv-courts-pill {
              font-size: 0.625rem;
              font-weight: 700;
              color: rgba(255,255,255,0.85);
              background: rgba(255,255,255,0.14);
              border: 1px solid rgba(255,255,255,0.22);
              padding: 3px 8px;
              border-radius: 999px;
              backdrop-filter: blur(8px);
            }
            .cv-rating-pill {
              display: inline-flex;
              align-items: center;
              gap: 3px;
              background: rgba(0,0,0,0.30);
              backdrop-filter: blur(8px);
              border: 1px solid rgba(255,255,255,0.18);
              padding: 3px 7px;
              border-radius: 999px;
              font-size: 0.6875rem;
              font-weight: 700;
              color: #fde68a;
            }
          `}</style>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">

              {venues.map((venue) => {
                const rating = venueRatings[venue.id];
                const isOpen = isVenueOpen(venue.opening_hours);
                const validRates = venue.courts
                  .map(c => c.hourly_rate)
                  .filter(rate => typeof rate === 'number' && !isNaN(rate) && rate > 0);
                const minPrice = validRates.length > 0 ? Math.min(...validRates) : null;

                return (
                  <Link
                    key={venue.id}
                    href={`/courts/${venue.id}`}
                    className="cv-card"
                  >
                    {/* Full-bleed image */}
                    {(() => {
                      const imgSrc = venue.image_url || venue.courts.find(c => c.images && c.images.length > 0)?.images[0]?.url;
                      return imgSrc
                        ? <img src={imgSrc} alt={venue.name} className="cv-card-img" />
                        : (
                          <div className="cv-card-placeholder">
                            <svg style={{ width: 36, height: 36, color: '#0d9488', opacity: 0.35 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        );
                    })()}

                    {/* Fog layers */}
                    <div className="cv-fog-gradient" />
                    <div className="cv-fog-blur" />

                    {/* Badges (fade out on hover) */}
                    <div className="cv-badges">
                      {/* Top-left badges */}
                      <div className="absolute top-2 left-2 md:top-3 md:left-3 flex flex-col gap-1" style={{ zIndex: 6 }}>
                      {(venue as any).is_ml_recommendation && (
                        <span className="px-2 py-0.5 md:px-2.5 md:py-1 bg-amber-500/90 text-white text-[10px] md:text-[11px] font-bold rounded-full shadow-sm flex items-center gap-1 backdrop-blur-sm">
                          <Sparkles className="w-2.5 h-2.5" />
                          Recommended
                        </span>
                      )}
                      {venue.hasActiveDiscounts && venue.activeDiscountLabels && venue.activeDiscountLabels.map((discount, i) => (
                        <span key={i} title={discount.description || discount.name}
                          className={`px-2 py-0.5 md:px-2.5 md:py-1 ${discount.isSurcharge ? 'bg-orange-500/90' : 'bg-green-600/90'} text-white text-[10px] md:text-[11px] font-bold rounded-full shadow-sm flex items-center gap-1 backdrop-blur-sm`}
                        >
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {discount.isSurcharge
                              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            }
                          </svg>
                          {discount.label}
                        </span>
                      ))}
                      </div>

                      {/* Top-right: Open/Closed + Rating */}
                    <div className="absolute top-2 right-2 md:top-3 md:right-3 flex flex-col items-end gap-1" style={{ zIndex: 6 }}>
                      <span className={`px-2 py-0.5 md:px-2.5 md:py-1 text-white text-[10px] md:text-[11px] font-bold rounded-full shadow-sm backdrop-blur-sm ${isOpen ? 'bg-green-500/85' : 'bg-gray-600/80'}`}>
                        {isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                      {rating && (
                        <span className="cv-rating-pill">
                          {rating.avg.toFixed(1)}
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </span>
                      )}
                      </div>

                      {/* Distance badge */}
                      {userLocation && venue.distance !== undefined && (
                        <div className="absolute bottom-[calc(42%+8px)] right-2 md:right-3 px-1.5 py-0.5 bg-black/50 backdrop-blur-sm text-white text-[9px] md:text-[10px] rounded-full flex items-center gap-1" style={{ zIndex: 6 }}>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {formatDistance(venue.distance)}
                        </div>
                      )}
                    </div>{/* end cv-badges */}

                    {/* Content over fog */}
                    <div className="cv-content">
                      <div className="cv-category">{venue.category || 'Sports Venue'}</div>
                      <div className="cv-name">{venue.name}</div>
                      <div className="cv-location">
                        <svg style={{ width: 10, height: 10, display: 'inline', marginRight: 3, verticalAlign: 'middle', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {venue.location}
                      </div>
                      <div className="cv-footer">
                        <div>
                          <div className="cv-price-label">Starting from</div>
                          <div className="cv-price">
                            {minPrice !== null
                              ? <>{`₱${minPrice}`}<span className="cv-price-sub">/hr</span></>
                              : <span className="cv-price-sub">N/A</span>
                            }
                          </div>
                        </div>
                        <span className="cv-courts-pill">{venue.courts.length} Courts</span>
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
                {fetchError ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                )}
              </svg>
            </div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">
              {fetchError ? 'Failed to load venues' : 'No venues found'}
            </h3>
            <p className="text-sm md:text-base text-gray-500 max-w-sm mx-auto">
              {fetchError
                ? 'Something went wrong while loading venues. Please try again.'
                : 'We couldn\'t find any venues matching your criteria. Try adjusting your filters or search term.'}
            </p>
            {fetchError ? (
              <button
                onClick={() => fetchVenues(true)}
                className="mt-6 bg-primary text-white hover:bg-primary/90 font-medium text-sm md:text-base px-6 py-2 rounded-lg"
              >
                Try again
              </button>
            ) : (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
