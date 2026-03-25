'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  created_at: string
  read: boolean
  action_url?: string
}

// ── Local storage fallback for when not authenticated ──────────────────────
const LS_KEY = 'geonova_notifications'

function loadLocal(): Notification[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

function saveLocal(items: Notification[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(items))
}

// ── Status icons using SVG — no emoji ─────────────────────────────────────
function TypeIcon({ type }: { type: Notification['type'] }) {
  const base = 'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0'
  if (type === 'success') return (
    <div className={`${base} bg-green-900/40 border border-green-700/40`}>
      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  )
  if (type === 'warning') return (
    <div className={`${base} bg-amber-900/40 border border-amber-700/40`}>
      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    </div>
  )
  if (type === 'error') return (
    <div className={`${base} bg-red-900/40 border border-red-700/40`}>
      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  )
  return (
    <div className={`${base} bg-blue-900/40 border border-blue-700/40`}>
      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  )
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
        if (data && data.length > 0) {
          setNotifications(data)
          setLoading(false)
          return
        }
      }
    } catch { /* fall through to local */ }
    // Fall back to localStorage (works offline / unauthenticated)
    setNotifications(loadLocal())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n)
    setNotifications(updated)
    saveLocal(updated)
    try {
      createClient().from('notifications').update({ read: true }).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to mark read:', error)
      })
    } catch (e) {
      console.error('Failed to mark read:', e)
    }
  }

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }))
    setNotifications(updated)
    saveLocal(updated)
    try {
      createClient().from('notifications')
        .update({ read: true })
        .in('id', notifications.map(n => n.id))
        .then(({ error }) => {
          if (error) console.error('Failed to mark all read:', error)
        })
    } catch (e) {
      console.error('Failed to mark all read:', e)
    }
  }

  const dismiss = (id: string) => {
    const updated = notifications.filter(n => n.id !== id)
    setNotifications(updated)
    saveLocal(updated)
    try {
      createClient().from('notifications').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to dismiss:', error)
      })
    } catch (e) {
      console.error('Failed to dismiss:', e)
    }
  }

  const shown = filter === 'unread' ? notifications.filter(n => !n.read) : notifications
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Notifications</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="text-sm text-[var(--accent)] hover:text-[var(--accent-dim)] transition-colors">
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-[var(--accent)] text-black'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-color)]'
              }`}>
              {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[var(--bg-tertiary)] rounded w-1/3" />
                    <div className="h-3 bg-[var(--bg-tertiary)] rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && shown.length === 0 && (
          <div className="text-center py-20 border border-dashed border-[var(--border-color)] rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-[var(--text-secondary)] font-medium">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {filter === 'unread' ? 'You\'re all caught up' : 'Activity from your projects will appear here'}
            </p>
          </div>
        )}

        {/* Notification list */}
        {!loading && shown.length > 0 && (
          <div className="space-y-2">
            {shown.map(n => (
              <div key={n.id}
                className={`group relative bg-[var(--bg-card)] rounded-xl border transition-colors cursor-pointer ${
                  !n.read
                    ? 'border-[var(--accent)]/30 bg-[var(--accent-subtle)]'
                    : 'border-[var(--border-color)] hover:border-[var(--border-hover)]'
                }`}
                onClick={() => markRead(n.id)}>

                {/* Unread dot */}
                {!n.read && (
                  <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[var(--accent)]" />
                )}

                <div className="flex items-start gap-3 p-4 pr-8">
                  <TypeIcon type={n.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{n.title}</p>
                      <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{relativeTime(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5 leading-snug">{n.message}</p>
                    {n.action_url && (
                      <Link href={n.action_url} onClick={e => e.stopPropagation()}
                        className="text-xs text-[var(--accent)] hover:text-[var(--accent-dim)] mt-2 inline-block transition-colors">
                        View →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Dismiss button — visible on hover */}
                <button
                  onClick={e => { e.stopPropagation(); dismiss(n.id) }}
                  className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
                  title="Dismiss">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
