import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Button, Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const RESEND_COOLDOWN_SECONDS = 60;
const POLL_INTERVAL_MS = 5000;

export default function VerifyEmailScreen() {
    const { email } = useLocalSearchParams<{ email: string }>();

    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [resendError, setResendError] = useState<string | null>(null);

    // Poll for email verification every 5 seconds
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        pollRef.current = setInterval(async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user?.email_confirmed_at) {
                    clearInterval(pollRef.current!);
                    // Small delay so the user sees the confirmation
                    setTimeout(() => router.replace('/(tabs)'), 500);
                }
            } catch {
                // Silently ignore polling errors
            }
        }, POLL_INTERVAL_MS);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // Cooldown timer for resend button
    useEffect(() => {
        if (resendCooldown <= 0) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return;
        }

        cooldownRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(cooldownRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
        };
    }, [resendCooldown]);

    const handleResend = async () => {
        if (!email || resendCooldown > 0 || isResending) return;

        setIsResending(true);
        setResendError(null);
        setResendSuccess(false);

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
        });

        setIsResending(false);

        if (error) {
            setResendError(error.message || 'Failed to resend. Please try again.');
        } else {
            setResendSuccess(true);
            setResendCooldown(RESEND_COOLDOWN_SECONDS);
        }
    };

    const maskedEmail = email
        ? email.replace(/(.{2}).+(@.+)/, '$1•••$2')
        : 'your email';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                    <Ionicons name="mail" size={64} color={Colors.dark.primary} />
                </View>

                {/* Heading */}
                <Text style={styles.title}>Check Your Inbox</Text>
                <Text style={styles.subtitle}>
                    We sent a verification link to
                </Text>
                <Text style={styles.email}>{maskedEmail}</Text>

                <Card variant="glass" padding="lg" style={styles.card}>
                    {/* Instructions */}
                    <View style={styles.instructionRow}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={Colors.dark.primary} />
                        <Text style={styles.instructionText}>Open the email on this device</Text>
                    </View>
                    <View style={styles.instructionRow}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={Colors.dark.primary} />
                        <Text style={styles.instructionText}>Tap the "Confirm your email" link</Text>
                    </View>
                    <View style={styles.instructionRow}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={Colors.dark.primary} />
                        <Text style={styles.instructionText}>You'll be signed in automatically</Text>
                    </View>

                    {/* Waiting indicator */}
                    <View style={styles.waitingRow}>
                        <View style={styles.waitingDot} />
                        <Text style={styles.waitingText}>Waiting for verification…</Text>
                    </View>
                </Card>

                {/* Resend section */}
                <View style={styles.resendSection}>
                    <Text style={styles.resendLabel}>Didn't receive it?</Text>

                    {resendSuccess && (
                        <Text style={styles.resendSuccessText}>
                            ✓ Email resent successfully
                        </Text>
                    )}

                    {resendError && (
                        <Text style={styles.resendErrorText}>{resendError}</Text>
                    )}

                    <Button
                        variant="secondary"
                        fullWidth
                        onPress={handleResend}
                        loading={isResending}
                        disabled={resendCooldown > 0 || isResending}
                        style={styles.resendButton}
                    >
                        {resendCooldown > 0
                            ? `Resend in ${resendCooldown}s`
                            : 'Resend Email'}
                    </Button>
                </View>

                {/* Back to login */}
                <TouchableOpacity
                    onPress={() => router.replace('/login')}
                    style={styles.backToLoginButton}
                >
                    <Ionicons name="arrow-back" size={16} color={Colors.dark.primary} />
                    <Text style={styles.backToLoginText}>Back to Sign In</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.dark.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
    },
    title: {
        ...Typography.h1,
        color: Colors.dark.text,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    subtitle: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
    email: {
        ...Typography.body,
        color: Colors.dark.primary,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: Spacing.xl,
    },
    card: {
        width: '100%',
        marginBottom: Spacing.xl,
        gap: Spacing.sm,
    },
    instructionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.xs,
    },
    instructionText: {
        ...Typography.body,
        color: Colors.dark.text,
        flex: 1,
    },
    waitingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.dark.border,
    },
    waitingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.dark.primary,
        // Pulse animation would require Animated API; static dot is fine
    },
    waitingText: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        fontStyle: 'italic',
    },
    resendSection: {
        width: '100%',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    resendLabel: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        marginBottom: Spacing.sm,
    },
    resendSuccessText: {
        ...Typography.bodySmall,
        color: Colors.dark.success,
        marginBottom: Spacing.sm,
    },
    resendErrorText: {
        ...Typography.bodySmall,
        color: Colors.dark.error,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    resendButton: {
        width: '100%',
    },
    backToLoginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    backToLoginText: {
        ...Typography.body,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
});
