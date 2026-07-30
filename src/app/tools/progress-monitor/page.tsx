'use client';

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, BarChart3, Clock, CheckCircle2, AlertTriangle, PlayCircle } from 'lucide-react'
import ProgressMonitorPanel from '@/components/engineering/ProgressMonitorPanel'
import { generatePDF, downloadCSV, toCSV } from '@/lib/export/helpers'
import { useLanguage } from '@/lib/i18n/LanguageContext'

// ── Project Phases for Survey Workflow ──────────────────────────────────────

interface PhaseProgress {
  id: string
  name: string
  progress: number
  status: 'completed' | 'in_progress' | 'pending' | 'delayed'
  startDate: string
  endDate: string
  description: string
  tasks: { name: string; done: boolean }[]
}

const DEMO_PHASES: PhaseProgress[] = [
  {
    id: 'fieldwork',
    name: 'Fieldwork',
    progress: 85,
    status: 'in_progress',
    startDate: '2025-01-15',
    endDate: '2025-02-28',
    description: 'Field data collection — control survey, detail pickup, leveling, GNSS observations',
    tasks: [
      { name: 'Reconnaissance & site visit', done: true },
      { name: 'Control traverse observation', done: true },
      { name: 'GNSS base station setup', done: true },
      { name: 'Detail pickup (topographic)', done: true },
      { name: 'Leveling run (BM connections)', done: false },
      { name: 'Beacon setting & descriptions', done: false },
    ],
  },
  {
    id: 'computation',
    name: 'Computation',
    progress: 50,
    status: 'in_progress',
    startDate: '2025-02-15',
    endDate: '2025-03-15',
    description: 'Data processing — traverse adjustment, coordinate computation, area calculation',
    tasks: [
      { name: 'Traverse adjustment (Bowditch)', done: true },
      { name: 'Coordinate computation', done: true },
      { name: 'Area computation (shoelace)', done: false },
      { name: 'Leveling reduction & adjustment', done: false },
      { name: 'GNSS baseline processing', done: false },
      { name: 'Quality assurance checks', done: false },
    ],
  },
  {
    id: 'mapping',
    name: 'Mapping & Drafting',
    progress: 15,
    status: 'in_progress',
    startDate: '2025-03-01',
    endDate: '2025-04-01',
    description: 'Plan preparation — deed plan, mutation, working diagram, cross-sections',
    tasks: [
      { name: 'Working diagram preparation', done: false },
      { name: 'Deed plan drafting', done: false },
      { name: 'Cross-section drawings', done: false },
      { name: 'Longitudinal section', done: false },
      { name: 'Final plan compilation', done: false },
      { name: 'Plan checking & QA', done: false },
    ],
  },
  {
    id: 'submission',
    name: 'Submission & Review',
    progress: 0,
    status: 'pending',
    startDate: '2025-04-01',
    endDate: '2025-05-01',
    description: 'Document submission — statutory workbook, certification, DoLS submission',
    tasks: [
      { name: 'Statutory workbook compilation', done: false },
      { name: "Surveyor's certificate signing", done: false },
      { name: 'Director of Surveys submission', done: false },
      { name: 'Peer review & sign-off', done: false },
      { name: 'Client delivery & handover', done: false },
    ],
  },
]

// ── Timeline events ────────────────────────────────────────────────────────

interface TimelineEvent {
  date: string
  phase: string
  event: string
  type: 'milestone' | 'task' | 'issue'
}

const DEMO_TIMELINE: TimelineEvent[] = [
  { date: '2025-01-15', phase: 'Fieldwork', event: 'Project kickoff — site reconnaissance completed', type: 'milestone' },
  { date: '2025-01-20', phase: 'Fieldwork', event: 'Control traverse observed — 8 stations', type: 'task' },
  { date: '2025-01-25', phase: 'Fieldwork', event: 'GNSS base station set up on KenCORS', type: 'task' },
  { date: '2025-02-01', phase: 'Fieldwork', event: 'Detail pickup completed — 142 points', type: 'task' },
  { date: '2025-02-05', phase: 'Fieldwork', event: 'Weather delay — 3 days lost to rain', type: 'issue' },
  { date: '2025-02-15', phase: 'Computation', event: 'Traverse adjustment completed — precision 1:30,402', type: 'milestone' },
  { date: '2025-02-20', phase: 'Computation', event: 'Coordinates computed for all control points', type: 'task' },
  { date: '2025-03-01', phase: 'Mapping', event: 'Working diagram draft started', type: 'task' },
]

const STATUS_CONFIG: Record<PhaseProgress['status'], { icon: React.ReactNode; color: string; label: string }> = {
  completed: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-400', label: 'Completed' },
  in_progress: { icon: <PlayCircle className="w-4 h-4" />, color: 'text-amber-400', label: 'In Progress' },
  pending: { icon: <Clock className="w-4 h-4" />, color: 'text-gray-400', label: 'Pending' },
  delayed: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-400', label: 'Delayed' },
}

