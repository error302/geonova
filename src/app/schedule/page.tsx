'use client';

import { useState, useEffect, useCallback } from 'react'
import { createClient, type BrowserSession } from '@/lib/api-client/client'
import {
  JobSchedule, JobScheduleWithAlerts, SchedulePriority, ScheduleStatus,
  getSchedules, createSchedule, updateSchedule, deleteSchedule,
  markScheduleCompleted, markScheduleCancelled, getDueReminders,
  getScheduleStats, enrichWithAlerts, formatDate, formatTime,
  getRelativeDate, STATUS_LABELS, PRIORITY_COLORS, SURVEY_TYPES, EQUIPMENT_OPTIONS,
} from '@/lib/schedule/schedule'

/* ── Helpers ────────────────────────────────────────────────────────────── */

function statusColor(s: ScheduleStatus): string {
  switch (s) {
    case 'upcoming': return 'bg-green-900/40 text-green-300 border-green-700/40'
    case 'in_progress': return 'bg-blue-900/40 text-blue-300 border-blue-700/40'
    case 'completed': return 'bg-gray-700/40 text-gray-400 border-gray-600/40'
    case 'cancelled': return 'bg-red-900/30 text-red-400 border-red-700/30'
    case 'postponed': return 'bg-amber-900/40 text-amber-300 border-amber-700/40'
    default: return 'bg-gray-700/40 text-gray-400 border-gray-600/40'
  }
}

const TODAY = new Date().toISOString().split('T')[0]

/* ── Schedule Form Modal ────────────────────────────────────────────────── */

const BLANK = {
  title: '', description: '', scheduled_date: '', scheduled_time: '',
  location: '', client_name: '', client_contact: '',
  estimated_duration_hours: 1, survey_type: '',
  equipment_needed: [] as string[], team_members: [] as string[],
  reminder_enabled: true, reminder_days_before: [1] as number[],
  priority: 'normal' as SchedulePriority, notes: '',
}

