/**
 * Theme color palettes for Rallio mobile app
 * Dark purple/violet theme inspired by modern sports apps
 */

export type ThemeColors = {
  background: {
    primary: string
    secondary: string
    tertiary: string
    card: string
    elevated: string
    gradient: {
      start: string
      end: string
    }
  }
  text: {
    primary: string
    secondary: string
    tertiary: string
    muted: string
  }
  primary: {
    main: string
    light: string
    dark: string
    gradient: {
      start: string
      end: string
    }
  }
  accent: {
    purple: string
    violet: string
    blue: string
    cyan: string
  }
  success: string
  error: string
  warning: string
  info: string
  border: {
    light: string
    main: string
    dark: string
  }
  shadow: string
  overlay: string
}

// Dark purple/violet theme - matching the reference sports app design
export const darkColors: ThemeColors = {
  background: {
    primary: '#0D0B1E',      // Very dark purple (main background)
    secondary: '#151329',    // Dark purple (secondary background)
    tertiary: '#1E1B3A',     // Medium dark purple
    card: '#1A1833',         // Card background with purple tint
    elevated: '#252248',     // Elevated surfaces
    gradient: {
      start: '#0D0B1E',
      end: '#1E1B3A',
    },
  },
  text: {
    primary: '#FFFFFF',      // White
    secondary: '#A8A5C0',    // Light purple-gray
    tertiary: '#6B6889',     // Medium purple-gray
    muted: '#4A4766',        // Muted text
  },
  primary: {
    main: '#8B5CF6',         // Vibrant purple (primary action)
    light: '#A78BFA',        // Light purple
    dark: '#7C3AED',         // Dark purple
    gradient: {
      start: '#8B5CF6',
      end: '#6366F1',
    },
  },
  accent: {
    purple: '#8B5CF6',       // Primary purple
    violet: '#7C3AED',       // Violet
    blue: '#3B82F6',         // Blue accent
    cyan: '#06B6D4',         // Cyan for highlights
  },
  success: '#10B981',        // Emerald green
  error: '#EF4444',          // Red
  warning: '#F59E0B',        // Amber
  info: '#3B82F6',           // Blue
  border: {
    light: '#2E2B4A',        // Light border
    main: '#3D3A5C',         // Main border
    dark: '#1E1B3A',         // Dark border
  },
  shadow: '#000000',
  overlay: 'rgba(13, 11, 30, 0.8)',
}

// Light mode (optional, keeping for potential future use)
export const lightColors: ThemeColors = {
  background: {
    primary: '#FAFAFF',      // Very light purple tint
    secondary: '#F3F2FC',    // Light purple background
    tertiary: '#EBE9F8',     // Light purple
    card: '#FFFFFF',         // White cards
    elevated: '#F8F7FF',     // Elevated surfaces
    gradient: {
      start: '#FAFAFF',
      end: '#F3F2FC',
    },
  },
  text: {
    primary: '#1E1B3A',      // Dark purple
    secondary: '#4A4766',    // Medium purple
    tertiary: '#6B6889',     // Light purple
    muted: '#A8A5C0',        // Muted
  },
  primary: {
    main: '#7C3AED',         // Purple
    light: '#8B5CF6',
    dark: '#6D28D9',
    gradient: {
      start: '#7C3AED',
      end: '#6366F1',
    },
  },
  accent: {
    purple: '#7C3AED',
    violet: '#8B5CF6',
    blue: '#3B82F6',
    cyan: '#06B6D4',
  },
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  border: {
    light: '#E5E3F1',
    main: '#D4D2E8',
    dark: '#C4C1DC',
  },
  shadow: '#1E1B3A',
  overlay: 'rgba(30, 27, 58, 0.3)',
}

// Export the current theme (dark mode is default)
export const colors = darkColors
