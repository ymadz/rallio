import React, { useEffect, useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    FlatList,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, CourtListSkeleton } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

interface Reservation {
    id: string;
    court_id: string;
    start_time: string;
    end_time: string;
    num_players: number;
    total_amount: number;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
    courts?: {
        name: string;
        venues?: {
            name: string;
            address: string;
        };
    };
}

interface BookingCardProps {
    booking: Reservation;
    onPress: () => void;
}

const BookingCard = React.memo(({ booking, onPress }: BookingCardProps) => {
    const startTime = new Date(booking.start_time);
    const endTime = new Date(booking.end_time);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const formatDate = (date: Date) => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const isUpcoming = startTime > new Date();
    const isPast = endTime < new Date();

    const statusColors: Record<string, { bg: string; text: string }> = {
        pending: { bg: Colors.dark.warning + '20', text: Colors.dark.warning },
        confirmed: { bg: Colors.dark.success + '20', text: Colors.dark.success },
        cancelled: { bg: Colors.dark.error + '20', text: Colors.dark.error },
        completed: { bg: Colors.dark.textTertiary + '20', text: Colors.dark.textTertiary },
        no_show: { bg: Colors.dark.error + '20', text: Colors.dark.error },
    };

    const statusLabels: Record<string, string> = {
        pending: 'Pending Payment',
        confirmed: 'Confirmed',
        cancelled: 'Cancelled',
        completed: 'Completed',
        no_show: 'No Show',
    };

    // Get status color with fallback
    const statusColor = statusColors[booking.status] || {
        bg: Colors.dark.textTertiary + '20',
        text: Colors.dark.textTertiary
    };
    const statusLabel = statusLabels[booking.status] || booking.status;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <Card variant="glass" padding="md" style={styles.bookingCard}>
                {/* Status badge */}
                <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                    <Text style={[styles.statusText, { color: statusColor.text }]}>
                        {statusLabel}
                    </Text>
                </View>

                {/* Venue Info */}
                <Text style={styles.venueName}>
                    {booking.courts?.venues?.name || 'Unknown Venue'}
                </Text>
                <Text style={styles.courtName}>
                    {booking.courts?.name || 'Court'}
                </Text>

                {/* Date & Time */}
                <View style={styles.timeRow}>
                    <View style={styles.timeItem}>
                        <Ionicons name="calendar-outline" size={16} color={Colors.dark.textSecondary} />
                        <Text style={styles.timeText}>{formatDate(startTime)}</Text>
                    </View>
                    <View style={styles.timeItem}>
                        <Ionicons name="time-outline" size={16} color={Colors.dark.textSecondary} />
                        <Text style={styles.timeText}>
                            {formatTime(startTime)} - {formatTime(endTime)}
                        </Text>
                    </View>
                </View>

                {/* Bottom row */}
                <View style={styles.bottomRow}>
                    <View style={styles.playersInfo}>
                        <Ionicons name="people-outline" size={16} color={Colors.dark.textSecondary} />
                        <Text style={styles.playersText}>
                            {booking.num_players} player{booking.num_players !== 1 ? 's' : ''}
                        </Text>
                    </View>
                    <Text style={styles.amount}>₱{booking.total_amount.toFixed(2)}</Text>
                </View>
            </Card>
        </TouchableOpacity>
    );
});

BookingCard.displayName = 'BookingCard';

type TabKey = 'upcoming' | 'past';

