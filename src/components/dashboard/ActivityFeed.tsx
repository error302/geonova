'use client'

/**
 * ActivityFeed — Dashboard widget showing recent user activity
 *
 * Shows a chronological feed of:
 * - Project created/updated
 * - Documents generated
 * - Fieldbook entries saved
 * - Computations run
 * - Peer review submissions
 *
 * Fetches from /api/activity
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  FolderKanban, FileText, MapPin, Calculator, FileCheck2,
  Users, CreditCard, Settings, Activity as ActivityIcon,
  Loader2, ChevronRight, Clock,
} from 'lucide-react'

interface Activity {
  id: string
  project_id: string | null
  activity_type: string
  entity_type: string | null
  entity_id: string | null
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

const ACTIVITY_ICONS: Record<string, typeof FolderKanban> = {
  project_created: FolderKanban,
  project_updated: FolderKanban,
  document_generated: FileText,
  fieldbook_saved: FileText,
  computation_run: Calculator,
  map_capture: MapPin,
  peer_review_submitted: FileCheck2,
  peer_review_completed: FileCheck2,
  team_invite: Users,
  payment_received: CreditCard,
  settings_changed: Settings,
}

const ACTIVITY_COLORS: Record<string, string> = {
  project_created: 'text-blue-400 bg-blue-500/10',
  project_updated: 'text-blue-400 bg-blue-500/10',
  document_generated: 'text-purple-400 bg-purple-500/10',
  fieldbook_saved: 'text-amber-400 bg-amber-500/10',
  computation_run: 'text-emerald-400 bg-emerald-500/10',
  map_capture: 'text-[#D17B47] bg-[#D17B47]/10',
  peer_review_submitted: 'text-cyan-400 bg-cyan-500/10',
  peer_review_completed: 'text-cyan-400 bg-cyan-500/10',
  team_invite: 'text-pink-400 bg-pink-500/10',
  payment_received: 'text-green-400 bg-green-500/10',
  settings_changed: 'text-gray-400 bg-gray-500/10',
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })
}

export function ActivityFeed({ limit = 10 }: { limit?: number }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/activity?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to load activity')
      const data = (await res.json()) as { data?: { activities?: Activity[] } }
      setActivities(data.data?.activities || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchActivities()
    const interval = setInterval(fetchActivities, 30000) // 30s refresh
    return () => clearInterval(interval)
  }, [fetchActivities])

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <ActivityIcon className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</h3>
            <p className="text-[10px] text-gray-500">What happened in your projects</p>
          </div>
        </div>
        <Link
          href="/activity"
          className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-0.5"
        >
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Activity list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-xs text-gray-500">{error}</p>
          <button
            onClick={fetchActivities}
            className="mt-2 text-[10px] text-[var(--accent)] hover:underline"
          >
            Retry
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="w-8 h-8 text-gray-600 mb-2" />
          <p className="text-sm text-gray-500">No recent activity</p>
          <p className="text-[10px] text-gray-600 mt-1">
            Create a project or run a computation to see activity here.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map((activity, idx) => {
            const Icon = ACTIVITY_ICONS[activity.activity_type] || ActivityIcon
            const colorClass = ACTIVITY_COLORS[activity.activity_type] || 'text-gray-400 bg-gray-500/10'
            const href = activity.project_id ? `/project/${activity.project_id}` : null

            const content = (
              <>
                {/* Timeline dot */}
                {idx < activities.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-px bg-white/[0.06]" />
                )}
                <div className={`relative flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.02] transition-colors ${href ? 'cursor-pointer' : ''}`}>
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass} border border-white/[0.06]`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-primary)] leading-tight">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-gray-600">{timeAgo(activity.created_at)}</span>
                      {activity.entity_type && (
                        <span className="text-[9px] text-gray-600 px-1 py-0.5 rounded bg-white/[0.04]">
                          {activity.entity_type}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )

            return href ? (
              <Link key={activity.id} href={href}>{content}</Link>
            ) : (
              <div key={activity.id}>{content}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
