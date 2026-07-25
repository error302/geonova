'use client'

import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import FeedbackWidget from '@/components/FeedbackWidget'
import { QuickCompute } from '@/components/layout/QuickCompute'
import MobileNav from '@/components/MobileNav'
import { HotkeyHelpOverlay } from '@/components/shared/HotkeyHelpOverlay'
import { AppUpdateBanner } from '@/components/app/AppUpdateBanner'
import { OfflineIndicator } from '@/components/app/OfflineIndicator'
import { PWAInstallBanner } from '@/components/app/PWAInstallBanner'
import { ProjectionInit } from '@/components/layout/ProjectionInit'
import FieldModeToggle from '@/components/shared/FieldModeToggle'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import { CountryProvider } from '@/lib/country'
import { SubscriptionProvider } from '@/lib/subscription/subscriptionContext'
import SkipToContent from '@/components/shared/SkipToContent'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { CommandPalette } from '@/components/search/CommandPalette'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
import { LoadingScreen } from '@/components/shared/LoadingScreen'
import dynamic from 'next/dynamic'

const NotificationToast = dynamic(
  () => import('@/components/ui/NotificationToast').then(m => ({ default: m.NotificationToast })),
  { ssr: false }
)

/* ── Route classification ─────────────────────────────────────────── */

function isFullScreenRoute(pathname: string): boolean {
  return pathname === '/field/map' || pathname.startsWith('/field/map/')
}

