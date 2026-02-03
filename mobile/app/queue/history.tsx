import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

interface HistoryItem {
    id: string;
    courtName: string;
    venueName: string;
    status: string;
    date: string;
    joinedAt: string;
    leftAt: string | null;
    gamesPlayed: number;
    gamesWon: number;
    totalCost: number;
    paymentStatus: string;
    userStatus: string;
}

export default function QueueHistoryScreen() {
    const { user } = useAuthStore();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        if (!user) return;

        try {
            // Logic mirrors web: getMyQueueHistory
            const { data: participations, error } = await supabase
                .from('queue_participants')
                .select(`
                    *,
                    queue_sessions!inner (
                        *,
                        courts (
                            name,
                            venues (
                                name
                            )
                        )
                    )
                `)
                .eq('user_id', user.id)
                .or('status.eq.left,queue_sessions.status.in.(closed,cancelled),queue_sessions.end_time.lt.now()')
                .order('joined_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            const items: HistoryItem[] = (participations || []).map((p: any) => {
                const costPerGame = parseFloat(p.queue_sessions.cost_per_game || '0');
                const gamesPlayed = p.games_played || 0;
                const totalCost = costPerGame * gamesPlayed;

                return {
                    id: p.queue_session_id,
                    courtName: p.queue_sessions.courts?.name || 'Unknown Court',
                    venueName: p.queue_sessions.courts?.venues?.name || 'Unknown Venue',
                    status: p.queue_sessions.status,
                    date: p.queue_sessions.start_time,
                    joinedAt: p.joined_at,
                    leftAt: p.left_at,
                    gamesPlayed,
                    gamesWon: p.games_won || 0,
                    totalCost,
                    paymentStatus: p.payment_status,
                    userStatus: p.status,
                };
            });

            setHistory(items);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderItem = ({ item }: { item: HistoryItem }) => (
        <Card variant="glass" padding="md" style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.venueName}>{item.venueName}</Text>
                    <Text style={styles.courtName}>{item.courtName}</Text>
                </View>
                <View style={[styles.statusBadge, {
                    backgroundColor: item.userStatus === 'left' ? Colors.dark.surface : Colors.dark.success + '20'
                }]}>
                    <Text style={[styles.statusText, {
                        color: item.userStatus === 'left' ? Colors.dark.textSecondary : Colors.dark.success
                    }]}>
                        {item.userStatus === 'left' ? 'Left Early' : 'Completed'}
                    </Text>
                </View>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>GAMES</Text>
                    <Text style={styles.statValue}>{item.gamesPlayed}</Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>WON</Text>
                    <Text style={[styles.statValue, { color: Colors.dark.primary }]}>{item.gamesWon}</Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.statLabel}>PAID</Text>
                    <Text style={styles.statValue}>₱{item.totalCost.toFixed(0)}</Text>
                </View>
            </View>

            <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={14} color={Colors.dark.textSecondary} />
                <Text style={styles.dateText}>
                    {new Date(item.date).toLocaleDateString()}
                </Text>
                {/* Future: Add Arrow for details */}
            </View>
        </Card>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Queue History</Text>
                <View style={{ width: 44 }} />
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.dark.primary} />
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No history yet</Text>
                        </View>
                    }
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
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        ...Typography.h2,
        color: Colors.dark.text,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: Spacing.lg,
    },
    card: {
        marginBottom: Spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    venueName: {
        ...Typography.h3,
        color: Colors.dark.text,
        fontSize: 16,
    },
    courtName: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: Radius.sm,
    },
    statusText: {
        ...Typography.caption,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
        paddingVertical: Spacing.sm,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.dark.border,
    },
    stat: {
        alignItems: 'center',
    },
    statLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        fontSize: 10,
        marginBottom: 2,
    },
    statValue: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    dateText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    emptyContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
});
