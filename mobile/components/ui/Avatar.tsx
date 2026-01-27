import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Typography } from '@/constants/Colors';

interface AvatarProps {
    source?: string | null;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    style?: ViewStyle;
}

const SIZES = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
};

const FONT_SIZES = {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 36,
};

export function Avatar({ source, name, size = 'md', style }: AvatarProps) {
    const dimension = SIZES[size];
    const fontSize = FONT_SIZES[size];

    // Get initials from name
    const getInitials = (name: string) => {
        const parts = name.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const containerStyle: ViewStyle = {
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
    };

    if (source) {
        return (
            <Image
                source={{ uri: source }}
                style={[styles.image, containerStyle, style]}
            />
        );
    }

    return (
        <View style={[styles.placeholder, containerStyle, style]}>
            <Text style={[styles.initials, { fontSize }]}>
                {name ? getInitials(name) : '?'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    image: {
        backgroundColor: Colors.dark.surface,
    },
    placeholder: {
        backgroundColor: Colors.dark.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initials: {
        color: Colors.dark.text,
        fontWeight: '600',
    },
});
