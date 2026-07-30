'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

/**
 * Cadastral Workflow Hub — v0.3
 *
 * Connects the existing cadastral tools into a visible 5-step workflow.
 * A surveyor lands here, sees the full process, and can track progress.
 *
 * Steps:
 * 1. Search parcel → /parcel
 * 2. Validate boundary → /cadastra
 * 3. Record beacons → /beacons
 * 4. Generate deed plan → /deed-plan
 * 5. Create mutation / submit → /tools/mutation-plan
 *
 * Status tracking via localStorage (no DB needed — zero paying customers).
 * When real persistence is needed, swap localStorage for a Supabase table.
 */

interface WorkflowState {
  parcelSearched: boolean
  boundaryValidated: boolean
  beaconsRecorded: boolean
  deedPlanGenerated: boolean
  submissionReady: boolean
  parcelNumber?: string
  updatedAt: string
}

const STORAGE_KEY = 'metardu:cadastral-workflow'

const EMPTY_STATE: WorkflowState = {
  parcelSearched: false,
  boundaryValidated: false,
  beaconsRecorded: false,
  deedPlanGenerated: false,
  submissionReady: false,
  updatedAt: new Date().toISOString(),
}

const STEPS = [
  {
    id: 'parcelSearched' as const,
    num: '01',
    title: 'Search the parcel',
    desc: 'Look up the LR number, title number, or parcel ID in the NLIMS / county registry. Confirm the registered owner, approximate area, and existing boundaries before heading to the field.',
    href: '/parcel',
    cta: 'Search parcel',
    reference: 'Land Registration Act 2012 · NLIMS',
    hints: [
      'Note the LR number (e.g. 2090/42) and registration section',
      'Check for existing beacons on the registry map',
      'Identify adjoining landowners — you will need their consent for mutations',
    ],
  },
  {
    id: 'boundaryValidated' as const,
    num: '02',
    title: 'Validate the boundary',
    desc: 'Run a topological pre-flight check on your surveyed boundary polygon. Catches self-intersections, sliver polygons, area violations, and winding-order issues before NLIMS / ArdhiSasa submission. Also check for overlaps with adjoining parcels.',
    href: '/tools/topology-check',
    cta: 'Run topology check',
    reference: 'Survey Act Cap 299 § 22 · NLIMS submission requirements · GeoJSON RFC 7946',
    hints: [
      'Compare surveyed area vs registered area — tolerance is ±2% for cadastral',
      'Check for encroachment on adjoining parcels',
      'Flag any beacon discrepancies (found vs set vs referenced)',
    ],
  },
  {
    id: 'beaconsRecorded' as const,
    num: '03',
    title: 'Record beacons',
    desc: 'Register every boundary beacon with its type (PSC, SSC, iron pin, concrete), coordinates (UTM), and status (found, set, referenced). This is your evidence base for the deed plan and any future disputes.',
    href: '/beacons',
    cta: 'Open beacon registry',
    reference: 'Survey Regulations 1994 · Form LRA 67',
    hints: [
      'Every beacon needs: type, UTM coordinates, status, description',
      'Photo-document each beacon (field record evidence)',
      'Reference destroyed beacons to permanent features',
    ],
  },
  {
    id: 'deedPlanGenerated' as const,
    num: '04',
    title: 'Generate the deed plan',
    desc: 'Draft the Form No. 4 deed plan from your computed coordinates. Include the parcel outline, bearings and distances, area, north arrow, scale bar, beacon schedule, and abuttals. This is the primary survey output.',
    href: '/deed-plan',
    cta: 'Generate deed plan',
    reference: 'Survey Act Cap 299 · Form No. 4 · RDM 1.1',
    hints: [
      'Scale: 1:500, 1:1000, 1:2500, or 1:5000 depending on parcel size',
      'Bearings in WCB (whole circle bearing), distances in metres',
      'Area computed by double meridian distance (DMD) or coordinate method',
      'Include abuttals on all four sides (N, S, E, W)',
    ],
  },
  {
    id: 'submissionReady' as const,
    num: '05',
    title: 'Create mutation & submit',
    desc: 'If this is a subdivision, amalgamation, or boundary adjustment, generate the mutation plan and assemble the NLIMS submission package. Include the deed plan, beacon certificate, computation workbook, and statutory forms.',
    href: '/tools/mutation-plan',
    cta: 'Create mutation plan',
    reference: 'Land Registration Act § 38 · NLIMS submission workflow',
    hints: [
      'Mutation types: subdivision, amalgamation, boundary adjustment, change of user',
      'Neighbour consent (Form LRA 52) required for boundary adjustments',
      'Submission package: deed plan + beacon certificate + workbook + CLA forms',
      'Survey of Kenya review takes 2-6 weeks — track status in your project',
    ],
  },
]

