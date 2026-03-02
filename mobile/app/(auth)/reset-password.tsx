import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Button, Input, Card } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSessionReady, setIsSessionReady] = useState(false);
    const [tokenError, setTokenError] = useState<string | null>(null);

    const handleDeepLink = useCallback(async (url: string | null) => {
        if (!url) return;

        try {
            // Parse the hash fragment which contains access_token & refresh_token
            const parsed = new URL(url);
            const hashParams = new URLSearchParams(parsed.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const type = hashParams.get('type');

            if (type !== 'recovery') {
                // Not a password-reset link; ignore
                return;
            }

            if (!accessToken || !refreshToken) {
                setTokenError('This password reset link is invalid or has expired. Please request a new one.');
                return;
            }

            // Silently establish the session so updateUser() works
            const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            if (error) {
                setTokenError('This password reset link has expired. Please request a new one.');
            } else {
                setIsSessionReady(true);
            }
        } catch {
            setTokenError('Invalid reset link. Please request a new password reset.');
        }
    }, []);

    useEffect(() => {
        // Handle the case where the app was opened directly via the deep link
        Linking.getInitialURL().then(handleDeepLink);

        // Handle the case where the app was already open in background
        const subscription = Linking.addEventListener('url', ({ url }) => {
            handleDeepLink(url);
        });

        return () => subscription.remove();
    }, [handleDeepLink]);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (!confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleReset = async () => {
        if (!validate()) return;

        setIsLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        setIsLoading(false);

        if (error) {
            Alert.alert('Error', error.message || 'Failed to update password. Please try again.');
        } else {
            // Sign out first so user logs in fresh with new password
            await supabase.auth.signOut();
            Alert.alert(
                'Password Updated',
                'Your password has been changed successfully. Please sign in with your new password.',
                [{ text: 'Sign In', onPress: () => router.replace('/login') }]
            );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.replace('/login')} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}>New Password</Text>
                        <Text style={styles.subtitle}>
                            {tokenError
                                ? 'Unable to verify reset link'
                                : isSessionReady
                                    ? 'Choose a strong new password'
                                    : 'Verifying your reset link...'}
                        </Text>
                    </View>

                    <Card variant="glass" padding="lg" style={styles.formCard}>
                        {/* Token error state */}
                        {tokenError && (
                            <View style={styles.errorBanner}>
                                <Ionicons name="warning-outline" size={20} color={Colors.dark.error} />
                                <Text style={styles.errorBannerText}>{tokenError}</Text>
                            </View>
                        )}

                        {/* Waiting for deep link */}
                        {!tokenError && !isSessionReady && (
                            <View style={styles.waitingContainer}>
                                <Ionicons name="hourglass-outline" size={40} color={Colors.dark.textSecondary} />
                                <Text style={styles.waitingText}>Verifying your reset link…</Text>
                                <Text style={styles.waitingSubtext}>
                                    If nothing happens, make sure you opened this link on your phone.
                                </Text>
                            </View>
                        )}

                        {/* Password form — shown once session is ready */}
                        {isSessionReady && (
                            <>
                                <Input
                                    label="New Password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChangeText={setPassword}
                                    error={errors.password}
                                    secureTextEntry
                                    leftIcon="lock-closed-outline"
                                    hint="At least 6 characters"
                                />
                                <Input
                                    label="Confirm New Password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    error={errors.confirmPassword}
                                    secureTextEntry
                                    leftIcon="lock-closed-outline"
                                />
                                <Button
                                    onPress={handleReset}
                                    loading={isLoading}
                                    fullWidth
                                    style={styles.submitButton}
                                >
                                    Update Password
                                </Button>
                            </>
                        )}

                        {/* Back to login link */}
                        <TouchableOpacity
                            onPress={() => router.replace('/login')}
                            style={styles.backToLoginButton}
                        >
                            <Ionicons name="arrow-back" size={16} color={Colors.dark.primary} />
                            <Text style={styles.backToLoginText}>Back to Sign In</Text>
                        </TouchableOpacity>
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: Spacing.lg,
    },
    header: {
        marginBottom: Spacing.xl,
        marginTop: Spacing.md,
    },
    backButton: {
        marginBottom: Spacing.md,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        ...Typography.h1,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    formCard: {
        marginBottom: Spacing.lg,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        backgroundColor: Colors.dark.error + '18',
        borderWidth: 1,
        borderColor: Colors.dark.error + '40',
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginBottom: Spacing.lg,
    },
    errorBannerText: {
        ...Typography.body,
        color: Colors.dark.error,
        flex: 1,
    },
    waitingContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        gap: Spacing.md,
    },
    waitingText: {
        ...Typography.body,
        color: Colors.dark.text,
        fontWeight: '600',
    },
    waitingSubtext: {
        ...Typography.bodySmall,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
    submitButton: {
        marginTop: Spacing.md,
        marginBottom: Spacing.md,
    },
    backToLoginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.md,
    },
    backToLoginText: {
        ...Typography.body,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
});
