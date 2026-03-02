import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useLocationStore } from '@/store/location-store';

interface Court {
    id: string;
    name: string;
    hourly_rate: number;
    court_type: string;
    is_active: boolean;
    capacity: number;
    court_images?: { url: string; is_primary: boolean; display_order: number }[];
    court_amenities?: { amenities: { name: string } | null }[];
    court_ratings?: { overall_rating: number }[];
}

export interface Venue {
    id: string;
    name: string;
    description?: string;
    address: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: any;
    metadata?: Record<string, any>;
    courts?: Court[];
    court_count?: number;
    // Derived / computed fields
    amenities: string[];
    distance?: number;
    rating?: number;
    review_count?: number;
}

export type SortBy = 'nearest' | 'rating' | 'price_low' | 'price_high' | null;

interface CourtState {
    venues: Venue[];
    isLoading: boolean;
    error: string | null;
    searchQuery: string;
    filters: {
        amenities: string[];
        maxPrice: number | null;
        maxDistance: number | null;
        minRating: number | null;
        sortBy: SortBy;
    };
}

interface CourtActions {
    fetchVenues: () => Promise<void>;
    searchVenues: (query: string) => void;
    setFilter: (key: keyof CourtState['filters'], value: any) => void;
    clearFilters: () => void;
    getVenueById: (id: string) => Venue | undefined;
}

type CourtStore = CourtState & CourtActions;

export const useCourtStore = create<CourtStore>()((set, get) => ({
    // State
    venues: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    filters: {
        amenities: [],
        maxPrice: null,
        maxDistance: null,
        minRating: null,
        sortBy: null,
    },

    // Actions
    fetchVenues: async () => {
        set({ isLoading: true, error: null });

        try {
            const { data, error } = await supabase
                .from('venues')
                .select(`
                    id,
                    name,
                    description,
                    address,
                    latitude,
                    longitude,
                    opening_hours,
                    metadata,
                    courts (
                        id,
                        name,
                        hourly_rate,
                        court_type,
                        is_active,
                        capacity,
                        court_images (
                            url,
                            is_primary,
                            display_order
                        ),
                        court_amenities (
                            amenities (
                                name
                            )
                        ),
                        court_ratings (
                            overall_rating
                        )
                    )
                `)
                .eq('is_active', true)
                .eq('is_verified', true)
                .eq('courts.is_active', true)
                .order('name');

            if (error) {
                set({ error: error.message, isLoading: false });
                return;
            }

            const calculateDistance = useLocationStore.getState().calculateDistance;

            const venues: Venue[] = (data || []).map((venue: any) => {
                // Flatten unique amenity names from all courts
                const amenitySet = new Set<string>();
                venue.courts?.forEach((court: Court) => {
                    court.court_amenities?.forEach((ca) => {
                        const name = ca.amenities?.name;
                        if (name) amenitySet.add(name);
                    });
                });

                // Compute average rating across all courts' ratings
                const allRatings: number[] = [];
                venue.courts?.forEach((court: Court) => {
                    court.court_ratings?.forEach((cr) => {
                        if (cr.overall_rating) allRatings.push(cr.overall_rating);
                    });
                });
                const avgRating = allRatings.length > 0
                    ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
                    : undefined;

                // Compute distance from user location (returns km or null)
                const distance = (venue.latitude && venue.longitude)
                    ? calculateDistance(Number(venue.latitude), Number(venue.longitude)) ?? undefined
                    : undefined;

                return {
                    ...venue,
                    amenities: Array.from(amenitySet),
                    rating: avgRating,
                    review_count: allRatings.length,
                    distance,
                };
            });

            set({ venues, isLoading: false, error: null });
        } catch (err) {
            set({ error: 'Failed to fetch venues', isLoading: false });
        }
    },

    searchVenues: (query: string) => {
        set({ searchQuery: query });
    },

    setFilter: (key, value) => {
        set((state) => ({
            filters: { ...state.filters, [key]: value },
        }));
    },

    clearFilters: () => {
        set({
            filters: {
                amenities: [],
                maxPrice: null,
                maxDistance: null,
                minRating: null,
                sortBy: null,
            },
            searchQuery: '',
        });
    },

    getVenueById: (id: string) => {
        return get().venues.find((v) => v.id === id);
    },
}));

// Selector for filtered + sorted venues
export const useFilteredVenues = () => {
    const { venues, searchQuery, filters } = useCourtStore();

    const filtered = venues.filter((venue) => {
        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesName = venue.name.toLowerCase().includes(query);
            const matchesAddress = venue.address.toLowerCase().includes(query);
            if (!matchesName && !matchesAddress) return false;
        }

        // Amenities filter — must have ALL selected amenities
        if (filters.amenities && filters.amenities.length > 0) {
            const venueAmenities = venue.amenities || [];
            const hasAll = filters.amenities.every((a) =>
                venueAmenities.some((va) => va.toLowerCase() === a.toLowerCase())
            );
            if (!hasAll) return false;
        }

        // Max price filter
        if (filters.maxPrice) {
            const minPrice = Math.min(
                ...(venue.courts?.map((c) => c.hourly_rate) || [Infinity])
            );
            if (minPrice > filters.maxPrice) return false;
        }

        // Min rating filter
        if (filters.minRating) {
            if ((venue.rating || 0) < filters.minRating) return false;
        }

        // Distance filter
        if (filters.maxDistance != null && venue.distance !== undefined) {
            if (venue.distance > filters.maxDistance) return false;
        }

        return true;
    });

    // Sort
    const { sortBy } = filters;
    if (!sortBy) return filtered;

    return [...filtered].sort((a, b) => {
        switch (sortBy) {
            case 'nearest': {
                const da = a.distance ?? Infinity;
                const db = b.distance ?? Infinity;
                return da - db;
            }
            case 'rating': {
                return (b.rating ?? 0) - (a.rating ?? 0);
            }
            case 'price_low': {
                const pa = Math.min(...(a.courts?.map((c) => c.hourly_rate) || [Infinity]));
                const pb = Math.min(...(b.courts?.map((c) => c.hourly_rate) || [Infinity]));
                return pa - pb;
            }
            case 'price_high': {
                const pa = Math.min(...(a.courts?.map((c) => c.hourly_rate) || [Infinity]));
                const pb = Math.min(...(b.courts?.map((c) => c.hourly_rate) || [Infinity]));
                return pb - pa;
            }
            default:
                return 0;
        }
    });
};
