'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  getWorkflowStatus,
  getWorkflowSteps,
  getNextAction,
  STEP_COLOR_MAP,
  type ProjectWorkflowData,
} from '@/lib/workflows/projectWorkflowEngine'

interface WorkflowOverviewPanelProps {
  /** The project data */
  project: ProjectWorkflowData
  /** Whether the panel is open */
  isOpen: boolean
  /** Callback to toggle the panel */
  onToggle: () => void
  /** Callback when user clicks a step (for navigation within workspace) */
  onStepClick?: (stepId: string) => void
}

export default function WorkflowOverviewPanel({
  project,
  isOpen,
  onToggle,
  onStepClick,
}: WorkflowOverviewPanelProps) {
  const status = useMemo(() => getWorkflowStatus(project), [project])
  const steps = getWorkflowSteps(project.surveyType)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        onClick={onToggle}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-80 max-w-[85vw] bg-[var(--bg-card)] border-l border-[var(--border-color)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Workflow Progress</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Overall: <span className="font-mono text-[var(--text-primary)]">{status.overallPct}%</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Overall progress bar */}
        <div className="px-5 py-3 border-b border-[var(--border-color)]">
          <div className="w-full h-2.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"
              style={{ width: `${status.overallPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-[var(--text-muted)]">Step {status.currentStep} of {steps.length}</span>
            <span className="text-[10px] text-[var(--text-muted)]">{status.overallPct}% complete</span>
          </div>
        </div>

        {/* Steps list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {steps.map((stepDef, idx) => {
            const stepInfo = status.steps.find((s) => s.id === stepDef.id)
            if (!stepInfo) return null

            const colors = STEP_COLOR_MAP[stepDef.color] ?? STEP_COLOR_MAP.gray
            const nextAction = getNextAction(project, stepDef.id)

            return (
              <div
                key={stepDef.id}
                className={`rounded-lg border p-3 transition-colors ${
                  stepInfo.status === 'active'
                    ? `border-[color-mix(in_srgb,var(--accent)_40%,transparent)] ${colors.bg}`
                    : stepInfo.status === 'complete'
                    ? 'border-green-500/20 bg-green-500/5'
                    : 'border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-tertiary)_30%,transparent)]'
                }`}
              >
                {/* Step header */}
                <div className="flex items-center gap-2.5 mb-1.5">
                  {/* Status icon */}
                  {stepInfo.status === 'complete' ? (
                    <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : stepInfo.status === 'active' ? (
                    <div className={`w-6 h-6 rounded-full border-2 ${colors.border} flex items-center justify-center shrink-0`}>
                      <span className={`text-[10px] font-bold ${colors.text}`}>{stepDef.index}</span>
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                  )}

                  {/* Step name + description */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      stepInfo.status === 'complete'
                        ? 'text-green-400'
                        : stepInfo.status === 'active'
                        ? colors.text
                        : 'text-[var(--text-muted)]'
                    }`}>
                      {stepDef.label}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {stepDef.description}
                    </p>
                  </div>

                  {/* Completion % */}
                  <span className={`text-xs font-mono shrink-0 ${
                    stepInfo.status === 'complete'
                      ? 'text-green-400'
                      : stepInfo.completionPct > 0
                      ? 'text-[var(--text-secondary)]'
                      : 'text-[var(--text-muted)]'
                  }`}>
                    {stepInfo.completionPct}%
                  </span>
                </div>

                {/* Mini progress bar */}
                {stepInfo.status !== 'complete' && (
                  <div className="ml-[2.125rem] mb-1.5">
                    <div className="w-full h-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${colors.bar}`}
                        style={{ width: `${stepInfo.completionPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Next action link */}
                {stepInfo.status === 'active' && nextAction && (
                  <div className="ml-[2.125rem]">
                    {onStepClick ? (
                      <button
                        type="button"
                        onClick={() => onStepClick(stepDef.id)}
                        className="text-xs text-[var(--accent)] hover:text-[var(--accent-dim)] font-medium transition-colors"
                      >
                        {nextAction.label} →
                      </button>
                    ) : (
                      <Link
                        href={nextAction.route}
                        className="text-xs text-[var(--accent)] hover:text-[var(--accent-dim)] font-medium transition-colors"
                      >
                        {nextAction.label} →
                      </Link>
                    )}
                  </div>
                )}

                {/* Connector line between steps */}
                {idx < steps.length - 1 && (
                  <div className="flex justify-start ml-3 mt-2">
                    <div className={`w-0.5 h-3 rounded-full ${
                      stepInfo.status === 'complete' ? 'bg-green-400/50' : 'bg-[var(--border-color)]'
                    }`} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Blockers */}
        {status.blockers.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--border-color)] bg-red-500/5">
            <p className="text-xs font-semibold text-red-400 mb-1">Blockers</p>
            {status.blockers.map((b, i) => (
              <p key={`${b}-${i}`} className="text-xs text-red-400/80 flex items-start gap-1.5">
                <svg className="w-3 h-3 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {b}
              </p>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-color)]">
          {status.canAdvance ? (
            <p className="text-xs text-green-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ready to advance to next step
            </p>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              Complete current step to unlock the next
            </p>
          )}
        </div>
      </div>
    </>
  )
}
