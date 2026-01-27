import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { Colors, Spacing, Radius } from '@/constants/Colors';

interface CardProps extends ViewProps {
    children: React.ReactNode;
    variant?: 'default' | 'glass' | 'elevated';
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

/**
 * Glassmorphism Card Component
 * 
 * Note: React Native doesn't support backdrop-filter natively.
 * For true blur effect, use expo-blur's BlurView as a wrapper.
 * This component provides the visual styling without the blur.
 */
export function Card({
    children,
    variant = 'default',
    padding = 'md',
    style,
    ...props
}: CardProps) {
    return (
        <View
            style={[
                styles.base,
                styles[variant],
                styles[`padding_${padding}`],
                style,
            ]}
            {...props}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        borderRadius: Radius.lg,
        overflow: 'hidden',
    },

    // Variants
    default: {
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    glass: {
        backgroundColor: Colors.dark.glass,
        borderWidth: 1,
        borderColor: Colors.dark.glassBorder,
    },
    elevated: {
        backgroundColor: Colors.dark.elevated,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },

    // Padding
    padding_none: {
        padding: 0,
    },
    padding_sm: {
        padding: Spacing.sm,
    },
    padding_md: {
        padding: Spacing.md,
    },
    padding_lg: {
        padding: Spacing.lg,
    },
});
