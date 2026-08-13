'use client'

/**
 * OnboardingTour — Interactive guided walkthrough for new users
 *
 * Features:
 * - Step-by-step tour with spotlight overlay
 * - Highlights key UI elements with descriptions
 * - Progress indicator (step X of Y)
 * - Skip / Next / Back navigation
 * - Persists completion in localStorage
 * - Auto-starts on first visit to dashboard
 *
 * Tour steps:
 * 1. Welcome to METARDU
 * 2. Dashboard — your projects
 * 3. Map — survey workflow
 * 4. Field Book — capture observations
 * 5. Tools — COGO, traverse, leveling
 * 6. Documents — generate deed plans
 * 7. Community — connect with surveyors
 * 8. Search (Cmd+K) — quick navigation
 * 9. Notifications — stay updated
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, ChevronLeft, ChevronRight, Check,
  LayoutDashboard, Map, FileText, Wrench, Users, Search, Bell,
} from 'lucide-react'

interface TourStep {
  title: string
  description: string
  icon: typeof LayoutDashboard
  href?: string
  highlight?: string // CSS selector to highlight
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to METARDU',
    description: 'East Africa\'s professional surveying platform. This quick tour will show you the key features. You can skip this anytime and come back later.',
    icon: LayoutDashboard,
  },
  {
    title: 'Your Dashboard',
    description: 'This is your home base. Create new projects, view recent activity, and track your survey work. Each project contains its own map, field book, and documents.',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    title: 'The Survey Map',
    description: 'The map is where you draw parcels, measure distances, and run COGO computations. Use the floating dock on the left to access tools. On mobile, use two fingers to pan.',
    icon: Map,
    href: '/map',
  },
  {
    title: 'Digital Field Book',
    description: 'Capture traverse, leveling, and control observations directly in the field. Works offline — your data syncs when you\'re back online. On mobile, use the bottom bar to take measurements.',
    icon: FileText,
    href: '/fieldbook',
  },
  {
    title: 'Survey Tools',
    description: '60+ calculation tools for every survey workflow: COGO, traverse adjustment, leveling, coordinate transformation, curves, areas, volumes, and more.',
    icon: Wrench,
    href: '/tools/cogo',
  },
  {
    title: 'Document Generation',
    description: 'Generate Kenya-compliant deed plans, Form C-22, beacon certificates, and traverse sheets. Free tier includes METARDU watermark; paid plans can add a company logo.',
    icon: FileText,
    href: '/documents',
  },
  {
    title: 'Surveyor Community',
    description: 'Connect with peers, submit plans for review, browse the equipment market, and track your CPD progress.',
    icon: Users,
    href: '/community',
  },
  {
    title: 'Quick Search',
    description: 'Press Cmd+K (Mac) or Ctrl+K (Windows) anywhere to open the command palette. Search across projects, parcels, tools, and pages instantly.',
    icon: Search,
  },
  {
    title: 'Notifications',
    description: 'Click the bell icon to see peer review requests, payment confirmations, and system updates. You\'re all set — welcome aboard!',
    icon: Bell,
  },
]

const STORAGE_KEY = 'metardu:onboarding-completed'

export function OnboardingTour() {
  const router = useRouter()
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)

  // Check if tour should auto-start
  // UI-12 (2026-07-24): Also check the checklist's dismissed state so
  // the tour doesn't fire before the user has seen the checklist.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const completed = localStorage.getItem(STORAGE_KEY)
    const skipped = localStorage.getItem('metardu:onboarding-skipped')
    const checklistDismissed = localStorage.getItem('metardu_onboarding_dismissed')
    if (!completed && !skipped && checklistDismissed) {
      // Only start the tour AFTER the checklist has been dismissed —
      // otherwise the user gets two onboarding overlays at once.
      const timer = setTimeout(() => setActive(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    localStorage.setItem('metardu:onboarding-skipped', 'true')
    // AUDIT FIX (M18, 2026-07-02): Persist to server so cross-device users
    // don't see the tour again. Fire-and-forget — localStorage is the
    // immediate source of truth; the server record prevents the tour from
    // reappearing on a new device.
    fetch('/api/user/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip' }),
      credentials: 'include',
    }).catch(() => { /* silent fail — localStorage is enough */ })
    setActive(false)
  }, [])

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    // AUDIT FIX (M18, 2026-07-02): Persist completion to server.
    fetch('/api/user/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete' }),
      credentials: 'include',
    }).catch(() => { /* silent fail — localStorage is enough */ })
    setActive(false)
  }, [])

  const handleNext = useCallback(() => {
    const currentStep = TOUR_STEPS[step]
    if (step < TOUR_STEPS.length - 1) {
      // Navigate to the step's href if provided
      if (currentStep.href) {
        router.push(currentStep.href)
      }
      setStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }, [step, router, handleComplete])

  const handleBack = useCallback(() => {
    if (step > 0) {
      const prevStep = TOUR_STEPS[step - 1]
      if (prevStep.href) {
        router.push(prevStep.href)
      }
      setStep(prev => prev - 1)
    }
  }, [step, router])

  // Close the tour with Escape regardless of focus location
  // (handled at document level — the dialog element itself is not
  // focusable, so a local onKeyDown would only fire from child buttons)
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, handleSkip])

  if (!active) return null

  const currentStep = TOUR_STEPS[step]
  const Icon = currentStep.icon
  const isLast = step === TOUR_STEPS.length - 1
  const isFirst = step === 0

  return (
    <>
      {/* AUDIT FIX (M16, 2026-07-02): Added ARIA attributes for accessibility.
          - role="dialog" + aria-modal on the tour card (screen readers announce it as a dialog)
          - aria-labelledby pointing to the step title
          - aria-label on the close button
          - The backdrop no longer dismisses on click (prevents accidental dismissal)
            — users must click Skip or press Escape. */}

      {/* Backdrop overlay — no onClick (prevents accidental dismissal) */}
      <div
        className="fixed inset-0 z-[9990] bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Tour card */}
      <div
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9991] w-[440px] max-w-[calc(100vw-2rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
      >
        <div className="bg-[#0d0d14]/95 backdrop-blur-2xl border border-[#D17B47]/30 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Progress bar */}
          <div className="h-1 bg-white/[0.06]">
            <div
              className="h-full bg-[#D17B47] transition-all duration-300"
              style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                Step {step + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Skip tour"
              aria-label="Skip onboarding tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-[#D17B47]/10 border border-[#D17B47]/20 flex items-center justify-center">
                <Icon className="w-6 h-6 text-[#D17B47]" />
              </div>
              <div className="flex-1 pt-1">
                <h3 id="tour-title" className="text-base font-bold text-white">{currentStep.title}</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{currentStep.description}</p>
              </div>
            </div>

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1.5 pt-2">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'w-6 bg-[#D17B47]' : i < step ? 'w-1.5 bg-[#D17B47]/50' : 'w-1.5 bg-white/10'
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSkip}
                className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                {!isFirst && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1 px-3 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-gray-300 hover:bg-white/[0.08] transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-4 h-8 rounded-lg bg-[#D17B47] hover:bg-[#FFB84D] text-black text-xs font-semibold transition-colors"
                >
                  {isLast ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Get Started
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Hook to check if onboarding has been completed
 */
export function useOnboardingStatus() {
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    setCompleted(!!localStorage.getItem(STORAGE_KEY))
  }, [])

  return completed
}

/**
 * Reset onboarding (for testing or re-triggering)
 */
export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('metardu:onboarding-skipped')
}
