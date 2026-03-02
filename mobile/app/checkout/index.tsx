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
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button } from '@/components/ui';
import { useCheckoutStore } from '@/store/checkout-store';
import { useCourtStore } from '@/store/court-store';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import SplitPaymentControls from '@/components/checkout/SplitPaymentControls';

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

    const { getVenueById } = useCourtStore();

    // Get venue to check for discounts
    const venue = bookingData ? getVenueById(bookingData.venueId) : null;
    const hasDiscounts = venue?.hasActiveDiscounts || false;
    const discountLabels = venue?.activeDiscountLabels || [];

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
        // Adjust total if discount is applied? 
        // Note: The store `getTotalAmount` usually calculates based on its internal state. 
        // Since we are adding local discount state, we subtract it here. 
        // Ideally we should sync this to the store, but for parity fix, local calculation on display and submission is acceptable.
    }, [discountAmount]);

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

            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.254.178:3000';

            // Prepare payload for Server Action Wrapper
            const reservationPayload = {
                courtId: bookingData.courtId,
                startTimeISO: `${format(new Date(bookingData.date), 'yyyy-MM-dd')}T${bookingData.startTime}:00`,
                endTimeISO: `${format(new Date(bookingData.date), 'yyyy-MM-dd')}T${bookingData.endTime}:00`, // Duration logic handled by server if needed, but passing endISO is clearer
                totalAmount: total, // GRAND TOTAL (Pre-calculated with discount)
                discountAmount: discountAmount, // Pass discount info if backend needs it
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

                // Add return URL for Expo Go compatibility
                const redirectUrl = Linking.createURL('/checkout');
                console.log('Mobile Checkout: Deep link return URL:', redirectUrl);

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
                        isDownPayment: isDownPaymentRequired,
                        redirectUrl: redirectUrl
                    })
                });

                const checkoutResult = await checkoutResponse.json();

                if (!checkoutResponse.ok || !checkoutResult.checkoutUrl) {
                    throw new Error(checkoutResult.error || 'Failed to create checkout session');
                }

                // Open PayMongo Checkout via WebBrowser so it returns back to the app smoothly
                const browserResult = await WebBrowser.openAuthSessionAsync(
                    checkoutResult.checkoutUrl,
                    redirectUrl
                );

                console.log('Mobile Checkout: Browser returned', browserResult.type);

                if (browserResult.type === 'success' && browserResult.url) {
                    const parsedUrl = Linking.parse(browserResult.url);
                    if (parsedUrl.queryParams?.status === 'success') {
                        setStep('success');
                        setIsProcessing(false);
                        return;
                    } else if (parsedUrl.queryParams?.status === 'failed') {
                        Alert.alert('Payment Failed', 'Your payment was cancelled or failed.');
                        setStep('review');
                        setIsProcessing(false);
                        return;
                    }
                }

                // If user closed the browser securely or deep link missed
                setPendingReservationId(primaryReservationId);
                setIsProcessing(false);

                Alert.alert('Payment Pending', 'If you completed the payment, your booking will be confirmed shortly. You can check its status in the Bookings tab.', [
                    { text: 'View Bookings', onPress: () => { resetCheckout(); router.replace('/(tabs)/bookings'); } }
                ]);
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
                {/* Unified Booking Summary & Price Details */}
                <Text style={styles.sectionTitle}>Booking Summary</Text>
                <Card variant="glass" padding="md" style={styles.summaryCard}>
                    {/* Court Info */}
                    <View style={styles.summarySectionBlock}>
                        <Text style={styles.summaryLabel}>Court</Text>
                        <Text style={styles.courtName}>{bookingData.courtName}</Text>
                        <Text style={styles.venueName}>{bookingData.venueName}</Text>
                    </View>

                    {/* Date & Time */}
                    <View style={styles.summarySectionBlock}>
                        <Text style={styles.summaryLabel}>Date & Time</Text>
                        <Text style={styles.summaryMainText}>
                            {format(new Date(bookingData.date), 'EEEE, MMM d, yyyy')}
                        </Text>
                        <Text style={styles.summarySubText}>
                            {formatTime(bookingData.startTime)} - {formatTime(bookingData.endTime)}
                        </Text>

                        {bookingData.recurrenceWeeks && bookingData.recurrenceWeeks > 1 && (
                            <View style={styles.recurrenceBadges}>
                                <View style={styles.recurrenceBadge}>
                                    <Text style={styles.recurrenceBadgeText}>{bookingData.recurrenceWeeks} Weeks Selection</Text>
                                </View>
                                {(bookingData.selectedDays?.length || 0) > 1 && (
                                    <View style={[styles.recurrenceBadge, styles.weeklyBadge]}>
                                        <Text style={[styles.recurrenceBadgeText, styles.weeklyBadgeText]}>
                                            {bookingData.selectedDays?.length}x Weekly
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Price Breakdown */}
                    <View style={styles.priceContainer}>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>
                                Court Fee (₱{bookingData.hourlyRate.toFixed(2)} × {bookingData.duration} {bookingData.duration > 1 ? 'hrs' : 'hr'})
                                {bookingData.recurrenceWeeks && bookingData.recurrenceWeeks > 1 ? ` × ${bookingData.recurrenceWeeks * (bookingData.selectedDays?.length || 1)} sessions` : ''}
                            </Text>
                            <Text style={styles.priceValue}>₱{(subtotal + discountAmount).toLocaleString()}</Text>
                        </View>

                        {/* Discount Tags */}
                        {hasDiscounts && discountLabels.length > 0 && (
                            <View style={[styles.discountBadgesContainer, { marginTop: Spacing.sm }]}>
                                {discountLabels.map((label, idx) => (
                                    <View key={idx} style={styles.discountBadge}>
                                        <Ionicons name="pricetag" size={14} color={Colors.dark.primary} style={{ marginTop: 2 }} />
                                        <Text style={styles.discountBadgeText}>{label}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {discountAmount > 0 && (
                            <>
                                <View style={styles.priceRow}>
                                    <Text style={[styles.priceLabel, { color: Colors.dark.success }]}>Discount</Text>
                                    <Text style={[styles.priceValue, { color: Colors.dark.success }]}>-₱{discountAmount.toLocaleString()}</Text>
                                </View>
                                <View style={[styles.priceRow, { paddingTop: Spacing.xs }]}>
                                    <Text style={[styles.priceLabel, { fontWeight: '600' }]}>Subtotal</Text>
                                    <Text style={[styles.priceValue, { fontWeight: '600' }]}>₱{subtotal.toLocaleString()}</Text>
                                </View>
                            </>
                        )}

                        <View style={[styles.priceRow, { marginTop: Spacing.xs }]}>
                            <Text style={styles.priceLabel}>Platform Fee (5%)</Text>
                            <Text style={styles.priceValue}>₱{platformFee.toFixed(2)}</Text>
                        </View>
                    </View>

                    {/* Total Area */}
                    <View style={[styles.totalPriceRow, { marginTop: Spacing.md }]}>
                        <View style={styles.priceRow}>
                            <Text style={styles.totalPriceLabel}>Total Amount</Text>
                            <Text style={styles.totalPriceValue}>
                                ₱{(isDownPaymentRequired ? downPaymentAmount : total).toLocaleString()}
                            </Text>
                        </View>

                        {isDownPaymentRequired && (
                            <View style={styles.downPaymentBox}>
                                <View>
                                    <Text style={styles.dpBoxTitle}>REMAINING BALANCE</Text>
                                    <Text style={styles.dpBoxSub}>To be paid at the venue</Text>
                                </View>
                                <Text style={styles.dpBoxValue}>₱{remainingBalance.toLocaleString()}</Text>
                            </View>
                        )}
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
    summaryLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        marginBottom: 2,
    },
    summaryMainText: {
        ...Typography.body,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    summarySubText: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
    },
    summarySectionBlock: {
        marginBottom: Spacing.md,
    },
    recurrenceBadges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    recurrenceBadge: {
        backgroundColor: Colors.dark.primary + '15',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.sm,
    },
    recurrenceBadgeText: {
        ...Typography.caption,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    weeklyBadge: {
        backgroundColor: Colors.dark.primary + '15',
    },
    weeklyBadgeText: {
        color: Colors.dark.primary,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.dark.border,
        marginVertical: Spacing.sm,
    },
    priceContainer: {
        paddingVertical: Spacing.sm,
    },
    downPaymentBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.dark.primary + '10',
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginTop: Spacing.md,
    },
    dpBoxTitle: {
        ...Typography.caption,
        color: Colors.dark.primary,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    dpBoxSub: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    dpBoxValue: {
        ...Typography.h3,
        color: Colors.dark.text,
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
    priceTotalValue: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    discountBadgesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginTop: Spacing.xs,
        marginBottom: Spacing.xs,
    },
    discountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.primary + '15',
        borderWidth: 1,
        borderColor: Colors.dark.primary + '30',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: Radius.full,
        gap: 4,
    },
    discountBadgeText: {
        ...Typography.caption,
        color: Colors.dark.primary,
        fontWeight: 'bold',
    },
    bottomSafeArea: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
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
