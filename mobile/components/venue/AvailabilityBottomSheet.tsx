import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card } from '@/components/ui';
import { apiGetPublic } from '@/lib/api';
import { format, addDays, startOfDay } from 'date-fns';

interface TimeSlot {
    time: string;
    available: boolean;
    label: string;
}

interface AvailabilityBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    courtId: string;
    courtName: string;
    venueId: string;
    hourlyRate: number;
}

export default function AvailabilityBottomSheet({
    visible,
    onClose,
    courtId,
    courtName,
    venueId,
    hourlyRate,
}: AvailabilityBottomSheetProps) {
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Generate next 14 days
    const dates = Array.from({ length: 14 }, (_, i) => startOfDay(addDays(new Date(), i)));

    // Fetch time slots when date changes
    useEffect(() => {
        if (!visible) return;

        const fetchSlots = async () => {
            setLoadingSlots(true);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const result = await apiGetPublic('/api/mobile/get-time-slots', {
                    courtId,
                    date: dateStr,
                });
                setTimeSlots(result.slots || []);
            } catch {
                setTimeSlots([]);
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlots();
    }, [selectedDate, courtId, visible]);

    const availableCount = timeSlots.filter((s) => s.available).length;
    const bookedCount = timeSlots.filter((s) => !s.available).length;

    const handleBookSlot = (slot: TimeSlot) => {
        if (!slot.available) return;
        onClose();
        // Navigate to booking with pre-selected params
        router.push({
            pathname: `/courts/[id]/book` as any,
            params: {
                id: venueId,
                preselectedCourtId: courtId,
                preselectedDate: format(selectedDate, 'yyyy-MM-dd'),
                preselectedTime: slot.time,
            },
        });
    };

    const formatTimeLabel = (time: string) => {
        const [hours] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${h}:00 ${period}`;
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Schedule</Text>
                            <Text style={styles.subtitle}>{courtName} — ₱{hourlyRate}/hr</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Date Selection */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.dateScroll}
                        contentContainerStyle={styles.dateScrollContent}
                    >
                        {dates.map((date) => {
                            const isSelected = selectedDate.toDateString() === date.toDateString();
                            const isToday = date.toDateString() === new Date().toDateString();
                            return (
                                <TouchableOpacity
                                    key={date.toISOString()}
                                    style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                                    onPress={() => setSelectedDate(date)}
                                >
                                    <Text style={[styles.dateDayName, isSelected && styles.dateTextSelected]}>
                                        {isToday ? 'Today' : format(date, 'EEE')}
                                    </Text>
                                    <Text style={[styles.dateDayNum, isSelected && styles.dateTextSelected]}>
                                        {format(date, 'd')}
                                    </Text>
                                    <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>
                                        {format(date, 'MMM')}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Legend */}
                    {!loadingSlots && timeSlots.length > 0 && (
                        <View style={styles.legend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: Colors.dark.success }]} />
                                <Text style={styles.legendText}>Available ({availableCount})</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: Colors.dark.error + '60' }]} />
                                <Text style={styles.legendText}>Booked ({bookedCount})</Text>
                            </View>
                        </View>
                    )}

                    {/* Time Slots */}
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {loadingSlots ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color={Colors.dark.primary} />
                                <Text style={styles.loadingText}>Loading schedule...</Text>
                            </View>
                        ) : timeSlots.length === 0 ? (
                            <Card variant="glass" padding="lg" style={styles.emptyCard}>
                                <Ionicons name="calendar-outline" size={40} color={Colors.dark.textTertiary} />
                                <Text style={styles.emptyText}>No schedule available for this date</Text>
                            </Card>
                        ) : (
                            <View style={styles.slotGrid}>
                                {timeSlots.map((slot) => (
                                    <TouchableOpacity
                                        key={slot.time}
                                        style={[
                                            styles.slotChip,
                                            slot.available ? styles.slotAvailable : styles.slotBooked,
                                        ]}
                                        onPress={() => handleBookSlot(slot)}
                                        disabled={!slot.available}
                                        activeOpacity={slot.available ? 0.7 : 1}
                                    >
                                        <Text
                                            style={[
                                                styles.slotText,
                                                !slot.available && styles.slotTextBooked,
                                            ]}
                                        >
                                            {formatTimeLabel(slot.time)}
                                        </Text>
                                        {slot.available && (
                                            <Ionicons name="add-circle-outline" size={14} color={Colors.dark.success} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: Colors.dark.background,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        maxHeight: '85%',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    title: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    subtitle: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateScroll: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    dateScrollContent: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        gap: Spacing.xs,
    },
    dateChip: {
        width: 58,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    dateChipSelected: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primary,
    },
    dateDayName: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        fontSize: 10,
    },
    dateDayNum: {
        ...Typography.h3,
        color: Colors.dark.text,
        marginVertical: 2,
    },
    dateMonth: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        fontSize: 10,
    },
    dateTextSelected: {
        color: Colors.dark.text,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    content: {
        padding: Spacing.lg,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        gap: Spacing.sm,
    },
    loadingText: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
    },
    emptyCard: {
        alignItems: 'center',
        gap: Spacing.sm,
    },
    emptyText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    slotGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    slotChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        borderWidth: 1,
    },
    slotAvailable: {
        backgroundColor: Colors.dark.success + '15',
        borderColor: Colors.dark.success + '40',
    },
    slotBooked: {
        backgroundColor: Colors.dark.error + '10',
        borderColor: Colors.dark.error + '20',
    },
    slotText: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '500',
        fontSize: 13,
    },
    slotTextBooked: {
        color: Colors.dark.textTertiary,
        textDecorationLine: 'line-through',
    },
});
