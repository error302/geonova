'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  Upload, Cloud, Loader2, CheckCircle2, XCircle, Download,
  Map as MapIcon, Box, Mountain, FileCode, ChevronRight, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'

// ─── Types ──────────────────────────────────────────────────────────────────

type TaskStatus = 'uploading' | 'queued' | 'running' | 'completed' | 'failed' | 'imported'

interface DroneTask {
  id: string
  name: string
  photo_count: number
  total_size_mb: number
  status: TaskStatus
  progress: number
  error_message?: string
  orthophoto_path?: string
  pointcloud_path?: string
  dsm_path?: string
  dtm_path?: string
  contour_path?: string
  created_at: string
  processing_completed_at?: string
}

// ─── Upload Section ─────────────────────────────────────────────────────────

function UploadSection({ onTaskCreated }: { onTaskCreated: (taskId: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [taskName, setTaskName] = useState(`Drone Survey ${new Date().toLocaleDateString()}`)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
    setError(null)
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Select at least one photo')
      return
    }

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('name', taskName)
      selectedFiles.forEach(f => formData.append('photos', f))

      // Simulate progress while uploading (we can't get real progress from fetch)
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 5, 90))
      }, 500)

      const res = await fetch('/api/drone/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Upload failed (${res.status})`)
      }

      const data = await res.json()
      onTaskCreated(data.taskId)
      setSelectedFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setTimeout(() => setProgress(0), 1000)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
      <div className="flex items-center gap-3 mb-4">
        <Upload className="w-5 h-5 text-[var(--accent)]" />
        <h2 className="text-lg font-bold text-[var(--text-primary)]">1. Upload Drone Photos</h2>
      </div>

      <div className="space-y-4">
        {/* Task name */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">Survey Name</label>
          <input
            type="text"
            value={taskName}
            onChange={e => setTaskName(e.target.value)}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] outline-none"
          />
        </div>

        {/* File input */}
        <div>
          <label className="block text-sm text-[var(--text-muted)] mb-2">Photos (JPG, PNG, or TIFF — max 25MB each, max 200 photos)</label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--accent)] transition-colors"
          >
            <Upload className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">
              {selectedFiles.length > 0
                ? `${selectedFiles.length} photo${selectedFiles.length !== 1 ? 's' : ''} selected (${Math.round(selectedFiles.reduce((s, f) => s + f.size, 0) / 1024 / 1024)}MB)`
                : 'Click to select photos'}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.tif,.tiff"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Selected files list */}
        {selectedFiles.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-1">
            {selectedFiles.slice(0, 5).map((f, i) => (
              <div key={i} className="text-xs text-[var(--text-muted)] flex justify-between">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 ml-2">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
              </div>
            ))}
            {selectedFiles.length > 5 && (
              <p className="text-xs text-[var(--text-muted)]">...and {selectedFiles.length - 5} more</p>
            )}
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
              <span>Uploading {selectedFiles.length} photos...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">{error}</p>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || selectedFiles.length === 0}
          className="w-full py-2.5 bg-[var(--accent)] text-black font-semibold rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-40 transition-colors text-sm flex items-center justify-center gap-2"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Photo${selectedFiles.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}

// ─── Processing Section ─────────────────────────────────────────────────────

function ProcessingSection({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<DroneTask | null>(null)
  const [processing, setProcessing] = useState(false)
  const [options, setOptions] = useState({
    demResolution: 5,
    orthophotoResolution: 5,
    dsm: true,
    dtm: true,
    contourResolution: 0.5,
  })

  const fetchTask = useCallback(async () => {
    const res = await fetch(`/api/drone/process?taskId=${taskId}`)
    if (res.ok) {
      const data = await res.json()
      setTask(data.task)
    }
  }, [taskId])

  useEffect(() => {
    fetchTask()

    // Poll every 5 seconds if task is running
    const interval = setInterval(() => {
      if (task && (task.status === 'queued' || task.status === 'running')) {
        fetchTask()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchTask, task?.status])

  const startProcessing = async () => {
    setProcessing(true)
    try {
      const res = await fetch('/api/drone/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, ...options }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start processing')
      }

      await fetchTask()
    } catch (err) {
      console.error(err)
    } finally {
      setProcessing(false)
    }
  }

  if (!task) return <div className="animate-pulse">Loading task...</div>

  const isProcessing = task.status === 'queued' || task.status === 'running'
  const isCompleted = task.status === 'completed'
  const isFailed = task.status === 'failed'

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
      <div className="flex items-center gap-3 mb-4">
        <Cloud className="w-5 h-5 text-[var(--accent)]" />
        <h2 className="text-lg font-bold text-[var(--text-primary)]">2. Process Photos</h2>
      </div>

      {/* Task summary */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-2">
          <p className="text-lg font-bold text-[var(--text-primary)]">{task.photo_count}</p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Photos</p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-2">
          <p className="text-lg font-bold text-[var(--text-primary)]">{Math.round(task.total_size_mb)}</p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase">MB</p>
        </div>
        <div className="bg-[var(--bg-tertiary)] rounded-lg p-2">
          <p className="text-lg font-bold capitalize" style={{
            color: isCompleted ? '#34d399' : isFailed ? '#ef4444' : isProcessing ? '#f59e0b' : 'var(--text-primary)'
          }}>
            {task.status}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase">Status</p>
        </div>
      </div>

      {/* Processing options (only show before processing starts) */}
      {!isProcessing && !isCompleted && (
        <div className="space-y-3 mb-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Processing Options</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-[var(--text-muted)]">
              Orthophoto Resolution (cm/px)
              <input
                type="number"
                value={options.orthophotoResolution}
                onChange={e => setOptions(o => ({ ...o, orthophotoResolution: +e.target.value }))}
                className="w-full mt-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)]"
                min={1}
                max={50}
              />
            </label>
            <label className="text-xs text-[var(--text-muted)]">
              DSM Resolution (cm/px)
              <input
                type="number"
                value={options.demResolution}
                onChange={e => setOptions(o => ({ ...o, demResolution: +e.target.value }))}
                className="w-full mt-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)]"
                min={1}
                max={50}
              />
            </label>
            <label className="text-xs text-[var(--text-muted)]">
              Contour Interval (m)
              <input
                type="number"
                step="0.1"
                value={options.contourResolution}
                onChange={e => setOptions(o => ({ ...o, contourResolution: +e.target.value }))}
                className="w-full mt-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1.5 text-[var(--text-primary)]"
                min={0.1}
                max={10}
              />
            </label>
            <div className="flex items-center gap-3 pt-4">
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.dsm}
                  onChange={e => setOptions(o => ({ ...o, dsm: e.target.checked }))}
                  className="rounded"
                />
                DSM
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.dtm}
                  onChange={e => setOptions(o => ({ ...o, dtm: e.target.checked }))}
                  className="rounded"
                />
                DTM
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar (when processing) */}
      {isProcessing && (
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--text-muted)]">
              {task.status === 'queued' ? 'Queued for processing...' : 'Processing photos...'}
            </span>
            <span className="text-[var(--accent)] font-semibold">{task.progress}%</span>
          </div>
          <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent)] to-amber-500 transition-all duration-500"
              style={{ width: `${task.progress}%` }}
            />
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">
            Processing can take 10-60 minutes depending on photo count and resolution. This page auto-refreshes every 5 seconds.
          </p>
        </div>
      )}

      {/* Error message */}
      {isFailed && task.error_message && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          <p className="text-xs text-red-400 font-semibold">Processing Failed</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{task.error_message}</p>
        </div>
      )}

      {/* Start button */}
      {!isProcessing && !isCompleted && (
        <button
          onClick={startProcessing}
          disabled={processing || task.photo_count === 0}
          className="w-full py-2.5 bg-[var(--accent)] text-black font-semibold rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-40 transition-colors text-sm flex items-center justify-center gap-2"
        >
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
          {processing ? 'Starting...' : 'Start Processing'}
        </button>
      )}

      {/* Refresh button (when processing) */}
      {isProcessing && (
        <button
          onClick={fetchTask}
          className="w-full py-2 border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3 h-3" /> Refresh Status
        </button>
      )}
    </div>
  )
}

