import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card } from '@/components/ui';
import { useCheckoutStore } from '@/store/checkout-store';

export default function SplitPaymentControls() {
    const {
        bookingData,
        isSplitPayment,
        splitPlayerCount,
        setSplitPayment,
        getTotalAmount,
        getPerPlayerAmount,
    } = useCheckoutStore();

    const maxPlayers = bookingData?.numPlayers || bookingData?.capacity || 4;
    const total = getTotalAmount();
    const perPlayer = getPerPlayerAmount();

    const increment = () => {
        if (splitPlayerCount < maxPlayers) {
            setSplitPayment(true, splitPlayerCount + 1);
        }
    };

    const decrement = () => {
        if (splitPlayerCount > 2) {
            setSplitPayment(true, splitPlayerCount - 1);
        }
    };

    return (
        <Card variant="glass" padding="md" style={styles.container}>
            {/* Toggle */}
            <View style={styles.toggleRow}>
                <View style={styles.toggleLabel}>
                    <Ionicons name="people" size={20} color={Colors.dark.primary} />
                    <Text style={styles.toggleText}>Split Payment</Text>
                </View>
                <Switch
                    value={isSplitPayment}
                    onValueChange={(val) => setSplitPayment(val, val ? 2 : splitPlayerCount)}
                    trackColor={{
                        false: Colors.dark.border,
                        true: Colors.dark.primary + '60',
                    }}
                    thumbColor={isSplitPayment ? Colors.dark.primary : Colors.dark.textTertiary}
                />
            </View>

            {isSplitPayment && (
                <>
                    <View style={styles.divider} />

                    {/* Player count stepper */}
                    <View style={styles.stepperRow}>
                        <Text style={styles.stepperLabel}>Split between</Text>
                        <View style={styles.stepper}>
                            <TouchableOpacity
                                style={[styles.stepperButton, splitPlayerCount <= 2 && styles.stepperDisabled]}
                                onPress={decrement}
                                disabled={splitPlayerCount <= 2}
                            >
                                <Ionicons
                                    name="remove"
                                    size={18}
                                    color={splitPlayerCount <= 2 ? Colors.dark.textTertiary : Colors.dark.text}
                                />
                            </TouchableOpacity>
                            <Text style={styles.stepperValue}>{splitPlayerCount}</Text>
                            <TouchableOpacity
                                style={[styles.stepperButton, splitPlayerCount >= maxPlayers && styles.stepperDisabled]}
                                onPress={increment}
                                disabled={splitPlayerCount >= maxPlayers}
                            >
                                <Ionicons
                                    name="add"
                                    size={18}
                                    color={splitPlayerCount >= maxPlayers ? Colors.dark.textTertiary : Colors.dark.text}
                                />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.stepperLabel}>players</Text>
                    </View>

                    {/* Per-player amount */}
                    <View style={styles.splitSummary}>
                        <View style={styles.splitRow}>
                            <Text style={styles.splitLabel}>Total</Text>
                            <Text style={styles.splitValue}>₱{total.toLocaleString()}</Text>
                        </View>
                        <View style={styles.splitRow}>
                            <Text style={styles.splitLabel}>Per Player</Text>
                            <Text style={styles.splitValueHighlight}>₱{perPlayer.toLocaleString()}</Text>
                        </View>
                    </View>

                    <Text style={styles.splitNote}>
                        Each player will receive a payment link. Booking confirms once all payments are received.
                    </Text>
                </>
            )}
        </Card>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.md,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    toggleText: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.dark.border,
        marginVertical: Spacing.md,
    },
    stepperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    stepperLabel: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        overflow: 'hidden',
    },
    stepperButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.dark.surface,
    },
    stepperDisabled: {
        opacity: 0.4,
    },
    stepperValue: {
        ...Typography.h3,
        color: Colors.dark.text,
        minWidth: 36,
        textAlign: 'center',
        backgroundColor: Colors.dark.background,
        lineHeight: 36,
    },
    splitSummary: {
        marginTop: Spacing.md,
        gap: Spacing.xs,
    },
    splitRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    splitLabel: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    splitValue: {
        ...Typography.body,
        color: Colors.dark.text,
    },
    splitValueHighlight: {
        ...Typography.h3,
        color: Colors.dark.primary,
    },
    splitNote: {
        ...Typography.caption,
        color: Colors.dark.textTertiary,
        marginTop: Spacing.sm,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
