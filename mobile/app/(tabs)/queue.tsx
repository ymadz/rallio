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

interface QueueSession {
    id: string;
    court_id: string;
    organizer_id: string;
    start_time: string;
    end_time: string;
    mode: 'casual' | 'competitive';
    game_format: 'singles' | 'doubles' | 'mixed';
    max_players: number;
    current_players: number;
    cost_per_game: number | null;
    is_public: boolean;
    status: 'draft' | 'open' | 'active' | 'paused' | 'closed' | 'cancelled';
    courts?: {
        name: string;
        venues?: {
            name: string;
            address: string;
        };
    };
}

interface QueueCardProps {
    session: QueueSession;
    onPress: () => void;
}

const QueueCard = React.memo(({ session, onPress }: QueueCardProps) => {
    const startTime = new Date(session.start_time);
    const endTime = new Date(session.end_time);

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

    const spotsLeft = session.max_players - session.current_players;
    const isFull = spotsLeft <= 0;

    const statusColors: Record<string, string> = {
        open: Colors.dark.success,
        active: Colors.dark.primary,
        paused: Colors.dark.warning,
        closed: Colors.dark.textTertiary,
    };

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <Card variant="glass" padding="md" style={styles.queueCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.headerLeft}>
                        <View style={[styles.statusBadge, { backgroundColor: statusColors[session.status] + '20' }]}>
                            <View style={[styles.statusDot, { backgroundColor: statusColors[session.status] }]} />
                            <Text style={[styles.statusText, { color: statusColors[session.status] }]}>
                                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                            </Text>
                        </View>
                        <View style={[styles.modeBadge, { backgroundColor: session.mode === 'competitive' ? Colors.dark.warning + '20' : Colors.dark.info + '20' }]}>
                            <Text style={[styles.modeText, { color: session.mode === 'competitive' ? Colors.dark.warning : Colors.dark.info }]}>
                                {session.mode === 'competitive' ? '🏆 Competitive' : '🎾 Casual'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Venue Info */}
                <Text style={styles.venueName}>
                    {session.courts?.venues?.name || 'Unknown Venue'}
                </Text>
                <Text style={styles.courtName}>
                    {session.courts?.name || 'Court'}
                </Text>

                {/* Time & Date */}
                <View style={styles.timeRow}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.dark.textSecondary} />
                    <Text style={styles.timeText}>
                        {formatDate(startTime)} • {formatTime(startTime)} - {formatTime(endTime)}
                    </Text>
                </View>

                {/* Players & Format */}
                <View style={styles.bottomRow}>
                    <View style={styles.playersInfo}>
                        <Ionicons name="people" size={18} color={Colors.dark.textSecondary} />
                        <Text style={styles.playersText}>
                            {session.current_players}/{session.max_players} players
                        </Text>
                        {!isFull && (
                            <Text style={styles.spotsText}>
                                ({spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left)
                            </Text>
                        )}
                    </View>
                    <View style={styles.formatBadge}>
                        <Text style={styles.formatText}>
                            {session.game_format.charAt(0).toUpperCase() + session.game_format.slice(1)}
                        </Text>
                    </View>
                </View>

                {/* Cost */}
                {session.cost_per_game && (
                    <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Cost per game:</Text>
                        <Text style={styles.costValue}>₱{session.cost_per_game}</Text>
                    </View>
                )}

                {/* Join Button */}
                <TouchableOpacity
                    style={[styles.joinButton, isFull && styles.joinButtonDisabled]}
                    disabled={isFull}
                    onPress={onPress}
                >
                    <Text style={[styles.joinButtonText, isFull && styles.joinButtonTextDisabled]}>
                        {isFull ? 'Queue Full' : 'Join Queue'}
                    </Text>
                </TouchableOpacity>
            </Card>
        </TouchableOpacity>
    );
});

QueueCard.displayName = 'QueueCard';

export default function QueueScreen() {
    const { user } = useAuthStore();
    const [sessions, setSessions] = useState<QueueSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchQueueSessions = useCallback(async (showRefreshIndicator = false) => {
        try {
            if (showRefreshIndicator) setIsRefreshing(true);
            else setIsLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('queue_sessions')
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
                .in('status', ['open', 'active'])
                .gte('end_time', new Date().toISOString())
                .order('start_time', { ascending: true });

            if (fetchError) throw fetchError;
            setSessions(data || []);
        } catch (err: any) {
            console.error('Error fetching queue sessions:', err);
            setError(err.message || 'Failed to load queue sessions');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchQueueSessions();
    }, [fetchQueueSessions]);

    const handleRefresh = useCallback(() => {
        fetchQueueSessions(true);
    }, [fetchQueueSessions]);

    const handleSessionPress = (sessionId: string) => {
        router.push(`/queue/${sessionId}`);
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Card variant="glass" padding="lg" style={styles.emptyCard}>
                <MaterialCommunityIcons name="badminton" size={64} color={Colors.dark.textTertiary} />
                <Text style={styles.emptyTitle}>No Active Queues</Text>
                <Text style={styles.emptyText}>
                    There are no queue sessions happening right now.{"\n"}Check back later!
                </Text>
                <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={() => fetchQueueSessions()}
                >
                    <Ionicons name="refresh" size={18} color={Colors.dark.text} />
                    <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
            </Card>
        </View>
    );

    const renderErrorState = () => (
        <View style={styles.emptyContainer}>
            <Card variant="glass" padding="lg" style={styles.emptyCard}>
                <Ionicons name="alert-circle-outline" size={64} color={Colors.dark.error} />
                <Text style={styles.emptyTitle}>Something went wrong</Text>
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity onPress={() => fetchQueueSessions()} style={styles.retryButton}>
                    <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
            </Card>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Join Queue</Text>
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
                    data={sessions}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <QueueCard
                            session={item}
                            onPress={() => handleSessionPress(item.id)}
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
    subtitle: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },

    listContent: {
        padding: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: 100,
    },
    queueCard: {
        marginBottom: 0,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    headerLeft: {
        flexDirection: 'row',
        gap: Spacing.xs,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
        gap: 4,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        ...Typography.caption,
        fontWeight: '600',
    },
    modeBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    modeText: {
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
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    timeText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    playersInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    playersText: {
        ...Typography.body,
        color: Colors.dark.text,
    },
    spotsText: {
        ...Typography.bodySmall,
        color: Colors.dark.success,
    },
    formatBadge: {
        backgroundColor: Colors.dark.surface,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    formatText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    costRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
        marginBottom: Spacing.sm,
    },
    costLabel: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
    },
    costValue: {
        ...Typography.body,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    joinButton: {
        backgroundColor: Colors.dark.primary,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        alignItems: 'center',
    },
    joinButtonDisabled: {
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    joinButtonText: {
        ...Typography.button,
        color: Colors.dark.text,
    },
    joinButtonTextDisabled: {
        color: Colors.dark.textTertiary,
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
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        gap: Spacing.xs,
    },
    refreshButtonText: {
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
