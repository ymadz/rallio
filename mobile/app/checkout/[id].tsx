import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';

interface CheckoutData {
    court: any;
    slots: any[];
    pricing: {
        subtotal: number;
        discount: number;
        total: number;
    };
}

export default function CheckoutScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    // In a real app, you would fetch the pending reservation or cart state based on the ID.
    // For this implementation, we will mock the display state as requested for UI alignment.

    useEffect(() => {
        // Simulate fetching checkout data
        setTimeout(() => {
            setIsLoading(false);
        }, 800);
    }, [id]);

    const handleConfirmBooking = async () => {
        setIsProcessing(true);
        // Simulate payment/booking confirmation
        setTimeout(() => {
            setIsProcessing(false);
            router.replace('/(tabs)/bookings');
        }, 1500);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.dark.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Checkout</Text>
                <View style={{ width: 44 }} /> {/* Spacer */}
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

                <Text style={styles.sectionTitle}>Booking Summary</Text>

                <Card variant="glass" padding="lg" style={styles.summaryCard}>
                    <Text style={styles.venueName}>Sample Venue Name</Text>
                    <Text style={styles.courtName}>Court 1 • Indoor Wood</Text>

                    <View style={styles.divider} />

                    <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={20} color={Colors.dark.textSecondary} />
                        <Text style={styles.detailText}>Wed, Oct 25, 2023</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Ionicons name="time-outline" size={20} color={Colors.dark.textSecondary} />
                        <Text style={styles.detailText}>6:00 PM - 8:00 PM (2 hrs)</Text>
                    </View>
                </Card>

                <Text style={styles.sectionTitle}>Payment Details</Text>

                <Card variant="glass" padding="lg" style={styles.priceCard}>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Subtotal</Text>
                        <Text style={styles.priceValue}>₱800.00</Text>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Platform Fee</Text>
                        <Text style={styles.priceValue}>₱50.00</Text>
                    </View>
                    <View style={[styles.priceRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>₱850.00</Text>
                    </View>
                </Card>

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={20} color={Colors.dark.textSecondary} />
                    <Text style={styles.infoText}>
                        By confirming this booking, you agree to the venue's cancellation policy.
                    </Text>
                </View>

                {/* Extra space for scrolling past fixed bottom bar */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Fixed Bottom Action Bar */}
            <View style={styles.bottomBar}>
                <View style={styles.bottomBarInner}>
                    <View>
                        <Text style={styles.bottomBarLabel}>Total to pay</Text>
                        <Text style={styles.bottomBarAmount}>₱850.00</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.confirmButton, isProcessing && styles.confirmButtonDisabled]}
                        onPress={handleConfirmBooking}
                        disabled={isProcessing}
                        activeOpacity={0.8}
                    >
                        {isProcessing ? (
                            <ActivityIndicator size="small" color={Colors.dark.background} />
                        ) : (
                            <Text style={styles.confirmButtonText}>Confirm Booking</Text>
                        )}
                    </TouchableOpacity>
                </View>
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
        backgroundColor: Colors.dark.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border,
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.full,
    },
    headerTitle: {
        ...Typography.h2,
        color: Colors.dark.text,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
    sectionTitle: {
        ...Typography.h3,
        color: Colors.dark.text,
        marginBottom: Spacing.md,
        marginTop: Spacing.sm,
    },
    summaryCard: {
        marginBottom: Spacing.xl,
    },
    venueName: {
        ...Typography.h2,
        color: Colors.dark.text,
        marginBottom: 4,
    },
    courtName: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.dark.border,
        marginVertical: Spacing.lg,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.sm,
    },
    detailText: {
        ...Typography.body,
        color: Colors.dark.text,
    },
    priceCard: {
        marginBottom: Spacing.lg,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    priceLabel: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    priceValue: {
        ...Typography.body,
        color: Colors.dark.text,
    },
    totalRow: {
        marginTop: Spacing.sm,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
        marginBottom: 0,
    },
    totalLabel: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    totalValue: {
        ...Typography.h2,
        color: Colors.dark.primary,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.surface,
        padding: Spacing.md,
        borderRadius: Radius.md,
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    infoText: {
        flex: 1,
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        lineHeight: 18,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: Spacing.lg,
        paddingBottom: 40, // Account for safe area
        backgroundColor: Colors.dark.background,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    bottomBarInner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bottomBarLabel: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        marginBottom: 2,
    },
    bottomBarAmount: {
        ...Typography.h2,
        color: Colors.dark.text,
    },
    confirmButton: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: Spacing.xl,
        paddingVertical: 14,
        borderRadius: Radius.md,
        minWidth: 160,
        alignItems: 'center',
    },
    confirmButtonDisabled: {
        opacity: 0.7,
    },
    confirmButtonText: {
        ...Typography.button,
        color: Colors.dark.background,
    },
});
