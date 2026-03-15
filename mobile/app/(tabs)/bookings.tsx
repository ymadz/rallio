import React, { useEffect, useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,

    FlatList,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    amount_paid?: number;
    payment_method?: string;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending_payment' | 'partially_paid' | 'pending_refund' | 'refunded';
    metadata?: {
        type?: string;
        rescheduled?: boolean;
        week?: number;
        totalWeeks?: number;
        [key: string]: any;
    };
    recurrence_group_id?: string | null;
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
        pending_payment: { bg: Colors.dark.warning + '20', text: Colors.dark.warning },
        partially_paid: { bg: Colors.dark.info + '20', text: Colors.dark.info },
        confirmed: { bg: Colors.dark.success + '20', text: Colors.dark.success },
        cancelled: { bg: Colors.dark.error + '20', text: Colors.dark.error },
        completed: { bg: Colors.dark.textTertiary + '20', text: Colors.dark.textTertiary },
        no_show: { bg: Colors.dark.error + '20', text: Colors.dark.error },
        pending_refund: { bg: Colors.dark.warning + '20', text: Colors.dark.warning },
        refunded: { bg: Colors.dark.success + '20', text: Colors.dark.success },
    };

    const getStatusLabel = (booking: Reservation): string => {
        // Fix 17: cash pending_payment shows as "Reserved"
        if (booking.status === 'pending_payment' && booking.payment_method === 'cash') return 'Reserved';
        const labels: Record<string, string> = {
            pending: 'Pending',
            pending_payment: 'Awaiting Payment',
            partially_paid: 'Partially Paid',
            confirmed: 'Confirmed',
            cancelled: 'Cancelled',
            completed: 'Completed',
            no_show: 'No Show',
            pending_refund: 'Refund Pending',
            refunded: 'Refunded',
        };
        return labels[booking.status] || booking.status;
    };

    // Get status color with fallback
    const statusColor = statusColors[booking.status] || {
        bg: Colors.dark.textTertiary + '20',
        text: Colors.dark.textTertiary
    };
    const statusLabel = getStatusLabel(booking);

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

type TabKey = 'upcoming' | 'past' | 'refunds' | 'summary';
type SubFilter = 'all' | 'today' | 'this-week';

