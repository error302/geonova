'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, MapPin } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

interface SurveyorProfile {
  id: string
  fullName: string
  iskNumber?: string
  verifiedIsk: boolean
  firmName?: string
  county?: string
  specialty?: string
  avatarUrl?: string
  projectsCount: number
}

export default function SurveyorDirectoryPage() {
  const [surveyors, setSurveyors] = useState<SurveyorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [countyFilter, setCountyFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ limit: '50' })
    if (search) params.set('q', search)
    if (countyFilter) params.set('county', countyFilter)

    fetch(`/api/community/surveyors?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.data) setSurveyors(data.data)
      })
      .catch(() => { if (!cancelled) setSurveyors([]) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [search, countyFilter])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title="Surveyor Directory"
        subtitle="Verified land surveyors across East Africa"
        reference="ISK-verified professionals · Public profiles"
      />

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, firm, or ISK number..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
          />
        </div>
        <input
          type="text"
          value={countyFilter}
          onChange={e => setCountyFilter(e.target.value)}
          placeholder="Filter by county..."
          className="sm:w-48 px-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40"
        />
      </div>

      {/* Results count */}
      <p className="text-xs text-[var(--text-muted)] mb-4">
        {loading ? 'Loading...' : `${surveyors.length} surveyor${surveyors.length !== 1 ? 's' : ''} found`}
      </p>

      {/* Surveyor grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-[var(--bg-tertiary)] rounded w-2/3" />
                  <div className="h-2 bg-[var(--bg-tertiary)] rounded w-1/2" />
                </div>
              </div>
              <div className="h-2 bg-[var(--bg-tertiary)] rounded w-full mb-2" />
              <div className="h-2 bg-[var(--bg-tertiary)] rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : surveyors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]/50 p-12 text-center">
          <Search className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">No surveyors found</h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
            {search || countyFilter
              ? 'Try adjusting your search or filters.'
              : 'Verified ISK surveyors who create a public profile will appear here. Be the first — add your firm info in Settings.'}
          </p>
          {!search && !countyFilter && (
            <Link
              href="/settings/profile"
              className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              Set up your profile <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {surveyors.map((s) => {
            const hue = s.fullName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
            return (
              <div
                key={s.id}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 hover:border-[var(--accent)]/30 transition-all"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${hue + 40}, 70%, 35%))`,
                    }}
                  >
                    {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {s.fullName}
                    </h3>
                    {s.county && (
                      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {s.county}
                      </p>
                    )}
                  </div>
                  {s.verifiedIsk && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                      Verified
                    </span>
                  )}
                </div>

                {s.iskNumber && (
                  <p className="text-[10px] font-mono text-[var(--text-muted)] mb-2">
                    ISK {s.iskNumber}
                  </p>
                )}

                {s.firmName && (
                  <p className="text-xs text-[var(--text-secondary)] mb-2">{s.firmName}</p>
                )}

                {s.specialty && (
                  <span
                    className="inline-block px-2 py-1 rounded text-[10px] font-semibold mb-3"
                    style={{
                      background: `hsl(${hue}, 60%, 15%)`,
                      color: `hsl(${hue}, 80%, 70%)`,
                    }}
                  >
                    {s.specialty}
                  </span>
                )}

                <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">
                    {s.projectsCount} project{s.projectsCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Back to community */}
      <div className="mt-8">
        <Link
          href="/community"
          className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
        >
          ← Back to Community
        </Link>
      </div>
    </div>
  )
}
