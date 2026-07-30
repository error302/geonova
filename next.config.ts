import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment (smaller image, no node_modules)
  output: 'standalone',

  experimental: {},

  // External packages that should not be bundled (server-only)
  serverExternalPackages: ['pdfkit', 'canvas'],

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
  },

  // Remove X-Powered-By header (security)
  poweredByHeader: false,

  // React strict mode catches common bugs
  reactStrictMode: true,

  // Compress responses (Caddy also does gzip/zstd, but this handles SSR)
  compress: true,

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle server-only packages on the client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
