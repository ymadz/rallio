export const siteConfig = {
  name: 'Rallio',
  description: 'Badminton Court Finder & Queue Management System for Zamboanga City',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ogImage: '/og-image.png',
  links: {
    github: 'https://github.com/rallio',
  },
};

export const apiConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN!,
  paymongoKey: process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY!,
};

export const mapConfig = {
  defaultCenter: {
    latitude: 6.9214,
    longitude: 122.079,
  },
  defaultZoom: 13,
  style: 'mapbox://styles/mapbox/streets-v12',
};
