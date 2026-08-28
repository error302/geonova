'use client'

import { memo } from 'react'

export interface WorkflowBadgeItem {
  id: string
  label: string
  accent: string
}

export interface SurveyWorkflowBadgeProps {
  activeItems: WorkflowBadgeItem[]
}

/**
 * SurveyWorkflowBadge — floating workflow status indicator at the top-center of the map.
 * Displays active panel categories / tools with glowing accent dots and glassmorphic styling.
 */
export const SurveyWorkflowBadge = memo(function SurveyWorkflowBadge({
  activeItems,
}: SurveyWorkflowBadgeProps) {
  if (!activeItems || activeItems.length === 0) return null

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex items-center gap-2">
      {activeItems.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-xl border border-white/[0.08] bg-[color-mix(in_srgb,var(--bg-secondary)_70%,transparent)]"
          style={{ boxShadow: `0 0 12px ${item.accent}20` }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: item.accent }}
          />
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
})
