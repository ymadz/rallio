import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button, Avatar } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

interface Participant {
    id: string;
    user_id: string;
    status: 'waiting' | 'playing' | 'completed' | 'left';
    games_played: number;
    games_won: number;
    amount_owed: number;
    payment_status: 'unpaid' | 'partial' | 'paid';
    joined_at: string;
    left_at: string | null;
    user?: {
        display_name: string;
        first_name: string;
        last_name: string;
        avatar_url: string | null;
    };
}

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
    status: string;
    courts?: {
        name: string;
        venues?: {
            name: string;
            address: string;
        };
    };
    organizer?: {
        display_name: string;
        avatar_url: string | null;
    };
}

export default function QueueDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();
    const [session, setSession] = useState<QueueSession | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Active participants (not left)
    const activeParticipants = participants.filter(p => !p.left_at && p.status !== 'left');

    // User's participation info
    const userParticipant = activeParticipants.find(p => p.user_id === user?.id);
    const isInQueue = !!userParticipant;

    // Calculate position (sorted by joined_at)
    const sortedParticipants = [...activeParticipants].sort(
        (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    );
    const userPosition = userParticipant
        ? sortedParticipants.findIndex(p => p.user_id === user?.id) + 1
        : null;
    const estimatedWaitTime = userPosition ? userPosition * 15 : null;

    // Queue state
    const spotsLeft = session ? session.max_players - session.current_players : 0;
    const isFull = spotsLeft <= 0;

    const fetchSession = useCallback(async (showRefreshIndicator = false) => {
        if (!id) return;

        if (showRefreshIndicator) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);

        try {
            // Fetch session details
            const { data: sessionData, error: sessionError } = await supabase
                .from('queue_sessions')
                .select(`
                    *,
                    courts (
                        name,
                        venues (
                            name,
                            address
                        )
                    ),
                    organizer:organizer_id (
                        display_name,
                        avatar_url
                    )
                `)
                .eq('id', id)
                .single();

            if (sessionError) throw sessionError;

            setSession({
                ...sessionData,
                organizer: Array.isArray(sessionData.organizer)
                    ? sessionData.organizer[0]
                    : sessionData.organizer
            });

            // Fetch participants separately for better control
            const { data: participantsData, error: participantsError } = await supabase
                .from('queue_participants')
                .select(`
                    id,
                    user_id,
                    status,
                    games_played,
                    games_won,
                    amount_owed,
                    payment_status,
                    joined_at,
                    left_at,
                    user:user_id (
                        display_name,
                        first_name,
                        last_name,
                        avatar_url
                    )
                `)
                .eq('queue_session_id', id)
                .is('left_at', null)
                .order('joined_at', { ascending: true });

            if (participantsError) {
                console.error('Participants fetch error:', participantsError);
            } else {
                const formatted = (participantsData || []).map((p: any) => ({
                    ...p,
                    user: Array.isArray(p.user) ? p.user[0] : p.user
                }));
                setParticipants(formatted);
            }
        } catch (err: any) {
            console.error('Error fetching session:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [id]);

    useEffect(() => {
        fetchSession();
    }, [fetchSession]);

    // Real-time subscription for participant updates
    useEffect(() => {
        if (!id) return;

        const channel = supabase
            .channel(`queue_participants_${id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'queue_participants',
                    filter: `queue_session_id=eq.${id}`,
                },
                (payload) => {
                    console.log('Queue participant change:', payload.eventType);
                    fetchSession();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, fetchSession]);

    const handleJoinQueue = async () => {
        if (!user || !session) return;

        setIsJoining(true);
        try {
            // Check for existing record (including left ones for cooldown)
            const { data: existing } = await supabase
                .from('queue_participants')
                .select('id, left_at')
                .eq('queue_session_id', session.id)
                .eq('user_id', user.id)
                .order('left_at', { ascending: false, nullsFirst: true })
                .limit(1)
                .maybeSingle();

            if (existing && !existing.left_at) {
                Alert.alert('Already in Queue', 'You are already in this queue.');
                return;
            }

            // Check cooldown (5 minutes after leaving)
            if (existing?.left_at) {
                const leftAt = new Date(existing.left_at);
                const cooldownEnd = new Date(leftAt.getTime() + 5 * 60 * 1000);
                const now = new Date();

                if (now < cooldownEnd) {
                    const remaining = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 1000);
                    const mins = Math.floor(remaining / 60);
                    const secs = remaining % 60;
                    Alert.alert('Cooldown', `Please wait ${mins}m ${secs}s before rejoining.`);
                    return;
                }

                // Reactivate existing record
                const { error: updateError } = await supabase
                    .from('queue_participants')
                    .update({
                        left_at: null,
                        status: 'waiting',
                        joined_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;
            } else {
                // Insert new participant
                const { error: insertError } = await supabase
                    .from('queue_participants')
                    .insert({
                        queue_session_id: session.id,
                        user_id: user.id,
                        status: 'waiting',
                        payment_status: 'unpaid',
                        amount_owed: 0,
                        games_played: 0,
                        games_won: 0,
                    });

                if (insertError) throw insertError;
            }

            Alert.alert('Joined!', 'You have joined the queue.');
            fetchSession();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to join queue');
        } finally {
            setIsJoining(false);
        }
    };

    const handleLeaveQueue = async () => {
        if (!user || !session || !userParticipant) return;

        // Check if user owes money
        const amountOwed = parseFloat(String(userParticipant.amount_owed || 0));
        const gamesPlayed = userParticipant.games_played || 0;

        if (gamesPlayed > 0 && amountOwed > 0 && userParticipant.payment_status !== 'paid') {
            Alert.alert(
                'Payment Required',
                `You owe ₱${amountOwed.toFixed(2)} for ${gamesPlayed} game(s).\n\nPlease pay the Queue Master before leaving.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'I Have Paid',
                        onPress: () => confirmLeave(),
                    },
                ]
            );
            return;
        }

        confirmLeave();
    };

    const confirmLeave = () => {
        Alert.alert(
            'Leave Queue',
            'Are you sure you want to leave this queue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        if (!userParticipant) return;

                        setIsLeaving(true);
                        try {
                            const { error: leaveError } = await supabase
                                .from('queue_participants')
                                .update({
                                    left_at: new Date().toISOString(),
                                    status: 'left',
                                })
                                .eq('id', userParticipant.id);

                            if (leaveError) throw leaveError;

                            Alert.alert('Left Queue', 'You have left the queue.');
                            fetchSession();
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to leave queue');
                        } finally {
                            setIsLeaving(false);
                        }
                    }
                }
            ]
        );
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };

    const getDisplayName = (participant: Participant) => {
        if (participant.user?.display_name) return participant.user.display_name;
        if (participant.user?.first_name || participant.user?.last_name) {
            return `${participant.user.first_name || ''} ${participant.user.last_name || ''}`.trim();
        }
        return 'Player';
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

    if (error || !session) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>
                </View>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={Colors.dark.error} />
                    <Ionicons name="alert-circle-outline" size={48} color={Colors.dark.error} />
                    <Text style={styles.errorText}>{error || 'Queue not found'}</Text>
                    <Button onPress={() => router.back()} style={{ marginTop: Spacing.md }}>Go Back</Button>
                </View>
            </SafeAreaView>
        );
    }

    const statusColors: Record<string, string> = {
        open: Colors.dark.success,
        active: Colors.dark.primary,
        paused: Colors.dark.warning,
        closed: Colors.dark.textTertiary,
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Queue Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => fetchSession(true)}
                        tintColor={Colors.dark.primary}
                    />
                }
            >
                {/* Status Banner */}
                <View style={[styles.statusBanner, { backgroundColor: statusColors[session.status] + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColors[session.status] }]} />
                    <Text style={[styles.statusText, { color: statusColors[session.status] }]}>
                        {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                    </Text>
                    <View style={[styles.modeBadge, {
                        backgroundColor: session.mode === 'competitive' ? Colors.dark.warning + '20' : Colors.dark.info + '20'
                    }]}>
                        <Text style={[styles.modeText, {
                            color: session.mode === 'competitive' ? Colors.dark.warning : Colors.dark.info
                        }]}>
                            {session.mode === 'competitive' ? '🏆 Competitive' : '🎾 Casual'}
                        </Text>
                    </View>
                </View>

                {/* Venue Info */}
                <View style={styles.section}>
                    <Text style={styles.venueName}>
                        {session.courts?.venues?.name || 'Unknown Venue'}
                    </Text>
                    <Text style={styles.courtName}>{session.courts?.name}</Text>
                    <View style={styles.addressRow}>
                        <Ionicons name="location" size={16} color={Colors.dark.textSecondary} />
                        <Text style={styles.address}>{session.courts?.venues?.address}</Text>
                    </View>
                </View>

                {/* User Position Card (if in queue) */}
                {isInQueue && userParticipant && (
                    <Card variant="elevated" padding="lg" style={styles.positionCard}>
                        <View style={styles.positionHeader}>
                            <Text style={styles.positionLabel}>Your Position</Text>
                            {userParticipant.status === 'playing' && (
                                <View style={styles.playingBadge}>
                                    <Text style={styles.playingBadgeText}>🎮 Playing Now!</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.positionDisplay}>
                            <Text style={styles.positionNumber}>
                                {userParticipant.status === 'playing' ? '🎮' : `#${userPosition}`}
                            </Text>
                            {userParticipant.status === 'waiting' && estimatedWaitTime && (
                                <Text style={styles.waitTime}>~{estimatedWaitTime} min wait</Text>
                            )}
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{userParticipant.games_played || 0}</Text>
                                <Text style={styles.statLabel}>Played</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{userParticipant.games_won || 0}</Text>
                                <Text style={styles.statLabel}>Won</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={[styles.statValue, { color: Colors.dark.primary }]}>
                                    ₱{parseFloat(String(userParticipant.amount_owed || 0)).toFixed(0)}
                                </Text>
                                <Text style={styles.statLabel}>Owed</Text>
                            </View>
                        </View>
                    </Card>
                )}

                {/* Time & Details Card */}
                <Card variant="glass" padding="md" style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoItem}>
                            <Ionicons name="calendar" size={20} color={Colors.dark.primary} />
                            <View>
                                <Text style={styles.infoLabel}>Date</Text>
                                <Text style={styles.infoValue}>{formatDate(session.start_time)}</Text>
                            </View>
                        </View>
                        <View style={styles.infoDivider} />
                        <View style={styles.infoItem}>
                            <Ionicons name="time" size={20} color={Colors.dark.primary} />
                            <View>
                                <Text style={styles.infoLabel}>Time</Text>
                                <Text style={styles.infoValue}>
                                    {formatTime(session.start_time)} - {formatTime(session.end_time)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </Card>

                {/* Details Card */}
                <Card variant="glass" padding="md" style={styles.infoCard}>
                    <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Format</Text>
                            <Text style={styles.detailValue}>
                                {session.game_format.charAt(0).toUpperCase() + session.game_format.slice(1)}
                            </Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Players</Text>
                            <Text style={styles.detailValue}>
                                {activeParticipants.length}/{session.max_players}
                            </Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Cost</Text>
                            <Text style={styles.detailValue}>
                                {session.cost_per_game ? `₱${session.cost_per_game}/game` : 'Free'}
                            </Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Spots Left</Text>
                            <Text style={[styles.detailValue, { color: isFull ? Colors.dark.error : Colors.dark.success }]}>
                                {isFull ? 'Full' : `${spotsLeft} available`}
                            </Text>
                        </View>
                    </View>
                </Card>

                {/* Queue Master */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Queue Master</Text>
                    <View style={styles.organizerCard}>
                        <Avatar
                            source={session.organizer?.avatar_url}
                            name={session.organizer?.display_name || 'Organizer'}
                            size="md"
                        />
                        <View style={styles.organizerInfo}>
                            <Text style={styles.organizerName}>
                                {session.organizer?.display_name || 'Unknown'}
                            </Text>
                            <Text style={styles.organizerRole}>Queue Master</Text>
                        </View>
                    </View>
                </View>

                {/* Participants */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Players in Queue ({sortedParticipants.length})
                    </Text>
                    {sortedParticipants.length > 0 ? (
                        <View style={styles.participantsList}>
                            {sortedParticipants.map((p, index) => {
                                const isCurrentUser = p.user_id === user?.id;
                                return (
                                    <View
                                        key={p.id}
                                        style={[
                                            styles.participantItem,
                                            isCurrentUser && styles.participantItemCurrent
                                        ]}
                                    >
                                        <View style={styles.positionBadge}>
                                            <Text style={styles.positionBadgeText}>#{index + 1}</Text>
                                        </View>
                                        <Avatar
                                            source={p.user?.avatar_url}
                                            name={getDisplayName(p)}
                                            size="sm"
                                        />
                                        <View style={styles.participantInfo}>
                                            <Text style={[
                                                styles.participantName,
                                                isCurrentUser && styles.participantNameCurrent
                                            ]}>
                                                {getDisplayName(p)} {isCurrentUser && '(You)'}
                                            </Text>
                                            <Text style={styles.participantStats}>
                                                {p.games_played || 0} games • {p.games_won || 0} wins
                                            </Text>
                                        </View>
                                        <View style={[
                                            styles.participantStatus,
                                            { backgroundColor: p.status === 'playing' ? Colors.dark.success + '20' : Colors.dark.info + '20' }
                                        ]}>
                                            <Text style={[
                                                styles.participantStatusText,
                                                { color: p.status === 'playing' ? Colors.dark.success : Colors.dark.info }
                                            ]}>
                                                {p.status === 'playing' ? '🎮' : '⏳'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <Text style={styles.noParticipants}>No players yet. Be the first to join!</Text>
                    )}
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Bottom Action */}
            <View style={styles.bottomAction}>
                {isInQueue ? (
                    <Button
                        variant="secondary"
                        onPress={handleLeaveQueue}
                        loading={isLeaving}
                        style={styles.leaveButton}
                    >
                        {isLeaving ? 'Leaving...' : 'Leave Queue'}
                    </Button>
                ) : (
                    <Button
                        onPress={handleJoinQueue}
                        loading={isJoining}
                        disabled={isFull || isJoining}
                    >
                        {isJoining ? 'Joining...' : isFull ? 'Queue Full' : 'Join Queue'}
                    </Button>
                )}
            </View>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: Spacing.lg,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        gap: Spacing.sm,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        ...Typography.body,
        fontWeight: '600',
    },
    modeBadge: {
        marginLeft: 'auto',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    modeText: {
        ...Typography.caption,
        fontWeight: '600',
    },
    section: {
        padding: Spacing.lg,
    },
    sectionTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    venueName: {
        ...Typography.h1,
        color: Colors.dark.text,
    },
    courtName: {
        ...Typography.body,
        color: Colors.dark.primary,
        marginTop: 2,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.sm,
    },
    address: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        flex: 1,
    },
    positionCard: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
        backgroundColor: Colors.dark.primary + '10',
        borderWidth: 1,
        borderColor: Colors.dark.primary + '30',
    },
    positionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    positionLabel: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    playingBadge: {
        backgroundColor: Colors.dark.success + '20',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    playingBadgeText: {
        ...Typography.caption,
        color: Colors.dark.success,
        fontWeight: '600',
    },
    positionDisplay: {
        alignItems: 'center',
        marginVertical: Spacing.md,
    },
    positionNumber: {
        fontSize: 48,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    waitTime: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        marginTop: Spacing.xs,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
        paddingTop: Spacing.md,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    statLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    infoCard: {
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    infoDivider: {
        width: 1,
        height: 40,
        backgroundColor: Colors.dark.border,
        marginHorizontal: Spacing.md,
    },
    infoLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    infoValue: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '500',
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    detailItem: {
        width: '50%',
        paddingVertical: Spacing.xs,
    },
    detailLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    detailValue: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '500',
    },
    organizerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        padding: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    organizerInfo: {
        marginLeft: Spacing.md,
    },
    organizerName: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    organizerRole: {
        ...Typography.caption,
        color: Colors.dark.primary,
    },
    participantsList: {
        gap: Spacing.sm,
    },
    participantItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        padding: Spacing.sm,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        gap: Spacing.sm,
    },
    participantItemCurrent: {
        borderColor: Colors.dark.primary + '50',
        backgroundColor: Colors.dark.primary + '10',
    },
    positionBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.dark.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    positionBadgeText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        fontWeight: '600',
    },
    participantInfo: {
        flex: 1,
    },
    participantName: {
        ...Typography.body,
        color: Colors.dark.text,
    },
    participantNameCurrent: {
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    participantStats: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    participantStatus: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
    },
    participantStatusText: {
        fontSize: 14,
    },
    noParticipants: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        padding: Spacing.lg,
    },
    bottomAction: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: Spacing.lg,
        paddingBottom: Spacing.xl,
        backgroundColor: Colors.dark.background,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    leaveButton: {
        borderColor: Colors.dark.error,
    },
});
