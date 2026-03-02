import React, { useEffect, useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,

    FlatList,
    RefreshControl,
    TextInput,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, CourtListSkeleton } from '@/components/ui';
import { CourtCard } from '@/components/courts/CourtCard';
import { useCourtStore, useFilteredVenues } from '@/store/court-store';
import { FilterBottomSheet } from '@/components/courts/FilterBottomSheet';
import { apiGet } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

interface RecommendedCourt {
    id: string;
    name: string;
    hourly_rate: number;
    court_type: string;
    surface_type?: string;
    venues?: { id: string; name: string; address: string; image_url?: string };
}

export default function CourtsScreen() {
    const { isLoading, error, searchQuery, fetchVenues, searchVenues } = useCourtStore();
    const venues = useFilteredVenues();
    const { user } = useAuthStore();
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const [isFilterVisible, setIsFilterVisible] = React.useState(false);
    const [recommendations, setRecommendations] = useState<RecommendedCourt[]>([]);
    const [recsLoading, setRecsLoading] = useState(false);

    useEffect(() => {
        fetchVenues().finally(() => setIsInitialLoad(false));
    }, []);

    // Fetch ML recommendations
    useEffect(() => {
        if (!user) return;
        const fetchRecs = async () => {
            setRecsLoading(true);
            try {
                const result = await apiGet('/api/mobile/recommendations', { limit: '4' });
                if (result.success && result.courts?.length > 0) {
                    setRecommendations(result.courts);
                }
            } catch {
                // Silent fail — non-critical
            } finally {
                setRecsLoading(false);
            }
        };
        fetchRecs();
    }, [user]);

    const handleRefresh = useCallback(() => {
        fetchVenues();
    }, []);

    const handleVenuePress = (venueId: string) => {
        router.push(`/courts/${venueId}`);
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Card variant="glass" padding="lg" style={styles.emptyCard}>
                <MaterialCommunityIcons name="badminton" size={64} color={Colors.dark.textTertiary} />
                <Text style={styles.emptyTitle}>
                    {searchQuery ? 'No Results' : 'No Courts Available'}
                </Text>
                <Text style={styles.emptyText}>
                    {searchQuery
                        ? `No courts match "${searchQuery}"`
                        : 'There are no verified courts at the moment. Check back later!'
                    }
                </Text>
                {searchQuery && (
                    <TouchableOpacity onPress={() => searchVenues('')}>
                        <Text style={styles.clearSearch}>Clear search</Text>
                    </TouchableOpacity>
                )}
            </Card>
        </View>
    );

    const renderErrorState = () => (
        <View style={styles.emptyContainer}>
            <Card variant="glass" padding="lg" style={styles.emptyCard}>
                <Ionicons name="alert-circle-outline" size={64} color={Colors.dark.error} />
                <Text style={styles.emptyTitle}>Something went wrong</Text>
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity onPress={fetchVenues} style={styles.retryButton}>
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </Card>
        </View>
    );

    const renderCourtItem = useCallback(({ item }: { item: any }) => (
        <View style={styles.cardWrapper}>
            <CourtCard
                venue={item}
                onPress={() => handleVenuePress(item.id)}
            />
        </View>
    ), [handleVenuePress]);

    const getItemLayout = useCallback(
        (data: any, index: number) => ({
            length: 180, // Approximate height of CourtCard + margin
            offset: 180 * index,
            index,
        }),
        []
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Courts</Text>
                {/* View Toggle */}
                <View style={styles.viewToggleContainer}>
                    <TouchableOpacity
                        style={[styles.viewToggleButton, styles.viewToggleButtonActive]}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="list" size={16} color={Colors.dark.background} />
                        <Text style={[styles.viewToggleText, styles.viewToggleTextActive]}>List</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.viewToggleButton}
                        onPress={() => router.push('/map')}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="map-outline" size={16} color={Colors.dark.textSecondary} />
                        <Text style={styles.viewToggleText}>Map</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchRow}>
                    <View style={styles.searchBar}>
                        <Ionicons name="search" size={20} color={Colors.dark.textTertiary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search courts or venues..."
                            placeholderTextColor={Colors.dark.textTertiary}
                            value={searchQuery}
                            onChangeText={searchVenues}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity style={{ padding: 12, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => searchVenues('')}>
                                <Ionicons name="close-circle" size={20} color={Colors.dark.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={() => setIsFilterVisible(true)}
                    >
                        <Ionicons name="options" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Results count */}
            {!isLoading && venues.length > 0 && (
                <Text style={styles.resultCount}>
                    {venues.length} venue{venues.length !== 1 ? 's' : ''} found
                </Text>
            )}

            {/* Court List */}
            {error ? renderErrorState() : isInitialLoad ? (
                <View style={styles.listContent}>
                    <CourtListSkeleton />
                </View>
            ) : (
                <FlatList
                    data={venues}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCourtItem}
                    getItemLayout={getItemLayout}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isLoading}
                            onRefresh={handleRefresh}
                            tintColor={Colors.dark.primary}
                            colors={[Colors.dark.primary]}
                        />
                    }
                    ListHeaderComponent={
                        recommendations.length > 0 && !searchQuery ? (
                            <View style={styles.recsSection}>
                                <View style={styles.recsTitleRow}>
                                    <View style={styles.sparkleIconBg}>
                                        <Ionicons name="sparkles" size={14} color="#F59E0B" />
                                    </View>
                                    <Text style={styles.recsTitle}>Recommended For You</Text>
                                </View>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.recsScroll}
                                >
                                    {recommendations.map((court) => {
                                        const venue = Array.isArray(court.venues) ? court.venues[0] : court.venues;
                                        return (
                                            <TouchableOpacity
                                                key={court.id}
                                                style={styles.recCard}
                                                onPress={() => venue && router.push(`/courts/${venue.id}`)}
                                                activeOpacity={0.8}
                                            >
                                                <View style={styles.recBadge}>
                                                    <Ionicons name="sparkles" size={12} color="white" />
                                                    <Text style={styles.recBadgeText}>Recommended</Text>
                                                </View>
                                                <Text style={styles.recCourtName} numberOfLines={1}>{court.name}</Text>
                                                <Text style={styles.recVenueName} numberOfLines={1}>
                                                    {venue?.name || 'Venue'}
                                                </Text>
                                                <View style={styles.recPriceContainer}>
                                                    <Text style={styles.recPrice}>₱{court.hourly_rate}</Text>
                                                    <Text style={styles.recPriceUnit}>/hr</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={renderEmptyState}
                    ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
                />
            )}

            <FilterBottomSheet
                visible={isFilterVisible}
                onClose={() => setIsFilterVisible(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    title: {
        ...Typography.h1,
        color: Colors.dark.text,
    },
    viewToggleContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.lg,
        padding: 4,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    viewToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: Radius.md,
        gap: 6,
        minHeight: 44,
        justifyContent: 'center',
    },
    viewToggleButtonActive: {
        backgroundColor: Colors.dark.primary,
    },
    viewToggleText: {
        ...Typography.bodySmall,
        fontWeight: '600',
        color: Colors.dark.textSecondary,
    },
    viewToggleTextActive: {
        color: Colors.dark.background,
    },
    searchContainer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        height: 48,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        gap: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        ...Typography.body,
        color: Colors.dark.text,
    },
    filterButton: {
        width: 48,
        height: 48,
        borderRadius: Radius.md,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    resultCount: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    listContent: {
        padding: Spacing.lg,
        paddingTop: 0,
        paddingBottom: 80, // Add bottom padding for better scrolling experience
    },
    cardWrapper: {
        marginBottom: 0,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    emptyCard: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    emptyTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
        marginTop: Spacing.md,
    },
    emptyText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },
    clearSearch: {
        ...Typography.body,
        color: Colors.dark.primary,
        marginTop: Spacing.md,
        fontWeight: '500',
    },
    retryButton: {
        marginTop: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.dark.primary,
        borderRadius: Radius.md,
    },
    retryText: {
        ...Typography.button,
        color: Colors.dark.text,
    },
    recsSection: {
        marginBottom: Spacing.lg,
    },
    recsTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.md,
    },
    sparkleIconBg: {
        backgroundColor: '#F59E0B20',
        padding: 4,
        borderRadius: Radius.full,
    },
    recsTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
        fontSize: 16,
    },
    recsScroll: {
        gap: Spacing.sm,
    },
    recCard: {
        width: 156,
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.md,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: '#F59E0B40',
        paddingTop: 36, // leave room for badge
    },
    recBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F59E0B',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: Radius.sm,
        gap: 4,
    },
    recBadgeText: {
        ...Typography.caption,
        color: 'white',
        fontWeight: '700',
        fontSize: 10,
    },
    recCourtName: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '700',
        fontSize: 14,
    },
    recVenueName: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    recPriceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: Spacing.sm,
    },
    recPrice: {
        ...Typography.h3,
        color: Colors.dark.primary,
        fontWeight: '700',
        fontSize: 16,
    },
    recPriceUnit: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginLeft: 2,
    }
});
