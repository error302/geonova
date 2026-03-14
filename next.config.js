const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable:
    process.env.NODE_ENV === 'development' ||
    process.env.DISABLE_PWA === 'true' ||
    (process.platform === 'win32' && process.env.ENABLE_PWA_ON_WINDOWS !== 'true')
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true
  },
  eslint: {
    // On some Windows environments, `next build` can fail with `spawn EPERM` when Next tries to fork workers
    // for lint/typecheck. We keep strict checks on Linux/CI (e.g. Vercel) and allow Windows dev builds to pass.
    ignoreDuringBuilds: process.platform === 'win32' && process.env.NEXT_STRICT_CHECKS !== 'true',
  },
  typescript: {
    ignoreBuildErrors: process.platform === 'win32' && process.env.NEXT_STRICT_CHECKS !== 'true',
  },
  trailingSlash: true,
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  swcMinify: true,
  experimental: {
    // Use worker_threads instead of child_process on Windows to avoid `spawn EPERM` failures in some environments.
    workerThreads: process.platform === 'win32' && process.env.NEXT_WORKER_THREADS !== 'false',
  },
}

module.exports = withPWA(nextConfig)
