import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Card, Button } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';
import { supabase } from '@/lib/supabase';

type PaymentMethod = 'e-wallet' | 'cash';

export default function QueuePaymentScreen() {
    const { amount, sessionId, description } = useLocalSearchParams<{ amount: string; sessionId: string; description: string }>();
    const { user } = useAuthStore();
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const parsedAmount = parseFloat(amount || '0');

    const handlePayment = async () => {
        if (!paymentMethod) {
            Alert.alert('Error', 'Please select a payment method');
            return;
        }

        if (paymentMethod === 'cash') {
            // cash flow logic
            Alert.alert(
                'Pay with Cash',
                'Please proceed to the Queue Master to pay in cash.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.back()
                    }
                ]
            );
            return;
        }

        setIsProcessing(true);
        try {
            // Get session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.254.170:3000';

            // Create checkout session
            const response = await fetch(`${apiUrl}/api/mobile/create-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    reservationId: sessionId, // Using session ID as reference for queue payments
                    amount: parsedAmount,
                    description: description || 'Queue Fee Payment',
                    successUrl: 'rallio://queue/payment/success', // Deep link to success handler if needed
                    cancelUrl: 'rallio://queue/payment/cancel',
                    metadata: {
                        type: 'queue_payment',
                        user_id: user?.id,
                        session_id: sessionId
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Payment failed');
            }

            const data = await response.json();
            if (data?.checkoutUrl) {
                await Linking.openURL(data.checkoutUrl);
                // Ideally we'd listen for the deep link callback here, but for now we'll just go back
                // Or maybe show a "I've Paid" button?
            }

        } catch (error: any) {
            console.error('Payment error:', error);
            Alert.alert('Error', error.message || 'Payment initiation failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="close" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Pay Outstanding Balance</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>Total Due</Text>
                    <Text style={styles.amountValue}>₱{parsedAmount.toFixed(2)}</Text>
                    <Text style={styles.description}>{description}</Text>
                </View>

                <Text style={styles.sectionTitle}>Select Payment Method</Text>

                <TouchableOpacity
                    style={[
                        styles.paymentOption,
                        paymentMethod === 'e-wallet' && styles.paymentOptionSelected,
                    ]}
                    onPress={() => setPaymentMethod('e-wallet')}
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
                    onPress={() => setPaymentMethod('cash')}
                >
                    <View style={styles.paymentIcon}>
                        <Ionicons name="cash-outline" size={24} color={Colors.dark.success} />
                    </View>
                    <View style={styles.paymentInfo}>
                        <Text style={styles.paymentTitle}>Cash</Text>
                        <Text style={styles.paymentDesc}>Pay directly to Queue Master</Text>
                    </View>
                    <View style={[
                        styles.radioOuter,
                        paymentMethod === 'cash' && styles.radioSelected,
                    ]}>
                        {paymentMethod === 'cash' && <View style={styles.radioInner} />}
                    </View>
                </TouchableOpacity>

            </ScrollView>

            <View style={styles.footer}>
                <Button
                    onPress={handlePayment}
                    disabled={!paymentMethod || isProcessing}
                    loading={isProcessing}
                >
                    {paymentMethod === 'e-wallet' ? 'Pay Now' : 'Confirm Cash Payment'}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
    backButton: {
        padding: 8,
    },
    title: {
        ...Typography.h3,
        color: Colors.dark.text,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
    amountContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    amountLabel: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    amountValue: {
        fontSize: 40,
        fontWeight: 'bold',
        color: Colors.dark.primary,
        marginVertical: Spacing.xs,
    },
    description: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
    sectionTitle: {
        ...Typography.body,
        fontWeight: '600',
        color: Colors.dark.text,
        marginBottom: Spacing.md,
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
    footer: {
        padding: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
});