function ScheduleFormModal({
  initial, onSave, onClose,
}: {
  initial?: Partial<JobSchedule>
  onSave: (data: any) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({ ...BLANK, ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [equipInput, setEquipInput] = useState('')
  const [memberInput, setMemberInput] = useState('')
  const f = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const toggleReminderDay = (d: number) => {
    setForm(p => ({
      ...p,
      reminder_days_before: p.reminder_days_before.includes(d)
        ? p.reminder_days_before.filter(x => x !== d)
        : [...p.reminder_days_before, d].sort((a, b) => b - a),
    }))
  }

  const addEquipment = (item: string) => {
    const v = item.trim()
    if (v && !form.equipment_needed.includes(v)) f('equipment_needed', [...form.equipment_needed, v])
    setEquipInput('')
  }

  const addMember = (name: string) => {
    const v = name.trim()
    if (v && !form.team_members.includes(v)) f('team_members', [...form.team_members, v])
    setMemberInput('')
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Job title is required'); return }
    if (!form.scheduled_date) { setError('Scheduled date is required'); return }
    setError('')
    setSaving(true)
    try { await onSave(form) }
    catch (err: unknown) { setError((err as Error).message || 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {initial?.id ? 'Edit Scheduled Job' : 'Schedule New Job'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl leading-none p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4 flex-1">
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{error}</div>
          )}
          <div>
            <label htmlFor="job-title" className="block text-xs text-[var(--text-muted)] mb-1">Job Title *</label>
            <input id="job-title" value={form.title} onChange={e => f('title', e.target.value)}
              placeholder="e.g. Boundary Survey - Karen Plot L.R. No. 123/456" className="input w-full" />
          </div>
          <div>
            <label htmlFor="job-description" className="block text-xs text-[var(--text-muted)] mb-1">Description</label>
            <textarea id="job-description" value={form.description ?? ''} onChange={e => f('description', e.target.value)} rows={2}
              placeholder="Brief description of the work..." className="input w-full resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="job-date" className="block text-xs text-[var(--text-muted)] mb-1">Scheduled Date *</label>
              <input id="job-date" type="date" min={TODAY} value={form.scheduled_date}
                onChange={e => f('scheduled_date', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label htmlFor="job-time" className="block text-xs text-[var(--text-muted)] mb-1">Time</label>
              <input id="job-time" type="time" value={form.scheduled_time || ''}
                onChange={e => f('scheduled_time', e.target.value || null)} className="input w-full" />
            </div>
            <div>
              <label htmlFor="job-duration" className="block text-xs text-[var(--text-muted)] mb-1">Duration (hours)</label>
              <input id="job-duration" type="number" min={1} max={24} value={form.estimated_duration_hours}
                onChange={e => f('estimated_duration_hours', parseInt(e.target.value) || 1)} className="input w-full" />
            </div>
            <div>
              <label htmlFor="job-survey-type" className="block text-xs text-[var(--text-muted)] mb-1">Survey Type</label>
              <select id="job-survey-type" value={form.survey_type ?? ''} onChange={e => f('survey_type', e.target.value)} className="input w-full">
                <option value="">Select type...</option>
                {SURVEY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="job-priority" className="block text-xs text-[var(--text-muted)] mb-1">Priority</label>
              <select id="job-priority" value={form.priority} onChange={e => f('priority', e.target.value as SchedulePriority)} className="input w-full">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label htmlFor="job-location" className="block text-xs text-[var(--text-muted)] mb-1">Location</label>
              <input id="job-location" value={form.location ?? ''} onChange={e => f('location', e.target.value)}
                placeholder="e.g. Karen, Nairobi" className="input w-full" />
            </div>
            <div>
              <label htmlFor="job-client-name" className="block text-xs text-[var(--text-muted)] mb-1">Client Name</label>
              <input id="job-client-name" value={form.client_name ?? ''} onChange={e => f('client_name', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label htmlFor="job-client-contact" className="block text-xs text-[var(--text-muted)] mb-1">Client Contact</label>
              <input id="job-client-contact" value={form.client_contact ?? ''} onChange={e => f('client_contact', e.target.value)} className="input w-full" />
            </div>
          </div>
          <div>
            <label htmlFor="equipment-input" className="block text-xs text-[var(--text-muted)] mb-1">Equipment Needed</label>
            <div className="flex gap-2 mb-2">
              <input id="equipment-input" value={equipInput} onChange={e => setEquipInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEquipment(equipInput) } }}
                placeholder="Type + Enter" className="input flex-1 text-sm py-1.5" />
              <button onClick={() => addEquipment(equipInput)} className="btn btn-secondary text-sm py-1.5 px-3">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {EQUIPMENT_OPTIONS.filter(e => !form.equipment_needed.includes(e)).slice(0, 6).map(e => (
                <button key={e} onClick={() => addEquipment(e)}
                  className="text-xs px-2 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] transition-colors">
                  + {e}
                </button>
              ))}
            </div>
            {form.equipment_needed.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.equipment_needed.map(e => (
                  <span key={e} className="text-xs px-2 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center gap-1">
                    {e}
                    <button onClick={() => f('equipment_needed', form.equipment_needed.filter(x => x !== e))} className="hover:text-red-400">x</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="member-input" className="block text-xs text-[var(--text-muted)] mb-1">Team Members</label>
            <div className="flex gap-2">
              <input id="member-input" value={memberInput} onChange={e => setMemberInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMember(memberInput) } }}
                placeholder="Name + Enter" className="input flex-1 text-sm py-1.5" />
              <button onClick={() => addMember(memberInput)} className="btn btn-secondary text-sm py-1.5 px-3">Add</button>
            </div>
            {form.team_members.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.team_members.map(m => (
                  <span key={m} className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center gap-1">
                    {m}
                    <button onClick={() => f('team_members', form.team_members.filter(x => x !== m))} className="hover:text-red-400">x</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[var(--text-primary)]">Reminders</span>
              <button onClick={() => f('reminder_enabled', !form.reminder_enabled)}
                className={`w-10 h-5 rounded-full transition-colors relative ${form.reminder_enabled ? 'bg-[var(--accent)]' : 'bg-gray-600'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.reminder_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {form.reminder_enabled && (
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 7, 14].map(d => (
                  <button key={d} onClick={() => toggleReminderDay(d)}
                    className={`text-xs px-3 py-1 rounded border transition-colors ${
                      form.reminder_days_before.includes(d)
                        ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--accent)]/30'
                    }`}>
                    {d === 1 ? '1 day before' : `${d} days before`}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="job-notes" className="block text-xs text-[var(--text-muted)] mb-1">Notes</label>
            <textarea id="job-notes" value={form.notes ?? ''} onChange={e => f('notes', e.target.value)} rows={2}
              placeholder="Any additional notes..." className="input w-full resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[var(--border-color)] flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-black hover:opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? (
              <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Saving...</>
            ) : (initial?.id ? 'Update Schedule' : 'Schedule Job')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Delete Confirmation Modal ──────────────────────────────────────────── */

function DeleteConfirmModal({ title, onConfirm, onCancel }: {
  title: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Remove Schedule</h3>
            <p className="text-sm text-[var(--text-muted)]">This cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Remove <span className="font-semibold text-[var(--text-primary)]">"{title}"</span> from your schedule?
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Schedule Page ─────────────────────────────────────────────────── */

export default function SchedulePage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [schedules, setSchedules] = useState<JobScheduleWithAlerts[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'overdue'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<JobSchedule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<JobSchedule | null>(null)
  const [reminders, setReminders] = useState<JobScheduleWithAlerts[]>([])

  // Get user on mount
  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      const session = data?.session as BrowserSession | null | undefined
      if (session?.user?.id) {
        setUserId(session.user.id)
      }
      setAuthLoading(false)
    }).catch(() => setAuthLoading(false))
  }, [])

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [allScheds, schedStats, dueReminders] = await Promise.all([
        getSchedules(userId),
        getScheduleStats(userId),
        getDueReminders(userId),
      ])
      setSchedules(allScheds.map(enrichWithAlerts))
      setStats(schedStats)
      setReminders(dueReminders)
    } catch (err) {
      console.error('Failed to load schedules', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  if (authLoading) return <div className="flex items-center justify-center min-h-screen text-[var(--text-muted)]">Loading...</div>
  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-[var(--text-muted)]">Please sign in to manage your schedule</p>
        <a href="/login" className="btn btn-primary">Sign In</a>
      </div>
    )
  }

  const handleSave = async (formData: any) => {
    if (editItem) {
      await updateSchedule(editItem.id, formData)
    } else {
      await createSchedule({ ...formData, user_id: userId })
    }
    setShowForm(false)
    setEditItem(null)
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteSchedule(deleteTarget.id)
    setDeleteTarget(null)
    load()
  }

  const handleStatusChange = async (id: string, status: ScheduleStatus) => {
    if (status === 'completed') await markScheduleCompleted(id)
    else if (status === 'cancelled') await markScheduleCancelled(id)
    else await updateSchedule(id, { status })
    load()
  }

  const filtered = schedules.filter(s => {
    if (filter === 'upcoming') return s.status === 'upcoming' && !s.isOverdue
    if (filter === 'completed') return s.status === 'completed'
    if (filter === 'overdue') return s.isOverdue
    return true
  })

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Job Schedule</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Plan and track your upcoming survey jobs</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true) }}
          className="btn btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Schedule Job
        </button>
      </div>

      {/* Due Reminders Banner */}
      {reminders.length > 0 && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
            </svg>
            <span className="font-semibold text-amber-300 text-sm">Reminders Due ({reminders.length})</span>
          </div>
          <div className="space-y-1">
            {reminders.slice(0, 3).map(r => (
              <p key={r.id} className="text-xs text-amber-200/70">
                <strong>{r.title}</strong> — {getRelativeDate(r.scheduled_date)} {formatTime(r.scheduled_time ?? null)}
              </p>
            ))}
            {reminders.length > 3 && (
              <p className="text-xs text-amber-200/50">+ {reminders.length - 3} more reminder{reminders.length - 3 > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Today', value: stats.today, color: 'text-[var(--accent)]' },
            { label: 'This Week', value: stats.thisWeek, color: 'text-blue-400' },
            { label: 'Overdue', value: stats.overdue, color: 'text-red-400' },
            { label: 'Completed', value: stats.completed, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {(['all', 'upcoming', 'overdue', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm rounded-lg border transition-colors whitespace-nowrap capitalize ${
              filter === f
                ? 'border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--accent)]/30'
            }`}>
            {f === 'all' ? 'All Jobs' : f === 'overdue' ? `Overdue${stats?.overdue ? ` (${stats.overdue})` : ''}` : `${f}`}
          </button>
        ))}
      </div>

      {/* Schedule List */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">Loading schedules...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
            </svg>
          </div>
          <h3 className="font-medium text-[var(--text-primary)] mb-1">No scheduled jobs</h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">Start by scheduling your first survey job</p>
          <button onClick={() => { setEditItem(null); setShowForm(true) }} className="btn btn-primary">
            Schedule Your First Job
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(schedule => (
            <div key={schedule.id}
              className={`rounded-xl border p-4 transition-all ${
                schedule.isOverdue ? 'border-red-500/30 bg-red-500/5' :
                schedule.isToday ? 'border-[var(--accent)]/30 bg-[var(--accent)]/5' :
                'border-[var(--border-color)] bg-[var(--bg-card)]'
              }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className={`font-semibold ${schedule.status === 'completed' ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}>
                      {schedule.title}
                    </h3>
                    <span className={`badge text-[10px] border ${statusColor(schedule.status)}`}>{STATUS_LABELS[schedule.status]}</span>
                    <span className={`badge text-[10px] border ${PRIORITY_COLORS[schedule.priority]}`}>{schedule.priority}</span>
                    {schedule.isOverdue && <span className="badge text-[10px] bg-red-500/20 text-red-300 border border-red-500/30">OVERDUE</span>}
                    {schedule.isToday && <span className="badge text-[10px] bg-green-500/20 text-green-300 border border-green-500/30">TODAY</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] flex-wrap">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
                      </svg>
                      <span className={schedule.isOverdue ? 'text-red-400 font-medium' : ''}>{formatDate(schedule.scheduled_date)}</span>
                    </span>
                    {schedule.scheduled_time && (
                      <span>{formatTime(schedule.scheduled_time)}</span>
                    )}
                    {schedule.location && <span className="text-[var(--text-muted)]">{schedule.location}</span>}
                    <span className="text-[var(--text-muted)]">{schedule.estimated_duration_hours}h</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {schedule.survey_type && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">{schedule.survey_type}</span>
                    )}
                    {schedule.client_name && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">{schedule.client_name}</span>
                    )}
                    {schedule.equipment_needed?.slice(0, 3).map(e => (
                      <span key={e} className="text-[10px] px-2 py-0.5 rounded bg-gray-500/10 text-gray-300 border border-gray-500/20">{e}</span>
                    ))}
                    {schedule.team_members?.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {schedule.team_members.length} team member{schedule.team_members.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {schedule.reminder_enabled && schedule.status === 'upcoming' && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                      Reminder: {schedule.reminder_days_before.map(d => d === 1 ? '1 day' : `${d} days`).join(', ')} before
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {schedule.status === 'upcoming' && (
                    <>
                      <button onClick={() => handleStatusChange(schedule.id, 'in_progress')} title="Start"
                        className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-green-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleStatusChange(schedule.id, 'completed')} title="Complete"
                        className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-green-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                      </button>
                    </>
                  )}
                  {schedule.status === 'in_progress' && (
                    <button onClick={() => handleStatusChange(schedule.id, 'completed')} title="Complete"
                      className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-green-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                    </button>
                  )}
                  <button onClick={() => { setEditItem(schedule); setShowForm(true) }} title="Edit"
                    className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
                    </svg>
                  </button>
                  <button onClick={() => setDeleteTarget(schedule)} title="Delete"
                    className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ScheduleFormModal
          initial={editItem || undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          title={deleteTarget.title}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
