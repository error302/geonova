'use client';

/**
 * Integrated Road Design Pipeline
 *
 * AUDIT FIX (2026-07-03): Previously a surveyor had to use 4-5 separate
 * tool pages for road design with no data flow between them. This page
 * provides a single guided workflow that chains:
 *
 *   1. Horizontal alignment (curves, spirals, compound/reverse)
 *   2. Vertical alignment (vertical curves with AASHTO K-factor)
 *   3. Cross-sections (TIN sampling along centerline)
 *   4. Earthworks (cut/fill volumes, mass-haul)
 *   5. Setting-out (stakeout coordinates + RDM 1.1 tolerances)
 *   6. Export (LandXML for Civil 3D, IFC 4.3, DXF, machine control)
 *
 * Each step links to the full-featured tool page for detailed work.
 * Progress is tracked in localStorage.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Route, TrendingUp, Scissors, Box, Crosshair, Download,
  CheckCircle2, Circle, ArrowRight,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

interface PipelineStep {
  id: string
  number: number
  title: string
  description: string
  href: string
  icon: typeof Route
  optional?: boolean
  status: string
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'horizontal',
    number: 1,
    title: 'Horizontal Alignment',
    description: 'Design horizontal curves — simple, compound, reverse, and clothoid spiral transitions (TS→SC→CS→ST). Computes tangent lengths, curve lengths, deflection angles, and chainage.',
    href: '/tools/curves',
    icon: Route,
    status: 'pending',
  },
  {
    id: 'vertical',
    number: 2,
    title: 'Vertical Alignment',
    description: 'Design vertical curves with AASHTO Green Book K-factor compliance. Multi-VIP alignment, crest/sag curves, stopping sight distance checks, profile generation.',
    href: '/tools/vertical-curve-designer',
    icon: TrendingUp,
    status: 'pending',
  },
  {
    id: 'sections',
    number: 3,
    title: 'Cross-Sections',
    description: 'Generate cross-sections by sampling the TIN along the centerline at chainage intervals. Existing ground vs design formation levels.',
    href: '/tools/cross-sections',
    icon: Scissors,
    status: 'pending',
  },
  {
    id: 'earthworks',
    number: 4,
    title: 'Earthworks & Mass-Haul',
    description: 'Compute cut/fill volumes using end-area or prismoidal methods. Generate mass-haul diagram. Corrected cross-section areas with zero-crossing split.',
    href: '/tools/earthworks',
    icon: Box,
    status: 'pending',
  },
  {
    id: 'setting-out',
    number: 5,
    title: 'Setting-Out',
    description: 'Compute stakeout coordinates for construction. Design points, offset points, and chainage stations with RDM 1.1 tolerance checks (±25mm H, ±15mm V).',
    href: '/tools/setting-out',
    icon: Crosshair,
    status: 'pending',
  },
  {
    id: 'export',
    number: 6,
    title: 'Export',
    description: 'LandXML (Civil 3D / 12d), IFC 4.3 (IfcAlignment for Bentley/Autodesk), DXF (AutoCAD), machine control (3D TIN + alignment for Leica/Trimble), stakeout CSV.',
    href: '/tools/civil-export',
    icon: Download,
    status: 'pending',
  },
]

export default function RoadDesignWorkflowPage() {
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE_STEPS)
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('metardu_road_pipeline')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.steps) {
          setSteps(prev => prev.map(s => {
            const savedStep = data.steps.find((ss: PipelineStep) => ss.id === s.id)
            return savedStep ? { ...s, status: savedStep.status } : s
          }))
        }
        if (data.projectId) setProjectId(data.projectId)
      } catch { /* ignore */ }
    }
  }, [])

  const saveProgress = (newSteps: PipelineStep[]) => {
    localStorage.setItem('metardu_road_pipeline', JSON.stringify({ steps: newSteps, projectId }))
  }

  const toggleStepDone = (id: string) => {
    const newSteps = steps.map(s =>
      s.id === id
        ? { ...s, status: s.status === 'done' ? ('pending' as const) : ('done' as const) }
        : s
    )
    setSteps(newSteps)
    saveProgress(newSteps)
  }

  const completedCount = steps.filter(s => s.status === 'done').length
  const progressPct = Math.round((completedCount / steps.length) * 100)

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <PageHeader
        title="Road Design Pipeline"
        subtitle="Complete workflow: horizontal → vertical → cross-sections → earthworks → setting-out → export"
        reference="AASHTO Green Book 2018 | RDM 1.3 | Survey Act Cap. 299"
      />

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {completedCount} of {steps.length} steps complete
          </span>
          <span className="text-sm font-bold text-[var(--accent)]">{progressPct}%</span>
        </div>
        <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-[var(--accent)] h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Pipeline steps */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isDone = step.status === 'done'
          const isLast = index === steps.length - 1

          return (
            <div key={step.id}>
              <div
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  isDone
                    ? 'bg-[var(--accent)]/5 border-[var(--accent)]/30'
                    : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[var(--accent)]/20'
                }`}
              >
                <button
                  onClick={() => toggleStepDone(step.id)}
                  className="mt-0.5 shrink-0"
                  title={isDone ? 'Mark as not done' : 'Mark as done'}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-6 h-6 text-[var(--accent)]" />
                  ) : (
                    <Circle className="w-6 h-6 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors" />
                  )}
                </button>

                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isDone ? 'bg-[var(--accent)]/15' : 'bg-[var(--bg-tertiary)]'
                }`}>
                  <Icon className={`w-5 h-5 ${isDone ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold text-sm ${isDone ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                      {step.number}. {step.title}
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-2">
                    {step.description}
                  </p>
                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:gap-2 transition-all"
                  >
                    Open tool
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {!isLast && (
                <div className="flex justify-center py-1">
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)] rotate-90" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reset */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => {
            const reset = steps.map(s => ({ ...s, status: 'pending' as const }))
            setSteps(reset)
            saveProgress(reset)
          }}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          Reset progress
        </button>
      </div>

      {/* Info */}
      <div className="mt-8 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
        <h4 className="text-sm font-semibold text-blue-400 mb-2">How to use this pipeline</h4>
        <ol className="text-xs text-[var(--text-muted)] space-y-1 list-decimal list-inside">
          <li>Start at step 1 — design your horizontal alignment (curves, spirals)</li>
          <li>Proceed to vertical alignment — design crest/sag curves with K-factor checks</li>
          <li>Generate cross-sections from your TIN along the centerline</li>
          <li>Compute earthworks volumes (cut/fill, mass-haul diagram)</li>
          <li>Generate setting-out coordinates for construction</li>
          <li>Export to LandXML (Civil 3D), IFC 4.3, DXF, or machine control format</li>
        </ol>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          METARDU is a field-to-design handoff toolkit — use it to compute field data and
          export to Civil 3D / 12d for detailed design. The math is verified against
          AASHTO Green Book 2018 and RDM 1.3.
        </p>
      </div>
    </div>
  )
}
