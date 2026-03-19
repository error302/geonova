import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';
import MobileNav from '@/components/MobileNav';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { SubscriptionProvider } from '@/lib/subscription/subscriptionContext';
import FeedbackWidget from '@/components/FeedbackWidget';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';

export const metadata: Metadata = {
  metadataBase: new URL('https://geonova-henna.vercel.app'),
  title: 'GeoNova — Professional Surveying Platform',
  description: 'Professional surveying platform for land surveyors worldwide. Traverse adjustment, leveling, COGO, GPS stakeout, PDF reports. Supports all 60 UTM zones. Built in Africa, used globally.',
  keywords: [
    'surveying software', 'traverse calculation', 'leveling calculator',
    'COGO tools', 'survey platform', 'land surveying',
    'surveying software Kenya', 'topographie Afrique', 'software topografia',
    'software agrimensura', 'programa topografia',
    'survey traverse online', 'bowditch adjustment',
    'horizontal curves calculator', 'UTM coordinates',
    'surveying app', 'cadastral survey', 'GPS stakeout'
  ],
  authors: [{ name: 'GeoNova' }],
  creator: 'GeoNova',
  publisher: 'GeoNova',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://geonova-henna.vercel.app',
    siteName: 'GeoNova',
    title: 'GeoNova — Professional Surveying Platform',
    description: 'Complete surveying platform for professional land surveyors across Africa and beyond.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GeoNova Surveying Platform'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GeoNova — Professional Surveying Platform',
    description: 'Complete surveying platform for professional land surveyors.',
    images: ['/og-image.png']
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1
    }
  },
  verification: {
    google: 'add-google-verification-code-here'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700&display=swap" 
          rel="stylesheet" 
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#E8841A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GeoNova" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        <LanguageProvider>
          <SubscriptionProvider>
            <NavBar />
            <main className="min-h-screen">
              {children}
            </main>
            <footer className="border-t border-[var(--border-color)] py-6 mt-16">
              <div className="max-w-7xl mx-auto px-4 text-center text-xs text-[var(--text-muted)]">
                GeoNova v1.0 — Professional Surveying Calculations
              </div>
            </footer>
            <FeedbackWidget />
            <KeyboardShortcuts />
            <MobileNav />
          </SubscriptionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