function isAdminRoute(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

function isAuthRoute(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register' || pathname.startsWith('/login/') || pathname.startsWith('/register/')
}

function isDashboardRoute(pathname: string): boolean {
  // Dashboard routes use sidebar navigation, not the top NavBar
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/') ||
         pathname.startsWith('/survey/') || pathname.startsWith('/project/')
}

function isHiddenShellRoute(pathname: string): boolean {
  return isFullScreenRoute(pathname) || isAdminRoute(pathname)
}

function isMapRoute(pathname: string): boolean {
  return pathname === '/map' || pathname.startsWith('/map/')
}

function isFieldbookRoute(pathname: string): boolean {
  return pathname === '/fieldbook' || pathname.startsWith('/fieldbook/')
}

/* ── Shell Component ─────────────────────────────────────────────── */

// Only show the loading screen once per browser session (not on every route change)
let _hasShownLoadingScreen = false

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const fullScreen = isFullScreenRoute(pathname)
  const admin = isAdminRoute(pathname)
  const hidden = isHiddenShellRoute(pathname)
  const auth = isAuthRoute(pathname)
  const dashboard = isDashboardRoute(pathname) // Uses sidebar nav, not top NavBar
  const mapPage = isMapRoute(pathname)
  const fieldbookPage = isFieldbookRoute(pathname)
  // Map and fieldbook are full-data-entry surfaces — the global overlays
  // (Footer, FeedbackWidget, QuickCompute, MobileNav, CommandPalette)
  // overlap the entry form and steal taps from the surveyor on a phone.
  const hideGlobalOverlays = mapPage || fieldbookPage
  const [initialLoading, setInitialLoading] = useState(!_hasShownLoadingScreen)

  // UI-12 (2026-07-24): Removed the OnboardingModal state + localStorage
  // 'metardu_onboarding_seen' key. The modal was redundant with the
  // OnboardingChecklist (rendered via OnboardingWrapper in the dashboard)
  // and the OnboardingTour (rendered below). Three onboarding flows
  // firing independently with 3 different localStorage keys created a
  // confusing first-run experience. Now there are exactly two:
  //   1. OnboardingChecklist (dashboard) — persistent progress tracker
  //   2. OnboardingTour (AppShell) — guided walk-through, respects the
  //      checklist's dismissed state so it doesn't fire before the
  //      user has seen the checklist.

  // Show branded loading screen only on very first app load
  useEffect(() => {
    if (_hasShownLoadingScreen) {
      setInitialLoading(false)
      return
    }
    const timer = setTimeout(() => {
      setInitialLoading(false)
      _hasShownLoadingScreen = true
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (isAuthRoute(pathname)) return
    // UI-12: OnboardingModal removed — see comment above.
  }, [pathname])

  // Auth routes (login/register): bare page, no chrome
  if (auth) {
    return (
      <>
        <SkipToContent />
        <OfflineIndicator />
        <ProjectionInit />
        <LanguageProvider>
          <CountryProvider>
            <SubscriptionProvider>
              <main id="main-content" className="min-h-screen max-w-full overflow-x-hidden">
                {children}
              </main>
              <NotificationToast />
            </SubscriptionProvider>
          </CountryProvider>
        </LanguageProvider>
      </>
    )
  }

  // Full-screen routes (field map): no chrome at all, but field mode toggle is always available
  if (fullScreen) {
    return (
      <>
        <SkipToContent />
        <AppUpdateBanner />
        <OfflineIndicator />
        <PWAInstallBanner />
        <ProjectionInit />
        <LanguageProvider>
          <CountryProvider>
            <SubscriptionProvider>
              <main id="main-content" className="overflow-hidden">
                {children}
              </main>
              <div className="fixed bottom-6 right-6 z-50">
                <FieldModeToggle />
              </div>
              <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
                <NotificationBell />
              </div>
              <CommandPalette />
              <HotkeyHelpOverlay />
              <NotificationToast />
              
            </SubscriptionProvider>
          </CountryProvider>
        </LanguageProvider>
      </>
    )
  }

  // Admin routes: hide NavBar, Footer, QuickCompute, FeedbackWidget, MobileNav
  if (admin) {
    return (
      <>
        <SkipToContent />
        <AppUpdateBanner />
        <OfflineIndicator />
        <PWAInstallBanner />
        <ProjectionInit />
        <LanguageProvider>
          <CountryProvider>
            <SubscriptionProvider>
              <main id="main-content" className="min-h-screen max-w-full overflow-x-hidden">
                {children}
              </main>
              <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
                <NotificationBell />
                <FieldModeToggle />
              </div>
              <CommandPalette />
              <HotkeyHelpOverlay />
              <NotificationToast />
              
            </SubscriptionProvider>
          </CountryProvider>
        </LanguageProvider>
      </>
    )
  }

  // Default: full app shell
  return (
    <>
      <LoadingScreen
        visible={initialLoading}
        message="Initializing METARDU"
        subMessage="Loading survey engine, map projections, and field tools..."
        autoDismiss={1500}
        onDismiss={() => setInitialLoading(false)}
      />
      <SkipToContent />
      <AppUpdateBanner />
      <OfflineIndicator />
      <PWAInstallBanner />
      <ProjectionInit />
      <LanguageProvider>
        <CountryProvider>
          <SubscriptionProvider>
            {/* AUDIT FIX: Hide top NavBar on dashboard routes — they use
                sidebar navigation via (dashboard)/layout.tsx. Showing both
                NavBar + sidebar header = double navigation bar. */}
            {!dashboard && <NavBar />}
            <main id="main-content" className={`min-h-screen max-w-full overflow-x-hidden ${dashboard ? '' : 'pb-40 md:pb-0 mobile-nav-spacer'}`}>
              {children}
            </main>
            <Footer />
            {!hideGlobalOverlays && <FeedbackWidget />}
            <HotkeyHelpOverlay />
            {/* Hide QuickCompute and FeedbackWidget on map + fieldbook pages — they overlap entry controls */}
            {!hideGlobalOverlays && <QuickCompute />}
            {!dashboard && !hideGlobalOverlays && <MobileNav />}
            {!hideGlobalOverlays && <CommandPalette />}
            <NotificationToast />
            <OnboardingTour />
            
          </SubscriptionProvider>
        </CountryProvider>
      </LanguageProvider>
    </>
  )
}
