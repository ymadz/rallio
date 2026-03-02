import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    NativeSyntheticEvent,
    NativeScrollEvent,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button, Avatar } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

interface Court {
    id: string;
    name: string;
    description?: string;
    hourly_rate: number;
    court_type: string;
    surface_type?: string;
    capacity?: number;
    is_active: boolean;
    court_images?: { url: string; is_primary: boolean }[];
}

interface Review {
    id: string;
    overall_rating: number;
    review: string | null;
    created_at: string;
    user: {
        display_name: string;
        avatar_url: string | null;
    };
}

interface Venue {
    id: string;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    opening_hours: Record<string, { open: string; close: string }> | string | null;
    description: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    image_url?: string | null;
    metadata: { amenities?: string[] } | null;
    courts?: Court[];
}

// Helper to check if venue is currently open
const isVenueOpen = (hours: Venue['opening_hours']): boolean => {
    if (!hours || typeof hours === 'string') return true; // Assume open if no structured data

    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const todayHours = hours[day];
    if (!todayHours) return false;

    const [openHour, openMin] = todayHours.open.split(':').map(Number);
    const [closeHour, closeMin] = todayHours.close.split(':').map(Number);
    const openTime = openHour * 60 + (openMin || 0);
    const closeTime = closeHour * 60 + (closeMin || 0);

    return currentTime >= openTime && currentTime < closeTime;
};

// Helper to format opening hours
const formatOpeningHours = (hours: Venue['opening_hours']) => {
    if (!hours) return null;
    if (typeof hours === 'string') return [hours];

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const formatted = days.map(day => {
        const schedule = hours[day];
        if (!schedule) return null;
        return {
            day: day.charAt(0).toUpperCase() + day.slice(1, 3),
            hours: `${schedule.open} - ${schedule.close}`
        };
    }).filter(Boolean);

    return formatted;
};

