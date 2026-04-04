'use client'

import { useState } from 'react'
import type { SurveyPlanData } from '@/lib/reports/surveyPlan/types'

interface ComplianceItem {
  key: string
  label: string
  pass: boolean
}

interface ComplianceChecklistModalProps {
  isOpen: boolean
  onClose: () => void
  data: SurveyPlanData
  onExport: () => void
}

export default function ComplianceChecklistModal({
  isOpen,
  onClose,
  data,
  onExport,
}: ComplianceChecklistModalProps) {
  if (!isOpen) return null

  const p = data.project
  const parcel = data.parcel
  const pts = parcel?.boundaryPoints || []

  const items: ComplianceItem[] = [
    {
      key: 'beacons',
      label: 'Boundary beacons are present (minimum 3 corners)',
      pass: pts.length >= 3,
    },
    {
      key: 'coordinates',
      label: 'All boundary coordinates tabulated in schedule',
      pass: pts.length >= 3,
    },
    {
      key: 'area',
      label: 'Parcel area is inscribed on the plan',
      pass: (p.area_sqm || 0) > 0,
    },
    {
      key: 'north',
      label: 'North point / arrow is shown',
      pass: true,
    },
    {
      key: 'scale',
      label: 'Scale bar and numeric scale are shown',
      pass: true,
    },
    {
      key: 'boundary',
      label: 'Boundary lengths and bearings are labeled',
      pass: (p.bearingSchedule?.length || 0) >= 3,
    },
    {
      key: 'adjacent',
      label: 'Adjacent lot references are noted',
      pass: !!(p.reference || p.plan_title),
    },
    {
      key: 'surveyor',
      label: 'Surveyor name and LSK licence number are shown',
      pass: !!(p.surveyor_name && p.surveyor_licence),
    },
    {
      key: 'authentication',
      label: 'Authentication space is reserved on the plan',
      pass: true,
    },
    {
      key: 'drawing_no',
      label: 'Drawing number / plan reference is assigned',
      pass: !!p.drawing_no,
    },
    {
      key: 'datum',
      label: 'Datum set to ARC1960 (required for KeNHA submissions per RDM 1.1 §5.2)',
      pass: p.datum === 'ARC1960' || !p.datum,
    },
  ]

  const passed = items.filter((i: any) => i.pass).length
  const total = items.length
  const allPassed = passed === total

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              METARDU Compliance Checklist
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              RDM 1.1 — Boundary Identification Plan
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[var(--text-secondary)]">
              {passed}/{total} items compliant
            </span>
            <span className={`font-semibold ${allPassed ? 'text-green-400' : 'text-amber-400'}`}>
              {allPassed ? 'READY TO EXPORT' : 'ACTION REQUIRED'}
            </span>
          </div>
          <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${allPassed ? 'bg-green-500' : 'bg-amber-500'}`}
              style={{ width: `${(passed / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Checklist items */}
        <div className="space-y-2 mb-6">
          {items.map((item: any) => (
            <div
              key={item.key}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                item.pass
                  ? 'border-green-800/40 bg-green-900/10'
                  : 'border-amber-800/40 bg-amber-900/10'
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                item.pass
                  ? 'bg-green-900/50 border border-green-600'
                  : 'bg-amber-900/50 border border-amber-600'
              }`}>
                {item.pass ? (
                  <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                  </svg>
                )}
              </div>
              <span className={`text-sm flex-1 ${
                item.pass ? 'text-green-300' : 'text-amber-300'
              }`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Warning for non-compliant items */}
        {!allPassed && (
          <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700/30 rounded-lg">
            <p className="text-xs text-amber-300">
              <strong>Note:</strong> The plan can still be exported, but may not meet KeNHA submission requirements. Address the flagged items above before formal submission.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onExport()
              onClose()
            }}
            disabled={false}
            className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {allPassed ? 'Export Plan' : 'Export Anyway'}
          </button>
        </div>
      </div>
    </div>
  )
}
