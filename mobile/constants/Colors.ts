/**
 * Rallio Mobile App - Color Theme
 * Dark-centered theme with Rallio Teal accent (matching web app)
 */

const tintColorLight = '#0d9488';
const tintColorDark = '#0d9488';

export const Colors = {
  // Light theme (for system preference compatibility)
  light: {
    text: '#11181C',
    textSecondary: '#687076',
    background: '#FFFFFF',
    surface: '#F4F4F5',
    elevated: '#FFFFFF',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    border: '#E4E4E7',
  },

  // Dark theme (primary theme)
  dark: {
    // Backgrounds
    background: '#0A0A0F',        // Near-black base
    surface: '#12121A',           // Card backgrounds
    elevated: '#1A1A24',          // Modals, overlays
    overlay: 'rgba(0,0,0,0.6)',   // Modal backdrop

    // Text
    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    textTertiary: '#71717A',
    textDisabled: '#52525B',

    // Primary accent (Rallio Teal - matches web)
    tint: tintColorDark,
    primary: '#0d9488',
    primaryLight: '#14b8a6',
    primaryDark: '#0f766e',
    primaryLighter: '#99f6e4',

    // Icons
    icon: '#A1A1AA',
    tabIconDefault: '#71717A',
    tabIconSelected: tintColorDark,

    // Borders
    border: 'rgba(255,255,255,0.10)',
    borderLight: 'rgba(255,255,255,0.05)',
    borderStrong: 'rgba(255,255,255,0.15)',

    // Status colors
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',

    // Glassmorphism
    glass: 'rgba(255,255,255,0.05)',
    glassBorder: 'rgba(255,255,255,0.10)',
  },
};

// Spacing scale (4px base)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Typography scale
export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
};