export default function CadastralWorkflowPage() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<WorkflowState>(EMPTY_STATE)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setState(JSON.parse(saved))
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  // Check URL params for step completion (e.g. ?completed=parcelSearched)
  useEffect(() => {
    if (!mounted) return
    const completed = searchParams.get('completed')
    const parcel = searchParams.get('parcel')
    if (completed && completed in state) {
      const newState = {
        ...state,
        [completed]: true,
        ...(parcel ? { parcelNumber: parcel } : {}),
        updatedAt: new Date().toISOString(),
      }
      setState(newState)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, searchParams])

  const toggleStep = (stepId: keyof WorkflowState) => {
    const newState = {
      ...state,
      [stepId]: !state[stepId],
      updatedAt: new Date().toISOString(),
    }
    setState(newState)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState))
  }

  const resetWorkflow = () => {
    setState(EMPTY_STATE)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(EMPTY_STATE))
  }

  const completedCount = STEPS.filter(s => state[s.id]).length
  const progress = Math.round((completedCount / STEPS.length) * 100)

  if (!mounted) {
    return <div className="max-w-5xl mx-auto px-4 py-8" style={{ minHeight: '50vh' }} />
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-10">
      {/* Header */}
      <div className="mb-8 pb-5 border-b border-[var(--border-color)]">
        <div className="font-mono text-[11px] text-[var(--accent)] tracking-[0.12em] uppercase mb-2">
          Cadastral survey · 5-step workflow
        </div>
        <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] tracking-[-0.025em] leading-[1.05]">
          From parcel search <span className="text-[var(--accent)] italic">to filed plan.</span>
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-3 max-w-[60ch] leading-relaxed">
          The complete cadastral survey workflow for Kenyan land surveyors. Each step
          links to the relevant tool. Track your progress as you go — your status saves
          locally and persists across sessions.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-10 flex items-center gap-4">
        <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-sm overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)] tracking-[0.04em]">
          {completedCount}/{STEPS.length} complete
        </span>
        {completedCount > 0 && (
          <button
            onClick={resetWorkflow}
            className="font-mono text-[10px] text-[var(--text-muted)] hover:text-[var(--error)] tracking-[0.06em] uppercase transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-0 border border-[var(--border-color)] bg-[var(--bg-card)]">
        {STEPS.map((step, idx) => {
          const isComplete = state[step.id]
          const isLocked = idx > 0 && !state[STEPS[idx - 1].id]

          return (
            <div
              key={step.id}
              className={`border-b border-[var(--border-color)] last:border-b-0 ${isLocked ? 'opacity-50' : ''}`}
            >
              <div className="p-5 md:p-6">
                <div className="flex items-start gap-4">
                  {/* Step number / checkbox */}
                  <button
                    onClick={() => !isLocked && toggleStep(step.id)}
                    disabled={isLocked}
                    className={`shrink-0 w-10 h-10 border flex items-center justify-center transition-all ${
                      isComplete
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--bg-primary)]'
                        : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--accent)]'
                    } ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    aria-label={isComplete ? `Mark step ${step.num} as incomplete` : `Mark step ${step.num} as complete`}
                  >
                    {isComplete ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <span className="font-mono text-xs tracking-[0.04em]">{step.num}</span>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h2 className={`font-display text-xl text-[var(--text-primary)] tracking-[-0.015em] leading-tight ${isComplete ? 'line-through opacity-60' : ''}`}>
                          {step.title}
                        </h2>
                        <p className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.04em] mt-1">
                          {step.reference}
                        </p>
                      </div>
                      {!isLocked && (
                        <Link
                          href={step.href}
                          className="shrink-0 font-mono text-[11px] text-[var(--accent)] hover:opacity-80 tracking-[0.04em] uppercase border-b border-[var(--accent)] pb-0.5 no-underline"
                        >
                          {step.cta} →
                        </Link>
                      )}
                    </div>

                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                      {step.desc}
                    </p>

                    {/* Hints */}
                    <ul className="space-y-1.5">
                      {step.hints.map((hint, i) => (
                        <li key={`${hint}-${i}`} className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
                          <span className="text-[var(--accent)] mt-0.5">·</span>
                          <span className="font-mono leading-relaxed">{hint}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom: contextual info */}
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
          <div className="font-mono text-[10px] text-[var(--accent)] tracking-[0.08em] uppercase mb-3">
            Regulatory framework
          </div>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
            <li className="font-mono">Survey Act Cap 299 — primary surveying law</li>
            <li className="font-mono">Survey Regulations 1994 — operational rules</li>
            <li className="font-mono">RDM 1.1 (2025) — accuracy standards</li>
            <li className="font-mono">Land Registration Act 2012 — registration</li>
            <li className="font-mono">NLIMS — National Land Information System</li>
          </ul>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
          <div className="font-mono text-[10px] text-[var(--accent)] tracking-[0.08em] uppercase mb-3">
            Key documents
          </div>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
            <li className="font-mono">Form No. 4 — deed plan (primary output)</li>
            <li className="font-mono">Form LRA 52 — neighbour consent (mutations)</li>
            <li className="font-mono">Form LRA 67 — beacon certificate</li>
            <li className="font-mono">CLA forms — computation workbook schedules</li>
            <li className="font-mono">Mutation form — subdivision / amalgamation</li>
          </ul>
        </div>
        <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
          <div className="font-mono text-[10px] text-[var(--accent)] tracking-[0.08em] uppercase mb-3">
            Geodesy tools
          </div>
          <ul className="space-y-2 text-xs">
            <li><Link href="/tools/scale-factor" className="text-[var(--text-secondary)] hover:text-[var(--accent)] font-mono no-underline">Scale factor (grid → ground area)</Link></li>
            <li><Link href="/tools/site-calibration" className="text-[var(--text-secondary)] hover:text-[var(--accent)] font-mono no-underline">Site calibration (WGS84 → Arc 1960)</Link></li>
            <li><Link href="/tools/cassini-utm" className="text-[var(--text-secondary)] hover:text-[var(--accent)] font-mono no-underline">Cassini ↔ UTM converter</Link></li>
            <li><Link href="/tools/topology-check" className="text-[var(--text-secondary)] hover:text-[var(--accent)] font-mono no-underline">Topology pre-flight validator</Link></li>
            <li><Link href="/tools/cogo-reconstruct" className="text-[var(--text-secondary)] hover:text-[var(--accent)] font-mono no-underline">COGO deed plan reconstructor</Link></li>
          </ul>
        </div>
      </div>

      {/* Last updated */}
      {state.updatedAt && (
        <div className="mt-6 text-center font-mono text-[10px] text-[var(--text-muted)] tracking-[0.04em]">
          Last updated {new Date(state.updatedAt).toLocaleString('en-KE')}
        </div>
      )}
    </div>
  )
}