function ProgressMonitorPage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState<'overview' | 'inspections'>('overview')
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') || undefined

  // If project is linked, don't show demo data — let ProgressMonitorPanel load real data
  const phases = projectId ? [] : DEMO_PHASES
  const timeline = projectId ? [] : DEMO_TIMELINE

  const overallProgress = useMemo(() => {
    const total = phases.reduce((sum, p) => sum + p.progress, 0)
    return Math.round(total / phases.length)
  }, [phases])

  const completedTasks = useMemo(() => {
    return phases.reduce((sum, p) => sum + p.tasks.filter(t => t.done).length, 0)
  }, [phases])

  const totalTasks = useMemo(() => {
    return phases.reduce((sum, p) => sum + p.tasks.length, 0)
  }, [phases])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('tools.progressMonitor')}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('tools.progressMonitorDesc')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              generatePDF(
                { title: 'Project Progress Report', reference: 'KENHA Supervision Manual | RDM 1.3 §10' },
                [
                  { title: 'Overall Summary', rows: [
                    { label: 'Overall Progress', value: `${overallProgress}%` },
                    { label: 'Tasks Completed', value: `${completedTasks} / ${totalTasks}` },
                    { label: 'Phases In Progress', value: String(phases.filter(p => p.status === 'in_progress').length) },
                    { label: 'Phases Completed', value: String(phases.filter(p => p.status === 'completed').length) },
                  ]},
                  ...phases.map(p => ({
                    title: `${p.name} — ${p.progress}%`,
                    rows: p.tasks.map(t => ({ label: t.name, value: t.done ? ' Done' : 'Pending' })),
                  })),
                ],
              )
            }}
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button
            onClick={() => {
              const csv = toCSV(
                ['Phase', 'Progress %', 'Status', 'Start Date', 'End Date', 'Task', 'Task Status'],
                phases.flatMap(p =>
                  p.tasks.map(t => [p.name, String(p.progress), p.status, p.startDate, p.endDate, t.name, t.done ? 'Done' : 'Pending']),
                ),
              )
              downloadCSV(csv, 'progress-report')
            }}
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
        </div>
      </div>

      {/* ── OVERALL PROGRESS BAR ─────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Overall Progress</span>
          <span className="text-2xl font-bold font-mono text-[var(--accent)]">{overallProgress}%</span>
        </div>
        <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-4 overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-[var(--text-muted)]">
          <span>{completedTasks} of {totalTasks} tasks completed</span>
          <span>{phases.filter(p => p.status === 'in_progress').length} phases in progress</span>
        </div>
      </div>

      {/* ── TAB BAR ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[var(--border-color)]">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)]'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-1.5" />Phase Overview
        </button>
        <button
          onClick={() => setActiveTab('inspections')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'inspections'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 inline mr-1.5" />Inspection Checkpoints
        </button>
      </div>

      {/* ── PHASE OVERVIEW TAB ───────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Phase cards */}
          <div className="space-y-4">
            {phases.map(phase => {
              const config = STATUS_CONFIG[phase.status]
              const doneCount = phase.tasks.filter(t => t.done).length
              return (
                <div key={phase.id} className="card overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1.5 text-xs font-semibold ${config.color}`}>
                          {config.icon} {config.label}
                        </span>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{phase.name}</h3>
                      </div>
                      <span className="text-lg font-bold font-mono text-[var(--accent)]">{phase.progress}%</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2.5 mb-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          phase.status === 'completed' ? 'bg-emerald-500' :
                          phase.status === 'delayed' ? 'bg-red-500' : 'bg-[var(--accent)]'
                        }`}
                        style={{ width: `${phase.progress}%` }}
                      />
                    </div>

                    <p className="text-xs text-[var(--text-muted)] mb-2">{phase.description}</p>

                    <div className="flex justify-between text-xs text-[var(--text-muted)] mb-3">
                      <span>{phase.startDate} → {phase.endDate}</span>
                      <span>{doneCount}/{phase.tasks.length} tasks</span>
                    </div>

                    {/* Task checklist */}
                    <div className="space-y-1">
                      {phase.tasks.map((task, i) => (
                        <div key={`${task}-${i}`} className="flex items-center gap-2 text-xs">
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            task.done
                              ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400'
                              : 'border-[var(--border-color)] text-[var(--text-muted)]'
                          }`}>
                            {task.done && ''}
                          </span>
                          <span className={task.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-secondary)]'}>
                            {task.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Timeline */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Project Timeline</h3>
            <div className="space-y-0">
              {timeline.map((event, i) => (
                <div key={`${event}-${i}`} className="flex gap-3 relative">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${
                      event.type === 'milestone' ? 'bg-[var(--accent)]' :
                      event.type === 'issue' ? 'bg-red-500' : 'bg-[var(--text-muted)]'
                    }`} />
                    {i < timeline.length - 1 && (
                      <div className="w-0.5 flex-1 bg-[var(--border-color)]" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-[var(--text-muted)]">{event.date}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">{event.phase}</span>
                    </div>
                    <p className="text-sm text-[var(--text-primary)]">{event.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── INSPECTIONS TAB (delegate to existing panel) ──────────────────────── */}
      {activeTab === 'inspections' && (
        <ProgressMonitorPanel projectId={projectId || ''} />
      )}
    </div>
  )
}

// P0-2 (2026-07-24): Wrap in <ToolGate> so direct-URL access can't
// bypass the plan check. The catalog page (/tools) shows lock badges,
// but those are display-only — this gate enforces the same check at
// the page level. Server-side enforcement for any export API this
// tool calls happens via the requirePlan() decorator on the route.
import { ToolGate } from '@/components/shared/ToolGate'

export default function ProgressMonitorPageGated() {
  return (
    <ToolGate toolPath="/tools/progress-monitor">
      <ProgressMonitorPage />
    </ToolGate>
  )
}
