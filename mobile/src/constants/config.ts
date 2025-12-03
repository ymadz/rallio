import { colors as themeColors } from '../theme/colors'

export const appConfig = {
  name: 'Rallio',
  description: 'Badminton Court Finder & Queue Management System',
  tagline: 'Find courts. Join queues. Play more.',
};

export const apiConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN!,
  paymongoKey: process.env.EXPO_PUBLIC_PAYMONGO_PUBLIC_KEY!,
};

export const mapConfig = {
  defaultCenter: {
    latitude: 6.9214,  // Zamboanga City
    longitude: 122.079,
  },
  defaultZoom: 0.05, // Delta for React Native Maps
  defaultRadiusKm: 10,
};

// Re-export theme colors for backwards compatibility
// Components should prefer importing from theme directly
export const colors = {
  primary: themeColors.primary.main,
  secondary: themeColors.text.secondary,
  success: themeColors.success,
  warning: themeColors.warning,
  error: themeColors.error,
  background: themeColors.background.primary,
  foreground: themeColors.text.primary,
  muted: themeColors.text.muted,
  border: themeColors.border.main,
  card: themeColors.background.card,
};
