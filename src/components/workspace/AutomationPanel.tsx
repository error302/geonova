'use client'

/**
 * AutomationPanel — Shows what's been auto-computed in the project.
 *
 * Displays the automation chain for the current project type, showing:
 *   - Which computations have run automatically
 *   - Which are pending (waiting for data)
 *   - Which failed (need attention)
 *   - Which are blocking export
 *
 * This replaces the need to visit 73 separate tool pages — everything
 * runs from the project workspace automatically.
 */

import { useState, useEffect } from 'react'
import {
  getAutomationChains,
  getAutomationSummary,
  type AutomationTrigger,
  type AutomationStep,
} from '@/lib/workflows/workflowAutomation'
import type { SurveyType } from '@/types/project'
import {
  CheckCircle2, XCircle, Loader2, Clock, AlertTriangle,
  Zap, ChevronDown, ChevronRight,
} from 'lucide-react'

interface AutomationPanelProps {
  surveyType: SurveyType
  /** Current workflow step (1-5) — determines which automations are active */
  currentStep?: number
}

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  fieldbook_saved: 'When Field Book is Saved',
  points_imported: 'When Points are Imported',
  alignment_entered: 'When Alignment is Entered',
  drone_processed: 'When Drone Processing Completes',
  pre_export: 'Before Export (Final Checks)',
}

const STEP_TO_TRIGGER: Record<number, AutomationTrigger[]> = {
  1: [], // Setup — no automations
  2: ['fieldbook_saved', 'points_imported', 'alignment_entered'], // Field Book
  3: ['fieldbook_saved'], // Compute
  4: [], // Review
  5: [], // Topo
  6: ['pre_export'], // Submission
}

export function AutomationPanel({ surveyType, currentStep = 1 }: AutomationPanelProps) {
  const [expandedTriggers, setExpandedTriggers] = useState<Set<AutomationTrigger>>(new Set())
  const chains = getAutomationChains(surveyType)
  const summary = getAutomationSummary(surveyType)

  // Filter to only show triggers relevant to the current step
  const relevantTriggers = STEP_TO_TRIGGER[currentStep] || []
  const activeTriggers = relevantTriggers.length > 0
    ? relevantTriggers
    : Object.keys(chains) as AutomationTrigger[]

  const toggleTrigger = (trigger: AutomationTrigger) => {
    setExpandedTriggers(prev => {
      const next = new Set(prev)
      if (next.has(trigger)) next.delete(trigger)
      else next.add(trigger)
      return next
    })
  }

  const allSteps = activeTriggers.flatMap(t => chains[t] || [])
  const totalSteps = allSteps.length
  const blockingSteps = allSteps.filter(s => s.blocking)

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Workflow Automation</h3>
          <p className="text-[10px] text-[var(--text-muted)]">
            {totalSteps} steps · {blockingSteps.length} blocking · runs automatically
          </p>
        </div>
      </div>

      {/* Summary banner */}
      <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/15 rounded-lg p-3 mb-4">
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {summary}
        </p>
      </div>

      {/* Automation chains */}
      <div className="space-y-2">
        {activeTriggers.map(trigger => {
          const steps = chains[trigger] || []
          if (steps.length === 0) return null

          const isExpanded = expandedTriggers.has(trigger)
          const completedCount = steps.filter(s => s.status === 'completed').length
          const failedCount = steps.filter(s => s.status === 'failed').length

          return (
            <div key={trigger} className="rounded-lg border border-[var(--border-color)] overflow-hidden">
              {/* Trigger header */}
              <button
                onClick={() => toggleTrigger(trigger)}
                className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  }
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {TRIGGER_LABELS[trigger]}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  {completedCount > 0 && (
                    <span className="text-emerald-400">{completedCount} </span>
                  )}
                  {failedCount > 0 && (
                    <span className="text-red-400">{failedCount} </span>
                  )}
                  <span className="text-[var(--text-muted)]">{steps.length} steps</span>
                </div>
              </button>

              {/* Steps (expanded) */}
              {isExpanded && (
                <div className="border-t border-[var(--border-color)] divide-y divide-[var(--border-color)]">
                  {steps.map(step => (
                    <div key={step.id} className="flex items-start gap-2 p-2.5">
                      {/* Status icon */}
                      <div className="shrink-0 mt-0.5">
                        {step.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {step.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                        {step.status === 'running' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                        {step.status === 'pending' && <Clock className="w-4 h-4 text-[var(--text-muted)]" />}
                        {step.status === 'skipped' && <div className="w-4 h-4 rounded-full border border-[var(--text-muted)] opacity-30" />}
                      </div>

                      {/* Step info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                            {step.name}
                          </span>
                          {step.blocking && (
                            <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold uppercase">
                              Blocking
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          {step.description}
                        </p>
                        {step.result && (
                          <p className="text-[10px] text-emerald-400 mt-1">{step.result}</p>
                        )}
                        {step.error && (
                          <p className="text-[10px] text-red-400 mt-1 flex items-start gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0 mt-0.5" />
                            {step.error}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Export readiness */}
      {currentStep >= 5 && (
        <div className="mt-4 p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Export Readiness</span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {blockingSteps.length} blocking step(s) must pass
            </span>
          </div>
          <div className="mt-2 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.max(0, 100 - (blockingSteps.length * 20))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
