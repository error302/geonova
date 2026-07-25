'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin, Plus, Search, AlertCircle } from 'lucide-react'
import { searchBoundaryMonuments, type BoundaryMonument, formatMonumentCoordinate, formatMonumentAccuracy, formatTreatyCitation, getVerificationStatusColor, getConditionColor } from '@/lib/survey/boundaryMonuments'

export default function BoundaryMonumentsPage() {
  const [monuments, setMonuments] = useState<BoundaryMonument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await searchBoundaryMonuments(searchQuery ? { monument_number: searchQuery } : { limit: 100 })
      setMonuments(result.data)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [searchQuery])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Boundary Monuments</h1>
          <p className="text-sm text-[var(--text-muted)]">International/bilateral boundary markers with treaty citations and epoch-aware coordinates</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">
          <Plus className="w-4 h-4" /> Add Monument
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by monument number or boundary name..."
          className="flex-1 h-9 px-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none" />
        <button onClick={load} className="px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--border-hover)] flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5" /> Search
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-xs text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {loading ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">Loading...</div>
      ) : monuments.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">No boundary monuments found. Click "Add Monument" to create one.</div>
      ) : (
        <div className="grid gap-3">
          {monuments.map(m => (
            <div key={m.id} className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--accent)]" />
                    <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{m.monument_number}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full bg-${getVerificationStatusColor(m.verification_status)}-500/15 text-${getVerificationStatusColor(m.verification_status)}-400`}>{m.verification_status}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full bg-${getConditionColor(m.condition)}-500/15 text-${getConditionColor(m.condition)}-400`}>{m.condition}</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">{m.boundary_name} · {m.monument_type}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--text-muted)]">
                <div><span className="opacity-60">Treaty:</span> <span className="text-[var(--text-secondary)]">{formatTreatyCitation(m)}</span></div>
                <div><span className="opacity-60">Coordinate:</span> <span className="text-[var(--text-secondary)] font-mono">{formatMonumentCoordinate(m)}</span></div>
                <div><span className="opacity-60">Accuracy:</span> <span className="text-[var(--text-secondary)] font-mono">{formatMonumentAccuracy(m)}</span></div>
                <div><span className="opacity-60">Location:</span> <span className="text-[var(--text-secondary)]">{[m.county, m.locality].filter(Boolean).join(', ') || '—'}</span></div>
              </div>
              {m.physical_description && <div className="text-[10px] text-[var(--text-muted)] mt-2">{m.physical_description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
