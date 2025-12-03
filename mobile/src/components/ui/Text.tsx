/**
 * Theme-aware Text component
 * Dark purple/violet theme
 */

import React from 'react'
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from 'react-native'
import { useTheme } from '@/contexts/ThemeContext'

type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'bodyLarge' | 'bodySmall' | 'caption' | 'label' | 'overline' | 'button'
type TextColor = 'primary' | 'secondary' | 'tertiary' | 'muted' | 'success' | 'error' | 'warning' | 'info' | 'accent'

interface TextProps extends RNTextProps {
  variant?: TextVariant
  color?: TextColor
  bold?: boolean
  semibold?: boolean
  medium?: boolean
  center?: boolean
  uppercase?: boolean
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = 'primary',
  bold,
  semibold,
  medium,
  center,
  uppercase,
  style,
  ...props
}) => {
  const { theme } = useTheme()

  const textColor = (() => {
    switch (color) {
      case 'primary':
        return theme.colors.text.primary
      case 'secondary':
        return theme.colors.text.secondary
      case 'tertiary':
        return theme.colors.text.tertiary
      case 'muted':
        return theme.colors.text.muted
      case 'success':
        return theme.colors.success
      case 'error':
        return theme.colors.error
      case 'warning':
        return theme.colors.warning
      case 'info':
        return theme.colors.info
      case 'accent':
        return theme.colors.primary.main
      default:
        return theme.colors.text.primary
    }
  })()

  const variantStyle = ((): TextStyle => {
    switch (variant) {
      case 'h1':
        return theme.textStyles.h1
      case 'h2':
        return theme.textStyles.h2
      case 'h3':
        return theme.textStyles.h3
      case 'h4':
        return theme.textStyles.h4
      case 'h5':
        return theme.textStyles.h5
      case 'h6':
        return theme.textStyles.h6
      case 'bodyLarge':
        return theme.textStyles.bodyLarge
      case 'body':
        return theme.textStyles.body
      case 'bodySmall':
        return theme.textStyles.bodySmall
      case 'caption':
        return theme.textStyles.caption
      case 'label':
        return theme.textStyles.label
      case 'overline':
        return theme.textStyles.overline
      case 'button':
        return theme.textStyles.button
      default:
        return theme.textStyles.body
    }
  })()

  const fontWeightStyle: TextStyle = bold
    ? { fontWeight: theme.fontWeights.bold }
    : semibold
    ? { fontWeight: theme.fontWeights.semibold }
    : medium
    ? { fontWeight: theme.fontWeights.medium }
    : {}

  return (
    <RNText
      style={[
        variantStyle,
        { color: textColor },
        fontWeightStyle,
        center && styles.center,
        uppercase && styles.uppercase,
        style,
      ]}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  uppercase: {
    textTransform: 'uppercase',
  },
})

export default Text
