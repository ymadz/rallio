/**
 * Theme-aware Card component
 * Dark purple/violet theme with modern styling
 */

import React from 'react'
import { View, ViewProps, StyleSheet, Pressable, ImageBackground, ImageSourcePropType, ColorValue } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/contexts/ThemeContext'

type CardVariant = 'default' | 'elevated' | 'outlined' | 'gradient' | 'image'
type CardPadding = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]]

interface CardProps extends ViewProps {
  variant?: CardVariant
  onPress?: () => void
  padding?: CardPadding
  /** @deprecated use variant='elevated' instead */
  elevated?: boolean
  // For gradient variant
  gradientColors?: GradientColors
  // For image variant
  backgroundImage?: ImageSourcePropType
  imageOverlay?: boolean
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  onPress,
  padding = 'md',
  elevated = false,
  gradientColors,
  backgroundImage,
  imageOverlay = true,
  style,
  children,
  ...props
}) => {
  const { theme } = useTheme()

  // Handle deprecated elevated prop
  const actualVariant = elevated ? 'elevated' : variant

  const paddingValue = {
    none: 0,
    xs: theme.spacing.xs,
    sm: theme.spacing.sm,
    md: theme.spacing.md,
    lg: theme.spacing.lg,
    xl: theme.spacing.xl,
  }[padding]

  const getCardStyles = () => {
    const baseStyles = {
      padding: paddingValue,
    }

    switch (actualVariant) {
      case 'elevated':
        return {
          ...baseStyles,
          backgroundColor: theme.colors.background.elevated,
          borderWidth: 0,
          shadowOpacity: 0.3,
          elevation: 4,
        }
      case 'outlined':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.colors.border.main,
        }
      case 'gradient':
      case 'image':
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          borderWidth: 0,
          overflow: 'hidden' as const,
        }
      default:
        return {
          ...baseStyles,
          backgroundColor: theme.colors.background.card,
          borderWidth: 1,
          borderColor: theme.colors.border.light,
        }
    }
  }

  const renderContent = () => {
    // Gradient variant
    if (actualVariant === 'gradient') {
      const colors: GradientColors = gradientColors || [
        theme.colors.background.gradient.start,
        theme.colors.background.gradient.end,
      ]
      return (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradient, { padding: paddingValue }]}
        >
          {children}
        </LinearGradient>
      )
    }

    // Image variant
    if (actualVariant === 'image' && backgroundImage) {
      return (
        <ImageBackground
          source={backgroundImage}
          style={styles.imageBackground}
          imageStyle={styles.image}
        >
          {imageOverlay && (
            <LinearGradient
              colors={['transparent', 'rgba(13, 11, 30, 0.9)']}
              style={[styles.imageOverlay, { padding: paddingValue }]}
            >
              {children}
            </LinearGradient>
          )}
          {!imageOverlay && (
            <View style={{ padding: paddingValue }}>{children}</View>
          )}
        </ImageBackground>
      )
    }

    // Default
    return children
  }

  const cardContent = (
    <View
      style={[
        styles.base,
        getCardStyles(),
        {
          shadowColor: theme.colors.shadow,
          borderRadius: theme.borderRadius.xl,
        },
        style,
      ]}
      {...props}
    >
      {renderContent()}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {cardContent}
      </Pressable>
    )
  }

  return cardContent
}

const styles = StyleSheet.create({
  base: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  gradient: {
    flex: 1,
  },
  imageBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  image: {
    borderRadius: 16,
  },
  imageOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
})

export default Card
