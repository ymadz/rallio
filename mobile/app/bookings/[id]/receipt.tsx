import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Share,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button } from '@/components/ui';
import { apiGet } from '@/lib/api';
import { format } from 'date-fns';
import QRCode from 'react-native-qrcode-svg';

interface ReceiptData {
    reservation: any;
    payments: any[];
}

export default function ReceiptScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [data, setData] = useState<ReceiptData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchReceipt();
    }, [id]);

    const fetchReceipt = async () => {
        try {
            setIsLoading(true);
            const result = await apiGet('/api/mobile/get-receipt', { reservationId: id });

            if (result.success) {
                setData({
                    reservation: result.reservation,
                    payments: result.payments,
                });
            } else {
                Alert.alert('Error', result.error || 'Failed to load receipt');
                router.back();
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to load receipt');
            router.back();
        } finally {
            setIsLoading(false);
        }
    };

    const handleShare = async () => {
        if (!data) return;

        const { reservation } = data;
        const startTime = new Date(reservation.start_time);
        const endTime = new Date(reservation.end_time);
        const venueName = reservation.courts?.venues?.name || 'Venue';
        const courtName = reservation.courts?.name || 'Court';

        const message = [
            `🏸 Rallio Booking Receipt`,
            ``,
            `Venue: ${venueName}`,
            `Court: ${courtName}`,
            `Date: ${format(startTime, 'EEEE, MMM d, yyyy')}`,
            `Time: ${format(startTime, 'h:mm a')} - ${format(endTime, 'h:mm a')}`,
            `Total: ₱${reservation.total_amount?.toLocaleString()}`,
            `Status: ${reservation.status.toUpperCase().replace('_', ' ')}`,
            ``,
            `Booking ID: ${reservation.id.slice(0, 8)}`,
        ].join('\n');

        try {
            await Share.share({
                message,
                title: 'Rallio Booking Receipt',
            });
        } catch (error) {
            // User cancelled share
        }
    };

    if (isLoading || !data) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.dark.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const { reservation, payments } = data;
    const startTime = new Date(reservation.start_time);
    const endTime = new Date(reservation.end_time);
    const venue = reservation.courts?.venues;
    const court = reservation.courts;

    const completedPayments = payments.filter((p: any) => p.status === 'completed' || p.status === 'paid');
    const totalPaid = completedPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Receipt</Text>
                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                    <Ionicons name="share-outline" size={22} color={Colors.dark.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* QR Code */}
                <View style={styles.qrContainer}>
                    <Card variant="default" style={styles.qrCard}>
                        <QRCode
                            value={reservation.id}
                            size={160}
                            backgroundColor="white"
                            color="black"
                        />
                        <Text style={styles.bookingId}>
                            #{reservation.id.slice(0, 8).toUpperCase()}
                        </Text>
                    </Card>
                </View>

                {/* Booking Details */}
                <Card variant="glass" padding="lg" style={styles.detailsCard}>
                    <Text style={styles.sectionTitle}>Booking Details</Text>

                    <View style={styles.row}>
                        <Text style={styles.label}>Venue</Text>
                        <Text style={styles.value}>{venue?.name || 'N/A'}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Court</Text>
                        <Text style={styles.value}>{court?.name || 'N/A'}</Text>
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
                    <View style={styles.row}>
                        <Text style={styles.label}>Duration</Text>
                        <Text style={styles.value}>
                            {Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60))} hour(s)
                        </Text>
                    </View>
                    {reservation.num_players && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Players</Text>
                            <Text style={styles.value}>{reservation.num_players}</Text>
                        </View>
                    )}
                    <View style={styles.row}>
                        <Text style={styles.label}>Status</Text>
                        <Text style={[styles.value, { color: getStatusColor(reservation.status) }]}>
                            {reservation.status.toUpperCase().replace('_', ' ')}
                        </Text>
                    </View>
                </Card>

                {/* Payment Breakdown */}
                <Card variant="glass" padding="lg" style={styles.detailsCard}>
                    <Text style={styles.sectionTitle}>Payment Summary</Text>

                    <View style={styles.row}>
                        <Text style={styles.label}>Subtotal</Text>
                        <Text style={styles.value}>₱{reservation.total_amount?.toLocaleString()}</Text>
                    </View>

                    {totalPaid > 0 && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Amount Paid</Text>
                            <Text style={[styles.value, { color: Colors.dark.success }]}>
                                ₱{totalPaid.toLocaleString()}
                            </Text>
                        </View>
                    )}

                    {reservation.total_amount - totalPaid > 0 && totalPaid > 0 && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Remaining Balance</Text>
                            <Text style={[styles.value, { color: Colors.dark.warning }]}>
                                ₱{(reservation.total_amount - totalPaid).toLocaleString()}
                            </Text>
                        </View>
                    )}

                    <View style={[styles.row, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>₱{reservation.total_amount?.toLocaleString()}</Text>
                    </View>
                </Card>

                {/* Payment History */}
                {payments.length > 0 && (
                    <Card variant="glass" padding="lg" style={styles.detailsCard}>
                        <Text style={styles.sectionTitle}>Payment History</Text>
                        {payments.map((payment: any, index: number) => (
                            <View key={payment.id || `payment-${payment.created_at || index}`} style={styles.paymentItem}>
                                <View>
                                    <Text style={styles.paymentMethod}>
                                        {(payment.payment_method || 'Unknown').toUpperCase()}
                                    </Text>
                                    <Text style={styles.paymentDate}>
                                        {format(new Date(payment.created_at), 'MMM d, yyyy h:mm a')}
                                    </Text>
                                </View>
                                <View style={styles.paymentRight}>
                                    <Text style={styles.paymentAmount}>₱{payment.amount?.toLocaleString()}</Text>
                                    <Text style={[
                                        styles.paymentStatus,
                                        { color: payment.status === 'completed' || payment.status === 'paid' ? Colors.dark.success : Colors.dark.warning }
                                    ]}>
                                        {payment.status?.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </Card>
                )}

                {/* Venue Contact */}
                {venue && (venue.phone || venue.email) && (
                    <Card variant="glass" padding="lg" style={styles.detailsCard}>
                        <Text style={styles.sectionTitle}>Venue Contact</Text>
                        {venue.address && (
                            <View style={styles.contactRow}>
                                <Ionicons name="location-outline" size={16} color={Colors.dark.textSecondary} />
                                <Text style={styles.contactText}>{venue.address}</Text>
                            </View>
                        )}
                        {venue.phone && (
                            <View style={styles.contactRow}>
                                <Ionicons name="call-outline" size={16} color={Colors.dark.textSecondary} />
                                <Text style={styles.contactText}>{venue.phone}</Text>
                            </View>
                        )}
                        {venue.email && (
                            <View style={styles.contactRow}>
                                <Ionicons name="mail-outline" size={16} color={Colors.dark.textSecondary} />
                                <Text style={styles.contactText}>{venue.email}</Text>
                            </View>
                        )}
                    </Card>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function getStatusColor(status: string) {
    switch (status) {
        case 'confirmed':
        case 'paid':
        case 'completed':
            return Colors.dark.success;
        case 'pending':
        case 'pending_payment':
        case 'partially_paid':
            return Colors.dark.warning;
        case 'cancelled':
        case 'refunded':
            return Colors.dark.error;
        default:
            return Colors.dark.textSecondary;
    }
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
    headerTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    shareButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.border,
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
    bookingId: {
        marginTop: Spacing.sm,
        color: '#333',
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: 1,
    },
    detailsCard: {
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        ...Typography.h4,
        color: Colors.dark.text,
        fontWeight: '700',
        marginBottom: Spacing.xs,
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
    paymentItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border + '40',
    },
    paymentMethod: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
        fontSize: 13,
    },
    paymentDate: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    paymentRight: {
        alignItems: 'flex-end',
    },
    paymentAmount: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    paymentStatus: {
        ...Typography.caption,
        fontWeight: '700',
        fontSize: 10,
        marginTop: 2,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    contactText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        flex: 1,
    },
});
