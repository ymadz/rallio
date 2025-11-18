export const appConfig = {
  name: 'Rallio',
  description: 'Badminton Court Finder & Queue Management System',
};

export const apiConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN!,
  paymongoKey: process.env.EXPO_PUBLIC_PAYMONGO_PUBLIC_KEY!,
};

export const mapConfig = {
  defaultCenter: {
    latitude: 6.9214,
    longitude: 122.079,
  },
  defaultZoom: 0.05, // Delta for React Native Maps
};

export const colors = {
  primary: '#3b82f6',
  secondary: '#64748b',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  background: '#ffffff',
  foreground: '#0f172a',
  muted: '#f1f5f9',
  border: '#e2e8f0',
};
