'use client'

import React, { memo } from 'react'
import { X, ChevronDown, Sparkles } from 'lucide-react'
import { Z_INDEX } from '@/lib/map/workspaceLayout'
import type { SurveyWorkflow } from './types'
import { PointCollectionWorkflow } from './workflows/PointCollectionWorkflow'
import { TraverseWorkflow } from './workflows/TraverseWorkflow'
import { StakeoutWorkflow } from './workflows/StakeoutWorkflow'
import { MeasurementWorkflow } from './workflows/MeasurementWorkflow'
import { VertexEditingWorkflow } from './workflows/VertexEditingWorkflow'

interface WorkflowDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeWorkflow: SurveyWorkflow
  onSelectWorkflow: (w: SurveyWorkflow) => void
}

export const WorkflowDrawer = memo(function WorkflowDrawer({
  isOpen,
  onClose,
  activeWorkflow,
  onSelectWorkflow,
}: WorkflowDrawerProps) {
  if (!isOpen || activeWorkflow === 'idle') return null

  return (
    <div
      className="absolute inset-x-0 bottom-0 bg-[var(--bg-primary)]/95 backdrop-blur-2xl border-t border-[var(--border-color)] shadow-[0_-12px_48px_rgba(0,0,0,0.5)] transition-all animate-in slide-in-from-bottom duration-200"
      style={{ zIndex: Z_INDEX.bottomDrawer, maxHeight: '55%' }}
      role="dialog"
      aria-label="Active Survey Workflow Drawer"
    >
      {/* ── DRAG / COLLAPSE HANDLE & CONTROLS ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)]/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#D17B47]" />
          <span className="text-xs font-bold text-[var(--text-primary)]">
            Active Survey Context
          </span>
        </div>

        {/* Center Drag Handle Bar */}
        <div className="w-12 h-1 rounded-full bg-[var(--border-color)]" />

        <button
          onClick={onClose}
          aria-label="Close workflow drawer"
          title="Close drawer (Esc)"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* ── WORKFLOW CONTENT CONTAINER ── */}
      <div className="overflow-y-auto max-h-[calc(55vh-45px)]">
        {activeWorkflow === 'point_collection' && (
          <PointCollectionWorkflow onClose={onClose} />
        )}
        {activeWorkflow === 'traverse' && (
          <TraverseWorkflow onClose={onClose} />
        )}
        {activeWorkflow === 'stakeout' && (
          <StakeoutWorkflow onClose={onClose} />
        )}
        {activeWorkflow === 'measure_distance' && (
          <MeasurementWorkflow mode="distance" onClose={onClose} />
        )}
        {activeWorkflow === 'measure_area' && (
          <MeasurementWorkflow mode="area" onClose={onClose} />
        )}
        {activeWorkflow === 'vertex_editing' && (
          <VertexEditingWorkflow onClose={onClose} />
        )}
      </div>
    </div>
  )
})
