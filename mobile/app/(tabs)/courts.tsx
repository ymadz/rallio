import React, { useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    RefreshControl,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, CourtListSkeleton } from '@/components/ui';
import { CourtCard } from '@/components/courts/CourtCard';
import { useCourtStore, useFilteredVenues } from '@/store/court-store';
import { FilterBottomSheet } from '@/components/courts/FilterBottomSheet';

export default function CourtsScreen() {
    const { isLoading, error, searchQuery, fetchVenues, searchVenues } = useCourtStore();
    const venues = useFilteredVenues();
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const [isFilterVisible, setIsFilterVisible] = React.useState(false);

    useEffect(() => {
        fetchVenues().finally(() => setIsInitialLoad(false));
    }, []);

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

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Courts</Text>
                <TouchableOpacity style={styles.mapButton} onPress={() => router.push('/map')}>
                    <Ionicons name="map" size={22} color={Colors.dark.text} />
                </TouchableOpacity>
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
                            <TouchableOpacity onPress={() => searchVenues('')}>
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
                    renderItem={({ item }) => (
                        <View style={styles.cardWrapper}>
                            <CourtCard
                                venue={item}
                                onPress={() => handleVenuePress(item.id)}
                            />
                        </View>
                    )}
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
    mapButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
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
});
