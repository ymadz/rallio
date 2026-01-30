import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Button } from '@/components/ui/Button';
import { useCourtStore } from '@/store/court-store';
import { BlurView } from 'expo-blur';

interface FilterBottomSheetProps {
    visible: boolean;
    onClose: () => void;
}

const AMENITIES = [
    'Parking',
    'Restroom',
    'Shower',
    'Lockers',
    'Water',
    'Air Conditioning',
    'Lighting',
    'Waiting Area',
    'Equipment Rental',
    'WiFi',
    'Canteen',
];

export function FilterBottomSheet({ visible, onClose }: FilterBottomSheetProps) {
    const { filters, setFilter, clearFilters } = useCourtStore();

    // Local state for filters to avoid triggering updates while selecting
    const [localFilters, setLocalFilters] = useState(filters);

    useEffect(() => {
        if (visible) {
            setLocalFilters(filters);
        }
    }, [visible, filters]);

    const handleApply = () => {
        setFilter('maxPrice', localFilters.maxPrice);
        setFilter('amenities', localFilters.amenities);
        setFilter('minRating', localFilters.minRating);
        onClose();
    };

    const handleClear = () => {
        clearFilters();
        setLocalFilters({
            maxPrice: null,
            amenities: [],
            maxDistance: null,
            minRating: null,
        });
        onClose();
    };

    const toggleAmenity = (amenity: string) => {
        const currentAmenities = localFilters.amenities || [];
        const newAmenities = currentAmenities.includes(amenity)
            ? currentAmenities.filter(a => a !== amenity)
            : [...currentAmenities, amenity];

        setLocalFilters({ ...localFilters, amenities: newAmenities });
    };

    const toggleRating = (rating: number) => {
        setLocalFilters({
            ...localFilters,
            minRating: localFilters.minRating === rating ? null : rating
        });
    };

    const setPrice = (price: number | null) => {
        setLocalFilters({ ...localFilters, maxPrice: price });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <View style={styles.sheetContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Filter Courts</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Price Range */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Max Hourly Rate</Text>
                            <View style={styles.priceContainer}>
                                {[200, 300, 500, 1000].map((price) => (
                                    <TouchableOpacity
                                        key={price}
                                        style={[
                                            styles.priceChip,
                                            localFilters.maxPrice === price && styles.activeChip
                                        ]}
                                        onPress={() => setPrice(localFilters.maxPrice === price ? null : price)}
                                    >
                                        <Text style={[
                                            styles.priceText,
                                            localFilters.maxPrice === price && styles.activeChipText
                                        ]}>
                                            ₱{price}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Customer Review */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Customer Review</Text>
                            <View style={styles.ratingContainer}>
                                <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <TouchableOpacity
                                            key={star}
                                            onPress={() => toggleRating(star)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons
                                                name={star <= (localFilters.minRating || 0) ? "star" : "star-outline"}
                                                size={32}
                                                color={Colors.dark.primary}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={styles.ratingLabel}>
                                    {localFilters.minRating ? `${localFilters.minRating} Stars & Up` : 'Any Rating'}
                                </Text>
                            </View>
                        </View>

                        {/* Amenities */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Amenities</Text>
                            <View style={styles.amenitiesContainer}>
                                {AMENITIES.map((amenity) => (
                                    <TouchableOpacity
                                        key={amenity}
                                        style={[
                                            styles.amenityChip,
                                            localFilters.amenities?.includes(amenity) && styles.activeChip
                                        ]}
                                        onPress={() => toggleAmenity(amenity)}
                                    >
                                        <Text style={[
                                            styles.amenityText,
                                            localFilters.amenities?.includes(amenity) && styles.activeChipText
                                        ]}>
                                            {amenity}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.spacer} />
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Button
                            variant="secondary"
                            onPress={handleClear}
                            style={styles.footerButton}
                        >
                            Reset
                        </Button>
                        <Button
                            variant="primary"
                            onPress={handleApply}
                            style={styles.footerButton}
                        >
                            Apply Filters
                        </Button>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheetContainer: {
        backgroundColor: Colors.dark.background,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        maxHeight: '80%',
        width: '100%',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    title: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    closeButton: {
        padding: Spacing.xs,
    },
    content: {
        padding: Spacing.lg,
    },
    section: {
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        ...Typography.body,
        fontWeight: '600',
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    priceContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    priceChip: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: Radius.full,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    activeChip: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primary,
    },
    priceText: {
        ...Typography.bodySmall,
        color: Colors.dark.text,
    },
    activeChipText: {
        color: Colors.dark.text, // Assuming dark text on primary color (yellow) looks good, or white if primary is dark
        fontWeight: '600',
    },
    amenitiesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    amenityChip: {
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.full,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginBottom: Spacing.xs,
    },
    amenityText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    ratingContainer: {
        gap: Spacing.sm,
    },
    starsRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    ratingLabel: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        padding: Spacing.lg,
        gap: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
        backgroundColor: Colors.dark.background,
    },
    footerButton: {
        flex: 1,
    },
    spacer: {
        height: 40,
    },
});
