/**
 * Typography system for Rallio mobile app
 * Modern, clean typography for sports app
 */

import { TextStyle } from 'react-native'

export const fontFamily = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
} as const

export const fontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
} as const

export const fontWeights = {
  normal: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  extrabold: '800' as TextStyle['fontWeight'],
} as const

export const lineHeights = {
  tight: 1.2,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const

export const letterSpacing = {
  tighter: -0.5,
  tight: -0.25,
  normal: 0,
  wide: 0.25,
  wider: 0.5,
} as const

// Pre-defined text styles
export const textStyles = {
  // Headings
  h1: {
    fontSize: fontSizes['5xl'],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes['5xl'] * lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  h2: {
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes['4xl'] * lineHeights.tight,
    letterSpacing: letterSpacing.tight,
  },
  h3: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes['3xl'] * lineHeights.snug,
  },
  h4: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes['2xl'] * lineHeights.snug,
  },
  h5: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.xl * lineHeights.normal,
  },
  h6: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.lg * lineHeights.normal,
  },
  
  // Body text
  bodyLarge: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.lg * lineHeights.relaxed,
  },
  body: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.base * lineHeights.relaxed,
  },
  bodySmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.sm * lineHeights.relaxed,
  },
  
  // UI text
  button: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.md * lineHeights.normal,
    letterSpacing: letterSpacing.wide,
  },
  buttonSmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.sm * lineHeights.normal,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.sm * lineHeights.normal,
  },
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.normal,
    lineHeight: fontSizes.xs * lineHeights.normal,
  },
  overline: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    lineHeight: fontSizes.xs * lineHeights.normal,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase' as const,
  },
} as const

// Legacy export for backwards compatibility
export const typography = {
  fontSizes,
  fontWeights,
  lineHeights,
} as const
