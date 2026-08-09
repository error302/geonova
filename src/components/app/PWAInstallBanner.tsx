'use client';

/**
 * PWAInstallBanner
 * ────────────────────────────────────────────────────────────────────────────
 * A dismissible install banner that:
 *   • Listens for the browser's `beforeinstallprompt` event (Android Chrome,
 *     Edge desktop, etc.) and reveals an "Install app" CTA.
 *   • Falls back to manual iOS instructions for iOS Safari (which doesn't
 *     fire `beforeinstallprompt` — Apple requires users to use Share →
 *     Add to Home Screen manually).
 *   • Remembers dismissal for 14 days via localStorage so we don't nag.
 *   • Auto-hides once the app is running in standalone mode (already
 *     installed).
 *
 * Render this once near the top of AppShell.
 */

import { useEffect, useState } from 'react'
import { Download, X, Share, PlusSquare } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const DISMISS_KEY = 'metardu_pwa_install_dismissed_at'
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

type Platform = 'android-chrome' | 'ios-safari' | 'desktop-chrome' | 'unsupported'

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unsupported'
  const ua = navigator.userAgent.toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(ua)
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/.test(ua)
  if (isIOS && isSafari) return 'ios-safari'
  const isAndroid = /android/.test(ua)
  if (isAndroid && /chrome|edge/.test(ua)) return 'android-chrome'
  if (/chrome|edge/.test(ua) && !isAndroid) return 'desktop-chrome'
  return 'unsupported'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS Safari
  if (navigator.standalone === true) return true
  // Android Chrome / Edge
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return false
}

function wasRecentlyDismissed(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (!ts) return false
    return Date.now() - ts < DISMISS_TTL_MS
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* ignore quota errors */
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallBanner() {
  const { t, hydrated } = useLanguage()
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState<Platform>('unsupported')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosSheet, setShowIosSheet] = useState(false)

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return
    setPlatform(detectPlatform())

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // iOS Safari never fires beforeinstallprompt — show banner after a short delay
  // so the user has time to engage with the page first.
  useEffect(() => {
    if (platform !== 'ios-safari' || isStandalone() || wasRecentlyDismissed()) return
    const t = setTimeout(() => setVisible(true), 4000)
    return () => clearTimeout(t)
  }, [platform])

  const dismiss = () => {
    setVisible(false)
    setShowIosSheet(false)
    markDismissed()
  }

  const handleInstallClick = async () => {
    if (platform === 'ios-safari') {
      setShowIosSheet(true)
      return
    }
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setVisible(false)
    } else {
      // User dismissed the native prompt — don't show our banner again for a while.
      dismiss()
    }
    setDeferredPrompt(null)
  }

  if (!visible || !hydrated) return null

  return (
    <>
      {/* ─── Banner ─── */}
      <div
        role="dialog"
        aria-label={t('pwa.installTitle')}
        className="fixed left-1/2 -translate-x-1/2 bottom-4 sm:bottom-6 z-[60] w-[calc(100%-1.5rem)] max-w-md animate-[slideUp_0.3s_ease-out]"
      >
        <div className="relative bg-[var(--bg-card)] border border-[var(--accent)]/30 rounded-2xl shadow-2xl shadow-[var(--accent)]/10 overflow-hidden">
          {/* Top accent stripe */}
          <div className="h-1 w-full bg-gradient-to-r from-[var(--accent)] via-amber-400 to-orange-300" />

          <div className="p-4 flex items-start gap-3">
            {/* App icon */}
            <div className="grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dim)] text-black shrink-0 shadow-lg shadow-[var(--accent)]/20">
              <Download className="w-6 h-6" strokeWidth={2.5} />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
                {t('pwa.installTitle')}
              </h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {platform === 'ios-safari'
                  ? t('pwa.installDescriptionIOS')
                  : t('pwa.installDescription')}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleInstallClick}
                  className="px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black text-xs font-semibold transition-colors active:scale-95"
                >
                  {platform === 'ios-safari' ? t('pwa.showMeHow') : t('pwa.installNow')}
                </button>
                <button
                  onClick={dismiss}
                  className="px-3 py-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] text-xs font-medium transition-colors"
                >
                  {t('pwa.notNow')}
                </button>
              </div>
            </div>

            <button
              onClick={dismiss}
              aria-label="Close install banner"
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── iOS instructions sheet ─── */}
      {showIosSheet && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
          onClick={() => setShowIosSheet(false)}
        >
          <div
            className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {t('pwa.addToHomeScreen')}
              </h3>
              <button
                onClick={() => setShowIosSheet(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-bold shrink-0 mt-0.5">1</span>
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{t('pwa.safariStep1')}</p>
                  <Share className="w-4 h-4 text-[var(--accent)] mt-1" />
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-bold shrink-0 mt-0.5">2</span>
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{t('pwa.safariStep2')}</p>
                  <PlusSquare className="w-4 h-4 text-[var(--accent)] mt-1" />
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid place-items-center w-6 h-6 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-bold shrink-0 mt-0.5">3</span>
                <p className="text-sm text-[var(--text-primary)]">{t('pwa.safariStep3')}</p>
              </li>
            </ol>

            <button
              onClick={() => {
                setShowIosSheet(false)
                dismiss()
              }}
              className="w-full mt-5 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold text-sm transition-colors active:scale-95"
            >
              {t('pwa.gotIt')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
