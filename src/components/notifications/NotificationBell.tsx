'use client'

/**
 * NotificationBell — Floating notification icon with unread count badge
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, CheckCheck, Trash2, Loader2,
  Info, AlertTriangle, CheckCircle2, XCircle,
  FileText, MessageSquare, CreditCard, Users, Settings as SettingsIcon,
} from 'lucide-react'

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  category: string
  title: string
  message: string
  action_url?: string | null
  action_label?: string | null
  read_at: string | null
  created_at: string
}

const TYPE_ICONS: Record<string, typeof Info> = {
  info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle,
}

const CATEGORY_ICONS: Record<string, typeof Info> = {
  peer_review: FileText, payment: CreditCard, project_share: Users,
  message: MessageSquare, system: SettingsIcon,
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

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20')
      if (!res.ok) return
      const data = await res.json() as { data?: { notifications?: Notification[]; unreadCount?: number } }
      setNotifications(data.data?.notifications || [])
      setUnreadCount(data.data?.unreadCount || 0)
    } catch (err) {}
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMarkRead = useCallback(async (id: string, actionUrl?: string | null) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      if (actionUrl) {
        router.push(actionUrl)
        setOpen(false)
      }
    } catch (err) {}
  }, [router])

  const handleMarkAllRead = useCallback(async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
      setUnreadCount(0)
    } catch (err) {}
  }, [])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' })
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {}
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications() }}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-red-500 text-white text-[9px] font-bold animate-in zoom-in duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-[360px] max-w-[calc(100vw-2rem)] bg-[#0d0d14]/95 backdrop-blur-2xl border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Bell className="w-8 h-8 text-gray-600 mb-2" />
                <p className="text-sm text-gray-500">No notifications yet</p>
                <p className="text-[10px] text-gray-600 mt-1">
                  You&apos;ll see peer review requests, payment confirmations, and updates here.
                </p>
              </div>
            )}

            {!loading && notifications.map(notif => {
              const TypeIcon = TYPE_ICONS[notif.type] || Info
              const CatIcon = CATEGORY_ICONS[notif.category] || TypeIcon
              const Icon = CatIcon
              const isUnread = !notif.read_at

              return (
                <div
                  key={notif.id}
                  onClick={() => handleMarkRead(notif.id, notif.action_url)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.03] transition-colors group ${
                    isUnread ? 'bg-blue-500/[0.03]' : ''
                  }`}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    notif.type === 'error' ? 'bg-red-500/10' :
                    notif.type === 'warning' ? 'bg-amber-500/10' :
                    notif.type === 'success' ? 'bg-emerald-500/10' :
                    'bg-blue-500/10'
                  }`}>
                    <Icon className={`w-4 h-4 ${
                      notif.type === 'error' ? 'text-red-400' :
                      notif.type === 'warning' ? 'text-amber-400' :
                      notif.type === 'success' ? 'text-emerald-400' :
                      'text-blue-400'
                    }`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">{notif.title}</span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] text-gray-600">{timeAgo(notif.created_at)}</span>
                      {notif.action_label && (
                        <span className="text-[9px] text-blue-400 font-medium">{notif.action_label} →</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(notif.id, e)}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-white/[0.06] px-4 py-2.5">
              <button
                onClick={() => { router.push('/notifications'); setOpen(false) }}
                className="w-full text-center text-xs text-gray-400 hover:text-white transition-colors"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
