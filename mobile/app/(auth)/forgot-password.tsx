import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Typography } from '@/constants/Colors';
import { Button, Input, Card } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleResetPassword = async () => {
        if (!email) {
            setError('Email is required');
            return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Enter a valid email');
            return;
        }

        setIsLoading(true);
        setError('');

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'rallio://reset-password',
        });

        setIsLoading(false);

        if (resetError) {
            Alert.alert('Error', resetError.message);
        } else {
            setSent(true);
        }
    };

    if (sent) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="mail-open-outline" size={64} color={Colors.dark.success} />
                    </View>
                    <Text style={styles.title}>Check your email</Text>
                    <Text style={styles.message}>
                        We sent a password reset link to {email}
                    </Text>
                    <Button onPress={() => router.replace('/login')} fullWidth style={{ marginTop: Spacing.xl }}>
                        Back to Login
                    </Button>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    {/* Header */}
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <Text style={styles.title}>Forgot Password?</Text>
                        <Text style={styles.subtitle}>
                            Enter your email and we'll send you a reset link
                        </Text>
                    </View>

                    {/* Form */}
                    <Card variant="glass" padding="lg">
                        <Input
                            label="Email"
                            placeholder="you@example.com"
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                setError('');
                            }}
                            error={error}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            leftIcon="mail-outline"
                        />

                        <Button
                            onPress={handleResetPassword}
                            loading={isLoading}
                            fullWidth
                        >
                            Send Reset Link
                        </Button>
                    </Card>
                </View>
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
    content: {
        flex: 1,
        padding: Spacing.lg,
        justifyContent: 'center',
    },
    backButton: {
        position: 'absolute',
        top: Spacing.lg,
        left: Spacing.lg,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.surface,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    header: {
        marginBottom: Spacing.xl,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        ...Typography.h1,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
    message: {
        ...Typography.body,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
});
