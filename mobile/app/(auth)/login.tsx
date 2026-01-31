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
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '@/constants/Colors';
import { Button, Input, Card } from '@/components/ui';
import { useAuthStore } from '@/store/auth-store';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

    const { signIn, isLoading } = useAuthStore();

    const validate = () => {
        const newErrors: typeof errors = {};

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

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validate()) return;

        const { error } = await signIn(email, password);

        if (error) {
            Alert.alert('Login Failed', error.message);
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
                    {/* Logo/Header */}
                    <View style={styles.header}>
                        <Image
                            source={require('@/assets/images/logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Sign in to find courts near you</Text>
                    </View>

                    {/* Login Form */}
                    <Card variant="glass" padding="lg" style={styles.formCard}>
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
                        />

                        <TouchableOpacity style={styles.forgotLink}>
                            <Link href="/forgot-password">
                                <Text style={styles.forgotText}>Forgot password?</Text>
                            </Link>
                        </TouchableOpacity>

                        <Button
                            onPress={handleLogin}
                            loading={isLoading}
                            fullWidth
                            style={styles.loginButton}
                        >
                            Sign In
                        </Button>

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or continue with</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Social Login */}
                        <Button
                            variant="secondary"
                            fullWidth
                            onPress={() => Alert.alert('Coming Soon', 'Google login will be available soon')}
                        >
                            <Ionicons name="logo-google" size={20} color={Colors.dark.text} style={{ marginRight: 8 }} />
                            Google
                        </Button>
                    </Card>

                    {/* Sign Up Link */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <Link href="/signup">
                            <Text style={styles.footerLink}>Sign Up</Text>
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
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: Spacing.md,
        tintColor: '#FFFFFF',
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
    forgotLink: {
        alignSelf: 'flex-end',
        marginBottom: Spacing.lg,
        marginTop: -Spacing.sm,
    },
    forgotText: {
        ...Typography.bodySmall,
        color: Colors.dark.primary,
    },
    loginButton: {
        marginBottom: Spacing.lg,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.lg,
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
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
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
});
