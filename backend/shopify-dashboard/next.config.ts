import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Shopify CDN
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
      {
        protocol: 'https',
        hostname: '**.shopifycdn.com',
      },
      // Google OAuth profile images
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // GitHub OAuth
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      // Facebook OAuth
      {
        protocol: 'https',
        hostname: 'platform-lookaside.fbsbx.com',
      },
      // Microsoft OAuth
      {
        protocol: 'https',
        hostname: 'graph.microsoft.com',
      },
      // Discord OAuth
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
    ],
  },
};

export default nextConfig;