export default function VenueDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [venue, setVenue] = useState<Venue | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [averageRating, setAverageRating] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (id) {
            fetchVenue();
            fetchReviews();
        }
    }, [id]);

    const fetchVenue = async () => {
        setIsLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
            .from('venues')
            .select(`
                id,
                name,
                address,
                latitude,
                longitude,
                opening_hours,
                description,
                phone,
                email,
                website,
                image_url,
                metadata,
                courts (
                    id,
                    name,
                    description,
                    hourly_rate,
                    court_type,
                    surface_type,
                    capacity,
                    is_active,
                    court_images (
                        url,
                        is_primary,
                        display_order
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (fetchError) {
            setError(fetchError.message);
        } else {
            setVenue(data);
        }
        setIsLoading(false);
    };

    const fetchReviews = async () => {
        // Fetch court IDs for this venue first
        const { data: courts } = await supabase
            .from('courts')
            .select('id')
            .eq('venue_id', id);

        if (!courts || courts.length === 0) return;

        const courtIds = courts.map(c => c.id);

        // Fetch ratings for these courts
        const { data: ratings, error: ratingsError } = await supabase
            .from('court_ratings')
            .select(`
                id,
                overall_rating,
                review,
                created_at,
                user:user_id (
                    display_name,
                    avatar_url
                )
            `)
            .in('court_id', courtIds)
            .order('created_at', { ascending: false })
            .limit(5);

        if (!ratingsError && ratings) {
            const formattedReviews = ratings.map((r: any) => ({
                ...r,
                user: Array.isArray(r.user) ? r.user[0] : r.user
            }));
            setReviews(formattedReviews);

            // Calculate average
            if (formattedReviews.length > 0) {
                const avg = formattedReviews.reduce((sum: number, r: Review) => sum + r.overall_rating, 0) / formattedReviews.length;
                setAverageRating(avg);
            }
        }
    };

    // Get all images: court_images first, then fall back to venue image_url
    const courtImages = venue?.courts
        ?.flatMap((c) => c.court_images || [])
        .sort((a, b) => (a.is_primary ? -1 : b.is_primary ? 1 : 0)) || [];
    const allImages: { url: string; is_primary: boolean }[] = courtImages.length > 0
        ? courtImages
        : venue?.image_url
            ? [{ url: venue.image_url, is_primary: true }]
            : [];

    const handleGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        setActiveImageIndex(index);
    };

    // Format currency
    const formatPrice = (price: number) => `₱${price.toLocaleString()}`;

    // Get price range
    const activeCourts = venue?.courts?.filter(c => c.is_active) || [];
    const prices = activeCourts.map((c) => c.hourly_rate).filter(Boolean);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;

    // Venue status
    const isOpen = venue ? isVenueOpen(venue.opening_hours) : false;
    const openingHours = venue ? formatOpeningHours(venue.opening_hours) : null;

    // Render stars
    const renderStars = (rating: number) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Ionicons
                    key={i}
                    name={i <= rating ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
                    size={14}
                    color={Colors.dark.warning}
                />
            );
        }
        return <View style={styles.starsRow}>{stars}</View>;
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (error || !venue) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={Colors.dark.error} />
                    <Text style={styles.errorTitle}>Venue not found</Text>
                    <Text style={styles.errorText}>{error || 'This venue may no longer exist'}</Text>
                    <Button onPress={() => router.back()}>Go Back</Button>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Back button */}
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>

                {/* Image Gallery */}
                <View style={styles.imageGallery}>
                    {allImages.length > 0 ? (
                        <>
                            <FlatList
                                ref={flatListRef}
                                data={allImages}
                                keyExtractor={(_, i) => String(i)}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                onScroll={handleGalleryScroll}
                                scrollEventThrottle={16}
                                renderItem={({ item }) => (
                                    <Image
                                        source={{ uri: item.url }}
                                        style={styles.mainImage}
                                        resizeMode="cover"
                                    />
                                )}
                            />
                            {allImages.length > 1 && (
                                <View style={styles.dotsRow}>
                                    {allImages.map((_, i) => (
                                        <View
                                            key={i}
                                            style={[
                                                styles.dot,
                                                i === activeImageIndex && styles.dotActive,
                                            ]}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            <MaterialIcons name="sports-tennis" size={64} color={Colors.dark.textTertiary} />
                        </View>
                    )}
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Venue Header */}
                    <View style={styles.venueHeader}>
                        <Text style={styles.venueName}>{venue.name}</Text>
                        <View style={styles.statusBadge}>
                            <View style={[styles.statusDot, { backgroundColor: isOpen ? Colors.dark.success : Colors.dark.error }]} />
                            <Text style={[styles.statusText, { color: isOpen ? Colors.dark.success : Colors.dark.error }]}>
                                {isOpen ? 'Open Now' : 'Closed'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.addressRow}>
                        <Ionicons name="location" size={16} color={Colors.dark.textSecondary} />
                        <Text style={styles.address}>{venue.address}</Text>
                    </View>

                    {/* Rating Summary */}
                    {reviews.length > 0 && (
                        <View style={styles.ratingRow}>
                            {renderStars(averageRating)}
                            <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
                            <Text style={styles.reviewCount}>({reviews.length} reviews)</Text>
                        </View>
                    )}

                    {/* Operating Hours */}
                    {openingHours && Array.isArray(openingHours) && openingHours.length > 0 && (
                        <Card variant="glass" padding="md" style={styles.hoursCard}>
                            <View style={styles.hoursHeader}>
                                <Ionicons name="time-outline" size={18} color={Colors.dark.primary} />
                                <Text style={styles.hoursTitle}>Operating Hours</Text>
                            </View>
                            <View style={styles.hoursGrid}>
                                {(openingHours as Array<{ day: string; hours: string }>).map((item, index) => (
                                    <View key={index} style={styles.hourRow}>
                                        <Text style={styles.hourDay}>{item.day}</Text>
                                        <Text style={styles.hourTime}>{item.hours}</Text>
                                    </View>
                                ))}
                            </View>
                        </Card>
                    )}

                    {/* Description */}
                    {venue.description && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>About</Text>
                            <Text style={styles.description}>{venue.description}</Text>
                        </View>
                    )}

                    {/* Courts List - Enhanced with per-court actions */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Available Courts ({activeCourts.length})</Text>
                        {activeCourts.map((court) => (
                            <Card key={court.id} variant="default" padding="md" style={styles.courtCard}>
                                <View style={styles.courtHeader}>
                                    <View style={styles.courtInfo}>
                                        <Text style={styles.courtName}>{court.name}</Text>
                                        {court.description && (
                                            <Text style={styles.courtDescription}>{court.description}</Text>
                                        )}
                                    </View>
                                    <View style={styles.courtPrice}>
                                        <Text style={styles.priceValue}>{formatPrice(court.hourly_rate)}</Text>
                                        <Text style={styles.priceUnit}>/hour</Text>
                                    </View>
                                </View>

                                {/* Court badges */}
                                <View style={styles.courtBadges}>
                                    {court.surface_type && (
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>{court.surface_type}</Text>
                                        </View>
                                    )}
                                    <View style={[styles.badge, court.court_type === 'indoor' ? styles.badgeIndoor : styles.badgeOutdoor]}>
                                        <Text style={[styles.badgeText, court.court_type === 'indoor' ? styles.badgeTextIndoor : styles.badgeTextOutdoor]}>
                                            {court.court_type}
                                        </Text>
                                    </View>
                                </View>

                                {/* Court actions */}
                                <View style={styles.courtActions}>
                                    <TouchableOpacity
                                        style={styles.actionButtonPrimary}
                                        onPress={() => router.push(`/courts/${id}/book?court=${court.id}`)}
                                    >
                                        <Ionicons name="calendar" size={16} color={Colors.dark.text} />
                                        <Text style={styles.actionButtonPrimaryText}>Book Now</Text>
                                    </TouchableOpacity>
                                </View>
                            </Card>
                        ))}
                    </View>

                    {/* Reviews Section */}
                    {reviews.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Recent Reviews</Text>
                            {reviews.map((review) => (
                                <Card key={review.id} variant="glass" padding="sm" style={styles.reviewCard}>
                                    <View style={styles.reviewHeader}>
                                        <Avatar
                                            source={review.user?.avatar_url}
                                            name={review.user?.display_name || 'User'}
                                            size="sm"
                                        />
                                        <View style={styles.reviewInfo}>
                                            <Text style={styles.reviewerName}>
                                                {review.user?.display_name || 'Anonymous'}
                                            </Text>
                                            <View style={styles.reviewMeta}>
                                                {renderStars(review.overall_rating)}
                                                <Text style={styles.reviewDate}>
                                                    {new Date(review.created_at).toLocaleDateString()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    {review.review && (
                                        <Text style={styles.reviewText}>{review.review}</Text>
                                    )}
                                </Card>
                            ))}
                        </View>
                    )}

                    {/* Amenities */}
                    {venue.metadata?.amenities && venue.metadata.amenities.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Amenities</Text>
                            <View style={styles.amenitiesGrid}>
                                {venue.metadata.amenities.map((amenity: string, index: number) => (
                                    <View key={index} style={styles.amenityBadge}>
                                        <Ionicons name="checkmark-circle" size={16} color={Colors.dark.primary} />
                                        <Text style={styles.amenityText}>{amenity}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Contact */}
                    {(venue.phone || venue.email || venue.website) && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Contact</Text>
                            {venue.phone && (
                                <TouchableOpacity
                                    style={styles.contactRow}
                                    onPress={() => Linking.openURL(`tel:${venue.phone}`)}
                                >
                                    <Ionicons name="call-outline" size={18} color={Colors.dark.primary} />
                                    <Text style={styles.contactText}>{venue.phone}</Text>
                                </TouchableOpacity>
                            )}
                            {venue.email && (
                                <TouchableOpacity
                                    style={styles.contactRow}
                                    onPress={() => Linking.openURL(`mailto:${venue.email}`)}
                                >
                                    <Ionicons name="mail-outline" size={18} color={Colors.dark.primary} />
                                    <Text style={styles.contactText}>{venue.email}</Text>
                                </TouchableOpacity>
                            )}
                            {venue.website && (
                                <TouchableOpacity
                                    style={styles.contactRow}
                                    onPress={() => Linking.openURL(venue.website!)}
                                >
                                    <Ionicons name="globe-outline" size={18} color={Colors.dark.primary} />
                                    <Text style={styles.contactText}>
                                        {venue.website.replace(/^https?:\/\//, '')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Bottom padding */}
                    <View style={{ height: 40 }} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
        gap: Spacing.md,
    },
    errorTitle: {
        ...Typography.h2,
        color: Colors.dark.text,
    },
    errorText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
    backButton: {
        position: 'absolute',
        top: Spacing.md,
        left: Spacing.md,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    imageGallery: {
        width: '100%',
    },
    mainImage: {
        width: width,
        height: 280,
    },
    imagePlaceholder: {
        width: '100%',
        height: 280,
        backgroundColor: Colors.dark.elevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotsRow: {
        position: 'absolute',
        bottom: Spacing.md,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.45)',
    },
    dotActive: {
        width: 18,
        backgroundColor: '#fff',
    },
    content: {
        padding: Spacing.lg,
    },
    venueHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.xs,
    },
    venueName: {
        ...Typography.h1,
        color: Colors.dark.text,
        flex: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
        gap: 4,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        ...Typography.caption,
        fontWeight: '600',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    address: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        flex: 1,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.lg,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 2,
    },
    ratingText: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    reviewCount: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
    },
    hoursCard: {
        marginBottom: Spacing.lg,
    },
    hoursHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    hoursTitle: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    hoursGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    hourRow: {
        width: '50%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingRight: Spacing.md,
        paddingVertical: 2,
    },
    hourDay: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    hourTime: {
        ...Typography.caption,
        color: Colors.dark.text,
    },
    section: {
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
        marginBottom: Spacing.sm,
    },
    description: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        lineHeight: 24,
    },
    courtCard: {
        marginBottom: Spacing.sm,
    },
    courtHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    courtInfo: {
        flex: 1,
    },
    courtName: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    courtDescription: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    courtPrice: {
        alignItems: 'flex-end',
    },
    priceValue: {
        ...Typography.h3,
        color: Colors.dark.primary,
    },
    priceUnit: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    courtBadges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.sm,
        gap: 4,
    },
    badgeText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        textTransform: 'capitalize',
    },
    badgeIndoor: {
        backgroundColor: Colors.dark.info + '20',
    },
    badgeOutdoor: {
        backgroundColor: Colors.dark.success + '20',
    },
    badgeTextIndoor: {
        color: Colors.dark.info,
    },
    badgeTextOutdoor: {
        color: Colors.dark.success,
    },
    courtActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    actionButtonPrimary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.dark.primary,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        gap: Spacing.xs,
    },
    actionButtonPrimaryText: {
        ...Typography.button,
        color: Colors.dark.text,
    },
    reviewCard: {
        marginBottom: Spacing.sm,
    },
    reviewHeader: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    reviewInfo: {
        flex: 1,
    },
    reviewerName: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '500',
    },
    reviewMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: 2,
    },
    reviewDate: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    reviewText: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginTop: Spacing.xs,
    },
    amenitiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    amenityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.dark.surface,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: Radius.full,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    amenityText: {
        ...Typography.bodySmall,
        color: Colors.dark.text,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.xs,
    },
    contactText: {
        ...Typography.body,
        color: Colors.dark.text,
    },
});
