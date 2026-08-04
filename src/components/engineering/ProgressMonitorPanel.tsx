'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react'
import type {
  InspectionCheckpoint,
  ProgressSummary,
  ProgressChart,
} from '@/lib/engineering/progressMonitor'
import {
  calculateProgressSummary,
  generateProgressChart,
  parseProgressCSV,
  progressToCSV,
  generateInspectionReport,
  generateDemoCheckpoints,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  STATUS_CONFIG,
} from '@/lib/engineering/progressMonitor'

// ─── TYPES ─────────────────────────────────────────────────────────────────────

interface ProgressMonitorPanelProps {
  projectId: string
  projectName?: string
}

type TabId = 'dashboard' | 'checkpoints' | 'add'

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ProgressMonitorPanel({ projectId, projectName }: ProgressMonitorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [checkpoints, setCheckpoints] = useState<InspectionCheckpoint[]>([])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Auto-generate ID
  const nextId = useCallback(() => {
    return `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  }, [])

  // Derived data
  const summary = useMemo(() => calculateProgressSummary(checkpoints), [checkpoints])
  const chart = useMemo(() => generateProgressChart(checkpoints), [checkpoints])

  // Status distribution
  const statusDistribution = useMemo(() => {
    const dist: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      inspected: 0,
      approved: 0,
      delayed: 0,
      rejected: 0,
    }
    for (const cp of checkpoints) {
      dist[cp.status] = (dist[cp.status] || 0) + 1
    }
    return dist
  }, [checkpoints])

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleAddCheckpoint = (cp: Omit<InspectionCheckpoint, 'id' | 'projectId' | 'timestamp' | 'status'> & { status?: InspectionCheckpoint['status'] }) => {
    const newCp: InspectionCheckpoint = {
      ...cp,
      id: nextId(),
      projectId,
      status: cp.status || 'pending',
      timestamp: new Date().toISOString().split('T')[0],
    }
    setCheckpoints(prev => [...prev, newCp].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)))
    showToast('Checkpoint added', 'success')
    setActiveTab('checkpoints')
  }

  const handleUpdateCheckpoint = (id: string, updates: Partial<InspectionCheckpoint>) => {
    setCheckpoints(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)))
  }

  const handleDeleteCheckpoint = (id: string) => {
    setCheckpoints(prev => prev.filter(c => c.id !== id))
    showToast('Checkpoint deleted', 'info')
  }

  const handleStatusTransition = (id: string, newStatus: InspectionCheckpoint['status']) => {
    const updates: Partial<InspectionCheckpoint> = { status: newStatus }
    if (newStatus === 'completed' || newStatus === 'inspected') {
      updates.actualDate = new Date().toISOString().split('T')[0]
      updates.actualPercentage = 100
    } else if (newStatus === 'in_progress') {
      updates.actualDate = new Date().toISOString().split('T')[0]
    }
    handleUpdateCheckpoint(id, updates)
    showToast(`Status updated to ${STATUS_CONFIG[newStatus].label}`, 'success')
  }

  const handleAddPhoto = (id: string, url: string) => {
    handleUpdateCheckpoint(id, { photos: [...(checkpoints.find(c => c.id === id)?.photos || []), url] })
  }

  const handleRemovePhoto = (id: string, photoIndex: number) => {
    const cp = checkpoints.find(c => c.id === id)
    if (cp?.photos) {
      const updated = cp.photos.filter((_, i) => i !== photoIndex)
      handleUpdateCheckpoint(id, { photos: updated })
    }
  }

  const handleLoadDemo = () => {
    const demo = generateDemoCheckpoints(projectId)
    setCheckpoints(demo)
    showToast(`Loaded ${demo.length} demo checkpoints`, 'success')
    setActiveTab('dashboard')
  }

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string
        const parsed = parseProgressCSV(text)
        if (parsed.length === 0) {
          showToast('No valid rows found in CSV', 'error')
          return
        }
        const newCheckpoints: InspectionCheckpoint[] = parsed.map(p => ({
          id: nextId(),
          projectId,
          description: p.description || 'Imported checkpoint',
          category: p.category || 'other',
          plannedDate: p.plannedDate || new Date().toISOString().split('T')[0],
          plannedPercentage: p.plannedPercentage || 0,
          status: p.status || 'pending',
          chainage: p.chainage,
          gridRef: p.gridRef,
          notes: p.notes,
          timestamp: new Date().toISOString().split('T')[0],
        }))
        setCheckpoints(prev => [...prev, ...newCheckpoints].sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)))
        showToast(`Imported ${newCheckpoints.length} checkpoints`, 'success')
      } catch {
        showToast('Failed to parse CSV file', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleExportCSV = () => {
    if (checkpoints.length === 0) return
    const csv = progressToCSV(checkpoints)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `progress_monitor_${projectId}_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('CSV exported', 'success')
  }

  const handleExportReport = () => {
    if (checkpoints.length === 0) return
    const html = generateInspectionReport(checkpoints, summary, {
      name: projectName || projectId,
      client: 'Client Name',
      contractor: 'Contractor Name',
      surveyor: 'Surveyor Name',
    })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inspection_report_${projectId}_${Date.now()}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Inspection report exported', 'success')
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" style={{ '--bg-tertiary': 'var(--bg-secondary, #18181b)', '--border-color': '#3f3f46', '--accent': '#3b82f6', '--accent-secondary': '#60a5fa', '--text-muted': '#a1a1aa' } as React.CSSProperties}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-900/90 text-green-300 border border-green-700' :
          toast.type === 'error' ? 'bg-red-900/90 text-red-300 border border-red-700' :
          'bg-zinc-800 text-zinc-300 border border-zinc-600'
        }`}>
          {toast.type === 'success' ? ' ' : toast.type === 'error' ? '[x] ' : '(i) '}{toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Construction Progress Monitor</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Track progress against programme &middot; {checkpoints.length} checkpoint{checkpoints.length !== 1 ? 's' : ''}
              {projectName && <span className="text-blue-400 ml-1">&mdash; {projectName}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleImportCSV}
              className="hidden"
            />
            <button
              onClick={() => csvInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <UploadIcon /> Import CSV
            </button>
            <button
              onClick={handleExportCSV}
              disabled={checkpoints.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                checkpoints.length > 0
                  ? 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <DownloadIcon /> CSV
            </button>
            <button
              onClick={handleExportReport}
              disabled={checkpoints.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                checkpoints.length > 0
                  ? 'bg-blue-600/20 border-blue-600/40 text-blue-400 hover:bg-blue-600/30'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
              }`}
            >
              <FileTextIcon /> Report
            </button>
            <button
              onClick={handleLoadDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 border border-zinc-600 text-zinc-200 rounded-lg text-xs font-medium hover:bg-zinc-600 transition-colors"
            >
              <FlaskIcon /> Demo Data
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-zinc-900 rounded-lg border border-zinc-700 p-1">
        {([
          { id: 'dashboard' as TabId, label: 'Dashboard' },
          { id: 'checkpoints' as TabId, label: `Checkpoints (${checkpoints.length})` },
          { id: 'add' as TabId, label: '+ Add Checkpoint' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <DashboardView
          summary={summary}
          chart={chart}
          statusDistribution={statusDistribution}
          checkpoints={checkpoints}
          onSelectCheckpoint={(cp) => {
            setActiveTab('checkpoints')
            setTimeout(() => {
              const el = document.getElementById(`cp-${cp.id}`)
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 100)
          }}
        />
      )}

      {/* Checkpoints Tab */}
      {activeTab === 'checkpoints' && (
        <CheckpointListView
          checkpoints={checkpoints}
          onStatusTransition={handleStatusTransition}
          onAddPhoto={handleAddPhoto}
          onRemovePhoto={handleRemovePhoto}
          onDelete={handleDeleteCheckpoint}
          onUpdate={handleUpdateCheckpoint}
        />
      )}

      {/* Add Checkpoint Tab */}
      {activeTab === 'add' && (
        <AddCheckpointForm onSubmit={handleAddCheckpoint} />
      )}
    </div>
  )
}

// Ref for CSV import
const csvInputRef = React.createRef<HTMLInputElement>()

// ─── ICONS (inline SVG) ────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  )
}

function FileTextIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function FlaskIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  )
}

