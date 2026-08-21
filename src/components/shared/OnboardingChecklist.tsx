'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, X, ChevronRight, Trophy } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OnboardingStep {
  id: string
  title: string
  description: string
  href: string
  estimatedTime: string
}

interface OnboardingState {
  completed: Record<string, boolean>
  dismissed: boolean
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'metardu_onboarding'
const DISMISSED_KEY = 'metardu_onboarding_dismissed'

const STEPS: OnboardingStep[] = [
  {
    id: 'create-project',
    title: 'Create your first project',
    description: 'Set up a new survey project to organize your field data, points, and deliverables.',
    href: '/project/new',
    estimatedTime: '2 min',
  },
  {
    id: 'add-survey-points',
    title: 'Add survey points',
    description: 'Import or manually enter survey points with coordinates into your project.',
    href: '/project/new',
    estimatedTime: '3 min',
  },
  {
    id: 'traverse-adjustment',
    title: 'Run a traverse adjustment',
    description: 'Perform a Bowditch or least-squares traverse adjustment with full computation steps.',
    href: '/tools/traverse',
    estimatedTime: '5 min',
  },
  {
    id: 'generate-deed-plan',
    title: 'Generate a deed plan',
    description: 'Create a professional deed plan with beacon descriptions, area, and diagram.',
    href: '/deed-plan',
    estimatedTime: '4 min',
  },
  {
    id: 'explore-field-book',
    title: 'Explore the field book',
    description: 'Record and manage traverse, leveling, and radiation field observations.',
    href: '/fieldbook',
    estimatedTime: '3 min',
  },
  {
    id: 'review-compliance',
    title: 'Review compliance standards',
    description: 'Familiarize yourself with Survey Act requirements and RDM accuracy standards.',
    href: '/docs/survey-act',
    estimatedTime: '5 min',
  },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function loadState(): OnboardingState {
  if (typeof window === 'undefined') {
    return { completed: {}, dismissed: false }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as OnboardingState
      return parsed
    }
  } catch {
    // ignore corrupt data
  }
  return { completed: {}, dismissed: false }
}

function saveState(state: OnboardingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    if (state.dismissed) {
      localStorage.setItem(DISMISSED_KEY, 'true')
    }
  } catch {
    // storage unavailable — silently ignore
  }
}

/**
 * Mark a checklist step complete from outside the component — e.g. the
 * project-create form ticks 'create-project' as soon as a project is
 * actually created, instead of waiting for the user to notice the checkbox.
 */
export function markOnboardingStepComplete(stepId: string) {
  if (typeof window === 'undefined') return
  const state = loadState()
  if (state.completed[stepId]) return
  saveState({ ...state, completed: { ...state.completed, [stepId]: true } })
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function OnboardingChecklist() {
  const [state, setState] = useState<OnboardingState>({ completed: {}, dismissed: false })
  const [mounted, setMounted] = useState(false)

  // Hydrate from localStorage after mount
  useEffect(() => {
    const saved = loadState()
    setState(saved)
    setMounted(true)
  }, [])

  const completedCount = Object.values(state.completed).filter(Boolean).length
  const totalSteps = STEPS.length
  const allComplete = completedCount === totalSteps

  const toggleStep = useCallback((stepId: string) => {
    setState((prev) => {
      const next: OnboardingState = {
        ...prev,
        completed: {
          ...prev.completed,
          [stepId]: !prev.completed[stepId],
        },
      }
      saveState(next)
      return next
    })
  }, [])

  const handleDismiss = useCallback(() => {
    const next: OnboardingState = { ...state, dismissed: true }
    saveState(next)
    setState(next)
  }, [state])

  // Don't render until hydrated to avoid SSR mismatch
  if (!mounted) return null

  // If dismissed, render nothing
  if (state.dismissed) return null

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] overflow-hidden mb-6">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            {allComplete ? (
              <>
                <Trophy className="h-5 w-5 text-[var(--accent)]" />
                You&apos;re all set!
              </>
            ) : (
              'Getting Started with METARDU'
            )}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {allComplete
              ? 'Congratulations — you\'ve completed every onboarding step. Welcome aboard!'
              : 'Complete these steps to get up and running'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss onboarding checklist"
          className="shrink-0 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ---- Progress bar ---- */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1.5">
          <span>{completedCount}/{totalSteps} completed</span>
          <span>{Math.round((completedCount / totalSteps) * 100)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${(completedCount / totalSteps) * 100}%`,
              background: allComplete
                ? 'var(--success)'
                : 'var(--accent)',
            }}
          />
        </div>
      </div>

      {/* ---- Congratulations banner ---- */}
      {allComplete && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-lg border border-[color-mix(in_srgb,var(--success)_20%,transparent)] bg-[color-mix(in_srgb,var(--success)_5%,transparent)] text-sm text-[var(--success)] flex items-center gap-3">
          <Trophy className="h-5 w-5 shrink-0" />
          <span>
            All onboarding steps complete! You&apos;re ready to make the most of METARDU.
          </span>
        </div>
      )}

      {/* ---- Steps list ---- */}
      <div className="px-2 pb-3">
        {STEPS.map((step) => {
          const isCompleted = !!state.completed[step.id]

          return (
            <div
              key={step.id}
              className={[
                'group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isCompleted
                  ? 'opacity-70'
                  : 'hover:bg-[var(--bg-tertiary)]',
              ].join(' ')}
            >
              {/* Checkbox */}
              <button
                type="button"
                onClick={() => toggleStep(step.id)}
                aria-label={`Mark "${step.title}" as ${isCompleted ? 'incomplete' : 'complete'}`}
                className="mt-0.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-[var(--success)] transition-colors" />
                ) : (
                  <Circle className="h-5 w-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                )}
              </button>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={step.href}
                    prefetch={false}
                    className={[
                      'text-sm font-medium transition-colors truncate',
                      isCompleted
                        ? 'text-[var(--text-muted)] line-through'
                        : 'text-[var(--accent)] hover:text-[var(--accent-dim)]',
                    ].join(' ')}
                  >
                    {step.title}
                  </Link>
                  {!isCompleted && (
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Estimated time */}
              <span className="shrink-0 text-[11px] text-[var(--text-muted)] mt-0.5 font-mono tabular-nums">
                {step.estimatedTime}
              </span>
            </div>
          )
        })}
      </div>

      {/* ---- Footer ---- */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-secondary)_50%,transparent)]">
        <p className="text-xs text-[var(--text-muted)]">
          {allComplete
            ? 'You can dismiss this panel whenever you like.'
            : 'Check off each step as you complete it — progress is saved automatically.'}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors underline-offset-2 hover:underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
