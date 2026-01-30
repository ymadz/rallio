import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    Platform,
} from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card } from '@/components/ui';
import { useCourtStore, useFilteredVenues, Venue } from '@/store/court-store';
import { FilterBottomSheet } from '@/components/courts/FilterBottomSheet';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// Default to Manila, Philippines
const DEFAULT_LOCATION = {
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
};

export default function MapScreen() {
    const mapRef = useRef<MapView>(null);
    const { fetchVenues, isLoading } = useCourtStore();
    const venues = useFilteredVenues(); // Use filtered venues!
    const [region, setRegion] = useState<Region>(DEFAULT_LOCATION);
    const [locationLoading, setLocationLoading] = useState(true);
    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
    const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
    const [isFilterVisible, setIsFilterVisible] = useState(false);

    useEffect(() => {
        fetchVenues();
        requestLocationPermission();
    }, []);

    const requestLocationPermission = async () => {
        try {
            setLocationLoading(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            setLocationPermission(status === 'granted');

            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                setRegion({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: LATITUDE_DELTA,
                    longitudeDelta: LONGITUDE_DELTA,
                });
            }
        } catch (error) {
            console.error('Error getting location:', error);
        } finally {
            setLocationLoading(false);
        }
    };

    const handleGoToMyLocation = useCallback(async () => {
        if (!locationPermission) {
            await requestLocationPermission();
            return;
        }

        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            const newRegion = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            };
            mapRef.current?.animateToRegion(newRegion, 500);
        } catch (error) {
            console.error('Error getting current location:', error);
        }
    }, [locationPermission]);

    const handleMarkerPress = (venue: Venue) => {
        setSelectedVenue(venue);

        // Center on venue
        if (venue.latitude && venue.longitude) {
            mapRef.current?.animateToRegion({
                latitude: venue.latitude,
                longitude: venue.longitude,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            }, 300);
        }
    };

    const handleVenuePress = () => {
        if (selectedVenue) {
            router.push(`/courts/${selectedVenue.id}`);
        }
    };

    const handleMapPress = () => {
        setSelectedVenue(null);
    };

    // Filter venues with valid coordinates
    const venuesWithCoords = venues
        .filter((v) =>
            v.latitude !== undefined &&
            v.longitude !== undefined &&
            typeof v.latitude === 'number' &&
            typeof v.longitude === 'number'
        );

    // Get min price for venue
    const getMinPrice = (venue: Venue) => {
        const prices = venue.courts?.map((c) => c.hourly_rate).filter(Boolean) || [];
        return prices.length > 0 ? Math.min(...prices) : null;
    };

    return (
        <View style={styles.container}>
            {/* Map */}
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                initialRegion={region}
                showsUserLocation={locationPermission === true}
                showsMyLocationButton={false}
                onPress={handleMapPress}
                mapType="standard"
            >
                {venuesWithCoords.map((venue) => (
                    <Marker
                        key={venue.id}
                        coordinate={{
                            latitude: venue.latitude!,
                            longitude: venue.longitude!,
                        }}
                        onPress={() => handleMarkerPress(venue)}
                    >
                        <View style={[
                            styles.markerContainer,
                            selectedVenue?.id === venue.id && styles.markerSelected
                        ]}>
                            <Ionicons
                                name="tennisball"
                                size={20}
                                color={selectedVenue?.id === venue.id ? Colors.dark.text : Colors.dark.primary}
                            />
                        </View>
                    </Marker>
                ))}
            </MapView>

            {/* Header */}
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Courts Near You</Text>
                    <View style={{ width: 44 }} />
                </View>
            </SafeAreaView>

            {/* Controls Container (Location + Filter) */}
            <View style={styles.controlsContainer}>
                <TouchableOpacity
                    style={styles.controlButton}
                    onPress={handleGoToMyLocation}
                >
                    <Ionicons
                        name={locationPermission ? "navigate" : "navigate-outline"}
                        size={22}
                        color={Colors.dark.primary}
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => setIsFilterVisible(true)}
                >
                    <Ionicons
                        name="options"
                        size={22}
                        color={Colors.dark.text}
                    />
                </TouchableOpacity>
            </View>

            {/* Loading Indicator */}
            {(isLoading || locationLoading) && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Colors.dark.primary} />
                </View>
            )}

            {/* Venue Count Badge */}
            <View style={styles.countBadge}>
                <Text style={styles.countText}>
                    {venuesWithCoords.length} court{venuesWithCoords.length !== 1 ? 's' : ''} nearby
                </Text>
            </View>

            {/* Selected Venue Card */}
            {selectedVenue && (
                <TouchableOpacity
                    style={styles.venueCardContainer}
                    onPress={handleVenuePress}
                    activeOpacity={0.9}
                >
                    <Card variant="glass" padding="md" style={styles.venueCard}>
                        <View style={styles.venueInfo}>
                            <Text style={styles.venueName} numberOfLines={1}>
                                {selectedVenue.name}
                            </Text>
                            <Text style={styles.venueAddress} numberOfLines={1}>
                                {selectedVenue.address}
                            </Text>
                            {getMinPrice(selectedVenue) && (
                                <Text style={styles.venuePrice}>
                                    From ₱{getMinPrice(selectedVenue)?.toLocaleString()}/hr
                                </Text>
                            )}
                        </View>
                        <View style={styles.venueArrow}>
                            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textSecondary} />
                        </View>
                    </Card>
                </TouchableOpacity>
            )}

            <FilterBottomSheet
                visible={isFilterVisible}
                onClose={() => setIsFilterVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    headerSafeArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        paddingTop: Spacing.md,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(18, 18, 26, 0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    title: {
        ...Typography.h3,
        color: Colors.dark.text,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    controlsContainer: {
        position: 'absolute',
        right: Spacing.lg,
        top: 140,
        gap: Spacing.md,
    },
    controlButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(18, 18, 26, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    loadingContainer: {
        position: 'absolute',
        top: 140,
        left: Spacing.lg,
        backgroundColor: 'rgba(18, 18, 26, 0.9)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.full,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    countBadge: {
        position: 'absolute',
        top: 200,
        left: Spacing.lg,
        backgroundColor: 'rgba(18, 18, 26, 0.9)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.full,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    countText: {
        ...Typography.caption,
        color: Colors.dark.text,
    },
    markerContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(18, 18, 26, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: Colors.dark.primary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    markerSelected: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primaryLight,
        transform: [{ scale: 1.1 }],
    },
    venueCardContainer: {
        position: 'absolute',
        bottom: 40,
        left: Spacing.lg,
        right: Spacing.lg,
    },
    venueCard: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    venueInfo: {
        flex: 1,
    },
    venueName: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    venueAddress: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    venuePrice: {
        ...Typography.bodySmall,
        color: Colors.dark.primary,
        fontWeight: '500',
        marginTop: 4,
    },
    venueArrow: {
        paddingLeft: Spacing.sm,
    },
});
