import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    AppState,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button } from '@/components/ui';
import { useCheckoutStore } from '@/store/checkout-store';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

type PaymentMethod = 'e-wallet' | 'cash';

export default function CheckoutScreen() {
    const { user } = useAuthStore();
    const {
        bookingData,
        paymentMethod,
        setPaymentMethod,
        policyAccepted,
        setPolicyAccepted,
        getSubtotal,
        getPlatformFeeAmount,
        getTotalAmount,
        getDownPaymentAmount,
        getRemainingBalance,
        setBookingReference,
        resetCheckout,
    } = useCheckoutStore();

    const [isProcessing, setIsProcessing] = useState(false);
    const [step, setStep] = useState<'review' | 'payment' | 'processing' | 'success'>('review');

    // Track pending e-wallet payment for AppState fallback
    const [pendingReservationId, setPendingReservationId] = useState<string | null>(null);
    const appState = useRef(AppState.currentState);

    // AppState listener - check payment status when app returns to foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            // App came back to foreground with pending payment
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active' &&
                pendingReservationId
            ) {
                console.log('App returned to foreground, checking payment status...');

                // Check reservation status in Supabase
                const { data: reservation, error } = await supabase
                    .from('reservations')
                    .select('status')
                    .eq('id', pendingReservationId)
                    .single();

                if (reservation) {
                    console.log('Reservation status:', reservation.status);

                    if (reservation.status === 'confirmed' || reservation.status === 'paid' || reservation.status === 'partially_paid') {
                        // Payment confirmed (or down payment received)!
                        setPendingReservationId(null);
                        setStep('success');
                    } else if (reservation.status === 'cancelled' || reservation.status === 'failed') {
                        // Payment failed
                        setPendingReservationId(null);
                        Alert.alert('Payment Failed', 'Your payment was not completed. Please try again.');
                        setStep('review');
                    }
                    // If still pending_payment, user might not have completed - stay on current screen
                }
            }
            appState.current = nextAppState;
        });

        return () => subscription.remove();
    }, [pendingReservationId]);

    // Discount from store (Calculated in backend later, currently removing deprecated promo logic)
    const [discountAmount, setDiscountAmount] = useState(0);

    useEffect(() => {
        if (!bookingData) {
            router.replace('/(tabs)/courts');
        }
    }, [bookingData]);

    if (!bookingData) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const subtotal = getSubtotal();
    const platformFee = getPlatformFeeAmount();
    const total = getTotalAmount() - discountAmount;

    useEffect(() => {
        // Adjust total if discount is applied? 
        // Note: The store `getTotalAmount` usually calculates based on its internal state. 
        // Since we are adding local discount state, we subtract it here. 
        // Ideally we should sync this to the store, but for parity fix, local calculation on display and submission is acceptable.
    }, [discountAmount]);

    const downPaymentAmount = getDownPaymentAmount();
    const remainingBalance = getRemainingBalance();
    const isDownPaymentRequired = paymentMethod === 'cash' && downPaymentAmount > 0;

    const formatTime = (time: string): string => {
        const [hours] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        return `${displayHours}:00 ${period}`;
    };

    const handleSelectPayment = (method: PaymentMethod) => {
        setPaymentMethod(method);
    };

    // Discount handling is now server-driven where applicable

    const handleConfirmBooking = async () => {
        if (!paymentMethod) {
            Alert.alert('Error', 'Please select a payment method');
            return;
        }

        if (!policyAccepted) {
            Alert.alert('Error', 'Please accept the cancellation policy');
            return;
        }

        setIsProcessing(true);
        setStep('processing');

        try {
            // Get session
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error('User not authenticated (No session)');
            }

            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.254.170:3000';

            // Prepare payload for Server Action Wrapper
            const reservationPayload = {
                courtId: bookingData.courtId,
                startTimeISO: `${format(new Date(bookingData.date), 'yyyy-MM-dd')}T${bookingData.startTime}:00`,
                endTimeISO: `${format(new Date(bookingData.date), 'yyyy-MM-dd')}T${bookingData.endTime}:00`, // Duration logic handled by server if needed, but passing endISO is clearer
                totalAmount: total, // GRAND TOTAL (Pre-calculated with discount)
                discountAmount: discountAmount, // Pass discount info if backend needs it
                numPlayers: bookingData.numPlayers,
                paymentType: 'full',
                paymentMethod: paymentMethod, // 'cash' or 'e-wallet'
                notes: bookingData.notes,
                recurrenceWeeks: bookingData.recurrenceWeeks,
                selectedDays: bookingData.selectedDays
            };

            console.log('Mobile Checkout: Creating reservation via API...', reservationPayload);

            const createResResponse = await fetch(`${apiUrl}/api/mobile/create-reservation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(reservationPayload)
            });

            const createResResult = await createResResponse.json();

            if (!createResResponse.ok || !createResResult.success) {
                console.error('Mobile Checkout: API Error:', createResResult);
                throw new Error(createResResult.error || 'Failed to create reservation');
            }

            console.log('Mobile Checkout: Reservation created:', createResResult.reservationId);

            // Set Reference
            const bookingRef = createResResult.bookingRef || `RLL-${Date.now().toString().slice(-8)}`;
            const primaryReservationId = createResResult.reservationId;
            const recurrenceGroupId = createResResult.recurrenceGroupId;

            setBookingReference(bookingRef, primaryReservationId);

            // Handle Payment Redirection (E-Wallet or Cash Down Payment)
            if (paymentMethod === 'e-wallet' || isDownPaymentRequired) {
                console.log(`Mobile Checkout: Initiating ${isDownPaymentRequired ? 'Down Payment' : 'Full Payment'} via PayMongo...`);

                const checkoutResponse = await fetch(`${apiUrl}/api/mobile/create-checkout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        reservationId: primaryReservationId,
                        amount: isDownPaymentRequired ? downPaymentAmount : total,
                        description: `Booking for ${bookingData.courtName} at ${bookingData.venueName}`,
                        recurrenceGroupId: recurrenceGroupId,
                        isDownPayment: isDownPaymentRequired
                    })
                });

                const checkoutResult = await checkoutResponse.json();

                if (!checkoutResponse.ok || !checkoutResult.checkoutUrl) {
                    throw new Error(checkoutResult.error || 'Failed to create checkout session');
                }

                // Open PayMongo Checkout
                await Linking.openURL(checkoutResult.checkoutUrl);

                // Set pending ID for AppState check when return
                setPendingReservationId(primaryReservationId);

                // Keep processing state while waiting for return from browser
                return;
            }

            // For pure cash payments (no down payment), show success immediately
            setStep('success');
        } catch (error: any) {
            console.error('Booking error:', error);
            Alert.alert('Error', error.message || 'Failed to create booking');
            setStep('review');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDone = () => {
        resetCheckout();
        router.replace('/(tabs)/bookings');
    };

    // Success Screen
    if (step === 'success') {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView style={styles.scrollView} contentContainerStyle={styles.successContent}>
                    {/* Success Icon */}
                    <View style={styles.successIconContainer}>
                        <View style={styles.successIcon}>
                            <Ionicons name="checkmark" size={48} color={Colors.dark.text} />
                        </View>
                    </View>

                    <Text style={styles.successTitle}>
                        {paymentMethod === 'e-wallet' ? 'Booking Confirmed!' : isDownPaymentRequired ? 'Down Payment Confirmed!' : 'Booking Reserved!'}
                    </Text>
                    <Text style={styles.successSubtitle}>
                        {paymentMethod === 'e-wallet'
                            ? 'Your court has been successfully booked.'
                            : isDownPaymentRequired
                                ? 'Your deposit has been received. Pay the remaining balance at the venue.'
                                : 'Please complete payment at the venue.'}
                    </Text>

                    {/* Booking Details Card */}
                    <Card variant="glass" padding="lg" style={styles.detailsCard}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Court</Text>
                            <Text style={styles.detailValue}>{bookingData.courtName}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Venue</Text>
                            <Text style={styles.detailValue}>{bookingData.venueName}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Date</Text>
                            <Text style={styles.detailValue}>
                                {format(new Date(bookingData.date), 'EEEE, MMM d, yyyy')}
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Time</Text>
                            <Text style={styles.detailValue}>
                                {formatTime(bookingData.startTime)} - {formatTime(bookingData.endTime)}
                            </Text>
                        </View>
                        <View style={[styles.detailRow, styles.totalRow]}>
                            <Text style={styles.totalLabel}>
                                {isDownPaymentRequired ? 'Down Payment Paid' : 'Total Paid'}
                            </Text>
                            <Text style={styles.totalValue}>₱{(isDownPaymentRequired ? downPaymentAmount : total).toLocaleString()}</Text>
                        </View>
                        {isDownPaymentRequired && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Remaining Balance</Text>
                                <Text style={[styles.detailValue, { color: Colors.dark.warning }]}>
                                    ₱{remainingBalance.toLocaleString()}
                                </Text>
                            </View>
                        )}
                    </Card>

                    {/* Reminder for cash payment */}
                    {paymentMethod === 'cash' && (
                        <Card variant="default" padding="md" style={styles.reminderCard}>
                            <View style={styles.reminderRow}>
                                <Ionicons name="warning" size={20} color={Colors.dark.warning} />
                                <View style={styles.reminderContent}>
                                    <Text style={styles.reminderTitle}>Payment Reminder</Text>
                                    <Text style={styles.reminderText}>
                                        Arrive 15 minutes early and pay at the venue.
                                        Unpaid bookings may be cancelled.
                                    </Text>
                                </View>
                            </View>
                        </Card>
                    )}

                    <Button onPress={handleDone} style={styles.doneButton}>
                        View My Bookings
                    </Button>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Processing Screen
    if (step === 'processing') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.processingContainer}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                    <Text style={styles.processingText}>Processing your booking...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Review & Payment Screen
    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Checkout</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Booking Summary */}
                <Text style={styles.sectionTitle}>Booking Summary</Text>
                <Card variant="glass" padding="md" style={styles.summaryCard}>
                    <Text style={styles.courtName}>{bookingData.courtName}</Text>
                    <Text style={styles.venueName}>{bookingData.venueName}</Text>

                    <View style={styles.summaryDetails}>
                        <View style={styles.summaryItem}>
                            <Ionicons name="calendar-outline" size={16} color={Colors.dark.textSecondary} />
                            <Text style={styles.summaryText}>
                                {format(new Date(bookingData.date), 'EEE, MMM d')}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Ionicons name="time-outline" size={16} color={Colors.dark.textSecondary} />
                            <Text style={styles.summaryText}>
                                {formatTime(bookingData.startTime)} - {formatTime(bookingData.endTime)}
                            </Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Ionicons name="people-outline" size={16} color={Colors.dark.textSecondary} />
                            <Text style={styles.summaryText}>
                                {bookingData.numPlayers} players
                            </Text>
                        </View>
                    </View>
                </Card>

                {/* Payment Method */}
                <Text style={styles.sectionTitle}>Payment Method</Text>
                <TouchableOpacity
                    style={[
                        styles.paymentOption,
                        paymentMethod === 'e-wallet' && styles.paymentOptionSelected,
                    ]}
                    onPress={() => handleSelectPayment('e-wallet')}
                >
                    <View style={styles.paymentIcon}>
                        <Ionicons name="wallet-outline" size={24} color={Colors.dark.primary} />
                    </View>
                    <View style={styles.paymentInfo}>
                        <Text style={styles.paymentTitle}>E-Wallet</Text>
                        <Text style={styles.paymentDesc}>GCash, Maya, or Card</Text>
                    </View>
                    <View style={[
                        styles.radioOuter,
                        paymentMethod === 'e-wallet' && styles.radioSelected,
                    ]}>
                        {paymentMethod === 'e-wallet' && <View style={styles.radioInner} />}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.paymentOption,
                        paymentMethod === 'cash' && styles.paymentOptionSelected,
                    ]}
                    onPress={() => handleSelectPayment('cash')}
                >
                    <View style={styles.paymentIcon}>
                        <Ionicons name="cash-outline" size={24} color={Colors.dark.success} />
                    </View>
                    <View style={styles.paymentInfo}>
                        <Text style={styles.paymentTitle}>Cash</Text>
                        <Text style={styles.paymentDesc}>Pay balance at venue</Text>
                        {downPaymentAmount > 0 && (
                            <Text style={[styles.paymentDesc, { color: Colors.dark.primary, marginTop: 2, fontWeight: '600' }]}>
                                ₱{downPaymentAmount.toLocaleString()} deposit required online
                            </Text>
                        )}
                    </View>
                    <View style={[
                        styles.radioOuter,
                        paymentMethod === 'cash' && styles.radioSelected,
                    ]}>
                        {paymentMethod === 'cash' && <View style={styles.radioInner} />}
                    </View>
                </TouchableOpacity>



                <Text style={styles.sectionTitle}>Price Details</Text>
                <Card variant="default" padding="md">
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>
                            ₱{bookingData.hourlyRate} × {bookingData.duration} hr
                            {bookingData.recurrenceWeeks && bookingData.recurrenceWeeks > 1 ? ` × ${bookingData.recurrenceWeeks} wks` : ''}
                        </Text>
                        <Text style={styles.priceValue}>₱{subtotal.toLocaleString()}</Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Platform fee (5%)</Text>
                        <Text style={styles.priceValue}>₱{platformFee.toFixed(2)}</Text>
                    </View>
                    {discountAmount > 0 && (
                        <View style={styles.priceRow}>
                            <Text style={[styles.priceLabel, { color: Colors.dark.success }]}>Discount</Text>
                            <Text style={[styles.priceValue, { color: Colors.dark.success }]}>-₱{discountAmount.toLocaleString()}</Text>
                        </View>
                    )}
                    <View style={[styles.priceRow, styles.totalPriceRow]}>
                        <Text style={styles.totalPriceLabel}>Total</Text>
                        <Text style={styles.totalPriceValue}>₱{total.toLocaleString()}</Text>
                    </View>

                    {isDownPaymentRequired && (
                        <>
                            <View style={[styles.priceRow, { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.dark.border }]}>
                                <Text style={[styles.priceLabel, { color: Colors.dark.primary, fontWeight: '600' }]}>Down Payment (Pay Online)</Text>
                                <Text style={[styles.priceValue, { color: Colors.dark.primary, fontWeight: '600' }]}>₱{downPaymentAmount.toLocaleString()}</Text>
                            </View>
                            <View style={styles.priceRow}>
                                <Text style={styles.priceLabel}>Remaining Balance (Pay at Venue)</Text>
                                <Text style={styles.priceValue}>₱{remainingBalance.toLocaleString()}</Text>
                            </View>
                        </>
                    )}
                </Card>

                {/* Cancellation Policy */}
                <TouchableOpacity
                    style={styles.policyRow}
                    onPress={() => setPolicyAccepted(!policyAccepted)}
                >
                    <View style={[styles.checkbox, policyAccepted && styles.checkboxChecked]}>
                        {policyAccepted && <Ionicons name="checkmark" size={16} color={Colors.dark.text} />}
                    </View>
                    <Text style={styles.policyText}>
                        I agree to the cancellation policy. Free cancellation up to 24 hours before the booking.
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Bottom CTA */}
            <View style={styles.bottomCta}>
                <View style={styles.ctaPrice}>
                    <Text style={styles.ctaPriceLabel}>{isDownPaymentRequired ? 'To Pay Online' : 'Total'}</Text>
                    <Text style={styles.ctaPriceValue}>₱{(isDownPaymentRequired ? downPaymentAmount : total).toLocaleString()}</Text>
                </View>
                <Button
                    onPress={handleConfirmBooking}
                    disabled={!paymentMethod || !policyAccepted || isProcessing}
                    style={styles.confirmButton}
                >
                    {paymentMethod === 'e-wallet' ? 'Pay Now' : isDownPaymentRequired ? 'Pay Down Payment' : 'Confirm Booking'}
                </Button>
            </View>
        </SafeAreaView >
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
    sectionTitle: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
        marginBottom: Spacing.sm,
        marginTop: Spacing.lg,
    },
    summaryCard: {
        marginBottom: Spacing.sm,
    },
    courtName: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    venueName: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.md,
    },
    summaryDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
    },
    summaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    summaryText: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginBottom: Spacing.sm,
    },
    paymentOptionSelected: {
        borderColor: Colors.dark.primary,
        backgroundColor: Colors.dark.primary + '10',
    },
    paymentIcon: {
        width: 48,
        height: 48,
        borderRadius: Radius.md,
        backgroundColor: Colors.dark.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    paymentTitle: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    paymentDesc: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.dark.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: {
        borderColor: Colors.dark.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.dark.primary,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.xs,
    },
    priceLabel: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    priceValue: {
        ...Typography.body,
        color: Colors.dark.text,
    },
    totalPriceRow: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    totalPriceLabel: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    totalPriceValue: {
        ...Typography.h2,
        color: Colors.dark.primary,
    },
    policyRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: Spacing.lg,
        gap: Spacing.sm,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: Radius.sm,
        borderWidth: 2,
        borderColor: Colors.dark.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primary,
    },
    policyText: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        flex: 1,
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
    ctaPrice: {
        marginRight: Spacing.lg,
    },
    ctaPriceLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
    },
    ctaPriceValue: {
        ...Typography.h2,
        color: Colors.dark.primary,
    },
    confirmButton: {
        flex: 1,
    },
    // Processing
    processingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.md,
    },
    processingText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    // Success
    successContent: {
        alignItems: 'center',
        padding: Spacing.lg,
        paddingTop: Spacing.xxl,
    },
    successIconContainer: {
        marginBottom: Spacing.lg,
    },
    successIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: Colors.dark.success,
        alignItems: 'center',
        justifyContent: 'center',
    },
    successTitle: {
        ...Typography.h1,
        color: Colors.dark.text,
        textAlign: 'center',
    },
    successSubtitle: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.xs,
        marginBottom: Spacing.xl,
    },
    detailsCard: {
        width: '100%',
        marginBottom: Spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.xs,
    },
    detailLabel: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    detailValue: {
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
    reminderCard: {
        width: '100%',
        backgroundColor: Colors.dark.warning + '15',
        borderColor: Colors.dark.warning + '30',
        marginBottom: Spacing.lg,
    },
    reminderRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    reminderContent: {
        flex: 1,
    },
    reminderTitle: {
        ...Typography.body,
        color: Colors.dark.warning,
        fontWeight: '600',
    },
    reminderText: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    doneButton: {
        width: '100%',
    },
    promoCard: {
        marginBottom: Spacing.sm,
    },
    promoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    promoInput: {
        flex: 1,
        ...Typography.body,
        color: Colors.dark.text,
        paddingVertical: Spacing.sm,
    },
    applyButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    applyText: {
        ...Typography.body,
        fontWeight: '600',
        color: Colors.dark.primary,
    },
    applyTextDisabled: {
        color: Colors.dark.textTertiary,
    },
    promoError: {
        ...Typography.caption,
        color: Colors.dark.error,
        marginTop: 4,
    },
    promoSuccess: {
        ...Typography.caption,
        color: Colors.dark.success,
        marginTop: 4,
    },
});
