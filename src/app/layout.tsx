import type { Metadata, Viewport } from 'next'
import Link from 'next/link'

import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import { ThemeProvider } from 'next-themes'
import { ProjectionInit } from '@/components/layout/ProjectionInit'
import AppShell from '@/components/layout/AppShell'
import QueryProvider from '@/lib/api/QueryProvider'
import { getPublicAppUrl } from '@/lib/site'
import { WebVitals } from './web-vitals'

const publicAppUrl = getPublicAppUrl()

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(publicAppUrl),
  title: 'METARDU - Precise earth measurements.',
  description:
    'Professional land surveying platform built in Kenya. Traverse adjustment, leveling, COGO, deed plans, GPS stakeout, and PDF reports. Supports Kenya UTM zones 36S and 37S.',
  keywords: [
    'surveying software',
    'traverse calculation',
    'leveling calculator',
    'COGO tools',
    'survey platform',
    'land surveying',
    'surveying software Kenya',
    'topographie Afrique',
    'software topografia',
    'software agrimensura',
    'programa topografia',
    'survey traverse online',
    'bowditch adjustment',
    'horizontal curves calculator',
    'UTM coordinates',
    'surveying app',
    'cadastral survey',
    'GPS stakeout',
  ],
  authors: [{ name: 'METARDU' }],
  creator: 'METARDU',
  publisher: 'METARDU',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: publicAppUrl,
    siteName: 'METARDU',
    title: 'METARDU - Precise earth measurements.',
    description: 'Complete surveying platform for professional land surveyors in Kenya.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'METARDU - Professional Surveying Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'METARDU - Professional Surveying Platform',
    description: 'Complete surveying platform for professional land surveyors.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="google" content="notranslate" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#D17B47" />
        <meta name="application-name" content="METARDU" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="METARDU" />
        {/* description meta is set via metadata export above to avoid duplicates */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#D17B47" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="color-scheme" content="dark light" />
        <link rel="icon" href="/metardu-icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="shortcut icon" href="/metardu-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-black focus:rounded focus:font-semibold"
        >
          Skip to content
        </a>
        <AuthProvider>
          {/* UI-8 (2026-07-24): Wire ThemeProvider so next-themes useTheme()
              works across the app. The CSS in globals.css uses
              html[data-theme="light"] and html[data-theme="field"], so we
              use attribute="data-theme". Default is dark (the :root vars).
              Sonner toasts, field mode toggle, and outdoor mode toggle can
              now use useTheme() to switch between 'dark', 'light', 'field'. */}
          <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
            <QueryProvider>
              <WebVitals />
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                  __html: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'Organization',
                    name: 'METARDU',
                    url: publicAppUrl,
                    description: 'Professional land-surveying platform built in Kenya for the East African market.',
                    areaServed: 'KE',
                    knowsAbout: ['Survey Act Cap. 299', 'RDM 1.1', 'NLIMS', 'ArdhiSasa', 'EPSG:21037'],
                  }),
                }}
              />
              <AppShell>
                {children}
              </AppShell>
            </QueryProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
