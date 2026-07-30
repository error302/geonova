'use client'

/**
 * ProjectPresencePanel — Lightweight presence indicator for project workspaces.
 *
 * Shows who else is online on the same project with live polling.
 * Uses the existing /api/realtime/poll endpoint.
 */

import { useState, useEffect } from 'react'
import { Users } from 'lucide-react'

interface ProjectPresencePanelProps {
  projectId: string
  currentUserId: string
}

const ROLE_COLORS = ['#e8841a', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b']

export function ProjectPresencePanel({ projectId, currentUserId }: ProjectPresencePanelProps) {
  const [collaborators, setCollaborators] = useState<Array<{ userId: string; name: string; status: string; color: string }>>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!projectId) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/realtime/poll?table=projects&projectId=${projectId}`)
        if (res.ok) {
          const data = await res.json()
          const seen = new Map<string, { userId: string; name: string; status: string; color: string }>()
          for (const row of data.data || []) {
            const userId = row.user_id || row.userId
            if (!userId || userId === currentUserId) continue
            if (!seen.has(userId)) {
              const colorIdx = seen.size % ROLE_COLORS.length
              const ageMs = Date.now() - new Date(row.updated_at).getTime()
              seen.set(userId, {
                userId,
                name: row.user_name || `Surveyor ${userId.slice(0, 4)}`,
                status: ageMs < 60000 ? 'active' : 'idle',
                color: ROLE_COLORS[colorIdx],
              })
            }
          }
          setCollaborators(Array.from(seen.values()))
        }
      } catch { /* non-blocking */ }
    }

    poll()
    const interval = setInterval(poll, 10000)
    return () => clearInterval(interval)
  }, [projectId, currentUserId])

  if (collaborators.length === 0) return null

  const activeCount = collaborators.filter(c => c.status === 'active').length

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Users className="w-4 h-4 text-[var(--accent)]" />
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">{activeCount} active now</span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-color)] divide-y divide-[var(--border-color)]">
          {collaborators.map(c => (
            <div key={c.userId} className="flex items-center gap-2 p-2.5">
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: c.color }}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-card)] ${c.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--text-primary)] truncate">{c.name}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{c.status === 'active' ? 'active now' : 'idle'}</div>
              </div>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
