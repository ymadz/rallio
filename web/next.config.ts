import type { NextConfig } from "next";

const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',
  // Output to root .next directory for Vercel
  distDir: '../.next',

  images: {
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
