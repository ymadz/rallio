import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useCheckoutStore } from '@/store/checkout-store';
import { format, addDays, startOfDay, isBefore, isToday } from 'date-fns';

interface Court {
    id: string;
    name: string;
    hourly_rate: number;
    court_type: string;
    capacity: number;
}

interface Venue {
    id: string;
    name: string;
    address: string;
    opening_hours?: Record<string, { open: string; close: string }> | string | null;
}

interface TimeSlot {
    time: string;
    available: boolean;
    price?: number;
}

// Helper to get operating hours for a specific day
const getOperatingHours = (
    openingHours: Venue['opening_hours'],
    date: Date
): { openHour: number; closeHour: number } | null => {
    if (!openingHours || typeof openingHours === 'string') {
        // Default hours if no structured data
        return { openHour: 6, closeHour: 22 };
    }

    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayHours = openingHours[dayName];

    if (!dayHours) return null; // Closed on this day

    const [openHour] = dayHours.open.split(':').map(Number);
    const [closeHour] = dayHours.close.split(':').map(Number);

    return { openHour, closeHour };
};

export default function BookingScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    // State
    const [venue, setVenue] = useState<Venue | null>(null);
    const [courts, setCourts] = useState<Court[]>([]);
    const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [endTime, setEndTime] = useState<string | null>(null);
    const [numPlayers, setNumPlayers] = useState<number>(4);
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);

    const { setBookingData, setDiscount } = useCheckoutStore();

    // Discount state
    const [discountResults, setDiscountResults] = useState<{
        totalDiscount: number;
        finalPrice: number;
        discounts: any[];
    }>({ totalDiscount: 0, finalPrice: 0, discounts: [] });
    const [isCalculatingDiscount, setIsCalculatingDiscount] = useState(false);

    // Calculate discounts when relevant fields change
    useEffect(() => {
        const calculateDiscounts = async () => {
            if (!venue || !selectedCourtId || !selectedDate || !selectedTime) {
                setDiscountResults({ totalDiscount: 0, finalPrice: 0, discounts: [] });
                return;
            }

            // Calculate duration and base price locally for the effect
            let currentDuration = 1;
            if (selectedTime) {
                if (endTime) {
                    const startHour = parseInt(selectedTime.split(':')[0]);
                    const endHour = parseInt(endTime.split(':')[0]);
                    currentDuration = endHour - startHour + 1;
                }
            }

            const currentCourt = courts.find(c => c.id === selectedCourtId);
            const basePrice = currentCourt ? currentCourt.hourly_rate * currentDuration : 0;

            if (basePrice <= 0) return;

            setIsCalculatingDiscount(true);
            try {
                // Import dynamically to avoid cycle if any, or just use the imported one
                const { calculateApplicableDiscounts } = require('@/lib/discount-utils');

                const result = await calculateApplicableDiscounts({
                    venueId: venue.id,
                    startDate: selectedDate.toISOString(),
                    endDate: selectedDate.toISOString(), // Multi-day logic might need adjustment but usually start=end for single booking
                    numberOfDays: currentDuration, // Using duration as "days" proxy or ignoring if rule is strictly days. *Correction*: Logic uses days for multi-day. For hourly, we might pass 1 day.
                    // Wait, existing logic uses numberOfDays for multi_day discount. If we book 1 day, it's 1. 
                    // If we want to support hourly discounts, the backend logic might need tweaks. 
                    // But for now, let's pass 1 day as it's a single day booking.
                    numberOfPlayers: numPlayers,
                    basePrice: basePrice
                });

                if (result.success) {
                    setDiscountResults({
                        totalDiscount: result.totalDiscount,
                        finalPrice: result.finalPrice,
                        discounts: result.discounts
                    });
                }
            } catch (err) {
                console.error('Error calculating discounts:', err);
            } finally {
                setIsCalculatingDiscount(false);
            }
        };

        // Debounce slightly
        const timer = setTimeout(calculateDiscounts, 300);
        return () => clearTimeout(timer);
    }, [venue, selectedCourtId, selectedDate, selectedTime, endTime, numPlayers]);




    // Generate next 14 days for date selection
    const dateOptions = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));

    useEffect(() => {
        if (id) fetchVenueAndCourts();
    }, [id]);

    useEffect(() => {
        if (selectedCourtId && selectedDate) {
            fetchTimeSlots();
        }
    }, [selectedCourtId, selectedDate]);

    // Reset selection when date/court changes
    useEffect(() => {
        setSelectedTime(null);
        setEndTime(null);
    }, [selectedDate, selectedCourtId]);

    const fetchVenueAndCourts = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('venues')
                .select(`
                    id, name, address, opening_hours,
                    courts (id, name, hourly_rate, court_type, capacity)
                `)
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            setVenue(data);
            const activeCourts = (data.courts || []).filter((c: any) => c.hourly_rate > 0);
            setCourts(activeCourts);

            // Auto-select first court
            if (activeCourts.length > 0) {
                setSelectedCourtId(activeCourts[0].id);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load venue');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTimeSlots = async () => {
        if (!selectedCourtId || !selectedDate || !venue) return;

        setIsLoadingSlots(true);
        setSelectedTime(null);
        setEndTime(null);

        try {
            // Get operating hours for the selected day
            const operatingHours = getOperatingHours(venue.opening_hours, selectedDate);

            if (!operatingHours) {
                // Venue is closed on this day
                setTimeSlots([]);
                setIsLoadingSlots(false);
                return;
            }

            const { openHour, closeHour } = operatingHours;

            // Get existing reservations for the selected date
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const { data: reservations } = await supabase
                .from('reservations')
                .select('start_time, end_time')
                .eq('court_id', selectedCourtId)
                .gte('start_time', `${dateStr}T00:00:00`)
                .lte('start_time', `${dateStr}T23:59:59`)
                .in('status', ['pending', 'confirmed']);

            // Generate time slots based on operating hours
            const slots: TimeSlot[] = [];
            const now = new Date();
            const court = courts.find(c => c.id === selectedCourtId);

            for (let hour = openHour; hour < closeHour; hour++) {
                const timeString = `${hour.toString().padStart(2, '0')}:00`;
                const slotDateTime = new Date(`${dateStr}T${timeString}:00`);

                // Check if slot is in the past
                const isPast = isBefore(slotDateTime, now);

                // Check if slot conflicts with existing reservation
                const isBooked = reservations?.some((res) => {
                    const resStart = new Date(res.start_time).getHours();
                    const resEnd = new Date(res.end_time).getHours();
                    return hour >= resStart && hour < resEnd;
                });

                slots.push({
                    time: timeString,
                    available: !isPast && !isBooked,
                    price: court?.hourly_rate,
                });
            }

            setTimeSlots(slots);
        } catch (err) {
            console.error('Error fetching time slots:', err);
        } finally {
            setIsLoadingSlots(false);
        }
    };

    const selectedCourt = courts.find(c => c.id === selectedCourtId);

    // Calculate duration
    let duration = 0;
    if (selectedTime) {
        if (!endTime) {
            duration = 1;
        } else {
            const startHour = parseInt(selectedTime.split(':')[0]);
            const endHour = parseInt(endTime.split(':')[0]);
            duration = endHour - startHour + 1;
        }
    }

    const totalPrice = selectedCourt ? selectedCourt.hourly_rate * duration : 0;

    const formatTime = (time: string): string => {
        const [hours] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${displayHours}:00 ${period}`;
    };

    const getEndTimeStr = (timeSlot: string): string => {
        const [hours] = timeSlot.split(':').map(Number);
        const endHours = hours + 1;
        return `${endHours.toString().padStart(2, '0')}:00`;
    };

    const handleContinue = () => {
        if (!selectedCourtId || !selectedDate || !selectedTime || !selectedCourt || !venue) {
            Alert.alert('Error', 'Please select a court, date, and time');
            return;
        }

        // Calculate final end time string
        const targetEndSlot = endTime || selectedTime;
        const finalEndTime = getEndTimeStr(targetEndSlot);

        // Check if all slots in the selected range are available
        const startIndex = timeSlots.findIndex(s => s.time === selectedTime);
        const endIndex = timeSlots.findIndex(s => s.time === targetEndSlot);

        if (startIndex === -1 || endIndex === -1) {
            Alert.alert('Error', 'Selected time range is invalid.');
            return;
        }

        for (let i = startIndex; i <= endIndex; i++) {
            if (!timeSlots[i] || !timeSlots[i].available) {
                Alert.alert('Error', `The selected ${duration}-hour slot is not fully available.`);
                return;
            }
        }

        // Pass discount info separately
        setDiscount(
            discountResults.totalDiscount,
            discountResults.discounts.length > 0 ? discountResults.discounts[0].type : undefined,
            discountResults.discounts.map((d: any) => d.name).join(', ')
        );

        // Save to checkout store
        setBookingData({
            courtId: selectedCourtId,
            courtName: selectedCourt.name,
            venueId: venue.id,
            venueName: venue.name,
            date: selectedDate.toISOString(),
            startTime: selectedTime,
            endTime: finalEndTime,
            hourlyRate: selectedCourt.hourly_rate,
            capacity: selectedCourt.capacity,
            duration: duration,
            numPlayers: numPlayers,
            notes: notes.trim() || undefined,
        });

        // Navigate to checkout
        router.push('/checkout');
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

    if (error || !venue) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={64} color={Colors.dark.error} />
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.errorText}>{error || 'Venue not found'}</Text>
                    <Button onPress={() => router.back()}>Go Back</Button>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Book Court</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Venue Info */}
                <Card variant="glass" padding="md" style={styles.venueCard}>
                    <Text style={styles.venueName}>{venue.name}</Text>
                    <Text style={styles.venueAddress}>{venue.address}</Text>
                </Card>

                {/* Court Selection */}
                <Text style={styles.sectionTitle}>Select Court</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                    {courts.map((court) => (
                        <TouchableOpacity
                            key={court.id}
                            style={[
                                styles.courtChip,
                                selectedCourtId === court.id && styles.courtChipSelected,
                            ]}
                            onPress={() => setSelectedCourtId(court.id)}
                        >
                            <Text style={[
                                styles.courtChipText,
                                selectedCourtId === court.id && styles.courtChipTextSelected,
                            ]}>
                                {court.name}
                            </Text>
                            <Text style={[
                                styles.courtChipPrice,
                                selectedCourtId === court.id && styles.courtChipTextSelected,
                            ]}>
                                ₱{court.hourly_rate}/hr
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Date Selection */}
                <Text style={styles.sectionTitle}>Select Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                    {dateOptions.map((date) => {
                        const isSelected = selectedDate?.toDateString() === date.toDateString();
                        return (
                            <TouchableOpacity
                                key={date.toISOString()}
                                style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                                onPress={() => setSelectedDate(date)}
                            >
                                <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>
                                    {format(date, 'EEE')}
                                </Text>
                                <Text style={[styles.dateNumber, isSelected && styles.dateTextSelected]}>
                                    {format(date, 'd')}
                                </Text>
                                <Text style={[styles.dateMonth, isSelected && styles.dateTextSelected]}>
                                    {format(date, 'MMM')}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Time Selection */}
                {selectedDate && (
                    <>
                        <Text style={styles.sectionTitle}>
                            Select Time Range
                        </Text>
                        <View style={styles.rangeInfoContainer}>
                            <Text style={styles.rangeInfoText}>
                                {!selectedTime ? (
                                    "Tap a time to start."
                                ) : !endTime ? (
                                    "Tap another time to end, or continue for 1 hour."
                                ) : (
                                    `${duration} hours selected.`
                                )}
                            </Text>
                        </View>
                        {isLoadingSlots ? (
                            <View style={styles.slotsLoading}>
                                <ActivityIndicator size="small" color={Colors.dark.primary} />
                                <Text style={styles.slotsLoadingText}>Loading available times...</Text>
                            </View>
                        ) : timeSlots.length === 0 ? (
                            <Card variant="glass" padding="md" style={styles.closedCard}>
                                <Ionicons name="close-circle-outline" size={32} color={Colors.dark.error} />
                                <Text style={styles.closedText}>Venue is closed on this day</Text>
                                <Text style={styles.closedHint}>Please select a different date</Text>
                            </Card>
                        ) : (
                            <View style={styles.timeSlotsGrid}>
                                {timeSlots.map((slot) => {
                                    const isSelected = selectedTime === slot.time || endTime === slot.time;

                                    // Calculate if in range
                                    let inRange = false;
                                    if (selectedTime && endTime) {
                                        const startIndex = timeSlots.findIndex(s => s.time === selectedTime);
                                        const endIndex = timeSlots.findIndex(s => s.time === endTime);
                                        const currentIndex = timeSlots.findIndex(s => s.time === slot.time);
                                        if (currentIndex > startIndex && currentIndex < endIndex) {
                                            inRange = true;
                                        }
                                    }

                                    return (
                                        <TouchableOpacity
                                            key={slot.time}
                                            style={[
                                                styles.timeSlot,
                                                !slot.available && styles.timeSlotUnavailable,
                                                isSelected && styles.timeSlotSelected,
                                                inRange && styles.timeSlotInRange,
                                            ]}
                                            onPress={() => {
                                                if (!slot.available) return;

                                                // Case 1: New selection or restarting
                                                if (!selectedTime || (selectedTime && endTime)) {
                                                    setSelectedTime(slot.time);
                                                    setEndTime(null);
                                                    return;
                                                }

                                                // Case 2: Selecting end slot
                                                const startIndex = timeSlots.findIndex(s => s.time === selectedTime);
                                                const clickedIndex = timeSlots.findIndex(s => s.time === slot.time);

                                                if (clickedIndex < startIndex) {
                                                    // Clicked before start -> New start
                                                    setSelectedTime(slot.time);
                                                    setEndTime(null);
                                                } else if (clickedIndex === startIndex) {
                                                    // Clicked start again -> Keep as single hour (deselect end if any)
                                                    setEndTime(null);
                                                } else {
                                                    // Clicked after start -> Check availability
                                                    let valid = true;
                                                    for (let i = startIndex; i <= clickedIndex; i++) {
                                                        if (!timeSlots[i].available) {
                                                            valid = false;
                                                            break;
                                                        }
                                                    }

                                                    if (valid) {
                                                        setEndTime(slot.time);
                                                    } else {
                                                        // Blocked -> New start
                                                        setSelectedTime(slot.time);
                                                        setEndTime(null);
                                                    }
                                                }
                                            }}
                                            disabled={!slot.available}
                                        >
                                            <Text style={[
                                                styles.timeSlotText,
                                                !slot.available && styles.timeSlotTextUnavailable,
                                                isSelected && styles.timeSlotTextSelected,
                                                inRange && styles.timeSlotTextInRange,
                                            ]}>
                                                {formatTime(slot.time)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </>
                )}

                {/* Number of Players */}
                {selectedTime && selectedCourt && (
                    <>
                        <Text style={styles.sectionTitle}>Number of Players</Text>
                        <View style={styles.playersRow}>
                            <TouchableOpacity
                                style={styles.playerButton}
                                onPress={() => setNumPlayers(Math.max(1, numPlayers - 1))}
                            >
                                <Ionicons name="remove" size={24} color={Colors.dark.text} />
                            </TouchableOpacity>
                            <Text style={styles.playersCount}>{numPlayers}</Text>
                            <TouchableOpacity
                                style={styles.playerButton}
                                onPress={() => setNumPlayers(Math.min(selectedCourt.capacity, numPlayers + 1))}
                            >
                                <Ionicons name="add" size={24} color={Colors.dark.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.playersHint}>Max {selectedCourt.capacity} players</Text>
                    </>
                )}

                {/* Notes */}
                {selectedTime && (
                    <>
                        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                        <TextInput
                            style={styles.notesInput}
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Any special requests..."
                            placeholderTextColor={Colors.dark.textTertiary}
                            multiline
                            numberOfLines={3}
                        />
                    </>
                )}

                {/* Summary */}
                {selectedTime && selectedCourt && selectedDate && (
                    <Card variant="glass" padding="lg" style={styles.summaryCard}>
                        <Text style={styles.summaryTitle}>Booking Summary</Text>

                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Date</Text>
                            <Text style={styles.summaryValue}>
                                {format(selectedDate, 'EEEE, MMM d')}
                            </Text>
                        </View>

                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Time</Text>
                            <Text style={styles.summaryValue}>
                                {formatTime(selectedTime)} - {formatTime(getEndTimeStr(endTime || selectedTime))}
                            </Text>
                        </View>

                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Duration</Text>
                            <Text style={styles.summaryValue}>
                                {duration} {duration === 1 ? 'hour' : 'hours'}
                            </Text>
                        </View>

                        <View style={[styles.summaryRow, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Total</Text>
                            <Text style={styles.totalValue}>₱{totalPrice.toLocaleString()}</Text>
                        </View>

                        {discountResults.discounts.length > 0 && (
                            <View style={styles.discountContainer}>
                                {discountResults.discounts.map((discount, index) => (
                                    <View key={index} style={styles.summaryRow}>
                                        <Text style={[
                                            styles.summaryLabel,
                                            { color: discount.isIncrease ? Colors.dark.error : Colors.dark.success }
                                        ]}>
                                            {discount.name}
                                        </Text>
                                        <Text style={[
                                            styles.summaryValue,
                                            { color: discount.isIncrease ? Colors.dark.error : Colors.dark.success }
                                        ]}>
                                            {discount.isIncrease ? '+' : '-'}₱{discount.amount.toLocaleString()}
                                        </Text>
                                    </View>
                                ))}
                                <View style={[styles.summaryRow, styles.finalPriceRow]}>
                                    <Text style={styles.finalPriceLabel}>Final Price</Text>
                                    <Text style={styles.finalPriceValue}>₱{discountResults.finalPrice.toLocaleString()}</Text>
                                </View>
                            </View>
                        )}
                    </Card>
                )}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Bottom CTA */}
            {selectedTime && (
                <View style={styles.bottomCta}>
                    <View style={styles.priceContainer}>
                        <Text style={styles.priceLabel}>Total</Text>
                        {discountResults.finalPrice !== totalPrice && discountResults.finalPrice > 0 ? (
                            <View>
                                <Text style={[styles.priceValue, { textDecorationLine: 'line-through', fontSize: 14, color: Colors.dark.textSecondary }]}>
                                    ₱{totalPrice.toLocaleString()}
                                </Text>
                                <Text style={[styles.priceValue, { color: Colors.dark.primary }]}>
                                    ₱{discountResults.finalPrice.toLocaleString()}
                                </Text>
                            </View>
                        ) : (
                            <Text style={styles.priceValue}>₱{totalPrice.toLocaleString()}</Text>
                        )}
                    </View>
                    <Button
                        onPress={handleContinue}
                        disabled={!selectedTime}
                        style={styles.continueButton}
                    >
                        Continue to Payment
                    </Button>
                </View>
            )}
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
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    title: {
        ...Typography.h2,
        color: Colors.dark.text,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    venueCard: {
        marginBottom: Spacing.lg,
    },
    venueName: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    venueAddress: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginTop: 4,
    },
    sectionTitle: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
        marginBottom: Spacing.sm,
        marginTop: Spacing.md,
    },
    durationHint: {
        color: Colors.dark.primary,
        fontWeight: '400',
    },
    horizontalScroll: {
        marginHorizontal: -Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    courtChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginRight: Spacing.sm,
        alignItems: 'center',
    },
    courtChipSelected: {
        backgroundColor: Colors.dark.primary + '20',
        borderColor: Colors.dark.primary,
    },
    courtChipText: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '500',
    },
    courtChipPrice: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    courtChipTextSelected: {
        color: Colors.dark.primary,
    },
    dateChip: {
        width: 64,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginRight: Spacing.sm,
        alignItems: 'center',
    },
    dateChipSelected: {
        backgroundColor: Colors.dark.primary + '20',
        borderColor: Colors.dark.primary,
    },
    dateDay: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    dateNumber: {
        ...Typography.h3,
        color: Colors.dark.text,
        marginVertical: 2,
    },
    dateMonth: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    dateTextSelected: {
        color: Colors.dark.primary,
    },
    rangeInfoContainer: {
        backgroundColor: Colors.dark.surface,
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    rangeInfoText: {
        ...Typography.bodySmall,
        color: Colors.dark.primary,
        textAlign: 'center',
    },
    slotsLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.lg,
        gap: Spacing.sm,
    },
    slotsLoadingText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    closedCard: {
        alignItems: 'center',
        gap: Spacing.sm,
    },
    closedText: {
        ...Typography.body,
        color: Colors.dark.error,
        fontWeight: '600',
    },
    closedHint: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    timeSlotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    timeSlot: {
        width: '23%',
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        alignItems: 'center',
    },
    timeSlotUnavailable: {
        backgroundColor: Colors.dark.background,
        borderColor: Colors.dark.borderLight,
        opacity: 0.5,
    },
    timeSlotSelected: {
        backgroundColor: Colors.dark.primary + '20',
        borderColor: Colors.dark.primary,
    },
    timeSlotInRange: {
        backgroundColor: Colors.dark.primary + '10',
        borderColor: Colors.dark.primary,
        borderWidth: 1,
    },
    timeSlotTextInRange: {
        color: Colors.dark.primary,
        fontWeight: '500',
    },
    timeSlotText: {
        ...Typography.bodySmall,
        color: Colors.dark.text,
    },
    timeSlotTextUnavailable: {
        color: Colors.dark.textTertiary,
    },
    timeSlotTextSelected: {
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    playersRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.lg,
    },
    playerButton: {
        width: 48,
        height: 48,
        borderRadius: Radius.md,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    discountContainer: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    finalPriceRow: {
        marginTop: Spacing.xs,
    },
    finalPriceLabel: {
        ...Typography.body,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    finalPriceValue: {
        ...Typography.h3,
        color: Colors.dark.primary,
    },
    playersCount: {
        ...Typography.h2,
        color: Colors.dark.text,
        minWidth: 40,
        textAlign: 'center',
    },
    playersHint: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },
    notesInput: {
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        padding: Spacing.md,
        color: Colors.dark.text,
        ...Typography.body,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    summaryCard: {
        marginTop: Spacing.lg,
    },
    summaryTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.xs,
    },
    summaryLabel: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    summaryValue: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '500',
    },
    totalRow: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    totalLabel: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    totalValue: {
        ...Typography.h2,
        color: Colors.dark.primary,
    },
    bottomCta: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        paddingBottom: Spacing.xl,
        backgroundColor: Colors.dark.elevated,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    priceContainer: {
        marginRight: Spacing.lg,
    },
    priceLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    priceValue: {
        ...Typography.h2,
        color: Colors.dark.primary,
    },
    continueButton: {
        flex: 1,
    },
});
