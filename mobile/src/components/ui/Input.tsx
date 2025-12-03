/**
 * Theme-aware Input component
 * Dark purple/violet theme with modern styling
 */

import React, { useState } from 'react'
import { View, TextInput, TextInputProps, StyleSheet, Pressable } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { Text } from './Text'

type InputSize = 'sm' | 'md' | 'lg'
type InputVariant = 'default' | 'filled' | 'outlined'

interface InputProps extends TextInputProps {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onRightIconPress?: () => void
  size?: InputSize
  variant?: InputVariant
  disabled?: boolean
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  size = 'md',
  variant = 'default',
  disabled = false,
  style,
  ...props
}) => {
  const { theme } = useTheme()
  const [isFocused, setIsFocused] = useState(false)

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          minHeight: theme.heights.inputSmall,
          paddingHorizontal: theme.spacing.sm,
          borderRadius: theme.borderRadius.md,
        }
      case 'lg':
        return {
          minHeight: theme.heights.inputLarge,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.borderRadius.xl,
        }
      default:
        return {
          minHeight: theme.heights.input,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.borderRadius.lg,
        }
    }
  }

  const getVariantStyles = () => {
    const baseStyles = {
      borderWidth: 1,
    }

    switch (variant) {
      case 'filled':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.background.tertiary,
          borderColor: error
            ? theme.colors.error
            : isFocused
            ? theme.colors.primary.main
            : 'transparent',
        }
      case 'outlined':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          borderColor: error
            ? theme.colors.error
            : isFocused
            ? theme.colors.primary.main
            : theme.colors.border.main,
        }
      default:
        return {
          ...baseStyles,
          backgroundColor: theme.colors.background.card,
          borderColor: error
            ? theme.colors.error
            : isFocused
            ? theme.colors.primary.main
            : theme.colors.border.light,
        }
    }
  }

  const getTextSize = () => {
    switch (size) {
      case 'sm':
        return theme.fontSizes.sm
      case 'lg':
        return theme.fontSizes.lg
      default:
        return theme.fontSizes.base
    }
  }

  return (
    <View style={styles.container}>
      {label && (
        <Text variant="label" color="secondary" style={styles.label}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          getSizeStyles(),
          getVariantStyles(),
          disabled && styles.disabled,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            {
              color: disabled ? theme.colors.text.muted : theme.colors.text.primary,
              fontSize: getTextSize(),
            },
            leftIcon ? styles.inputWithLeftIcon : undefined,
            rightIcon ? styles.inputWithRightIcon : undefined,
            style,
          ]}
          placeholderTextColor={theme.colors.text.muted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
          {...props}
        />
        {rightIcon && (
          <Pressable
            onPress={onRightIconPress}
            style={styles.rightIcon}
            disabled={disabled}
          >
            {rightIcon}
          </Pressable>
        )}
      </View>
      {error && (
        <Text variant="caption" color="error" style={styles.helperText}>
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text variant="caption" color="tertiary" style={styles.helperText}>
          {hint}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 8,
  },
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
    padding: 4,
  },
  helperText: {
    marginTop: 6,
    marginLeft: 4,
  },
  disabled: {
    opacity: 0.6,
  },
})

export default Input
