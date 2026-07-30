/**
 * Push notification system for METARDU.
 *
 * Uses the Notification API to alert surveyors when:
 *   - QC fails (traverse doesn't close, precision below standard)
 *   - Auto-save completes (data is safe)
 *   - Sync completes (data is on the server)
 *   - Another surveyor joins the project (collaboration)
 *
 * Falls back to in-app toast notifications if the browser doesn't
 * support the Notification API or the user hasn't granted permission.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'

export type NotificationType = 'qc_fail' | 'qc_pass' | 'auto_save' | 'sync_complete' | 'collaborator_joined' | 'sync_failed'

interface NotificationOptions {
  title: string
  body: string
  type: NotificationType
  /** Whether to also show an in-app toast (default: true) */
  showToast?: boolean
}

const ICON_MAP: Record<NotificationType, string> = {
  qc_fail: '/metardu-icon.png',
  qc_pass: '/metardu-icon.png',
  auto_save: '/metardu-icon.png',
  sync_complete: '/metardu-icon.png',
  collaborator_joined: '/metardu-icon.png',
  sync_failed: '/metardu-icon.png',
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = useCallback(async () => {
    if (!supported) return false
    const result = await Notification.requestPermission()
    setPermission(result)
    return result === 'granted'
  }, [supported])

  const notify = useCallback((opts: NotificationOptions) => {
    const { title, body, type, showToast = true } = opts

    // Show native notification if permitted
    if (supported && permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: ICON_MAP[type] || '/metardu-icon.png',
          badge: '/metardu-icon.png',
          tag: type, // prevent duplicate notifications of the same type
          data: { type },
        })

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000)

        notification.onclick = () => {
          window.focus()
          notification.close()
        }
      } catch {
        // Notification failed — fall back to toast
        if (showToast) showToastNotification(opts)
      }
    } else if (showToast) {
      // No permission or not supported — show in-app toast
      showToastNotification(opts)
    }
  }, [supported, permission])

  return { permission, supported, requestPermission, notify }
}

function showToastNotification(opts: NotificationOptions) {
  const { title, body, type } = opts

  switch (type) {
    case 'qc_fail':
      toast.error(title, { description: body, duration: 8000 })
      break
    case 'qc_pass':
      toast.success(title, { description: body, duration: 4000 })
      break
    case 'auto_save':
      toast.success(title, { description: body, duration: 3000 })
      break
    case 'sync_complete':
      toast.success(title, { description: body, duration: 4000 })
      break
    case 'sync_failed':
      toast.error(title, { description: body, duration: 8000 })
      break
    case 'collaborator_joined':
      toast.info(title, { description: body, duration: 5000 })
      break
    default:
      toast(title, { description: body })
  }
}

/**
 * Notification permission prompt component.
 * Shows a banner asking the user to enable notifications.
 */
export function NotificationPermissionBanner() {
  const { permission, supported, requestPermission } = useNotifications()
  const [dismissed, setDismissed] = useState(false)

  if (!supported || permission === 'granted' || dismissed) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:w-96 z-50 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Enable Notifications</h4>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Get alerted when QC fails, data is saved, or sync completes.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => requestPermission()}
              className="px-3 py-1.5 text-xs font-semibold bg-[var(--accent)] text-black rounded-lg"
            >
              Enable
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
