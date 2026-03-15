import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button } from '@/components/ui';
import { useCheckoutStore } from '@/store/checkout-store';
import { supabase } from '@/lib/supabase';

type PaymentStatus = 'verifying' | 'success' | 'failed' | 'pending';

export default function PaymentCallbackScreen() {
    const { status: urlStatus } = useLocalSearchParams<{ status?: string }>();
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('verifying');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const { reservationId, bookingData, resetCheckout } = useCheckoutStore();

    useEffect(() => {
        verifyPayment();
    }, []);

    const verifyPayment = async () => {
        if (!reservationId) {
            setPaymentStatus('failed');
            setErrorMessage('No reservation found to verify.');
            return;
        }

        try {
            // Poll for payment status (webhook may take a moment)
            const maxAttempts = 10;
            const delayMs = 2000;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                setRetryCount(attempt + 1);

                const { data: reservation, error } = await supabase
                    .from('reservations')
                    .select('status, amount_paid, total_amount')
                    .eq('id', reservationId)
                    .single();

                if (error) {
                    console.error('Error fetching reservation:', error);
                    continue;
                }

                // Check if payment was successful
                if (reservation.status === 'paid' || reservation.status === 'confirmed' || reservation.status === 'partially_paid') {
                    setPaymentStatus('success');
                    return;
                }

                // Check if explicitly failed
                if (reservation.status === 'cancelled' || reservation.status === 'payment_failed') {
                    setPaymentStatus('failed');
                    setErrorMessage('Payment was not completed.');
                    return;
                }

                // If URL status indicates failure, don't keep waiting
                if (urlStatus === 'failed' || urlStatus === 'cancelled') {
                    setPaymentStatus('failed');
                    setErrorMessage('Payment was cancelled or failed.');
                    return;
                }

                // Still pending_payment, wait and retry
                if (attempt < maxAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }

            // If we exhausted all attempts but URL says success, show pending
            if (urlStatus === 'success') {
                setPaymentStatus('pending');
                setErrorMessage('Payment is being processed. Please check your bookings shortly.');
            } else {
                setPaymentStatus('failed');
                setErrorMessage('Could not verify payment status. Please check your bookings.');
            }

        } catch (err: any) {
            console.error('Payment verification error:', err);
            setPaymentStatus('failed');
            setErrorMessage(err.message || 'An error occurred while verifying payment.');
        }
    };

    const handleViewBookings = () => {
        resetCheckout();
        router.replace('/(tabs)/bookings');
    };

    const handleRetry = () => {
        setPaymentStatus('verifying');
        setRetryCount(0);
        verifyPayment();
    };

    const handleGoBack = () => {
        router.replace('/checkout');
    };

    // Verifying state
    if (paymentStatus === 'verifying') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                    <Text style={styles.verifyingTitle}>Verifying Payment</Text>
                    <Text style={styles.verifyingSubtitle}>
                        Please wait while we confirm your payment...
                    </Text>
                    {retryCount > 1 && (
                        <Text style={styles.retryText}>
                            Checking... (attempt {retryCount}/10)
                        </Text>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // Success state
    if (paymentStatus === 'success') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <View style={styles.successIcon}>
                        <Ionicons name="checkmark" size={48} color={Colors.dark.text} />
                    </View>
                    <Text style={styles.successTitle}>Payment Successful!</Text>
                    <Text style={styles.successSubtitle}>
                        Your court has been booked successfully.
                    </Text>

                    {bookingData && (
                        <Card variant="glass" padding="md" style={styles.detailsCard}>
                            <Text style={styles.detailLabel}>Court</Text>
                            <Text style={styles.detailValue}>{bookingData.courtName}</Text>
                            <Text style={styles.detailLabel}>Venue</Text>
                            <Text style={styles.detailValue}>{bookingData.venueName}</Text>
                        </Card>
                    )}

                    <Button onPress={handleViewBookings} style={styles.button}>
                        View My Bookings
                    </Button>
                </View>
            </SafeAreaView>
        );
    }

    // Pending state (payment processing)
    if (paymentStatus === 'pending') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContent}>
                    <View style={styles.pendingIcon}>
                        <Ionicons name="time-outline" size={48} color={Colors.dark.warning} />
                    </View>
                    <Text style={styles.pendingTitle}>Payment Processing</Text>
                    <Text style={styles.pendingSubtitle}>{errorMessage}</Text>

                    <Button onPress={handleViewBookings} style={styles.button}>
                        View My Bookings
                    </Button>
                    <Button
                        variant="secondary"
                        onPress={handleRetry}
                        style={styles.secondaryButton}
                    >
                        Check Again
                    </Button>
                </View>
            </SafeAreaView>
        );
    }

    // Failed state
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.centerContent}>
                <View style={styles.failedIcon}>
                    <Ionicons name="close" size={48} color={Colors.dark.text} />
                </View>
                <Text style={styles.failedTitle}>Payment Failed</Text>
                <Text style={styles.failedSubtitle}>{errorMessage}</Text>

                <Button onPress={handleGoBack} style={styles.button}>
                    Try Again
                </Button>
                <Button
                    variant="secondary"
                    onPress={handleViewBookings}
                    style={styles.secondaryButton}
                >
                    View My Bookings
                </Button>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
    },
    // Verifying
    verifyingTitle: {
        ...Typography.h2,
        color: Colors.dark.text,
        marginTop: Spacing.lg,
    },
    verifyingSubtitle: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.xs,
    },
    retryText: {
        ...Typography.caption,
        color: Colors.dark.textTertiary,
        marginTop: Spacing.md,
    },
    // Success
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
        marginTop: Spacing.lg,
        textAlign: 'center',
    },
    successSubtitle: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.xs,
        marginBottom: Spacing.xl,
    },
    // Pending
    pendingIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: Colors.dark.warning + '30',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pendingTitle: {
        ...Typography.h1,
        color: Colors.dark.text,
        marginTop: Spacing.lg,
        textAlign: 'center',
    },
    pendingSubtitle: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.xs,
        marginBottom: Spacing.xl,
    },
    // Failed
    failedIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: Colors.dark.error,
        alignItems: 'center',
        justifyContent: 'center',
    },
    failedTitle: {
        ...Typography.h1,
        color: Colors.dark.text,
        marginTop: Spacing.lg,
        textAlign: 'center',
    },
    failedSubtitle: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.xs,
        marginBottom: Spacing.xl,
    },
    // Common
    detailsCard: {
        width: '100%',
        marginBottom: Spacing.lg,
    },
    detailLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        marginTop: Spacing.sm,
    },
    detailValue: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    button: {
        width: '100%',
        marginTop: Spacing.md,
    },
    secondaryButton: {
        width: '100%',
        marginTop: Spacing.sm,
    },
});
