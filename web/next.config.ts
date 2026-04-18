import type { NextConfig } from "next";

const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',
  
  images: {
    unoptimized: true, // Required for Capacitor when not using a specialized image loader
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