export default function BookingsScreen() {
    const { user } = useAuthStore();
    const [bookings, setBookings] = useState<Reservation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>('upcoming');

    const fetchBookings = useCallback(async (showRefreshIndicator = false) => {
        if (!user) return;

        try {
            if (showRefreshIndicator) setIsRefreshing(true);
            else setIsLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('reservations')
                .select(`
                    *,
                    courts (
                        name,
                        venues (
                            name,
                            address
                        )
                    )
                `)
                .eq('user_id', user.id)
                .order('start_time', { ascending: false });

            if (fetchError) throw fetchError;
            setBookings(data || []);
        } catch (err: any) {
            console.error('Error fetching bookings:', err);
            setError(err.message || 'Failed to load bookings');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const handleRefresh = useCallback(() => {
        fetchBookings(true);
    }, [fetchBookings]);

    const handleBookingPress = (bookingId: string) => {
        // TODO: Navigate to booking details
        console.log('Booking pressed:', bookingId);
    };

    // Filter bookings by tab
    const now = new Date();
    const filteredBookings = bookings.filter(booking => {
        const endTime = new Date(booking.end_time);
        if (activeTab === 'upcoming') {
            return endTime >= now && booking.status !== 'cancelled';
        }
        return endTime < now || booking.status === 'cancelled';
    });

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Card variant="glass" padding="lg" style={styles.emptyCard}>
                <Ionicons
                    name={activeTab === 'upcoming' ? 'calendar-outline' : 'checkmark-done-outline'}
                    size={64}
                    color={Colors.dark.textTertiary}
                />
                <Text style={styles.emptyTitle}>
                    {activeTab === 'upcoming' ? 'No Upcoming Bookings' : 'No Past Bookings'}
                </Text>
                <Text style={styles.emptyText}>
                    {activeTab === 'upcoming'
                        ? 'Book a court to get started!'
                        : 'Your completed bookings will appear here'}
                </Text>
                {activeTab === 'upcoming' && (
                    <TouchableOpacity
                        style={styles.findCourtsButton}
                        onPress={() => router.push('/courts')}
                    >
                        <MaterialCommunityIcons name="badminton" size={20} color={Colors.dark.text} />
                        <Text style={styles.findCourtsText}>Find Courts</Text>
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
                <TouchableOpacity onPress={() => fetchBookings()} style={styles.retryButton}>
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </Card>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>My Bookings</Text>
            </View>

            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
                    onPress={() => setActiveTab('upcoming')}
                >
                    <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
                        Upcoming
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'past' && styles.tabActive]}
                    onPress={() => setActiveTab('past')}
                >
                    <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
                        Past
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {isLoading ? (
                <View style={styles.listContent}>
                    <CourtListSkeleton />
                </View>
            ) : error ? (
                renderErrorState()
            ) : (
                <FlatList
                    data={filteredBookings}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <BookingCard
                            booking={item}
                            onPress={() => handleBookingPress(item.id)}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={handleRefresh}
                            tintColor={Colors.dark.primary}
                            colors={[Colors.dark.primary]}
                        />
                    }
                    ListEmptyComponent={renderEmptyState}
                    ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    header: {
        padding: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    title: {
        ...Typography.h1,
        color: Colors.dark.text,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        gap: Spacing.sm,
    },
    tab: {
        flex: 1,
        paddingVertical: Spacing.sm,
        alignItems: 'center',
        borderRadius: Radius.md,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    tabActive: {
        backgroundColor: Colors.dark.primary + '20',
        borderColor: Colors.dark.primary,
    },
    tabText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        fontWeight: '500',
    },
    tabTextActive: {
        color: Colors.dark.primary,
    },
    listContent: {
        padding: Spacing.lg,
        paddingTop: 0,
        paddingBottom: 100,
    },
    bookingCard: {
        marginBottom: 0,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
        marginBottom: Spacing.sm,
    },
    statusText: {
        ...Typography.caption,
        fontWeight: '600',
    },
    venueName: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    courtName: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.sm,
    },
    timeRow: {
        flexDirection: 'row',
        gap: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    timeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    timeText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    playersInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    playersText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    amount: {
        ...Typography.h3,
        color: Colors.dark.primary,
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
        marginBottom: Spacing.md,
    },
    findCourtsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        gap: Spacing.xs,
    },
    findCourtsText: {
        ...Typography.button,
        color: Colors.dark.text,
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
