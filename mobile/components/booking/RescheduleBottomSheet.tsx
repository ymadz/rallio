import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button } from '@/components/ui';
import { apiPost, apiGetPublic } from '@/lib/api';
import { format, addDays, startOfDay } from 'date-fns';

interface TimeSlot {
    time: string;
    available: boolean;
    label: string;
}

interface RescheduleBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    reservationId: string;
    courtId: string;
    currentStartTime: string; // ISO
    currentEndTime: string; // ISO
}

export default function RescheduleBottomSheet({
    visible,
    onClose,
    onSuccess,
    reservationId,
    courtId,
    currentStartTime,
    currentEndTime,
}: RescheduleBottomSheetProps) {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Calculate duration from current booking
    const duration = Math.round(
        (new Date(currentEndTime).getTime() - new Date(currentStartTime).getTime()) / (1000 * 60 * 60)
    );

    // Generate next 30 days (skip dates within 24 hours)
    const dates = Array.from({ length: 30 }, (_, i) => {
        const date = addDays(new Date(), i + 1); // Start from tomorrow (24h policy)
        return startOfDay(date);
    });

    // Fetch time slots when date changes
    useEffect(() => {
        if (!selectedDate) return;

        const fetchSlots = async () => {
            setLoadingSlots(true);
            setSelectedTime(null);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                const result = await apiGetPublic('/api/mobile/get-time-slots', {
                    courtId,
                    date: dateStr,
                    excludeReservationId: reservationId,
                });
                setTimeSlots(result.slots || []);
            } catch (error) {
                setTimeSlots([]);
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlots();
    }, [selectedDate, courtId, reservationId]);

    // Filter available slots that can fit the booking duration
    const availableSlots = timeSlots.filter((slot, index) => {
        if (!slot.available) return false;
        // Check if enough consecutive slots exist for the duration
        for (let i = 1; i < duration; i++) {
            const nextSlot = timeSlots[index + i];
            if (!nextSlot || !nextSlot.available) return false;
        }
        return true;
    });

    const handleSubmit = useCallback(async () => {
        if (!selectedDate || !selectedTime) return;

        setIsSubmitting(true);
        try {
            const result = await apiPost('/api/mobile/reschedule-reservation', {
                reservationId,
                newDate: selectedDate.toISOString(),
                newStartTime: selectedTime,
            });

            if (result.success) {
                Alert.alert('Success', 'Your booking has been rescheduled.', [
                    { text: 'OK', onPress: onSuccess },
                ]);
            } else {
                Alert.alert('Error', result.error || 'Failed to reschedule');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to reschedule');
        } finally {
            setIsSubmitting(false);
        }
    }, [selectedDate, selectedTime, reservationId, onSuccess]);

    const formatTimeLabel = (time: string) => {
        const [hours] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const h = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${h}:00 ${period}`;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Reschedule Booking</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Policy notice */}
                    <View style={styles.notice}>
                        <Ionicons name="information-circle-outline" size={16} color={Colors.dark.warning} />
                        <Text style={styles.noticeText}>
                            You can only reschedule once. Must be 24+ hours before start time.
                        </Text>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Date Selection */}
                        <Text style={styles.sectionLabel}>Select New Date</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.dateScroll}
                            contentContainerStyle={styles.dateScrollContent}
                        >
                            {dates.map((date) => {
                                const isSelected = selectedDate?.toDateString() === date.toDateString();
                                return (
                                    <TouchableOpacity
                                        key={date.toISOString()}
                                        style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                                        onPress={() => setSelectedDate(date)}
                                    >
                                        <Text style={[styles.dateDayName, isSelected && styles.dateTextSelected]}>
                                            {format(date, 'EEE')}
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

                        {/* Time Slots */}
                        {selectedDate && (
                            <>
                                <Text style={styles.sectionLabel}>
                                    Select New Time ({duration}h booking)
                                </Text>

                                {loadingSlots ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color={Colors.dark.primary} />
                                        <Text style={styles.loadingText}>Loading available slots...</Text>
                                    </View>
                                ) : availableSlots.length === 0 ? (
                                    <Card variant="glass" padding="md" style={styles.emptySlots}>
                                        <Ionicons name="calendar-outline" size={32} color={Colors.dark.textTertiary} />
                                        <Text style={styles.emptyText}>No available slots on this date</Text>
                                    </Card>
                                ) : (
                                    <View style={styles.slotGrid}>
                                        {availableSlots.map((slot) => {
                                            const isSelected = selectedTime === slot.time;
                                            return (
                                                <TouchableOpacity
                                                    key={slot.time}
                                                    style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                                                    onPress={() => setSelectedTime(slot.time)}
                                                >
                                                    <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>
                                                        {formatTimeLabel(slot.time)}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </>
                        )}

                        <View style={{ height: 100 }} />
                    </ScrollView>

                    {/* Confirm Button */}
                    <View style={styles.footer}>
                        <Button
                            variant="primary"
                            onPress={handleSubmit}
                            disabled={!selectedDate || !selectedTime || isSubmitting}
                            style={styles.confirmButton}
                        >
                            {isSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
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
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    title: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.dark.warning + '15',
    },
    noticeText: {
        ...Typography.bodySmall,
        color: Colors.dark.warning,
        flex: 1,
    },
    content: {
        padding: Spacing.lg,
    },
    sectionLabel: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
        marginBottom: Spacing.sm,
    },
    dateScroll: {
        marginBottom: Spacing.lg,
    },
    dateScrollContent: {
        gap: Spacing.xs,
    },
    dateChip: {
        width: 60,
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
        fontSize: 11,
    },
    dateDayNum: {
        ...Typography.h3,
        color: Colors.dark.text,
        marginVertical: 2,
    },
    dateMonth: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        fontSize: 11,
    },
    dateTextSelected: {
        color: Colors.dark.text,
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
    emptySlots: {
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
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    slotChipSelected: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primary,
    },
    slotText: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '500',
    },
    slotTextSelected: {
        color: Colors.dark.text,
    },
    footer: {
        padding: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    confirmButton: {
        width: '100%',
    },
});
