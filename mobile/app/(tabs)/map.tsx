import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';

const { width, height } = Dimensions.get('window');

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  courts_count: number;
  min_price: number;
}

// Zamboanga City default coordinates
const DEFAULT_REGION: Region = {
  latitude: 6.9214,
  longitude: 122.0790,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Dark map style for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1A1625' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1625' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7280' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#252038' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1A1625' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0D0B1A' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#252038' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1A1625' }] },
];

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);

  useEffect(() => {
    fetchVenues();
    getUserLocation();
  }, []);

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select(`
          id,
          name,
          address,
          city,
          latitude,
          longitude,
          courts(id, hourly_rate)
        `)
        .eq('status', 'active');

      if (error) throw error;

      const processedVenues: Venue[] = (data || []).map(v => ({
        id: v.id,
        name: v.name,
        address: v.address,
        city: v.city,
        latitude: v.latitude,
        longitude: v.longitude,
        courts_count: v.courts?.length || 0,
        min_price: v.courts?.length 
          ? Math.min(...v.courts.map((c: any) => c.hourly_rate))
          : 0,
      }));

      setVenues(processedVenues);
    } catch (error) {
      console.error('Error fetching venues:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setUserLocation(coords);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  };

  const handleMarkerPress = (venue: Venue) => {
    setSelectedVenue(venue);
    mapRef.current?.animateToRegion({
      latitude: venue.latitude,
      longitude: venue.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }, 300);
  };

  const handleVenuePress = () => {
    if (selectedVenue) {
      router.push(`/venue/${selectedVenue.id}`);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
        onPress={() => setSelectedVenue(null)}
      >
        {venues.map((venue) => (
          <Marker
            key={venue.id}
            coordinate={{
              latitude: venue.latitude,
              longitude: venue.longitude,
            }}
            onPress={() => handleMarkerPress(venue)}
          >
            <View style={[
              styles.markerContainer,
              selectedVenue?.id === venue.id && styles.markerSelected
            ]}>
              <Ionicons 
                name="tennisball" 
                size={16} 
                color={selectedVenue?.id === venue.id ? '#FFFFFF' : '#8B5CF6'} 
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Search Header */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <TouchableOpacity 
          style={styles.searchBar}
          onPress={() => router.push('/(tabs)')}
        >
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <Text style={styles.searchPlaceholder}>Search courts...</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Floating Buttons */}
      <View style={styles.floatingButtons}>
        <TouchableOpacity style={styles.floatingButton} onPress={centerOnUser}>
          <Ionicons name="locate" size={22} color="#8B5CF6" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.floatingButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Ionicons name="list" size={22} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      {/* Selected Venue Card */}
      {selectedVenue && (
        <TouchableOpacity 
          style={styles.venueCard}
          onPress={handleVenuePress}
          activeOpacity={0.95}
        >
          <LinearGradient
            colors={['#1A1625', '#252038']}
            style={styles.venueCardGradient}
          >
            <View style={styles.venueIconContainer}>
              <Ionicons name="tennisball" size={24} color="#8B5CF6" />
            </View>
            <View style={styles.venueInfo}>
              <Text style={styles.venueName} numberOfLines={1}>
                {selectedVenue.name}
              </Text>
              <View style={styles.venueMetaRow}>
                <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                <Text style={styles.venueAddress} numberOfLines={1}>
                  {selectedVenue.address}
                </Text>
              </View>
              <View style={styles.venueStats}>
                <Text style={styles.venueCourts}>
                  {selectedVenue.courts_count} court{selectedVenue.courts_count !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.venuePrice}>
                  From ₱{selectedVenue.min_price}/hr
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0B1A',
  },
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1625',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#252038',
    gap: 12,
  },
  searchPlaceholder: {
    fontSize: 15,
    color: '#6B7280',
  },
  floatingButtons: {
    position: 'absolute',
    right: 16,
    bottom: 200,
    gap: 12,
  },
  floatingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1625',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#252038',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1625',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  markerSelected: {
    backgroundColor: '#8B5CF6',
    transform: [{ scale: 1.2 }],
  },
  venueCard: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  venueCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#252038',
    borderRadius: 16,
  },
  venueIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  venueInfo: {
    flex: 1,
  },
  venueName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  venueMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  venueAddress: {
    fontSize: 12,
    color: '#9CA3AF',
    flex: 1,
  },
  venueStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  venueCourts: {
    fontSize: 12,
    color: '#6B7280',
  },
  venuePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 11, 26, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
