const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable:
    process.env.NODE_ENV === 'development' ||
    process.env.DISABLE_PWA === 'true' ||
    (process.platform === 'win32' && process.env.ENABLE_PWA_ON_WINDOWS !== 'true'),
  workboxOptions: { disableDevLogs: true },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Image optimization
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 1 day
  },
  
  // Linting
  eslint: {
    ignoreDuringBuilds: process.platform === 'win32' && process.env.NEXT_STRICT_CHECKS !== 'true',
  },
  
  // TypeScript
  typescript: {
    ignoreBuildErrors: process.platform === 'win32' && process.env.NEXT_STRICT_CHECKS !== 'true',
  },
  
  // Performance settings
  trailingSlash: true,
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  swcMinify: true,
  
  // Bundle optimization
  modularizeImports: {
    '@mui/material': {
      transform: '@mui/material/{{member}}',
    },
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}',
    },
  },
  
  // Experimental features
  experimental: {
    workerThreads: process.platform === 'win32' && process.env.NEXT_WORKER_THREADS !== 'false',
    optimizePackageImports: ['@mui/material', 'lucide-react'],
  },
  
  // Headers for performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
