/**
 * Badge component for status indicators
 * Also includes Chip for interactive tags
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Text } from './Text';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'primary' | 'live';
type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
  icon?: React.ReactNode;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
  style,
  icon,
  dot,
}) => {
  const { theme } = useTheme();

  const getVariantStyles = (): { backgroundColor: string; color: string; borderColor?: string } => {
    switch (variant) {
      case 'success':
        return {
          backgroundColor: theme.colors.success + '20',
          color: theme.colors.success,
        };
      case 'error':
        return {
          backgroundColor: theme.colors.error + '20',
          color: theme.colors.error,
        };
      case 'warning':
        return {
          backgroundColor: theme.colors.warning + '20',
          color: theme.colors.warning,
        };
      case 'info':
        return {
          backgroundColor: theme.colors.info + '20',
          color: theme.colors.info,
        };
      case 'primary':
        return {
          backgroundColor: theme.colors.primary.main + '20',
          color: theme.colors.primary.main,
        };
      case 'live':
        return {
          backgroundColor: theme.colors.error,
          color: '#FFFFFF',
        };
      case 'neutral':
      default:
        return {
          backgroundColor: theme.colors.background.elevated,
          color: theme.colors.text.secondary,
        };
    }
  };

  const getSizeStyles = (): { padding: ViewStyle; fontSize: number } => {
    switch (size) {
      case 'xs':
        return {
          padding: { paddingHorizontal: 6, paddingVertical: 2 },
          fontSize: 9,
        };
      case 'sm':
        return {
          padding: { paddingHorizontal: 8, paddingVertical: 3 },
          fontSize: 10,
        };
      case 'md':
        return {
          padding: { paddingHorizontal: 12, paddingVertical: 4 },
          fontSize: 12,
        };
      case 'lg':
        return {
          padding: { paddingHorizontal: 16, paddingVertical: 6 },
          fontSize: 14,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: variantStyles.backgroundColor },
        sizeStyles.padding,
        style,
      ]}
    >
      {dot && (
        <View
          style={[
            styles.dot,
            { backgroundColor: variantStyles.color },
          ]}
        />
      )}
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text
        variant="label"
        style={{
          color: variantStyles.color,
          fontSize: sizeStyles.fontSize,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </View>
  );
};

// Chip component - interactive badge/tag
interface ChipProps extends Omit<BadgeProps, 'dot'> {
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
  style,
  icon,
  selected = false,
  onPress,
  disabled = false,
}) => {
  const { theme } = useTheme();

  const getChipStyles = () => {
    if (selected) {
      return {
        backgroundColor: theme.colors.primary.main,
        borderColor: theme.colors.primary.main,
        textColor: '#FFFFFF',
      };
    }
    return {
      backgroundColor: 'transparent',
      borderColor: theme.colors.border.main,
      textColor: theme.colors.text.secondary,
    };
  };

  const chipStyles = getChipStyles();

  const getSizeStyles = () => {
    switch (size) {
      case 'xs':
        return { paddingHorizontal: 8, paddingVertical: 4, fontSize: 10 };
      case 'sm':
        return { paddingHorizontal: 10, paddingVertical: 6, fontSize: 11 };
      case 'md':
        return { paddingHorizontal: 14, paddingVertical: 8, fontSize: 13 };
      case 'lg':
        return { paddingHorizontal: 18, paddingVertical: 10, fontSize: 15 };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: chipStyles.backgroundColor,
          borderColor: chipStyles.borderColor,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
        },
        pressed && styles.chipPressed,
        disabled && styles.chipDisabled,
        style,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text
        style={{
          color: chipStyles.textColor,
          fontSize: sizeStyles.fontSize,
          fontWeight: '500',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 100,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  iconContainer: {
    marginRight: 4,
  },
  chip: {
    borderRadius: 100,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipDisabled: {
    opacity: 0.5,
  },
});

export default Badge;
