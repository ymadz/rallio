import React, { useState } from 'react';
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
import { Link, router } from 'expo-router';
import { Colors, Spacing, Typography } from '@/constants/Colors';
import { Button, Input, Card } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

export default function SignupScreen() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});

    const { signUp, signInWithGoogle, isLoading } = useAuthStore();

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!firstName.trim()) newErrors.firstName = 'First name is required';
        if (!lastName.trim()) newErrors.lastName = 'Last name is required';

        if (!email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Enter a valid email';
        }

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (!termsAccepted) {
            newErrors.terms = 'You must accept the Terms of Service to continue';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSignup = async () => {
        if (!validate()) return;

        const { error } = await signUp(email, password, {
            firstName,
            lastName,
        });

        if (error) {
            Alert.alert('Signup Failed', error.message);
        } else {
            // Cast: expo-router typed routes regenerate on `expo start`;
            // /(auth)/verify-email becomes valid once the dev server runs.
            router.replace({
                pathname: '/(auth)/verify-email' as any,
                params: { email },
            });
        }
    };

    const handleGoogleSignup = async () => {
        const { error } = await signInWithGoogle();

        if (error) {
            if (error.message !== 'Sign in was cancelled') {
                Alert.alert('Google Signup Failed', error.message);
            }
        } else {
            router.replace('/(tabs)');
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
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Create Account</Text>
                        <Text style={styles.subtitle}>Join Rallio and find courts near you</Text>
                    </View>

                    {/* Signup Form */}
                    <Card variant="glass" padding="lg" style={styles.formCard}>
                        <View style={styles.nameRow}>
                            <View style={styles.nameField}>
                                <Input
                                    label="First Name"
                                    placeholder="Juan"
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    error={errors.firstName}
                                    autoCapitalize="words"
                                />
                            </View>
                            <View style={styles.nameField}>
                                <Input
                                    label="Last Name"
                                    placeholder="Dela Cruz"
                                    value={lastName}
                                    onChangeText={setLastName}
                                    error={errors.lastName}
                                    autoCapitalize="words"
                                />
                            </View>
                        </View>

                        <Input
                            label="Email"
                            placeholder="you@example.com"
                            value={email}
                            onChangeText={setEmail}
                            error={errors.email}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            leftIcon="mail-outline"
                        />



                        <Input
                            label="Password"
                            placeholder="••••••••"
                            value={password}
                            onChangeText={setPassword}
                            error={errors.password}
                            secureTextEntry
                            leftIcon="lock-closed-outline"
                            hint="At least 6 characters"
                        />

                        <Input
                            label="Confirm Password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            error={errors.confirmPassword}
                            secureTextEntry
                            leftIcon="lock-closed-outline"
                        />

                        <Button
                            onPress={handleSignup}
                            loading={isLoading}
                            disabled={!termsAccepted || isLoading}
                            fullWidth
                            style={styles.signupButton}
                        >
                            Create Account
                        </Button>

                        {/* Terms checkbox */}
                        <TouchableOpacity
                            style={styles.termsRow}
                            onPress={() => setTermsAccepted(v => !v)}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={termsAccepted ? 'checkbox' : 'square-outline'}
                                size={22}
                                color={termsAccepted ? Colors.dark.primary : Colors.dark.textSecondary}
                                style={styles.checkbox}
                            />
                            <Text style={styles.terms}>
                                I agree to the{' '}
                                <Text
                                    style={styles.termsLink}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        WebBrowser.openBrowserAsync('https://rallio.app/terms');
                                    }}
                                >
                                    Terms of Service
                                </Text>
                                {' '}and{' '}
                                <Text
                                    style={styles.termsLink}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        WebBrowser.openBrowserAsync('https://rallio.app/privacy');
                                    }}
                                >
                                    Privacy Policy
                                </Text>
                            </Text>
                        </TouchableOpacity>
                        {errors.terms && (
                            <Text style={styles.termsError}>{errors.terms}</Text>
                        )}

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or continue with</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Google Signup */}
                        <Button
                            variant="secondary"
                            fullWidth
                            onPress={handleGoogleSignup}
                            disabled={isLoading}
                        >
                            <Ionicons name="logo-google" size={20} color={Colors.dark.text} style={{ marginRight: 8 }} />
                            Continue with Google
                        </Button>
                    </Card>

                    {/* Login Link */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <Link href="/login">
                            <Text style={styles.footerLink}>Sign In</Text>
                        </Link>
                    </View>
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
    nameRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    nameField: {
        flex: 1,
    },
    signupButton: {
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    termsRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    checkbox: {
        marginTop: 1,
    },
    terms: {
        ...Typography.caption,
        color: Colors.dark.textSecondary,
        flex: 1,
        lineHeight: 20,
    },
    termsLink: {
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    termsError: {
        ...Typography.caption,
        color: Colors.dark.error,
        marginBottom: Spacing.sm,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
    },
    footerText: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
    },
    footerLink: {
        ...Typography.body,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.dark.border,
    },
    dividerText: {
        ...Typography.caption,
        color: Colors.dark.textTertiary,
        marginHorizontal: Spacing.md,
    },
});
