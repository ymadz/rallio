/**
 * Icon component wrapper
 * Provides consistent theming for icons throughout the app
 */

import React from 'react'
import { View, ViewStyle, StyleSheet } from 'react-native'
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons'
import { useTheme } from '@/contexts/ThemeContext'

type IconFamily = 'ionicons' | 'material' | 'fontawesome' | 'feather'
type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
type IconColor = 'primary' | 'secondary' | 'tertiary' | 'muted' | 'accent' | 'success' | 'error' | 'warning' | 'white'

interface IconProps {
  name: string
  family?: IconFamily
  size?: IconSize | number
  color?: IconColor | string
  style?: ViewStyle
}

export const Icon: React.FC<IconProps> = ({
  name,
  family = 'ionicons',
  size = 'md',
  color = 'primary',
  style,
}) => {
  const { theme } = useTheme()

  // Get numeric size
  const iconSize = typeof size === 'number' ? size : theme.iconSizes[size]

  // Get color
  const iconColor = (() => {
    if (color.startsWith('#') || color.startsWith('rgb')) return color
    
    switch (color) {
      case 'primary':
        return theme.colors.text.primary
      case 'secondary':
        return theme.colors.text.secondary
      case 'tertiary':
        return theme.colors.text.tertiary
      case 'muted':
        return theme.colors.text.muted
      case 'accent':
        return theme.colors.primary.main
      case 'success':
        return theme.colors.success
      case 'error':
        return theme.colors.error
      case 'warning':
        return theme.colors.warning
      case 'white':
        return '#FFFFFF'
      default:
        return theme.colors.text.primary
    }
  })()

  const iconProps = {
    name: name as any,
    size: iconSize,
    color: iconColor,
  }

  const renderIcon = () => {
    switch (family) {
      case 'material':
        return <MaterialCommunityIcons {...iconProps} />
      case 'fontawesome':
        return <FontAwesome5 {...iconProps} />
      case 'feather':
        return <Feather {...iconProps} />
      default:
        return <Ionicons {...iconProps} />
    }
  }

  return <View style={style}>{renderIcon()}</View>
}

// Convenience components for common icon families
export const IoniconsIcon: React.FC<Omit<IconProps, 'family'>> = (props) => (
  <Icon {...props} family="ionicons" />
)

export const MaterialIcon: React.FC<Omit<IconProps, 'family'>> = (props) => (
  <Icon {...props} family="material" />
)

export const FeatherIcon: React.FC<Omit<IconProps, 'family'>> = (props) => (
  <Icon {...props} family="feather" />
)

export default Icon
