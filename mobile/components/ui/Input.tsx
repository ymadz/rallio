import React, { useState } from 'react';
import {
    View,
    TextInput as RNTextInput,
    Text,
    StyleSheet,
    TextInputProps as RNTextInputProps,
    TouchableOpacity,
    ViewStyle,
} from 'react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends RNTextInputProps {
    label?: string;
    error?: string;
    hint?: string;
    leftIcon?: keyof typeof Ionicons.glyphMap;
    rightIcon?: keyof typeof Ionicons.glyphMap;
    onRightIconPress?: () => void;
    containerStyle?: ViewStyle;
}

export function Input({
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    secureTextEntry,
    style,
    ...props
}: InputProps) {
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const isPassword = secureTextEntry !== undefined;
    const shouldHideText = isPassword && !showPassword;

    const inputContainerStyles = [
        styles.inputContainer,
        isFocused && styles.inputContainerFocused,
        error && styles.inputContainerError,
    ];

    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}

            <View style={inputContainerStyles}>
                {leftIcon && (
                    <Ionicons
                        name={leftIcon}
                        size={20}
                        color={Colors.dark.textSecondary}
                        style={styles.leftIcon}
                    />
                )}

                <RNTextInput
                    style={[styles.input, leftIcon && styles.inputWithLeftIcon, style]}
                    placeholderTextColor={Colors.dark.textTertiary}
                    secureTextEntry={shouldHideText}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...props}
                />

                {isPassword ? (
                    <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.rightIconButton}
                    >
                        <Ionicons
                            name={showPassword ? 'eye-off' : 'eye'}
                            size={20}
                            color={Colors.dark.textSecondary}
                        />
                    </TouchableOpacity>
                ) : rightIcon ? (
                    <TouchableOpacity
                        onPress={onRightIconPress}
                        style={styles.rightIconButton}
                        disabled={!onRightIconPress}
                    >
                        <Ionicons
                            name={rightIcon}
                            size={20}
                            color={Colors.dark.textSecondary}
                        />
                    </TouchableOpacity>
                ) : null}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
            {hint && !error && <Text style={styles.hint}>{hint}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.md,
    },
    label: {
        ...Typography.bodySmall,
        color: Colors.dark.text,
        marginBottom: Spacing.xs,
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: Radius.md,
        minHeight: 48,
    },
    inputContainerFocused: {
        borderColor: Colors.dark.primary,
    },
    inputContainerError: {
        borderColor: Colors.dark.error,
    },
    input: {
        flex: 1,
        ...Typography.body,
        color: Colors.dark.text,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm + 4,
    },
    inputWithLeftIcon: {
        paddingLeft: 0,
    },
    leftIcon: {
        marginLeft: Spacing.md,
        marginRight: Spacing.sm,
    },
    rightIconButton: {
        padding: Spacing.sm,
        marginRight: Spacing.xs,
    },
    error: {
        ...Typography.caption,
        color: Colors.dark.error,
        marginTop: Spacing.xs,
    },
    hint: {
        ...Typography.caption,
        color: Colors.dark.textTertiary,
        marginTop: Spacing.xs,
    },
});
