import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
    TouchableOpacityProps,
} from 'react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/Colors';

interface ButtonProps extends TouchableOpacityProps {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    fullWidth?: boolean;
}

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    disabled,
    style,
    ...props
}: ButtonProps) {
    const buttonStyles: ViewStyle[] = [
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style as ViewStyle,
    ];

    const textStyles: TextStyle[] = [
        styles.text,
        styles[`text_${variant}`],
        styles[`text_${size}`],
        (disabled || loading) && styles.textDisabled,
    ];

    return (
        <TouchableOpacity
            style={buttonStyles}
            disabled={disabled || loading}
            activeOpacity={0.7}
            {...props}
        >
            {loading ? (
                <ActivityIndicator
                    size="small"
                    color={variant === 'primary' ? Colors.dark.text : Colors.dark.primary}
                />
            ) : (
                <Text style={textStyles}>{children}</Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.md,
    },

    // Variants
    primary: {
        backgroundColor: Colors.dark.primary,
    },
    secondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    ghost: {
        backgroundColor: 'transparent',
    },
    danger: {
        backgroundColor: Colors.dark.error,
    },

    // Sizes
    size_sm: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        minHeight: 36,
    },
    size_md: {
        paddingVertical: Spacing.md - 4,
        paddingHorizontal: Spacing.lg,
        minHeight: 48,
    },
    size_lg: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        minHeight: 56,
    },

    fullWidth: {
        width: '100%',
    },

    disabled: {
        opacity: 0.5,
    },

    // Text styles
    text: {
        ...Typography.button,
        color: Colors.dark.text,
    },
    text_primary: {
        color: Colors.dark.text,
    },
    text_secondary: {
        color: Colors.dark.text,
    },
    text_ghost: {
        color: Colors.dark.primary,
    },
    text_danger: {
        color: Colors.dark.text,
    },
    text_sm: {
        fontSize: 14,
    },
    text_md: {
        fontSize: 16,
    },
    text_lg: {
        fontSize: 18,
    },
    textDisabled: {
        opacity: 0.7,
    },
});
