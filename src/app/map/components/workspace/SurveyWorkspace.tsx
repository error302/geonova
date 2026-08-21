'use client'

import React, { memo, useState, useCallback, useEffect } from 'react'
import { useMapContext } from '@/app/map/MapReactContext'
import { MapHeader } from './MapHeader'
import { MapNavigation } from './MapNavigation'
import { MapToolsPanel } from './MapToolsPanel'
import { SelectionContextToolbar } from './SelectionContextToolbar'
import { MapDetailsDrawer } from './MapDetailsDrawer'
import { MapStatusWidget } from './MapStatusWidget'
import { MapControls } from './MapControls'
import { WorkflowDrawer } from './WorkflowDrawer'
import type { PanelTab, SurveyWorkflow } from './types'

export const SurveyWorkspace = memo(function SurveyWorkspace({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    toggleDraw, toggleMeasure, toggleEdit, toggleStakeout,
    deleteSelected, selectedFeature, undo, redo,
  } = useMapContext()

  // Workspace layout states
  const [panelOpen, setPanelOpen] = useState(true)
  const [panelTab, setPanelTab] = useState<PanelTab>('tools')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [workflowDrawerOpen, setWorkflowDrawerOpen] = useState(false)
  const [activeWorkflow, setActiveWorkflow] = useState<SurveyWorkflow>('idle')

  // Automatically open details drawer if a feature is selected
  useEffect(() => {
    if (selectedFeature) {
      setDetailsOpen(true)
    }
  }, [selectedFeature])

  // Workflow selector dispatcher
  const handleSelectWorkflow = useCallback((w: SurveyWorkflow) => {
    setActiveWorkflow(w)
    setWorkflowDrawerOpen(true)

    switch (w) {
      case 'point_collection':
        toggleDraw('Point')
        break
      case 'traverse':
        // Traverse calculations & station logging
        break
      case 'stakeout':
        toggleStakeout()
        break
      case 'measure_distance':
        toggleMeasure('distance')
        break
      case 'measure_area':
        toggleMeasure('area')
        break
      case 'vertex_editing':
        toggleEdit()
        break
      default:
        break
    }
  }, [toggleDraw, toggleStakeout, toggleMeasure, toggleEdit])

  // Keyboard shortcuts (P, T, S, M, A, V, Esc, Del)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if typing in input or textarea
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        handleSelectWorkflow('point_collection')
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        handleSelectWorkflow('traverse')
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        handleSelectWorkflow('stakeout')
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        handleSelectWorkflow('measure_distance')
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        handleSelectWorkflow('measure_area')
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        handleSelectWorkflow('vertex_editing')
      } else if (e.key === 'Escape') {
        setWorkflowDrawerOpen(false)
        setActiveWorkflow('idle')
        setDetailsOpen(false)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedFeature) {
          e.preventDefault()
          deleteSelected()
        }
      } else if (e.key === '1') {
        setPanelTab('tools')
        setPanelOpen((v) => !v)
      } else if (e.key === '2') {
        setPanelTab('layers')
        setPanelOpen(true)
      } else if (e.key === '3') {
        setPanelTab('data')
        setPanelOpen(true)
      } else if (e.key === '4') {
        setPanelTab('workflows')
        setPanelOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSelectWorkflow, selectedFeature, deleteSelected])

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[var(--bg-primary)] select-none">
      {/* ── 1. FIXED APPLICATION HEADER ── */}
      <MapHeader
        workflow={activeWorkflow}
        onOpenWorkflows={() => {
          setPanelTab('workflows')
          setPanelOpen(true)
        }}
      />

      {/* ── 2. MAIN WORKSPACE BODY (Nav Rail + Map Canvas + Overlays) ── */}
      <div className="flex flex-1 w-full h-[calc(100vh-56px)] relative overflow-hidden">
        {/* Persistent Primary Navigation Rail */}
        <MapNavigation
          activeTab={panelOpen ? panelTab : undefined}
          onOpenLayers={() => {
            setPanelTab('layers')
            setPanelOpen(true)
          }}
          onOpenData={() => {
            setPanelTab('data')
            setPanelOpen(true)
          }}
        />

        {/* ── 3. MAP CANVAS VIEWPORT ── */}
        <main className="flex-1 h-full relative overflow-hidden" role="main">
          {/* OpenLayers Map Canvas (children) */}
          {children}

          {/* Contextual Tools Panel (Left side) */}
          <MapToolsPanel
            isOpen={panelOpen}
            onClose={() => setPanelOpen(false)}
            onToggle={() => setPanelOpen(!panelOpen)}
            activeTab={panelTab}
            onTabChange={setPanelTab}
            onSelectWorkflow={handleSelectWorkflow}
            activeWorkflow={activeWorkflow}
          />

          {/* Selection Context Toolbar (Top Center) */}
          <SelectionContextToolbar />

          {/* Details Drawer (Right side) */}
          <MapDetailsDrawer
            isOpen={detailsOpen}
            onClose={() => setDetailsOpen(false)}
          />

          {/* Compact Status Widget (Bottom Left) */}
          <MapStatusWidget />

          {/* Consolidated Map Navigation Controls (Bottom Right) */}
          <MapControls />

          {/* Collapsible Bottom Workflow Drawer */}
          <WorkflowDrawer
            isOpen={workflowDrawerOpen}
            onClose={() => {
              setWorkflowDrawerOpen(false)
              setActiveWorkflow('idle')
            }}
            activeWorkflow={activeWorkflow}
            onSelectWorkflow={handleSelectWorkflow}
          />
        </main>
      </div>
    </div>
  )
})