export default function BookingsScreen() {
    const { user } = useAuthStore();
    const [bookings, setBookings] = useState<Reservation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
    const [subFilter, setSubFilter] = useState<SubFilter>('all');

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
                .order('start_time', { ascending: false })
                .limit(200);

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
        router.push(`/bookings/${bookingId}`); // Navigate to the new details screen
    };

    // Filter bookings by tab
    const now = new Date();
    const filteredBookings = bookings.filter(booking => {
        const endTime = new Date(booking.end_time);
        const startTime = new Date(booking.start_time);

        // Fix 1: Refunds tab
        if (activeTab === 'refunds') {
            return ['refunded', 'pending_refund'].includes(booking.status);
        }

        // Fix 14: Summary tab shows all bookings
        if (activeTab === 'summary') return true;

        // Top-level tab filter
        let passesTab = false;
        if (activeTab === 'upcoming') {
            passesTab = endTime >= now &&
                !['cancelled', 'refunded', 'pending_refund'].includes(booking.status);
        } else {
            passesTab = endTime < now || booking.status === 'cancelled';
        }
        if (!passesTab) return false;

        // Sub-filter for upcoming tab
        if (activeTab === 'upcoming' && subFilter !== 'all') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            const endOfWeek = new Date(today);
            endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

            if (subFilter === 'today') {
                return startTime >= today && startTime < tomorrow;
            }
            if (subFilter === 'this-week') {
                return startTime >= today && startTime < endOfWeek;
            }
        }

        return true;
    });

    // Fix 1: Refund count for tab badge
    const refundCount = bookings.filter(b => ['refunded', 'pending_refund'].includes(b.status)).length;

    // Stats
    const totalBookings = bookings.length;
    const awaitingPayment = bookings.filter(b =>
        ['pending', 'pending_payment', 'partially_paid'].includes(b.status)
    ).length;
    const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Card variant="glass" padding="lg" style={styles.emptyCard}>
                <Ionicons
                    name={
                        activeTab === 'upcoming' ? 'calendar-outline'
                        : activeTab === 'refunds' ? 'refresh-outline'
                        : 'checkmark-done-outline'
                    }
                    size={64}
                    color={Colors.dark.textTertiary}
                />
                <Text style={styles.emptyTitle}>
                    {activeTab === 'upcoming' ? 'No Upcoming Bookings'
                    : activeTab === 'refunds' ? 'No Refunds'
                    : 'No Past Bookings'}
                </Text>
                <Text style={styles.emptyText}>
                    {activeTab === 'upcoming'
                        ? 'Book a court to get started!'
                        : activeTab === 'refunds'
                        ? 'Refunded or pending refund bookings will appear here'
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

    const renderBookingItem = useCallback(({ item }: { item: Reservation }) => (
        <BookingCard
            booking={item}
            onPress={() => handleBookingPress(item.id)}
        />
    ), []);

    const getItemLayout = useCallback(
        (data: any, index: number) => ({
            length: 140, // Approximate height of BookingCard + margin
            offset: 140 * index,
            index,
        }),
        []
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>My Bookings</Text>
            </View>

            {/* Stats Cards */}
            {!isLoading && !error && bookings.length > 0 && (
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{totalBookings}</Text>
                        <Text style={styles.statLabel}>Total</Text>
                    </View>
                    <View style={[styles.statCard, { borderColor: Colors.dark.warning + '40' }]}>
                        <Text style={[styles.statNumber, { color: Colors.dark.warning }]}>{awaitingPayment}</Text>
                        <Text style={styles.statLabel}>Awaiting</Text>
                    </View>
                    <View style={[styles.statCard, { borderColor: Colors.dark.success + '40' }]}>
                        <Text style={[styles.statNumber, { color: Colors.dark.success }]}>{confirmedCount}</Text>
                        <Text style={styles.statLabel}>Confirmed</Text>
                    </View>
                </View>
            )}

            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
                    onPress={() => { setActiveTab('upcoming'); setSubFilter('all'); }}
                >
                    <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>Upcoming</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'past' && styles.tabActive]}
                    onPress={() => { setActiveTab('past'); setSubFilter('all'); }}
                >
                    <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>Past</Text>
                </TouchableOpacity>
                {/* Fix 1: Refunds tab */}
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'refunds' && styles.tabActive]}
                    onPress={() => { setActiveTab('refunds'); setSubFilter('all'); }}
                >
                    <View style={styles.tabInner}>
                        <Text style={[styles.tabText, activeTab === 'refunds' && styles.tabTextActive]}>Refunds</Text>
                        {refundCount > 0 && (
                            <View style={styles.tabBadge}>
                                <Text style={styles.tabBadgeText}>{refundCount}</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
                {/* Fix 14: Summary tab */}
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'summary' && styles.tabActive]}
                    onPress={() => { setActiveTab('summary'); setSubFilter('all'); }}
                >
                    <Text style={[styles.tabText, activeTab === 'summary' && styles.tabTextActive]}>Summary</Text>
                </TouchableOpacity>
            </View>

            {/* Sub-filters for upcoming */}
            {activeTab === 'upcoming' && !isLoading && !error && (
                <View style={styles.subFilterRow}>
                    {(['all', 'today', 'this-week'] as SubFilter[]).map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.subFilterChip, subFilter === f && styles.subFilterChipActive]}
                            onPress={() => setSubFilter(f)}
                        >
                            <Text style={[styles.subFilterText, subFilter === f && styles.subFilterTextActive]}>
                                {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'This Week'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Content */}
            {isLoading ? (
                <View style={styles.listContent}>
                    <CourtListSkeleton />
                </View>
            ) : error ? (
                renderErrorState()
            ) : activeTab === 'summary' ? (
                // Fix 14: Summary view — flat table of all bookings
                <FlatList
                    data={bookings}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.dark.primary} />
                    }
                    ListHeaderComponent={
                        <View style={styles.summaryHeader}>
                            <Text style={[styles.summaryCol, { flex: 2 }]}>Venue / Court</Text>
                            <Text style={styles.summaryCol}>Date</Text>
                            <Text style={[styles.summaryCol, { textAlign: 'right' }]}>Amount</Text>
                        </View>
                    }
                    ListEmptyComponent={renderEmptyState}
                    renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => handleBookingPress(item.id)} activeOpacity={0.7}>
                            <View style={styles.summaryRow}>
                                <View style={{ flex: 2 }}>
                                    <Text style={styles.summaryVenue} numberOfLines={1}>{item.courts?.venues?.name || 'Venue'}</Text>
                                    <Text style={styles.summaryCourt} numberOfLines={1}>{item.courts?.name || 'Court'}</Text>
                                </View>
                                <Text style={styles.summaryDate}>
                                    {new Date(item.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </Text>
                                <Text style={[styles.summaryAmount, { textAlign: 'right' }]}>₱{item.total_amount.toFixed(0)}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={styles.summaryDivider} />}
                />
            ) : (
                <FlatList
                    data={filteredBookings}
                    keyExtractor={(item) => item.id}
                    renderItem={renderBookingItem}
                    getItemLayout={getItemLayout}
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
        height: 48,
        justifyContent: 'center',
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
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        gap: Spacing.sm,
    },
    statCard: {
        flex: 1,
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.md,
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    statNumber: {
        ...Typography.h2,
        color: Colors.dark.text,
    },
    statLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    subFilterRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.sm,
        gap: Spacing.xs,
    },
    subFilterChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: Radius.full,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    subFilterChipActive: {
        backgroundColor: Colors.dark.primary + '20',
        borderColor: Colors.dark.primary,
    },
    subFilterText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        fontWeight: '500',
    },
    subFilterTextActive: {
        color: Colors.dark.primary,
    },
    // Tab badge (Fix 1)
    tabInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    tabBadge: {
        backgroundColor: Colors.dark.error,
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1,
        minWidth: 16,
        alignItems: 'center',
    },
    tabBadgeText: {
        ...Typography.caption,
        color: '#fff',
        fontWeight: '700',
        fontSize: 10,
    },
    // Summary table styles (Fix 14)
    summaryHeader: {
        flexDirection: 'row',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
        marginBottom: Spacing.xs,
    },
    summaryCol: {
        flex: 1,
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.xs,
    },
    summaryVenue: {
        ...Typography.bodySmall,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    summaryCourt: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    summaryDate: {
        flex: 1,
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
    },
    summaryAmount: {
        flex: 1,
        ...Typography.bodySmall,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: Colors.dark.border + '60',
        marginHorizontal: Spacing.xs,
    },
});
