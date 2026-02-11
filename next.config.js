/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
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

module.exports = nextConfig;
