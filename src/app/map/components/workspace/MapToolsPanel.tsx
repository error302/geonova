'use client'

import React, { memo } from 'react'
import {
  Wrench, Layers, Database, Sparkles, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { WORKSPACE_PANEL_WIDTH, Z_INDEX } from '@/lib/map/workspaceLayout'
import { ToolsTab, LayersTab, DataTab, WorkflowsTab } from './MapToolsTabs'
import type { PanelTab, SurveyWorkflow } from './types'

interface MapToolsPanelProps {
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
  activeTab: PanelTab
  onTabChange: (tab: PanelTab) => void
  onSelectWorkflow: (w: SurveyWorkflow) => void
  activeWorkflow: SurveyWorkflow
}

const TABS: Array<{ id: PanelTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'workflows', label: 'Workflows', icon: Sparkles },
]

export const MapToolsPanel = memo(function MapToolsPanel({
  isOpen,
  onClose,
  onToggle,
  activeTab,
  onTabChange,
  onSelectWorkflow,
  activeWorkflow,
}: MapToolsPanelProps) {
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--bg-secondary)]/90 backdrop-blur-xl border border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#D17B47]/40 transition-all shadow-xl"
        style={{ zIndex: Z_INDEX.leftPanel }}
        title="Open Map Tools Panel (1)"
        aria-label="Open Map Tools Panel"
      >
        <Wrench className="w-3.5 h-3.5 text-[#D17B47]" />
        <span>MAP TOOLS</span>
        <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </button>
    )
  }

  return (
    <aside
      aria-label="Map Tools Workspace Panel"
      className="absolute top-0 left-0 bottom-0 flex flex-col bg-[var(--bg-primary)]/95 backdrop-blur-2xl border-r border-[var(--border-color)] shadow-2xl transition-all"
      style={{ width: WORKSPACE_PANEL_WIDTH, zIndex: Z_INDEX.leftPanel }}
    >
      {/* ── PANEL HEADER ── */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#D17B47]" />
          <h2 className="text-xs font-black tracking-wider uppercase text-[var(--text-primary)]">
            MAP TOOLS
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Collapse panel"
          title="Collapse panel (Esc)"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.06] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* ── 4 PRIMARY TABS ── */}
      <div className="grid grid-cols-4 p-1.5 gap-1 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/40 shrink-0">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-semibold transition-all ${
                isActive
                  ? 'bg-[var(--bg-primary)] text-[#D17B47] shadow-sm border border-[var(--border-color)]/80'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.03]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mb-0.5" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {activeTab === 'tools' && <ToolsTab onSelectWorkflow={onSelectWorkflow} />}
        {activeTab === 'layers' && <LayersTab />}
        {activeTab === 'data' && <DataTab />}
        {activeTab === 'workflows' && (
          <WorkflowsTab
            onSelectWorkflow={onSelectWorkflow}
            activeWorkflow={activeWorkflow}
          />
        )}
      </div>
    </aside>
  )
})