// ─── DASHBOARD VIEW ────────────────────────────────────────────────────────────

function DashboardView({
  summary,
  chart,
  statusDistribution,
  checkpoints,
  onSelectCheckpoint,
}: {
  summary: ProgressSummary
  chart: ProgressChart
  statusDistribution: Record<string, number>
  checkpoints: InspectionCheckpoint[]
  onSelectCheckpoint: (cp: InspectionCheckpoint) => void
}) {
  const isEmpty = summary.totalCheckpoints === 0

  if (isEmpty) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-12 text-center">
        <div className="text-zinc-500 text-4xl mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h4 className="text-lg font-medium text-zinc-300 mb-2">No Progress Data</h4>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          Add checkpoints or load demo data to see the progress dashboard with S-curve charts, status summaries, and critical item tracking.
        </p>
      </div>
    )
  }

  const varianceColor = summary.variance >= 0 ? 'text-green-400' : 'text-red-400'
  const varianceBg = summary.variance >= 0 ? 'border-green-500/40 bg-green-900/20' : 'border-red-500/40 bg-red-900/20'
  const varianceLabel = summary.variance >= 0 ? 'Ahead' : 'Behind'

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Progress - Circular */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3">Overall Progress</div>
          <div className="flex items-center justify-center">
            <CircularProgress value={summary.overallProgress} size={100} strokeWidth={8} color="#3b82f6" />
          </div>
          <div className="text-center mt-2 text-xs text-zinc-500">{summary.completedCheckpoints} of {summary.totalCheckpoints} checkpoints</div>
        </div>

        {/* Planned Progress - Circular */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3">Planned Progress</div>
          <div className="flex items-center justify-center">
            <CircularProgress value={summary.plannedProgress} size={100} strokeWidth={8} color="#a1a1aa" />
          </div>
          <div className="text-center mt-2 text-xs text-zinc-500">Should be done by now</div>
        </div>

        {/* Variance */}
        <div className={`bg-zinc-900 rounded-xl border-2 p-4 ${varianceBg}`}>
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3">Schedule Variance</div>
          <div className="text-center mt-2">
            <div className={`text-4xl font-bold font-mono ${varianceColor}`}>
              {summary.variance > 0 ? '+' : ''}{summary.variance}%
            </div>
            <div className={`text-sm font-medium mt-1 ${varianceColor}`}>{varianceLabel} of Schedule</div>
          </div>
          <div className="text-center mt-3 text-xs text-zinc-500">Est. completion: {summary.estimatedCompletion}</div>
        </div>

        {/* Critical Items */}
        <div className={`bg-zinc-900 rounded-xl border p-4 ${summary.criticalItems.length > 0 ? 'border-amber-500/40' : 'border-zinc-700'}`}>
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-3">Critical Items</div>
          <div className="text-center mt-2">
            <div className={`text-4xl font-bold font-mono ${summary.criticalItems.length > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {summary.criticalItems.length}
            </div>
            <div className={`text-sm font-medium mt-1 ${summary.criticalItems.length > 0 ? 'text-amber-400' : 'text-green-400'}`}>
              {summary.criticalItems.length > 0 ? 'Need Attention' : 'All Clear'}
            </div>
          </div>
          <div className="text-center mt-3 text-xs text-zinc-500">{summary.delayedCheckpoints} delayed &middot; {checkpoints.filter(c => c.status === 'rejected').length} rejected</div>
        </div>
      </div>

      {/* S-Curve Chart */}
      {chart.dates.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
          <h4 className="font-medium text-white mb-4">S-Curve Progress Chart</h4>
          <SCurveChart chart={chart} />
        </div>
      )}

      {/* Status Distribution + Critical Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
          <h4 className="font-medium text-white mb-4">Status Distribution</h4>
          <StatusDistributionBar distribution={statusDistribution} total={summary.totalCheckpoints} />
        </div>

        {/* Critical Items */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
          <h4 className="font-medium text-white mb-4">
            Critical Items
            {summary.criticalItems.length > 0 && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
                {summary.criticalItems.length}
              </span>
            )}
          </h4>
          {summary.criticalItems.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-sm">No critical items</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {summary.criticalItems.map(cp => (
                <button
                  key={cp.id}
                  onClick={() => onSelectCheckpoint(cp)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    cp.status === 'rejected'
                      ? 'bg-red-900/15 border-red-800/50 hover:bg-red-900/25'
                      : 'bg-amber-900/15 border-amber-800/50 hover:bg-amber-900/25'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-200 font-medium truncate mr-2">
                      {cp.chainage != null ? `Ch ${cp.chainage}+` : ''}{cp.gridRef ? `${cp.gridRef}` : ''} {cp.description}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
                      style={{ color: STATUS_CONFIG[cp.status].color, background: STATUS_CONFIG[cp.status].bg }}>
                      {STATUS_CONFIG[cp.status].label}
                    </span>
                  </div>
                  {cp.deviations && cp.deviations.length > 0 && (
                    <div className="text-xs text-zinc-400 mt-1 truncate">
                      {cp.deviations[0]}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      {summary.milestones.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
          <h4 className="font-medium text-white mb-4">Milestones</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.milestones.map((m, i) => (
              <div key={m.name} className="p-3 rounded-lg border border-zinc-800 bg-zinc-800/50">
                <div className="text-sm text-zinc-200 font-medium truncate">{m.name}</div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400">
                  <span>Plan: {m.planned}</span>
                  {m.actual && <span className="text-green-400">Actual: {m.actual}</span>}
                </div>
                <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ color: STATUS_CONFIG[m.status].color, background: STATUS_CONFIG[m.status].bg }}>
                  {STATUS_CONFIG[m.status].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CIRCULAR PROGRESS INDICATOR ────────────────────────────────────────────────

function CircularProgress({ value, size, strokeWidth, color }: { value: number; size: number; strokeWidth: number; color: string }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(value, 100) / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#27272a" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono font-bold"
        fill="white"
        fontSize={size * 0.22}
        transform={`rotate(90, ${size / 2}, ${size / 2})`}
      >
        {Math.round(value)}%
      </text>
    </svg>
  )
}

// ─── S-CURVE CHART ─────────────────────────────────────────────────────────────

function SCurveChart({ chart }: { chart: ProgressChart }) {
  const { dates, plannedProgress, actualProgress } = chart
  if (dates.length === 0) return null

  const width = 900
  const height = 320
  const margin = { top: 24, right: 24, bottom: 50, left: 50 }
  const plotW = width - margin.left - margin.right
  const plotH = height - margin.top - margin.bottom

  const scaleX = (i: number) => margin.left + (i / Math.max(dates.length - 1, 1)) * plotW
  const scaleY = (pct: number) => margin.top + plotH - (pct / 100) * plotH

  // Build paths
  const plannedPath = plannedProgress.map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(p)}`).join(' ')
  const actualPath = actualProgress.map((p, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(p)}`).join(' ')

  // Area between planned and actual
  let areaPath = ''
  for (let i = 0; i < dates.length; i++) {
    const x = scaleX(i)
    areaPath += `${i === 0 ? 'M' : 'L'}${x},${scaleY(plannedProgress[i])} `
  }
  for (let i = dates.length - 1; i >= 0; i--) {
    const x = scaleX(i)
    areaPath += `L${x},${scaleY(actualProgress[i])} `
  }
  areaPath += 'Z'

  // Today marker
  const today = new Date().toISOString().split('T')[0]
  const todayIndex = dates.findIndex(d => d >= today)
  const todayX = todayIndex >= 0 ? scaleX(todayIndex) : null

  // Tick labels (every N dates)
  const tickInterval = Math.max(1, Math.ceil(dates.length / 8))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(pct => (
        <g key={pct}>
          <line x1={margin.left} y1={scaleY(pct)} x2={width - margin.right} y2={scaleY(pct)} stroke="#27272a" strokeWidth={1} />
          <text x={margin.left - 8} y={scaleY(pct) + 4} textAnchor="end" fill="#71717a" fontSize="10" fontFamily="monospace">
            {pct}%
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="rgba(34,197,94,0.08)" />

      {/* Today marker */}
      {todayX !== null && (
        <line x1={todayX} y1={margin.top} x2={todayX} y2={margin.top + plotH} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6,3" />
      )}

      {/* Planned line (dashed) */}
      <path d={plannedPath} fill="none" stroke="#60a5fa" strokeWidth={2} strokeDasharray="8,4" />

      {/* Actual line (solid) */}
      <path d={actualPath} fill="none" stroke="#22c55e" strokeWidth={2.5} />

      {/* Data points */}
      {plannedProgress.map((p, i) => (
        <circle key={`p-${i}`} cx={scaleX(i)} cy={scaleY(p)} r={3} fill="#60a5fa" opacity={0.7} />
      ))}
      {actualProgress.map((p, i) => {
        if (p === 0 && i === 0) return null
        return <circle key={`a-${i}`} cx={scaleX(i)} cy={scaleY(p)} r={3.5} fill="#22c55e" />
      })}

      {/* X-axis labels */}
      {dates.map((d, i) => {
        if (i % tickInterval !== 0 && i !== dates.length - 1) return null
        const parts = d.split('-')
        const label = `${parts[1]}/${parts[0]?.slice(2)}`
        return (
          <text key={`${d}-${i}`} x={scaleX(i)} y={height - 10} textAnchor="middle" fill="#71717a" fontSize="10" fontFamily="monospace">
            {label}
          </text>
        )
      })}

      {/* Today label */}
      {todayX !== null && (
        <text x={todayX} y={margin.top - 6} textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="600">
          TODAY
        </text>
      )}

      {/* Legend */}
      <line x1={margin.left + 10} y1={14} x2={margin.left + 30} y2={14} stroke="#60a5fa" strokeWidth={2} strokeDasharray="6,3" />
      <text x={margin.left + 34} y={18} fill="#a1a1aa" fontSize="10">Planned</text>
      <line x1={margin.left + 100} y1={14} x2={margin.left + 120} y2={14} stroke="#22c55e" strokeWidth={2.5} />
      <text x={margin.left + 124} y={18} fill="#a1a1aa" fontSize="10">Actual</text>
      {todayX !== null && (
        <>
          <line x1={margin.left + 190} y1={14} x2={margin.left + 210} y2={14} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,2" />
          <text x={margin.left + 214} y={18} fill="#a1a1aa" fontSize="10">Today</text>
        </>
      )}
    </svg>
  )
}

// ─── STATUS DISTRIBUTION BAR ───────────────────────────────────────────────────

function StatusDistributionBar({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  if (total === 0) return null

  const segments: Array<{ key: string; count: number; color: string; label: string }> = [
    { key: 'approved', count: distribution['approved'] || 0, color: '#16a34a', label: 'Approved' },
    { key: 'completed', count: distribution['completed'] || 0, color: '#22c55e', label: 'Completed' },
    { key: 'inspected', count: distribution['inspected'] || 0, color: '#06b6d4', label: 'Inspected' },
    { key: 'in_progress', count: distribution['in_progress'] || 0, color: '#3b82f6', label: 'In Progress' },
    { key: 'pending', count: distribution['pending'] || 0, color: '#71717a', label: 'Pending' },
    { key: 'delayed', count: distribution['delayed'] || 0, color: '#f59e0b', label: 'Delayed' },
    { key: 'rejected', count: distribution['rejected'] || 0, color: '#ef4444', label: 'Rejected' },
  ].filter(s => s.count > 0)

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="h-8 rounded-lg overflow-hidden flex bg-zinc-800">
        {segments.map(seg => (
          <div
            key={seg.key}
            className="h-full flex items-center justify-center transition-all"
            style={{
              width: `${(seg.count / total) * 100}%`,
              backgroundColor: seg.color,
              minWidth: seg.count > 0 ? '2px' : '0',
            }}
            title={`${seg.label}: ${seg.count}`}
          >
            {(seg.count / total) > 0.1 && (
              <span className="text-xs font-bold text-white drop-shadow">{seg.count}</span>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map(seg => (
          <div key={seg.key} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span>{seg.label}</span>
            <span className="font-mono font-medium text-zinc-300">({seg.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CHECKPOINT LIST VIEW ──────────────────────────────────────────────────────

function CheckpointListView({
  checkpoints,
  onStatusTransition,
  onAddPhoto,
  onRemovePhoto,
  onDelete,
  onUpdate,
}: {
  checkpoints: InspectionCheckpoint[]
  onStatusTransition: (id: string, status: InspectionCheckpoint['status']) => void
  onAddPhoto: (id: string, url: string) => void
  onRemovePhoto: (id: string, index: number) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, updates: Partial<InspectionCheckpoint>) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [photoInputId, setPhotoInputId] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [deviationInput, setDeviationInput] = useState<Record<string, string>>({})
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  if (checkpoints.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-12 text-center">
        <p className="text-zinc-500">No checkpoints yet. Add your first checkpoint or import from CSV.</p>
      </div>
    )
  }

  const getNextStatus = (current: InspectionCheckpoint['status']): InspectionCheckpoint['status'] | null => {
    const flow: Record<string, InspectionCheckpoint['status'] | null> = {
      pending: 'in_progress',
      in_progress: 'completed',
      completed: 'inspected',
      inspected: 'approved',
      approved: null,
      delayed: 'in_progress',
      rejected: 'in_progress',
    }
    return flow[current]
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 px-4 py-3 flex items-center justify-between">
        <h4 className="font-medium text-white">Checkpoint Register</h4>
        <span className="text-xs text-zinc-400 font-mono">{checkpoints.length} rows</span>
      </div>

      {/* Checkpoint rows */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {checkpoints.map(cp => {
          const isExpanded = expandedId === cp.id
          const isCritical = cp.status === 'delayed' || cp.status === 'rejected'
          const nextStatus = getNextStatus(cp.status)

          return (
            <div
              key={cp.id}
              id={`cp-${cp.id}`}
              className={`rounded-xl border transition-colors ${
                isCritical
                  ? 'border-amber-700/50 bg-amber-900/5'
                  : 'border-zinc-700 bg-zinc-900'
              }`}
            >
              {/* Main row */}
              <div
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-zinc-800/50 rounded-t-xl"
                onClick={() => setExpandedId(isExpanded ? null : cp.id!)}
              >
                {/* Ref */}
                <div className="w-20 flex-shrink-0">
                  <span className="text-xs font-mono text-zinc-400">
                    {cp.chainage != null ? `Ch ${cp.chainage}` : ''}
                    {cp.gridRef ? `${cp.chainage != null ? ' · ' : ''}${cp.gridRef}` : ''}
                  </span>
                </div>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 font-medium truncate">{cp.description}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{ color: CATEGORY_COLORS[cp.category], background: `${CATEGORY_COLORS[cp.category]}15` }}>
                      {CATEGORY_LABELS[cp.category]}
                    </span>
                    <span className="text-xs text-zinc-500">{cp.plannedDate}</span>
                    <span className="text-xs font-mono text-zinc-400">{cp.plannedPercentage}%</span>
                  </div>
                </div>

                {/* Status badge */}
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap flex-shrink-0"
                  style={{ color: STATUS_CONFIG[cp.status].color, background: STATUS_CONFIG[cp.status].bg }}>
                  {STATUS_CONFIG[cp.status].label}
                </span>

                {/* Expand chevron */}
                <svg className={`w-4 h-4 text-zinc-500 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-zinc-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    {/* Details */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-500">Planned Date</span>
                          <div className="font-mono text-zinc-300">{cp.plannedDate}</div>
                        </div>
                        <div>
                          <span className="text-zinc-500">Planned %</span>
                          <div className="font-mono text-zinc-300">{cp.plannedPercentage}%</div>
                        </div>
                        <div>
                          <span className="text-zinc-500">Actual Date</span>
                          <div className="font-mono text-zinc-300">{cp.actualDate || '—'}</div>
                        </div>
                        <div>
                          <span className="text-zinc-500">Actual %</span>
                          <div className="font-mono text-zinc-300">{cp.actualPercentage != null ? `${cp.actualPercentage}%` : '—'}</div>
                        </div>
                        {cp.inspectedBy && (
                          <div>
                            <span className="text-zinc-500">Inspected By</span>
                            <div className="text-zinc-300">{cp.inspectedBy}</div>
                          </div>
                        )}
                        {cp.approvedBy && (
                          <div>
                            <span className="text-zinc-500">Approved By</span>
                            <div className="text-zinc-300">{cp.approvedBy}</div>
                          </div>
                        )}
                      </div>

                      {/* Notes */}
                      {cp.notes && (
                        <div>
                          <span className="text-xs text-zinc-500">Notes</span>
                          <div className="text-xs text-zinc-300 mt-0.5 bg-zinc-800/50 rounded p-2">{cp.notes}</div>
                        </div>
                      )}

                      {/* Deviations (for rejected/delayed) */}
                      {isCritical && (
                        <div>
                          <span className="text-xs text-amber-400 font-medium">Deviations</span>
                          {cp.deviations && cp.deviations.length > 0 ? (
                            <ul className="text-xs text-zinc-300 mt-0.5 space-y-0.5">
                              {cp.deviations.map((d, di) => <li key={di} className="flex items-start gap-1"><span className="text-amber-500">•</span> {d}</li>)}
                            </ul>
                          ) : (
                            <div className="text-xs text-zinc-500 mt-0.5">No deviations recorded</div>
                          )}
                          {/* Add deviation input */}
                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              value={deviationInput[cp.id!] || ''}
                              onChange={e => setDeviationInput(prev => ({ ...prev, [cp.id!]: e.target.value }))}
                              aria-label="Add deviation note..."
                              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600"
                              onKeyDown={e => {
                                if (e.key === 'Enter' && deviationInput[cp.id!]?.trim()) {
                                  onUpdate(cp.id!, {
                                    deviations: [...(cp.deviations || []), deviationInput[cp.id!].trim()],
                                  })
                                  setDeviationInput(prev => ({ ...prev, [cp.id!]: '' }))
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                if (deviationInput[cp.id!]?.trim()) {
                                  onUpdate(cp.id!, {
                                    deviations: [...(cp.deviations || []), deviationInput[cp.id!].trim()],
                                  })
                                  setDeviationInput(prev => ({ ...prev, [cp.id!]: '' }))
                                }
                              }}
                              className="px-2 py-1 bg-amber-600/20 border border-amber-700/40 text-amber-400 rounded text-xs hover:bg-amber-600/30 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions & Photos */}
                    <div className="space-y-3">
                      {/* Workflow buttons */}
                      <div>
                        <span className="text-xs text-zinc-500 block mb-1.5">Status Workflow</span>
                        <div className="flex flex-wrap gap-1.5">
                          {nextStatus && (
                            <button
                              onClick={() => onStatusTransition(cp.id!, nextStatus)}
                              className="px-3 py-1.5 bg-blue-600/20 border border-blue-600/40 text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-600/30 transition-colors"
                            >
                              → {STATUS_CONFIG[nextStatus].label}
                            </button>
                          )}
                          {cp.status !== 'rejected' && (
                            <button
                              onClick={() => onStatusTransition(cp.id!, 'rejected')}
                              className="px-3 py-1.5 bg-red-600/20 border border-red-600/40 text-red-400 rounded-lg text-xs font-medium hover:bg-red-600/30 transition-colors"
                            >
                              Reject
                            </button>
                          )}
                          {cp.status !== 'delayed' && cp.status !== 'pending' && (
                            <button
                              onClick={() => onStatusTransition(cp.id!, 'delayed')}
                              className="px-3 py-1.5 bg-amber-600/20 border border-amber-600/40 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-600/30 transition-colors"
                            >
                              Mark Delayed
                            </button>
                          )}
                          <button
                            onClick={() => onDelete(cp.id!)}
                            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg text-xs font-medium hover:bg-red-900/30 hover:text-red-400 hover:border-red-800/40 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Photos */}
                      <div>
                        <span className="text-xs text-zinc-500 block mb-1.5">
                          Photos ({cp.photos?.length || 0})
                        </span>
                        {cp.photos && cp.photos.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {cp.photos.map((photo, pi) => (
                              <div key={pi} className="flex items-center gap-2 bg-zinc-800/50 rounded px-2 py-1">
                                <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-xs text-zinc-300 truncate flex-1">{photo}</span>
                                <button
                                  onClick={() => onRemovePhoto(cp.id!, pi)}
                                  className="text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {photoInputId === cp.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              ref={el => { photoInputRefs.current[cp.id!] = el }}
                              value={photoUrl}
                              onChange={e => setPhotoUrl(e.target.value)}
                              aria-label="Photo URL or filename..."
                              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600"
                              onKeyDown={e => {
                                if (e.key === 'Enter' && photoUrl.trim()) {
                                  onAddPhoto(cp.id!, photoUrl.trim())
                                  setPhotoUrl('')
                                  setPhotoInputId(null)
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                if (photoUrl.trim()) {
                                  onAddPhoto(cp.id!, photoUrl.trim())
                                  setPhotoUrl('')
                                  setPhotoInputId(null)
                                }
                              }}
                              className="px-2 py-1 bg-blue-600/20 border border-blue-600/40 text-blue-400 rounded text-xs hover:bg-blue-600/30 transition-colors"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => { setPhotoInputId(null); setPhotoUrl('') }}
                              className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded text-xs hover:bg-zinc-700 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPhotoInputId(cp.id!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded text-xs hover:bg-zinc-700 hover:text-white transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add Photo
                          </button>
                        )}
                      </div>

                      {/* Set actual % */}
                      <div>
                        <span className="text-xs text-zinc-500 block mb-1">Set Actual Completion %</span>
                        <input aria-label="Set Actual Completion %"
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={cp.actualPercentage ?? 0}
                          onChange={e => {
                            const val = parseInt(e.target.value)
                            onUpdate(cp.id!, { actualPercentage: val })
                          }}
                          className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-zinc-500 mt-0.5">
                          <span>0%</span>
                          <span className="font-mono font-bold text-blue-400">{cp.actualPercentage ?? 0}%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ADD CHECKPOINT FORM ───────────────────────────────────────────────────────

function AddCheckpointForm({
  onSubmit,
}: {
  onSubmit: (cp: Omit<InspectionCheckpoint, 'id' | 'projectId' | 'timestamp' | 'status'> & { status?: InspectionCheckpoint['status'] }) => void
}) {
  const [form, setForm] = useState({
    chainage: '',
    gridRef: '',
    description: '',
    category: 'earthworks' as InspectionCheckpoint['category'],
    plannedDate: new Date().toISOString().split('T')[0],
    plannedPercentage: 10,
    notes: '',
  })
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!form.description.trim()) {
      setError('Description is required')
      return
    }
    if (!form.plannedDate) {
      setError('Planned date is required')
      return
    }
    setError(null)

    onSubmit({
      chainage: form.chainage ? parseFloat(form.chainage) : undefined,
      gridRef: form.gridRef || undefined,
      description: form.description.trim(),
      category: form.category,
      plannedDate: form.plannedDate,
      plannedPercentage: form.plannedPercentage,
      notes: form.notes || undefined,
    })

    // Reset form
    setForm(prev => ({
      ...prev,
      chainage: '',
      gridRef: '',
      description: '',
      notes: '',
    }))
  }

  const categories: Array<{ key: InspectionCheckpoint['category']; label: string }> = [
    { key: 'earthworks', label: 'Earthworks' },
    { key: 'drainage', label: 'Drainage' },
    { key: 'pavement', label: 'Pavement' },
    { key: 'structure', label: 'Structure' },
    { key: 'utilities', label: 'Utilities' },
    { key: 'finishing', label: 'Finishing' },
    { key: 'other', label: 'Other' },
  ]

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
      <h4 className="font-medium text-white mb-4">Add New Checkpoint</h4>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Chainage */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1" htmlFor="chainage-m">Chainage (m)</label>
          <input id="chainage-m"
            type="number"
            step="1"
            value={form.chainage}
            onChange={e => setForm(prev => ({ ...prev, chainage: e.target.value }))}
 placeholder="e.g. 200"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-zinc-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Grid Reference */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1" htmlFor="grid-reference">Grid Reference</label>
          <input id="grid-reference"
            type="text"
            value={form.gridRef}
            onChange={e => setForm(prev => ({ ...prev, gridRef: e.target.value }))}
 placeholder="e.g. A3, B7"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-zinc-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1" htmlFor="category">Category</label>
          <select id="category"
            value={form.category}
            onChange={e => setForm(prev => ({ ...prev, category: e.target.value as InspectionCheckpoint['category'] }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {categories.map(cat => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="md:col-span-2 lg:col-span-2">
          <label className="block text-xs text-zinc-400 mb-1" htmlFor="description">Description *</label>
          <input id="description"
            type="text"
            value={form.description}
            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
 placeholder="e.g. Column A3 concrete pour, Road at Ch 0+200 base course"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Planned Date */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1" htmlFor="planned-date">Planned Date</label>
          <input id="planned-date" aria-label="Planneddate"
            type="date"
            value={form.plannedDate}
            onChange={e => setForm(prev => ({ ...prev, plannedDate: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Planned % */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1" htmlFor="planned-completion">Planned Completion %</label>
          <input id="planned-completion" aria-label="Plannedpercentage"
            type="number"
            min={0}
            max={100}
            step={1}
            value={form.plannedPercentage}
            onChange={e => setForm(prev => ({ ...prev, plannedPercentage: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Notes */}
        <div className="md:col-span-2 lg:col-span-3">
          <label className="block text-xs text-zinc-400 mb-1" htmlFor="notes">Notes</label>
          <textarea
             id="notes" value={form.notes}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Optional notes..."
            rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={handleSubmit}
          className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Checkpoint
        </button>
      </div>
    </div>
  )
}
