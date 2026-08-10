let withBundleAnalyzer = (c) => c
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  })
} catch (e) {
  // bundle-analyzer not available, pass-through
}

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable:
    process.env.NODE_ENV !== 'production' ||
    process.env.DISABLE_PWA === 'true' ||
    (process.platform === 'win32' && process.env.ENABLE_PWA_ON_WINDOWS !== 'true'),
  workboxOptions: { 
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'esri-map-tiles',
          expiration: {
            maxEntries: 5000,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /^https:\/\/[a-z]\.tile\.openstreetmap\.org\/.*$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'osm-map-tiles',
          expiration: {
            maxEntries: 5000,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: { statuses: [0, 200] },
        },
      }
    ]
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output — smaller deploy, lower RAM
  // Use 'export' for Capacitor mobile builds (set MOBILE_BUILD=true)
  output: process.env.MOBILE_BUILD === 'true' ? 'export' : 'standalone',

  reactStrictMode: true,

  // SWC minifier — 20x faster than Terser, enabled by default in Next 14.
  // (Earlier comment said "Disabled — breaks OpenLayers" but the value was
  // actually `true`. OpenLayers tile rendering issues were traced to a
  // different cause and fixed separately. swcMinify stays on for speed.)
  swcMinify: true,

  // ─── Image optimization (enabled for web, disabled for Capacitor mobile builds) ───
  images: {
    unoptimized: process.env.MOBILE_BUILD === 'true',
    minimumCacheTTL: 60 * 60 * 24,
  },

  // ─── Linting & TypeScript ───
  eslint: {
    ignoreDuringBuilds: true,  // ESLint still has ~1300 any warnings; run via CI separately
  },
  typescript: {
    // AUDIT FIX (C10, 2026-07-02): Was `ignoreBuildErrors: process.env.IGNORE_TYPE_ERRORS === 'true'`.
    // Type errors now block the build — tsc --noEmit passes clean.
    ignoreBuildErrors: false,
  },

  // ─── Performance settings ───
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // ─── Tree-shaking for heavy packages ───
  // Only imports the named exports actually used instead of the entire package
  experimental: {
    // Next 14 expects server-only externals under the experimental flag.
    serverComponentsExternalPackages: [
      'pg',
      'canvas',
      '@google-cloud/storage',
      'bcryptjs',
      'better-sqlite3',
      'three',
      'pdfjs-dist',
    ],
    optimizePackageImports: [
      // NOTE: 'ol' removed — it breaks dynamic imports of 42+ ol/* submodules
      // used by MapClient.tsx. The ol package uses side-effectful modules
      // (e.g. ol/proj/proj4 register()) that conflict with tree-shaking
      // when combined with output: "standalone".
      'lucide-react',
      'recharts',
      'd3-contour',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      'date-fns',
    ],
  },

  // ─── Webpack configuration for OpenLayers ───
  webpack: (config, { isServer, nextRuntime }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: isServer ? false : require.resolve('crypto-browserify'),
    }

    // Middleware/edge bundles must stay self-contained. The catch-all
    // `vendor-common` splitChunks group below emits shared CJS chunks that
    // the Edge sandbox evaluates in ESM scope — 'ReferenceError: exports
    // is not defined' on every middleware request (vercel/next.js#51313).
    // Skipping code-splitting for the edge compilation keeps middleware in
    // one ESM-compatible chunk; the app/server compilation keeps the full
    // splitChunks config below.
    if (isServer && nextRuntime === 'edge') {
      config.optimization.splitChunks = false
      return config
    }

    if (isServer) {
      config.externals = config.externals || []
      config.externals.push(/^ol/)
      // Externalize heavy server-only native modules
      config.externals.push('better-sqlite3', 'canvas')
    } else {
      // Client-side: externalize Node.js built-ins that pg transitively depends on.
      // These are pulled in when client components (e.g. checkout/page.tsx) import
      // server modules (enterprise/auditTrail → db.ts → pg).
      config.externals = config.externals || []
      config.externals.push('pg', 'pg-native', 'pg-protocol', 'pg-connection-string',
        'pg-pool', 'pg-types', 'pg-cursor', 'async_hooks', 'dns', 'net', 'tls')
    }

    // Improve chunk splitting for large dependencies
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization?.splitChunks,
        chunks: 'all',
        // Warning threshold for individual chunks (kB) — surfaces oversized chunks in build logs
        minSize: 20_000,
        // Cap automatic chunk size so a single vendor can't balloon past 244 KB uncompressed
        maxSize: 244_000,
        cacheGroups: {
          ...config.optimization?.splitChunks?.cacheGroups,
          // OpenLayers — base maps + COGO (15MB on disk, ~600KB minified)
          openlayers: {
            test: /[\\/]node_modules[\\/]ol[\\/]/,
            name: 'vendor-ol',
            chunks: 'all',
            priority: 30,
          },
          // Three.js — 3D point cloud viewer (38MB on disk, ~1MB minified)
          // Only loaded by /tools/point-cloud-import — keep out of main bundle
          three: {
            test: /[\\/]node_modules[\\/]three[\\/]/,
            name: 'vendor-three',
            chunks: 'all',
            priority: 30,
          },
          // pdfjs-dist — PDF viewer used by /documents and OCR import (41MB on disk)
          pdfjs: {
            test: /[\\/]node_modules[\\/]pdfjs-dist[\\/]/,
            name: 'vendor-pdfjs',
            chunks: 'all',
            priority: 30,
          },
          // pdf-lib — PDF generation/manipulation (24MB on disk, ~500KB minified)
          // Used by deed plan renderer, statutory workbook, form generators
          pdfLib: {
            test: /[\\/]node_modules[\\/]pdf-lib[\\/]/,
            name: 'vendor-pdf-lib',
            chunks: 'all',
            priority: 30,
          },
          // pdfkit — server-side PDF generation (8MB on disk)
          pdfkit: {
            test: /[\\/]node_modules[\\/]pdfkit[\\/]/,
            name: 'vendor-pdfkit',
            chunks: 'all',
            priority: 30,
          },
          // ExcelJS — spreadsheet I/O (23MB on disk, ~700KB minified)
          // Used by field book importer, statutory workbook generator
          exceljs: {
            test: /[\\/]node_modules[\\/]exceljs[\\/]/,
            name: 'vendor-exceljs',
            chunks: 'all',
            priority: 30,
          },
          // Turf — geospatial analysis (9.6MB on disk)
          turf: {
            test: /[\\/]node_modules[\\/]@turf[\\/]/,
            name: 'vendor-turf',
            chunks: 'all',
            priority: 30,
          },
          // Recharts — charting library (5.4MB on disk, ~400KB minified)
          recharts: {
            test: /[\\/]node_modules[\\/]recharts[\\/]/,
            name: 'vendor-recharts',
            chunks: 'all',
            priority: 25,
          },
          // proj4 — coordinate transformations (1.6MB on disk, ~150KB minified)
          proj4: {
            test: /[\\/]node_modules[\\/]proj4[\\/]/,
            name: 'vendor-proj4',
            chunks: 'all',
            priority: 25,
          },
          // JSZip — ZIP archive utilities (1.2MB on disk, ~95KB minified)
          jszip: {
            test: /[\\/]node_modules[\\/]jszip[\\/]/,
            name: 'vendor-jszip',
            chunks: 'all',
            priority: 25,
          },
          // D3 family — used by recharts + contour generator
          d3: {
            test: /[\\/]node_modules[\\/]d3(-[a-z]+)?[\\/]/,
            name: 'vendor-d3',
            chunks: 'all',
            priority: 20,
          },
          // Radix UI primitives — shared across all dashboards
          radix: {
            test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
            name: 'vendor-radix',
            chunks: 'all',
            priority: 15,
          },
          // Catch-all vendor chunk for everything else from node_modules
          // (keeps the per-route bundle small)
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor-common',
            chunks: 'all',
            priority: 1,
            // Don't let vendor-common steal from the named groups above
            reuseExistingChunk: true,
          },
        },
      },
    }

    return config
  },

  // ─── Headers for performance & security ───
  async headers() {
    const isProd = process.env.NODE_ENV === 'production'
    // Allow the CSP to work with any domain (production, staging, dev)
    // instead of hardcoding metardu.space which breaks other environments
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ''
    const siteHost = siteUrl ? new URL(siteUrl).hostname : ''
    const wssHost = siteHost ? `wss://${siteHost}` : ''
    const httpsHost = siteHost ? `https://${siteHost}` : ''

    // Build connect-src with dynamic host or fallback to 'self'
    const connectSrcParts = [
      "'self'",
      "blob:",
    ]
    if (httpsHost) connectSrcParts.push(httpsHost)
    if (wssHost) connectSrcParts.push(wssHost)
    // Always allow these external services
    connectSrcParts.push(
      "https://ipapi.co",
      "https://*.upstash.io",
      "https://api.anthropic.com",
      "https://sentry.io",
      "https://*.sentry.io",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
      "https://tile.openstreetmap.org",
      "https://*.tile.openstreetmap.org",
      "https://server.arcgisonline.com",
      "https://*.arcgisonline.com",
      "https://*.basemaps.cartocdn.com",
    )

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
          ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
          // AUDIT FIX (M10, 2026-07-02): CSP removed from next.config.js.
          // Previously this static CSP with 'unsafe-inline' for scripts
          // overrode the middleware's nonce-based CSP, making the nonce
          // useless. CSP is now set exclusively in middleware.ts via
          // getCspHeaders() — which generates a per-request nonce AND
          // includes 'unsafe-inline' (required for Next.js 14 RSC inline
          // scripts). When upgrading to Next.js 15, 'unsafe-inline' can
          // be removed from the middleware CSP since Next.js 15 properly
          // injects nonces into RSC scripts.
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
      {
        source: '/api/projects/:path*',
        headers: [
          // User-specific data — must not be cached by CDNs/proxies
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      {
        source: '/api/survey-report/:path*',
        headers: [
          // User-specific report data — must not be cached by CDNs/proxies
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      {
        source: '/api/tools/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/api/field/mbtiles/tiles/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
    ]
  },
}

// Sentry (only wraps when NEXT_PUBLIC_SENTRY_DSN is set — no-op otherwise)
const { withSentryConfig } = require('@sentry/nextjs')

const hasSentry =
  process.env.NODE_ENV === 'production' &&
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)

module.exports = hasSentry
  ? withSentryConfig(
      withBundleAnalyzer(withPWA(nextConfig)),
      {
        silent: true,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
      {
        widenClientFileUpload: true,
        hideSourceMaps: true,
        disableLogger: true,
      }
    )
  : withBundleAnalyzer(withPWA(nextConfig))
