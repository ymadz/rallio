import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

interface ActiveBooking {
    id: string;
    courtName: string;
    venueName: string;
    endTime: Date;
    type: 'reservation' | 'queue';
    courtId?: string;
}

export default function ActiveBookingBanner() {
    const { user } = useAuthStore();
    const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);
    const [timeLeft, setTimeLeft] = useState('');
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Pulse animation for the live indicator
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 0.4,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    // Fetch active bookings
    useEffect(() => {
        if (!user?.id) return;

        const fetchActive = async () => {
            const now = new Date().toISOString();

            // Check reservations
            const { data: reservations } = await supabase
                .from('reservations')
                .select(`
                    id,
                    end_time,
                    courts (
                        name,
                        venues ( name )
                    )
                `)
                .eq('user_id', user.id)
                .in('status', ['confirmed', 'partially_paid'])
                .lte('start_time', now)
                .gte('end_time', now)
                .order('start_time', { ascending: true })
                .limit(1);

            if (reservations && reservations.length > 0) {
                const res = reservations[0] as any;
                setActiveBooking({
                    id: res.id,
                    courtName: res.courts?.name || 'Court',
                    venueName: res.courts?.venues?.name || 'Venue',
                    endTime: new Date(res.end_time),
                    type: 'reservation',
                });
                return;
            }

            // Check queue sessions where user is organizer
            const { data: queues } = await supabase
                .from('queue_sessions')
                .select(`
                    id,
                    court_id,
                    end_time,
                    courts (
                        name,
                        venues ( name )
                    )
                `)
                .eq('organizer_id', user.id)
                .eq('status', 'active')
                .lte('start_time', now)
                .gte('end_time', now)
                .limit(1);

            if (queues && queues.length > 0) {
                const q = queues[0] as any;
                setActiveBooking({
                    id: q.id,
                    courtName: q.courts?.name || 'Court',
                    venueName: q.courts?.venues?.name || 'Venue',
                    endTime: new Date(q.end_time),
                    type: 'queue',
                    courtId: q.court_id,
                });
            }
        };

        fetchActive();
        // Refresh every 60 seconds
        const interval = setInterval(fetchActive, 60000);
        return () => clearInterval(interval);
    }, [user?.id]);

    // Countdown timer
    useEffect(() => {
        if (!activeBooking) return;

        const updateTimer = () => {
            const now = new Date();
            const diff = activeBooking.endTime.getTime() - now.getTime();
            if (diff <= 0) {
                setActiveBooking(null);
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m left`);
            } else {
                setTimeLeft(`${minutes}m left`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 30000);
        return () => clearInterval(interval);
    }, [activeBooking]);

    if (!activeBooking) return null;

    const handlePress = () => {
        if (activeBooking.type === 'queue' && activeBooking.courtId) {
            router.push(`/queue/${activeBooking.courtId}`);
        } else {
            router.push(`/bookings/${activeBooking.id}`);
        }
    };

    return (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
            <Card variant="default" padding="md" style={styles.banner}>
                <View style={styles.row}>
                    <View style={styles.iconWrapper}>
                        <MaterialCommunityIcons name="badminton" size={22} color={Colors.dark.text} />
                    </View>

                    <View style={styles.info}>
                        <View style={styles.titleRow}>
                            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
                            <Text style={styles.liveText}>Happening Now!</Text>
                        </View>
                        <Text style={styles.courtName} numberOfLines={1}>
                            {activeBooking.courtName} — {activeBooking.venueName}
                        </Text>
                    </View>

                    <View style={styles.timeContainer}>
                        <Text style={styles.timeText}>{timeLeft}</Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.dark.textSecondary} />
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    banner: {
        marginBottom: Spacing.lg,
        borderColor: Colors.dark.success + '40',
        borderWidth: 1,
        backgroundColor: Colors.dark.success + '10',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    iconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.success + '25',
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.dark.success,
    },
    liveText: {
        ...Typography.caption,
        color: Colors.dark.success,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    courtName: {
        ...Typography.bodySmall,
        color: Colors.dark.text,
        fontWeight: '500',
        marginTop: 2,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    timeText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        fontWeight: '600',
    },
});
