import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '@/services/supabase';

const { width } = Dimensions.get('window');

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
  phone: string | null;
  email: string | null;
}

interface Court {
  id: string;
  name: string;
  court_type: 'indoor' | 'outdoor';
  hourly_rate: number;
  status: string;
  description: string | null;
}

const amenityIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Parking': 'car-outline',
  'Restroom': 'water-outline',
  'Shower': 'water-outline',
  'Lockers': 'lock-closed-outline',
  'Water': 'water-outline',
  'Air Conditioning': 'snow-outline',
  'Lighting': 'bulb-outline',
  'Waiting Area': 'people-outline',
  'Equipment Rental': 'tennisball-outline',
  'First Aid': 'medical-outline',
  'WiFi': 'wifi-outline',
  'Canteen': 'restaurant-outline',
};

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);

  useEffect(() => {
    fetchVenueDetails();
  }, [id]);

  const fetchVenueDetails = async () => {
    try {
      // Fetch venue
      const { data: venueData, error: venueError } = await supabase
        .from('venues')
        .select('*')
        .eq('id', id)
        .single();

      if (venueError) throw venueError;
      setVenue(venueData);

      // Fetch courts
      const { data: courtsData, error: courtsError } = await supabase
        .from('courts')
        .select('*')
        .eq('venue_id', id)
        .eq('status', 'active')
        .order('name');

      if (courtsError) throw courtsError;
      setCourts(courtsData || []);
      
      if (courtsData && courtsData.length > 0) {
        setSelectedCourt(courtsData[0]);
      }
    } catch (error) {
      console.error('Error fetching venue:', error);
    } finally {
      setLoading(false);
    }
  };

  const isVenueOpen = (): boolean => {
    if (!venue?.opening_hours) return true;
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayHours = venue.opening_hours[day];
    if (!dayHours || dayHours.closed) return false;
    return true;
  };

  const getTodayHours = (): string => {
    if (!venue?.opening_hours) return 'Hours not available';
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayHours = venue.opening_hours[day];
    if (!dayHours || dayHours.closed) return 'Closed today';
    return `${dayHours.open} - ${dayHours.close}`;
  };

  const openMaps = () => {
    if (!venue) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${venue.name}@${venue.latitude},${venue.longitude}`,
      android: `geo:0,0?q=${venue.latitude},${venue.longitude}(${venue.name})`,
    });
    if (url) Linking.openURL(url);
  };

  const callVenue = () => {
    if (venue?.phone) {
      Linking.openURL(`tel:${venue.phone}`);
    }
  };

  const handleBookCourt = (court: Court) => {
    router.push({
      pathname: '/booking/[courtId]',
      params: { courtId: court.id, venueName: venue?.name, courtName: court.name },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0D0B1A', '#1A1625']} style={styles.gradient}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading venue...</Text>
        </LinearGradient>
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient colors={['#0D0B1A', '#1A1625']} style={styles.gradient}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Venue not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  const isOpen = isVenueOpen();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient colors={['#0D0B1A', '#1A1625', '#0D0B1A']} style={styles.gradient}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          {venue.cover_image_url ? (
            <Image
              source={{ uri: venue.cover_image_url }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#252038', '#1A1625']}
              style={styles.coverImage}
            >
              <Ionicons name="tennisball" size={64} color="#8B5CF6" />
            </LinearGradient>
          )}
          
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(13, 11, 26, 0.8)', '#0D0B1A']}
            style={styles.imageOverlay}
          />

          {/* Back Button */}
          <SafeAreaView style={styles.headerButtons} edges={['top']}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="heart-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Venue Name Overlay */}
          <View style={styles.venueNameOverlay}>
            <View style={[styles.statusBadge, isOpen ? styles.openBadge : styles.closedBadge]}>
              <View style={[styles.statusDot, isOpen ? styles.openDot : styles.closedDot]} />
              <Text style={styles.statusText}>{isOpen ? 'Open Now' : 'Closed'}</Text>
            </View>
            <Text style={styles.venueName}>{venue.name}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color="#9CA3AF" />
              <Text style={styles.venueAddress}>{venue.address}, {venue.city}</Text>
            </View>
          </View>
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={openMaps}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="navigate" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.actionLabel}>Directions</Text>
            </TouchableOpacity>
            
            {venue.phone && (
              <TouchableOpacity style={styles.actionButton} onPress={callVenue}>
                <View style={styles.actionIconContainer}>
                  <Ionicons name="call" size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.actionLabel}>Call</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.actionButton}>
              <View style={styles.actionIconContainer}>
                <Ionicons name="share-social" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Hours */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={20} color="#8B5CF6" />
              <Text style={styles.sectionTitle}>Today's Hours</Text>
            </View>
            <Text style={styles.hoursText}>{getTodayHours()}</Text>
          </View>

          {/* Description */}
          {venue.description && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="information-circle-outline" size={20} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>About</Text>
              </View>
              <Text style={styles.descriptionText}>{venue.description}</Text>
            </View>
          )}

          {/* Amenities */}
          {venue.amenities && venue.amenities.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#8B5CF6" />
                <Text style={styles.sectionTitle}>Amenities</Text>
              </View>
              <View style={styles.amenitiesGrid}>
                {venue.amenities.map((amenity, index) => (
                  <View key={index} style={styles.amenityItem}>
                    <Ionicons 
                      name={amenityIcons[amenity] || 'checkmark-outline'} 
                      size={16} 
                      color="#8B5CF6" 
                    />
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Courts */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="tennisball-outline" size={20} color="#8B5CF6" />
              <Text style={styles.sectionTitle}>Available Courts ({courts.length})</Text>
            </View>
            
            {courts.map((court) => (
              <TouchableOpacity
                key={court.id}
                style={[
                  styles.courtCard,
                  selectedCourt?.id === court.id && styles.courtCardSelected
                ]}
                onPress={() => setSelectedCourt(court)}
              >
                <View style={styles.courtInfo}>
                  <View style={styles.courtHeader}>
                    <Text style={styles.courtName}>{court.name}</Text>
                    <View style={[
                      styles.courtTypeBadge,
                      court.court_type === 'indoor' ? styles.indoorBadge : styles.outdoorBadge
                    ]}>
                      <Text style={styles.courtTypeText}>
                        {court.court_type === 'indoor' ? '🏠 Indoor' : '☀️ Outdoor'}
                      </Text>
                    </View>
                  </View>
                  {court.description && (
                    <Text style={styles.courtDescription} numberOfLines={2}>
                      {court.description}
                    </Text>
                  )}
                  <View style={styles.courtFooter}>
                    <Text style={styles.courtPrice}>₱{court.hourly_rate}</Text>
                    <Text style={styles.priceUnit}>/hour</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.bookCourtButton}
                  onPress={() => handleBookCourt(court)}
                >
                  <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bottom Padding */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Fixed Book Button */}
        {selectedCourt && (
          <View style={styles.bottomBar}>
            <View style={styles.selectedCourtInfo}>
              <Text style={styles.selectedCourtName}>{selectedCourt.name}</Text>
              <Text style={styles.selectedCourtPrice}>
                ₱{selectedCourt.hourly_rate}/hr
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.bookButton}
              onPress={() => handleBookCourt(selectedCourt)}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.bookButtonGradient}
              >
                <Text style={styles.bookButtonText}>Book Now</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9CA3AF',
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  imageContainer: {
    height: 280,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  headerButtons: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  venueNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginBottom: 8,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  venueName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  venueAddress: {
    fontSize: 14,
    color: '#9CA3AF',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingVertical: 16,
    backgroundColor: '#1A1625',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252038',
  },
  actionButton: {
    alignItems: 'center',
    gap: 8,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hoursText: {
    fontSize: 15,
    color: '#9CA3AF',
    paddingLeft: 28,
  },
  descriptionText: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 22,
    paddingLeft: 28,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingLeft: 28,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1625',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#252038',
  },
  amenityText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  courtCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1625',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#252038',
  },
  courtCardSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  courtInfo: {
    flex: 1,
  },
  courtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  courtName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  courtTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  indoorBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  outdoorBadge: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
  },
  courtTypeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  courtDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  courtFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  courtPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  priceUnit: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 2,
  },
  bookCourtButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#1A1625',
    borderTopWidth: 1,
    borderTopColor: '#252038',
  },
  selectedCourtInfo: {
    flex: 1,
  },
  selectedCourtName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedCourtPrice: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  bookButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
