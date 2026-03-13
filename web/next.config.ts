import type { NextConfig } from "next";

const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',

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
      {
        protocol: 'https',
        hostname: 'secure-authentication.paymongo.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'paymongo.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
