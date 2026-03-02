import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    TouchableOpacity,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card } from '@/components/ui';

interface Court {
    id: string;
    name: string;
    hourly_rate: number;
    court_type: string;
    court_images?: { url: string; is_primary: boolean }[];
}

interface Venue {
    id: string;
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    courts?: Court[];
    distance?: number; // in km
    rating?: number;
    review_count?: number;
}

interface CourtCardProps {
    venue: Venue;
    onPress?: () => void;
}

export function CourtCard({ venue, onPress }: CourtCardProps) {
    // Get primary image or first available
    const primaryImage = venue.courts
        ?.flatMap((c) => c.court_images || [])
        .find((img) => img.is_primary);
    const imageUrl = primaryImage?.url || venue.courts?.[0]?.court_images?.[0]?.url;

    // Calculate price range
    const prices = venue.courts?.map((c) => c.hourly_rate).filter(Boolean) || [];
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

    // Format currency (Philippines peso)
    const formatPrice = (price: number) => `₱${price.toLocaleString()}`;

    const priceText = minPrice !== null && maxPrice !== null
        ? minPrice === maxPrice
            ? `${formatPrice(minPrice)}/hr`
            : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}/hr`
        : null;

    return (
        <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
            <Card variant="default" padding="none" style={styles.card}>
                {/* Image */}
                <View style={styles.imageContainer}>
                    {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.image} />
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            <MaterialCommunityIcons name="badminton" size={36} color={Colors.dark.textTertiary} />
                        </View>
                    )}
                    {/* Distance badge */}
                    {venue.distance !== undefined && (
                        <View style={styles.distanceBadge}>
                            <Ionicons name="location" size={12} color={Colors.dark.primary} />
                            <Text style={styles.distanceText}>{venue.distance.toFixed(1)} km</Text>
                        </View>
                    )}
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={styles.name} numberOfLines={1}>{venue.name}</Text>
                    <Text style={styles.address} numberOfLines={1}>{venue.address}</Text>

                    <View style={styles.footer}>
                        {/* Price */}
                        {priceText && (
                            <Text style={styles.price}>{priceText}</Text>
                        )}

                        {/* Rating */}
                        {venue.rating !== undefined && venue.rating > 0 && (
                            <View style={styles.rating}>
                                <Ionicons name="star" size={14} color="#FCD34D" />
                                <Text style={styles.ratingText}>{venue.rating.toFixed(1)}</Text>
                                {venue.review_count !== undefined && (
                                    <Text style={styles.reviewCount}>({venue.review_count})</Text>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Court count */}
                    {venue.courts && venue.courts.length > 0 && (
                        <View style={styles.courtsBadge}>
                            <Ionicons name="grid-outline" size={12} color={Colors.dark.textSecondary} />
                            <Text style={styles.courtsText}>
                                {venue.courts.length} court{venue.courts.length > 1 ? 's' : ''}
                            </Text>
                        </View>
                    )}
                </View>
            </Card>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        overflow: 'hidden',
    },
    imageContainer: {
        height: 140,
        backgroundColor: Colors.dark.elevated,
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.dark.elevated,
    },
    distanceBadge: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
        gap: 4,
    },
    distanceText: {
        ...Typography.caption,
        color: Colors.dark.text,
        fontWeight: '500',
    },
    content: {
        padding: Spacing.md,
    },
    name: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
        marginBottom: 4,
    },
    address: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.sm,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    price: {
        ...Typography.bodySmall,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    rating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingText: {
        ...Typography.bodySmall,
        color: Colors.dark.text,
        fontWeight: '500',
    },
    reviewCount: {
        ...Typography.caption,
        color: Colors.dark.textTertiary,
    },
    courtsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    courtsText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
});
