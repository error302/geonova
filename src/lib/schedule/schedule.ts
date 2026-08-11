/**
 * Job Scheduling Library
 * Database-backed scheduling for survey jobs with reminders.
 * Uses the job_schedule table via DbClient/postgres proxy.
 */

import { createClient } from '@/lib/api-client/client'

export type SchedulePriority = 'low' | 'normal' | 'high' | 'urgent'
export type ScheduleStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled' | 'postponed'

export interface JobSchedule {
  id: string
  user_id: string
  job_id?: string | null
  marketplace_job_id?: string | null
  title: string
  description?: string | null
  scheduled_date: string
  scheduled_time?: string | null
  location?: string | null
  client_name?: string | null
  client_contact?: string | null
  estimated_duration_hours: number
  status: ScheduleStatus
  reminder_enabled: boolean
  reminder_days_before: number[]
  reminder_notes?: string | null
  survey_type?: string | null
  equipment_needed: string[]
  team_members: string[]
  priority: SchedulePriority
  notes?: string | null
  created_at: string
  updated_at: string
  completed_at?: string | null
}

export interface JobScheduleWithAlerts extends JobSchedule {
  isReminderDue: boolean
  daysUntil: number
  isOverdue: boolean
  isToday: boolean
}

const STATUS_LABELS: Record<ScheduleStatus, string> = {
  upcoming: 'Upcoming',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
}

const PRIORITY_COLORS: Record<SchedulePriority, string> = {
  low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  normal: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  high: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  urgent: 'bg-red-500/20 text-red-300 border-red-500/30',
}

export { STATUS_LABELS, PRIORITY_COLORS }

// ── Helpers ────────────────────────────────────────────────────────────────

function daysBetween(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

export function enrichWithAlerts(schedule: JobSchedule): JobScheduleWithAlerts {
  const daysUntil = daysBetween(schedule.scheduled_date)
  const isToday = daysUntil === 0
  const isOverdue = daysUntil < 0 && schedule.status === 'upcoming'
  const isReminderDue = schedule.reminder_enabled &&
    schedule.status === 'upcoming' &&
    schedule.reminder_days_before.some(d => d === daysUntil)

  return { ...schedule, isReminderDue, daysUntil, isOverdue, isToday }
}

// ── CRUD Operations (via DbClient client proxy) ───────────────────────────

export async function getSchedules(userId: string): Promise<JobSchedule[]> {
  const sb = createClient()
  const res = await sb
    .from('job_schedule')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })
  if (res.error) throw new Error(res.error.message)
  return (res.data ?? []) as unknown as JobSchedule[]
}

export async function getUpcomingSchedules(userId: string): Promise<JobScheduleWithAlerts[]> {
  const all = await getSchedules(userId)
  return all
    .filter(s => s.status === 'upcoming')
    .map(enrichWithAlerts)
}

export async function getScheduleById(id: string): Promise<JobSchedule | null> {
  const sb = createClient()
  const res = await sb.from('job_schedule').select('*').eq('id', id).maybeSingle()
  if (res.error) throw new Error(res.error.message)
  return (res.data ?? null) as unknown as JobSchedule | null
}

export async function createSchedule(data: Omit<JobSchedule, 'id' | 'created_at' | 'updated_at' | 'completed_at'>): Promise<JobSchedule> {
  const sb = createClient()
  const res = await sb
    .from('job_schedule')
    .insert(data)
    .select()
    .single()
  if (res.error) throw new Error(res.error.message)
  return res.data as unknown as JobSchedule
}

export async function updateSchedule(id: string, updates: Partial<JobSchedule>): Promise<JobSchedule> {
  const sb = createClient()
  const res = await sb
    .from('job_schedule')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (res.error) throw new Error(res.error.message)
  return res.data as unknown as JobSchedule
}

export async function deleteSchedule(id: string): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('job_schedule').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function markScheduleCompleted(id: string): Promise<JobSchedule> {
  return updateSchedule(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  })
}

export async function markScheduleCancelled(id: string): Promise<JobSchedule> {
  return updateSchedule(id, { status: 'cancelled' })
}

export async function getDueReminders(userId: string): Promise<JobScheduleWithAlerts[]> {
  const upcoming = await getUpcomingSchedules(userId)
  return upcoming.filter(s => s.isReminderDue)
}

// ── Statistics ─────────────────────────────────────────────────────────────

export async function getScheduleStats(userId: string) {
  const all = await getSchedules(userId)
  const today = new Date().toISOString().split('T')[0]
  const weekFromNow = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0]

  return {
    total: all.length,
    upcoming: all.filter(s => s.status === 'upcoming').length,
    completed: all.filter(s => s.status === 'completed').length,
    inProgress: all.filter(s => s.status === 'in_progress').length,
    today: all.filter(s => s.scheduled_date === today && s.status === 'upcoming').length,
    thisWeek: all.filter(s => s.scheduled_date >= today && s.scheduled_date <= weekFromNow && s.status === 'upcoming').length,
    overdue: all.filter(s => {
      const d = daysBetween(s.scheduled_date)
      return d < 0 && s.status === 'upcoming'
    }).length,
  }
}

// ── Format Helpers ────────────────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTime(timeStr: string | null): string {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

export function getRelativeDate(dateStr: string): string {
  const days = daysBetween(dateStr)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 0 && days <= 7) return `In ${days} days`
  if (days < 0 && days >= -7) return `${Math.abs(days)} days ago`
  return formatDate(dateStr)
}

export const SURVEY_TYPES = [
  'Boundary', 'Topographic', 'Control', 'Engineering', 'Road',
  'Hydrographic', 'Mining', 'Construction', 'Cadastral', 'GNSS',
  'Leveling', 'Drone', 'As-built',
] as const

export const EQUIPMENT_OPTIONS = [
  'Total Station', 'GNSS Receiver', 'Digital Level', 'Theodolite',
  'Prism Pole', 'Tripod', 'Measuring Tape', 'Data Collector',
  'Drone/UAV', 'EDM', 'Auto Level', 'Staff',
] as const
