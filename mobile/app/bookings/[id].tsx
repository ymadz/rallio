import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,

    ActivityIndicator,
    Alert,
    ScrollView,
    TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import QRCode from 'react-native-qrcode-svg';
import { format } from 'date-fns';

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending_payment' | 'paid' | 'refunded';

interface Reservation {
    id: string;
    court_id: string;
    start_time: string;
    end_time: string;
    total_amount: number;
    status: BookingStatus;
    payment_method?: string;
    courts?: {
        name: string;
        venues?: {
            name: string;
            address: string;
            opening_hours?: any;
        };
    };
}

export default function BookingDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [booking, setBooking] = useState<Reservation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCancelling, setIsCancelling] = useState(false);

    // Refund State
    const [refundStatus, setRefundStatus] = useState<any>(null); // To store existing refund status
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundReason, setRefundReason] = useState('');
    const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

    useEffect(() => {
        fetchBookingDetails();
    }, [id]);

    // Check for refund status when booking loads
    useEffect(() => {
        if (booking && (booking.status === 'paid' || booking.status === 'confirmed')) {
            checkRefundStatus();
        }
    }, [booking]);

    const checkRefundStatus = async () => {
        try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.254.170:3000';
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const response = await fetch(`${apiUrl}/api/mobile/get-refund-status?reservationId=${id}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            const result = await response.json();
            if (result.success && result.refunds && result.refunds.length > 0) {
                // Find most recent meaningful status
                const activeRefund = result.refunds.find((r: any) =>
                    ['pending', 'processing', 'succeeded'].includes(r.status)
                );
                if (activeRefund) {
                    setRefundStatus(activeRefund);
                }
            }
        } catch (error) {
            console.error('Error checking refund status:', error);
        }
    };

    const fetchBookingDetails = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('reservations')
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
                .eq('id', id)
                .single();

            if (error) throw error;
            setBooking(data);
        } catch (error) {
            console.error('Error details:', error);
            Alert.alert('Error', 'Failed to load booking details');
            router.back();
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelReservation = async () => {
        if (!booking) return;

        // If booking is unpaid or pending_payment, we can just cancel directly
        const canDirectCancel = ['pending', 'pending_payment'].includes(booking.status);

        if (canDirectCancel) {
            Alert.alert(
                'Cancel Booking',
                'Are you sure you want to cancel this booking?',
                [
                    { text: 'No', style: 'cancel' },
                    {
                        text: 'Yes, Cancel',
                        style: 'destructive',
                        onPress: executeCancellation
                    }
                ]
            );
        } else {
            // Paid booking - must request refund
            // Check 24-hour policy
            const startTime = new Date(booking.start_time);
            const hoursUntilStart = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);

            if (hoursUntilStart < 24) {
                Alert.alert('Cannot Refund', 'Refunds cannot be requested within 24 hours of the booking start time.');
                return;
            }

            // Show refund modal
            setRefundReason('');
            setShowRefundModal(true);
        }
    };

    const executeCancellation = async () => {
        if (!booking) return;
        try {
            setIsCancelling(true);

            // Call API
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.254.170:3000';
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) throw new Error('Not authenticated');

            const response = await fetch(`${apiUrl}/api/mobile/cancel-reservation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ reservationId: booking.id })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to cancel');
            }

            Alert.alert('Success', 'Booking cancelled successfully');
            fetchBookingDetails(); // Refresh
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to cancel');
        } finally {
            setIsCancelling(false);
        }
    };

    const submitRefundRequest = async () => {
        if (!refundReason.trim()) {
            Alert.alert('Error', 'Please provide a reason for the refund');
            return;
        }

        try {
            setIsSubmittingRefund(true);
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.254.170:3000';
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) throw new Error('Not authenticated');

            const response = await fetch(`${apiUrl}/api/mobile/request-refund`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    reservationId: booking?.id,
                    reason: refundReason.trim()
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Failed to request refund');
            }

            setShowRefundModal(false);
            Alert.alert('Success', 'Refund request submitted successfully. We will notify you once it is processed.');
            checkRefundStatus(); // Refresh status
            fetchBookingDetails();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to submit refund request');
        } finally {
            setIsSubmittingRefund(false);
        }
    };

    if (isLoading || !booking) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const startTime = new Date(booking.start_time);
    const endTime = new Date(booking.end_time);
    const isUpcoming = startTime > new Date() && booking.status !== 'cancelled' && booking.status !== 'refunded';
    const canCancel = isUpcoming && booking.status !== 'completed';

    // Check if within 24 hours for paid bookings label
    const hoursUntilStart = (startTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const isWithin24Hours = hoursUntilStart < 24;
    const isPaid = ['paid', 'confirmed'].includes(booking.status) && booking.total_amount > 0;

    // Determine button label
    let buttonLabel = 'Cancel Booking';
    if (isPaid) {
        buttonLabel = isWithin24Hours ? 'Cannot Refund (Within 24h)' : 'Request Refund';
    }
    const isButtonDisabled = isCancelling || (isPaid && isWithin24Hours);

    // Status colors
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': case 'paid': return Colors.dark.success;
            case 'pending': case 'pending_payment': return Colors.dark.warning;
            case 'cancelled': case 'refunded': return Colors.dark.error;
            default: return Colors.dark.textSecondary;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Booking Details</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.content}>
                {/* QR Code Section (Only for valid active bookings) */}
                {booking.status !== 'cancelled' && booking.status !== 'refunded' && (
                    <View style={styles.qrContainer}>
                        <Card variant="default" style={styles.qrCard}>
                            <QRCode
                                value={booking.id}
                                size={200}
                                backgroundColor="white"
                                color="black"
                            />
                            <Text style={styles.qrLabel}>Scan at Venue</Text>
                        </Card>
                    </View>
                )}

                {/* Refund Status Banner */}
                {refundStatus && (
                    <View style={[styles.refundBanner, { backgroundColor: Colors.dark.warning + '20', borderColor: Colors.dark.warning }]}>
                        <ActivityIndicator size="small" color={Colors.dark.warning} />
                        <Text style={{ color: Colors.dark.warning, fontWeight: '600' }}>
                            Refund {refundStatus.status === 'succeeded' ? 'Completed' : 'Processing'}
                        </Text>
                    </View>
                )}

                {/* Status Banner */}
                <View style={[styles.statusBanner, { backgroundColor: getStatusColor(booking.status) + '15' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                        {booking.status.toUpperCase().replace('_', ' ')}
                    </Text>
                </View>

                {/* Details */}
                <Card variant="glass" padding="lg" style={styles.detailsCard}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Venue</Text>
                        <Text style={styles.value}>{booking.courts?.venues?.name}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Court</Text>
                        <Text style={styles.value}>{booking.courts?.name}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Date</Text>
                        <Text style={styles.value}>{format(startTime, 'EEEE, MMM d, yyyy')}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Time</Text>
                        <Text style={styles.value}>
                            {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                        </Text>
                    </View>
                    <View style={[styles.row, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total Amount</Text>
                        <Text style={styles.totalValue}>₱{booking.total_amount.toLocaleString()}</Text>
                    </View>
                </Card>

                {/* Actions */}
                {canCancel && !refundStatus && (
                    <Button
                        variant="secondary"
                        style={[styles.cancelButton, isWithin24Hours && isPaid && { opacity: 0.5 }]}
                        onPress={handleCancelReservation}
                        disabled={isButtonDisabled}
                    >
                        {isCancelling ? 'Processing...' : buttonLabel}
                    </Button>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Refund Reason Modal */}
            {showRefundModal && (
                <View style={[StyleSheet.absoluteFill, styles.modalOverlay]}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Request Refund</Text>
                        <Text style={styles.modalText}>
                            Please provide a reason for your refund request.
                            Refunds typically take 5-10 business days to process.
                        </Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Reason for refund..."
                            placeholderTextColor={Colors.dark.textSecondary}
                            multiline
                            value={refundReason}
                            onChangeText={setRefundReason}
                        />

                        <View style={styles.modalActions}>
                            <Button
                                variant="secondary"
                                style={styles.modalButton}
                                onPress={() => setShowRefundModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                style={[styles.modalButton, { backgroundColor: Colors.dark.primary }]}
                                onPress={submitRefundRequest}
                                disabled={isSubmittingRefund || !refundReason.trim()}
                            >
                                {isSubmittingRefund ? 'Submitting...' : 'Submit Request'}
                            </Button>
                        </View>
                    </View>
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
    center: {
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
        ...Typography.h3,
        color: Colors.dark.text,
    },
    content: {
        padding: Spacing.lg,
    },
    qrContainer: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    qrCard: {
        padding: Spacing.xl,
        backgroundColor: 'white',
        alignItems: 'center',
        borderRadius: Radius.lg,
    },
    qrLabel: {
        marginTop: Spacing.md,
        color: 'black',
        fontWeight: '600',
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statusBanner: {
        padding: Spacing.md,
        borderRadius: Radius.md,
        alignItems: 'center',
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    statusText: {
        fontWeight: '700',
        letterSpacing: 1,
    },
    refundBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.md,
        marginBottom: Spacing.lg,
        borderWidth: 1,
    },
    detailsCard: {
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    label: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        flex: 1,
    },
    value: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '500',
        flex: 1,
        textAlign: 'right',
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
        ...Typography.h3,
        color: Colors.dark.primary,
    },
    cancelButton: {
        borderColor: Colors.dark.error,
        marginTop: Spacing.md,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    modalContent: {
        backgroundColor: Colors.dark.surface,
        borderRadius: Radius.lg,
        padding: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    modalTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
        marginBottom: Spacing.md,
    },
    modalText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.lg,
    },
    input: {
        backgroundColor: Colors.dark.background,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: Radius.md,
        padding: Spacing.md,
        color: Colors.dark.text,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: Spacing.lg,
    },
    modalActions: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    modalButton: {
        flex: 1,
    }
});
