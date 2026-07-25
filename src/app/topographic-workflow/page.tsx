'use client';

/**
 * Integrated Topographic Survey Pipeline
 *
 * AUDIT FIX (2026-07-03): Previously a surveyor had to hop between 4-5
 * separate tool pages to produce a topographic map. This page provides
 * a single guided workflow that chains:
 *   1. Import field data (CSV / project points)
 *   2. Generate contours (TIN + marching triangles)
 *   3. Analyze slope (optional)
 *   4. Compute volumes (optional)
 *   5. Generate cross-sections (optional)
 *   6. Auto-draw topo plan (feature codes → DXF)
 *   7. Export (DXF / Shapefile / GeoJSON / KML)
 *
 * Each step links to the full-featured tool page for advanced options,
 * but the surveyor can see the whole pipeline in one place and track
 * progress.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Upload, Mountain, TrendingUp, Box, Scissors, FileCode, Download,
  CheckCircle2, Circle, ArrowRight, Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

interface PipelineStep {
  id: string
  number: number
  title: string
  description: string
  href: string
  icon: typeof Upload
  optional?: boolean
  status: string
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'import',
    number: 1,
    title: 'Import Field Data',
    description: 'Upload total station CSV, GNSS RINEX, GSI, RW5, or point cloud (LAS/PLY). Or load points from an existing project.',
    href: '/import',
    icon: Upload,
    status: 'pending' as const,
  },
  {
    id: 'contours',
    number: 2,
    title: 'Generate Contours',
    description: 'Delaunay TIN + marching-triangles contour generation. Set interval, add breaklines, export DXF/SVG/CSV/GeoJSON.',
    href: '/tools/contour-generator',
    icon: Mountain,
    status: 'pending' as const,
  },
  {
    id: 'slope',
    number: 3,
    title: 'Slope Analysis',
    description: 'IDW grid + Horn\'s method. Aspect, KENHA road classification, balance-point binary search.',
    href: '/tools/slope-analysis',
    icon: TrendingUp,
    status: 'pending' as const,
    optional: true,
  },
  {
    id: 'volumes',
    number: 4,
    title: 'Volume Computation',
    description: 'End-area, prismoidal, grid, or TIN-vs-TIN. Cut/fill volumes with mass-haul diagrams.',
    href: '/tools/volume-comparison',
    icon: Box,
    status: 'pending' as const,
    optional: true,
  },
  {
    id: 'sections',
    number: 5,
    title: 'Cross-Sections',
    description: 'TIN sampling along centerline at chainage intervals. CSV/DXF/PDF output.',
    href: '/tools/cross-sections',
    icon: Scissors,
    status: 'pending' as const,
    optional: true,
  },
  {
    id: 'drawing',
    number: 6,
    title: 'Topo Plan Drawing',
    description: 'Auto-generate DXF with Survey of Kenya feature codes, spot heights, north arrow, scale bar, title block.',
    href: '/tools/topo-drawing',
    icon: FileCode,
    status: 'pending' as const,
  },
  {
    id: 'export',
    number: 7,
    title: 'Export',
    description: 'DXF (AutoCAD/Civil 3D), Shapefile (QGIS/ArcGIS), GeoJSON, KML, LandXML.',
    href: '/tools/gis-export',
    icon: Download,
    status: 'pending' as const,
  },
]

export default function TopographicWorkflowPage() {
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE_STEPS)
  const [projectId, setProjectId] = useState<string | null>(null)

  // Load progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('metardu_topo_pipeline')
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
    localStorage.setItem('metardu_topo_pipeline', JSON.stringify({ steps: newSteps, projectId }))
  }

  const toggleStepDone = (id: string) => {
    const newSteps: PipelineStep[] = steps.map(s =>
      s.id === id
        ? { ...s, status: s.status === 'done' ? 'pending' as const : 'done' as const }
        : s
    )
    setSteps(newSteps)
    saveProgress(newSteps)
  }

  const completedCount = steps.filter(s => s.status === 'done').length
  const requiredSteps = steps.filter(s => !s.optional)
  const requiredCompleted = requiredSteps.filter(s => s.status === 'done').length
  const progressPct = Math.round((completedCount / steps.length) * 100)

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <PageHeader
        title="Topographic Survey Pipeline"
        subtitle="Complete workflow: field data → contours → analysis → topo plan → export"
        reference="Survey Act Cap. 299 | RDM 1.1 | Survey Regulations 1994"
      />

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {completedCount} of {steps.length} steps complete ({requiredCompleted}/{requiredSteps.length} required)
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
                {/* Step number / checkmark */}
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

                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isDone ? 'bg-[var(--accent)]/15' : 'bg-[var(--bg-tertiary)]'
                }`}>
                  <Icon className={`w-5 h-5 ${isDone ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold text-sm ${isDone ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                      {step.number}. {step.title}
                    </h3>
                    {step.optional && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                        optional
                      </span>
                    )}
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

              {/* Connector arrow */}
              {!isLast && (
                <div className="flex justify-center py-1">
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)] rotate-90" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reset button */}
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

      {/* Info box */}
      <div className="mt-8 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
        <h4 className="text-sm font-semibold text-blue-400 mb-2">How to use this pipeline</h4>
        <ol className="text-xs text-[var(--text-muted)] space-y-1 list-decimal list-inside">
          <li>Start at step 1 — import your field data (CSV, RINEX, or point cloud)</li>
          <li>Proceed through each step in order — click "Open tool" to use the full-featured tool page</li>
          <li>Mark each step as done by clicking the circle on the left</li>
          <li>Optional steps (slope, volumes, cross-sections) can be skipped for simple topo jobs</li>
          <li>Your progress is saved automatically — you can leave and come back</li>
          <li>Final export produces DXF/SHP/GeoJSON/KML for AutoCAD, Civil 3D, QGIS, or ArcGIS</li>
        </ol>
      </div>
    </div>
  )
}