// ─── Results Section ────────────────────────────────────────────────────────

function ResultsSection({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<DroneTask | null>(null)

  useEffect(() => {
    fetch(`/api/drone/process?taskId=${taskId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.task) setTask(data.task) })
  }, [taskId])

  if (!task || task.status !== 'completed') return null

  const outputs = [
    { label: 'Orthophoto', path: task.orthophoto_path, icon: MapIcon, href: '/tools/orthophoto-viewer', desc: 'Georeferenced aerial image' },
    { label: 'Point Cloud', path: task.pointcloud_path, icon: Box, href: '/tools/point-cloud-import', desc: '3D LAS point cloud' },
    { label: 'DSM', path: task.dsm_path, icon: Mountain, href: '/tools/contour-generator', desc: 'Digital Surface Model' },
    { label: 'DTM', path: task.dtm_path, icon: Mountain, href: '/tools/contour-generator', desc: 'Digital Terrain Model' },
    { label: 'Contours', path: task.contour_path, icon: FileCode, href: '/tools/contour-generator', desc: 'Contour lines (GeoJSON)' },
  ].filter(o => o.path)

  if (outputs.length === 0) return null

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-bold text-[var(--text-primary)]">3. Import Results</h2>
      </div>

      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Processing complete. {outputs.length} output{outputs.length !== 1 ? 's' : ''} available.
        Click any result to open it in the corresponding METARDU tool.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {outputs.map(output => {
          const Icon = output.icon
          return (
            <Link
              key={output.label}
              href={output.href}
              className="group flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 hover:border-emerald-500/30 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{output.label}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{output.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-emerald-400 transition-colors" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Task History ───────────────────────────────────────────────────────────

function TaskHistory({ refreshKey }: { refreshKey: number }) {
  const [tasks, setTasks] = useState<DroneTask[]>([])

  useEffect(() => {
    fetch('/api/drone/tasks?limit=10')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.tasks) setTasks(data.tasks) })
  }, [refreshKey])

  if (tasks.length === 0) return null

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">Recent Drone Surveys</h2>
      <div className="space-y-2">
        {tasks.map(task => (
          <div
            key={task.id}
            className="flex items-center justify-between rounded-lg border border-[var(--border-color)] p-3 hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{task.name}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {task.photo_count} photos · {Math.round(task.total_size_mb)}MB · {new Date(task.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {task.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
              {(task.status === 'queued' || task.status === 'running') && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
              <span className="text-xs capitalize text-[var(--text-muted)]">{task.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DronePage() {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        title="Drone Photogrammetry"
        subtitle="Upload drone photos → process to orthophoto + point cloud + contours → import to METARDU tools"
        reference="WebODM integration · Orthophoto · Point Cloud · DSM/DTM · Contours"
      />

      <div className="mt-6 space-y-6">
        {/* Info banner */}
        <div className="rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 p-4 text-sm text-[var(--text-secondary)]">
          <p>
            <span className="font-semibold text-[var(--accent)]">How it works:</span>{' '}
            Upload your drone photos (JPG/PNG/TIFF), then METARDU sends them to WebODM
            for photogrammetry processing. Results (orthophoto, point cloud, DSM/DTM, contours)
            are automatically downloaded and can be opened in METARDU&apos;s existing tools.
          </p>
        </div>

        {/* Step 1: Upload */}
        <UploadSection onTaskCreated={(taskId) => {
          setActiveTaskId(taskId)
          setRefreshKey(k => k + 1)
        }} />

        {/* Step 2: Process (only show if a task is active) */}
        {activeTaskId && (
          <ProcessingSection taskId={activeTaskId} />
        )}

        {/* Step 3: Results (only show if completed) */}
        {activeTaskId && (
          <ResultsSection taskId={activeTaskId} />
        )}

        {/* Task history */}
        <TaskHistory refreshKey={refreshKey} />
      </div>
    </div>
  )
}
