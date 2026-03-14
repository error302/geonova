import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export const metadata: Metadata = {
  title: 'GeoNova — Professional Surveying Calculations',
  description: 'Professional land surveying calculation platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link 
          href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@400;600;700&display=swap" 
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
          <NavBar />
          <main className="min-h-screen">
            {children}
          </main>
          <footer className="border-t border-[var(--border-color)] py-6 mt-16">
            <div className="max-w-7xl mx-auto px-4 text-center text-xs text-[var(--text-muted)]">
              GeoNova v1.0 — Professional Surveying Calculations
            </div>
          </footer>
        </LanguageProvider>
      </body>
    </html>
  );
}
