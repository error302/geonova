'use client';

/**
 * FieldbookAuditDrawer
 * ────────────────────────────────────────────────────────────────────────────
 * Bottom-sheet drawer that shows the fieldbook audit event stream
 * for the current user. Each row shows:
 *   • action chip (INSERT / UPDATE / SOFT_DELETE / RESTORE / DELETE)
 *   • table name + row id
 *   • who (email) + when (relative time)
 *   • SHA-256 hash (truncated) with copy button
 *   • expandable payload preview (JSON)
 *
 * Pulls from /api/fieldbook/audit.
 */

import { useEffect, useState, useCallback } from 'react'
import { X, ShieldCheck, ShieldAlert, Copy, Check, ChevronDown, ChevronRight, Hash, User, Clock } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface AuditEvent {
  id: string
  table_name: string
  row_id: string
  user_id: string | null
  user_email: string | null
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE' | 'RESTORE'
  summary: string
  prev_hash: string | null
  hash: string
  created_at: string
  payload: Record<string, unknown> | null
}

interface FieldbookAuditDrawerProps {
  open: boolean
  onClose: () => void
  projectId?: string
}

const ACTION_STYLES: Record<AuditEvent['action'], { bg: string; text: string; i18nKey: string }> = {
  INSERT:     { bg: 'bg-emerald-500/15',  text: 'text-emerald-300', i18nKey: 'audit.created' },
  UPDATE:     { bg: 'bg-blue-500/15',     text: 'text-blue-300',    i18nKey: 'audit.updated' },
  SOFT_DELETE:{ bg: 'bg-amber-500/15',    text: 'text-amber-300',   i18nKey: 'audit.softDeleted' },
  RESTORE:    { bg: 'bg-purple-500/15',   text: 'text-purple-300',  i18nKey: 'audit.restored' },
  DELETE:     { bg: 'bg-red-500/15',      text: 'text-red-300',     i18nKey: 'audit.deleted' },
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString()
}

export function FieldbookAuditDrawer({ open, onClose, projectId }: FieldbookAuditDrawerProps) {
  const { t } = useLanguage()
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/fieldbook/audit', window.location.origin)
      url.searchParams.set('limit', '100')
      if (projectId) url.searchParams.set('project_id', projectId)
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { events?: AuditEvent[] }
      setEvents(data.events || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(hash)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-10 h-10 rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">{t('audit.title')}</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Hash-chained evidence log · {events.length} event{events.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
              <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mr-2" />
              {t('common.loading')}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              <ShieldAlert className="w-4 h-4" />
              {error}
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{t('audit.noEvents')}</p>
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <ol className="relative">
              {/* vertical timeline line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[var(--border-color)]" />
              {events.map((ev) => {
                const style = ACTION_STYLES[ev.action]
                const isExpanded = expanded.has(ev.id)
                return (
                  <li key={ev.id} className="relative pl-12 pb-3">
                    {/* timeline dot */}
                    <div className={`absolute left-[12px] top-2.5 w-3.5 h-3.5 rounded-full ring-4 ring-[var(--bg-primary)] ${style.bg}`} />

                    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${style.bg} ${style.text}`}>
                              {t(style.i18nKey)}
                            </span>
                            <span className="text-xs text-[var(--text-muted)] font-mono">
                              {ev.table_name === 'project_fieldbook_entries' ? 'fieldbook' : 'survey_point'}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-primary)] truncate">
                            {ev.summary || ev.action}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--text-muted)]">
                            <span className="flex items-center gap-1">
                              <User className="w-2.5 h-2.5" />
                              {ev.user_email || ev.user_id?.slice(0, 8) || 'system'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {relTime(ev.created_at)}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleExpand(ev.id)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                          aria-label={t('audit.viewDetails')}
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Hash row */}
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[var(--border-color)]">
                        <Hash className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                        <code className="text-[10px] font-mono text-[var(--text-muted)] truncate flex-1">
                          {ev.hash.slice(0, 16)}…{ev.hash.slice(-8)}
                        </code>
                        <button
                          onClick={() => copyHash(ev.hash)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)]"
                          aria-label={t('audit.copyHash')}
                        >
                          {copied === ev.hash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>

                      {/* Expanded payload */}
                      {isExpanded && ev.payload && (
                        <pre className="mt-2 p-2 rounded bg-[var(--bg-secondary)] text-[10px] font-mono text-[var(--text-secondary)] overflow-x-auto max-h-48">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {/* Footer — integrity notice */}
        <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
          <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            {t('audit.integrityValid')}
          </p>
        </div>
      </div>
    </div>
  )
}
