import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/services/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 12) / 2; // 2 columns with padding

type SortOption = 'distance' | 'price_low' | 'price_high' | 'rating' | 'newest';

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  description: string | null;
  latitude: number;
  longitude: number;
  cover_image_url: string | null;
  opening_hours: any;
  amenities: string[];
  courts: Court[];
  distance?: number;
  avg_rating?: number;
  review_count?: number;
}

interface Court {
  id: string;
  name: string;
  court_type: 'indoor' | 'outdoor';
  hourly_rate: number;
  status: string;
}

export default function CourtsScreen() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'indoor' | 'outdoor'>('all');

  useEffect(() => {
    fetchVenues();
  }, [search, sortBy, selectedFilter, userLocation]);

  const fetchVenues = async () => {
    try {
      let query = supabase
        .from('venues')
        .select(`
          id,
          name,
          address,
          city,
          description,
          latitude,
          longitude,
          cover_image_url,
          opening_hours,
          amenities,
          courts (
            id,
            name,
            court_type,
            hourly_rate,
            status
          )
        `)
        .eq('status', 'active');

      // Apply search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%,city.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      let filteredVenues: Venue[] = (data || []) as Venue[];

      // Filter by court type if selected
      if (selectedFilter !== 'all') {
        filteredVenues = filteredVenues.filter(venue =>
          venue.courts.some(court => court.court_type === selectedFilter)
        );
      }

      // Calculate distance if user location available
      if (userLocation) {
        filteredVenues = filteredVenues.map(venue => ({
          ...venue,
          distance: calculateDistance(
            userLocation.lat,
            userLocation.lng,
            venue.latitude,
            venue.longitude
          ),
        }));
      }

      // Sort venues
      switch (sortBy) {
        case 'distance':
          if (userLocation) {
            filteredVenues.sort((a, b) => (a.distance || 999) - (b.distance || 999));
          }
          break;
        case 'price_low':
          filteredVenues.sort((a, b) => {
            const aMin = Math.min(...a.courts.map(c => c.hourly_rate));
            const bMin = Math.min(...b.courts.map(c => c.hourly_rate));
            return aMin - bMin;
          });
          break;
        case 'price_high':
          filteredVenues.sort((a, b) => {
            const aMax = Math.max(...a.courts.map(c => c.hourly_rate));
            const bMax = Math.max(...b.courts.map(c => c.hourly_rate));
            return bMax - aMax;
          });
          break;
        case 'rating':
          filteredVenues.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
          break;
        default:
          // newest - keep default order
          break;
      }

      setVenues(filteredVenues);
    } catch (error) {
      console.error('Error fetching venues:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
      setSortBy('distance');
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVenues();
  }, [search, sortBy, selectedFilter, userLocation]);

  const getLowestPrice = (courts: Court[]): number => {
    if (courts.length === 0) return 0;
    return Math.min(...courts.map(c => c.hourly_rate));
  };

  const isVenueOpen = (openingHours: any): boolean => {
    if (!openingHours) return true;
    // Simple check - can be enhanced
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayHours = openingHours[day];
    if (!dayHours || dayHours.closed) return false;
    return true;
  };

  const formatDistance = (km: number): string => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  const renderVenueCard = ({ item, index }: { item: Venue; index: number }) => {
    const lowestPrice = getLowestPrice(item.courts);
    const isOpen = isVenueOpen(item.opening_hours);
    const hasIndoor = item.courts.some(c => c.court_type === 'indoor');
    const hasOutdoor = item.courts.some(c => c.court_type === 'outdoor');

    return (
      <TouchableOpacity
        style={[styles.venueCard, { marginLeft: index % 2 === 0 ? 0 : 12 }]}
        onPress={() => router.push(`/venue/${item.id}`)}
        activeOpacity={0.8}
      >
        {/* Image */}
        <View style={styles.imageContainer}>
          {item.cover_image_url ? (
            <Image
              source={{ uri: item.cover_image_url }}
              style={styles.venueImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#252038', '#1A1625']}
              style={styles.venueImage}
            >
              <Ionicons name="tennisball" size={32} color="#8B5CF6" />
            </LinearGradient>
          )}
          
          {/* Status Badge */}
          <View style={[styles.statusBadge, isOpen ? styles.openBadge : styles.closedBadge]}>
            <View style={[styles.statusDot, isOpen ? styles.openDot : styles.closedDot]} />
            <Text style={styles.statusText}>{isOpen ? 'Open' : 'Closed'}</Text>
          </View>

          {/* Court Type Badges */}
          <View style={styles.courtTypeBadges}>
            {hasIndoor && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>Indoor</Text>
              </View>
            )}
            {hasOutdoor && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>Outdoor</Text>
              </View>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={styles.venueName} numberOfLines={1}>{item.name}</Text>
          
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color="#9CA3AF" />
            <Text style={styles.venueLocation} numberOfLines={1}>
              {item.city}
              {item.distance && ` • ${formatDistance(item.distance)}`}
            </Text>
          </View>

          {/* Rating */}
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color="#FBBF24" />
            <Text style={styles.ratingText}>
              {item.avg_rating?.toFixed(1) || '—'}
            </Text>
            <Text style={styles.reviewCount}>
              ({item.review_count || 0})
            </Text>
          </View>

          {/* Price & Courts */}
          <View style={styles.cardFooter}>
            <Text style={styles.price}>₱{lowestPrice}</Text>
            <Text style={styles.priceLabel}>/hr</Text>
            <View style={styles.courtCount}>
              <Text style={styles.courtCountText}>{item.courts.length} courts</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const sortOptions: { value: SortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'newest', label: 'Newest', icon: 'time-outline' },
    { value: 'distance', label: 'Nearest', icon: 'navigate-outline' },
    { value: 'price_low', label: 'Price: Low', icon: 'arrow-down-outline' },
    { value: 'price_high', label: 'Price: High', icon: 'arrow-up-outline' },
    { value: 'rating', label: 'Top Rated', icon: 'star-outline' },
  ];

  const filterOptions = [
    { value: 'all', label: 'All Courts' },
    { value: 'indoor', label: 'Indoor' },
    { value: 'outdoor', label: 'Outdoor' },
  ] as const;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0D0B1A', '#1A1625', '#0D0B1A']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Find Courts</Text>
              <Text style={styles.subtitle}>Discover badminton courts near you</Text>
            </View>
            <TouchableOpacity 
              style={[styles.locationButton, userLocation && styles.locationButtonActive]}
              onPress={handleGetLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <Ionicons 
                  name={userLocation ? "navigate" : "navigate-outline"} 
                  size={20} 
                  color={userLocation ? "#FFFFFF" : "#8B5CF6"} 
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search courts, city, or area..."
                placeholderTextColor="#6B7280"
                value={search}
                onChangeText={setSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={20} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Sort Button */}
            <TouchableOpacity 
              style={styles.sortButton}
              onPress={() => setShowSortMenu(!showSortMenu)}
            >
              <Ionicons name="funnel-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Filter Chips */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContainer}
          >
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  selectedFilter === option.value && styles.filterChipActive
                ]}
                onPress={() => setSelectedFilter(option.value)}
              >
                <Text style={[
                  styles.filterChipText,
                  selectedFilter === option.value && styles.filterChipTextActive
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Sort Options */}
            <View style={styles.sortDivider} />
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  sortBy === option.value && styles.filterChipActive,
                  option.value === 'distance' && !userLocation && styles.filterChipDisabled
                ]}
                onPress={() => {
                  if (option.value === 'distance' && !userLocation) {
                    handleGetLocation();
                  } else {
                    setSortBy(option.value);
                  }
                }}
              >
                <Ionicons 
                  name={option.icon} 
                  size={14} 
                  color={sortBy === option.value ? '#FFFFFF' : '#9CA3AF'} 
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  styles.filterChipText,
                  sortBy === option.value && styles.filterChipTextActive
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Results Count */}
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {loading ? 'Loading...' : `${venues.length} courts found`}
            </Text>
          </View>

          {/* Venues List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Finding courts...</Text>
            </View>
          ) : venues.length > 0 ? (
            <FlatList
              data={venues}
              renderItem={renderVenueCard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#8B5CF6"
                  colors={['#8B5CF6']}
                />
              }
            />
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="tennisball-outline" size={64} color="#4B5563" />
              </View>
              <Text style={styles.emptyTitle}>No courts found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search or filters
              </Text>
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={() => {
                  setSearch('');
                  setSelectedFilter('all');
                  setSortBy('newest');
                }}
              >
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 2,
  },
  locationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  locationButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1625',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#252038',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  sortButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#252038',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1625',
    borderWidth: 1,
    borderColor: '#252038',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  filterChipDisabled: {
    opacity: 0.5,
  },
  filterChipText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sortDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#252038',
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  resultsCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  venueCard: {
    width: CARD_WIDTH,
    backgroundColor: '#1A1625',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#252038',
  },
  imageContainer: {
    height: 120,
    position: 'relative',
  },
  venueImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  openBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
  },
  closedBadge: {
    backgroundColor: 'rgba(107, 114, 128, 0.9)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  openDot: {
    backgroundColor: '#FFFFFF',
  },
  closedDot: {
    backgroundColor: '#9CA3AF',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  courtTypeBadges: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  typeBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  cardContent: {
    padding: 12,
  },
  venueName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  venueLocation: {
    fontSize: 11,
    color: '#9CA3AF',
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reviewCount: {
    fontSize: 11,
    color: '#6B7280',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  priceLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 2,
  },
  courtCount: {
    marginLeft: 'auto',
    backgroundColor: '#252038',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  courtCountText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1625',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  clearFiltersButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
