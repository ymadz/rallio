/**
 * Theme-aware Button component
 * Dark purple/violet theme with gradient support
 */

import React from 'react'
import {
  Pressable,
  PressableProps,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/contexts/ThemeContext'
import { Text } from './Text'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gradient'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /** @deprecated use leftIcon instead */
  icon?: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  leftIcon,
  rightIcon,
  icon,
  style,
  ...props
}) => {
  const { theme } = useTheme()
  const iconToUse = leftIcon || icon

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: theme.colors.primary.main,
        }
      case 'gradient':
        return {
          backgroundColor: 'transparent',
        }
      case 'secondary':
        return {
          backgroundColor: theme.colors.background.elevated,
          borderWidth: 1,
          borderColor: theme.colors.border.main,
        }
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.colors.primary.main,
        }
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        }
      case 'danger':
        return {
          backgroundColor: theme.colors.error,
        }
      default:
        return {}
    }
  }

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          paddingHorizontal: theme.spacing.md,
          minHeight: theme.heights.buttonSmall,
          borderRadius: theme.borderRadius.lg,
        }
      case 'md':
        return {
          paddingHorizontal: theme.spacing.lg,
          minHeight: theme.heights.button,
          borderRadius: theme.borderRadius.xl,
        }
      case 'lg':
        return {
          paddingHorizontal: theme.spacing.xl,
          minHeight: theme.heights.buttonLarge,
          borderRadius: theme.borderRadius['2xl'],
        }
      default:
        return {}
    }
  }

  const getTextColor = () => {
    if (disabled) return theme.colors.text.tertiary

    switch (variant) {
      case 'primary':
      case 'gradient':
      case 'danger':
        return '#FFFFFF'
      case 'outline':
        return theme.colors.primary.main
      case 'secondary':
      case 'ghost':
        return theme.colors.text.primary
      default:
        return theme.colors.text.primary
    }
  }

  const getTextSize = () => {
    switch (size) {
      case 'sm':
        return theme.fontSizes.sm
      case 'md':
        return theme.fontSizes.md
      case 'lg':
        return theme.fontSizes.lg
      default:
        return theme.fontSizes.md
    }
  }

  const buttonContent = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {iconToUse && <View style={styles.leftIcon}>{iconToUse}</View>}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: getTextSize(),
                fontWeight: theme.fontWeights.semibold,
                letterSpacing: 0.25,
              },
            ]}
          >
            {title}
          </Text>
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </>
      )}
    </View>
  )

  if (variant === 'gradient') {
    return (
      <Pressable
        style={[
          fullWidth && styles.fullWidth,
          (disabled || loading) && styles.disabled,
          style as ViewStyle,
        ]}
        disabled={disabled || loading}
        {...props}
      >
        {({ pressed }) => (
          <LinearGradient
            colors={[theme.colors.primary.gradient.start, theme.colors.primary.gradient.end]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.base,
              getSizeStyles(),
              fullWidth && styles.fullWidth,
              pressed && styles.pressed,
            ]}
          >
            {buttonContent}
          </LinearGradient>
        )}
      </Pressable>
    )
  }

  return (
    <Pressable
      style={[
        styles.base,
        getVariantStyles(),
        getSizeStyles(),
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style as ViewStyle,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {({ pressed }) => (
        <View style={[styles.base, pressed && styles.pressed]}>
          {buttonContent}
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  text: {
    textAlign: 'center',
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
})

export default Button
