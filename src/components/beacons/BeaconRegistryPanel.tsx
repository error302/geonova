'use client'

/**
 * BeaconRegistryPanel — Searchable global beacon database
 *
 * Features:
 * - Text search by beacon number
 * - Proximity search by coordinate + radius
 * - Filter by county and beacon type
 * - Add new beacon to registry
 * - Click beacon to view details and copy coordinates
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Search, MapPin, Plus, Loader2, Copy, Check,
  Building2, Navigation, X,
} from 'lucide-react'

interface Beacon {
  id: string
  beacon_number: string
  beacon_type: string
  easting: number
  northing: number
  elevation?: number | null
  county?: string | null
  sub_county?: string | null
  locality?: string | null
  sheet_number?: string | null
  condition?: string | null
  description?: string | null
  distance_m?: number
}

type SearchMode = 'text' | 'proximity'

export function BeaconRegistryPanel() {
  const [mode, setMode] = useState<SearchMode>('text')
  const [query, setQuery] = useState('')
  const [easting, setEasting] = useState('')
  const [northing, setNorthing] = useState('')
  const [radius, setRadius] = useState('500')
  const [county, setCounty] = useState('')
  const [beaconType, setBeaconType] = useState('')
  const [results, setResults] = useState<Beacon[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const search = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (mode === 'text') {
        if (query) params.set('q', query)
      } else {
        if (!easting || !northing) {
          setError('Enter easting and northing for proximity search')
          setLoading(false)
          return
        }
        params.set('easting', easting)
        params.set('northing', northing)
        params.set('radius', radius)
      }
      if (county) params.set('county', county)
      if (beaconType) params.set('beacon_type', beaconType)
      params.set('limit', '50')

      const res = await fetch(`/api/beacons?${params}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json() as { data?: { beacons?: Beacon[] } }
      setResults(data.data?.beacons || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [mode, query, easting, northing, radius, county, beaconType])

  // Auto-search on mount - intentionally mount-only (explicit Search button / Enter
  // re-search), so `search` is deliberately omitted from deps.
  useEffect(() => {
    search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCopy = useCallback((beacon: Beacon) => {
    const text = `${beacon.beacon_number} E:${beacon.easting.toFixed(3)} N:${beacon.northing.toFixed(3)}`
    navigator.clipboard.writeText(text)
    setCopiedId(beacon.id)
    setTimeout(() => setCopiedId(null), 2000)
  }, [])

  return (
    <div className="space-y-4">
      {/* Search header */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Beacon Registry</h2>
              <p className="text-[10px] text-gray-500">Search the global survey beacon database</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Beacon
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-[var(--bg-tertiary)]/50 rounded-lg">
          <button
            onClick={() => setMode('text')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'text' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Search by Name
          </button>
          <button
            onClick={() => setMode('proximity')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === 'proximity' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            Search by Location
          </button>
        </div>

        {/* Search inputs */}
        {mode === 'text' ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              aria-label="Enter beacon number (e.g., KP/12/345, MB/001)..."
              className="w-full h-10 pl-9 pr-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none"
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="easting">Easting</label>
              <input id="easting"
                type="number"
                value={easting}
                onChange={e => setEasting(e.target.value)}
 placeholder="257412"
                className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="northing">Northing</label>
              <input id="northing"
                type="number"
                value={northing}
                onChange={e => setNorthing(e.target.value)}
 placeholder="9857641"
                className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="radius-m">Radius (m)</label>
              <input id="radius-m" aria-label="Radius (m)"
                type="number"
                value={radius}
                onChange={e => setRadius(e.target.value)}
                className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono focus:border-[var(--accent)]/30 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={county}
            onChange={e => setCounty(e.target.value)}
            aria-label="County (optional)"
            className="h-9 px-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none"
          />
          <select
            value={beaconType}
            onChange={e => setBeaconType(e.target.value)}
            className="h-9 px-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[var(--accent)]/30 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="concrete">Concrete Beacon</option>
            <option value="iron_pin">Iron Pin</option>
            <option value="stone">Stone</option>
            <option value="pipe">Pipe</option>
            <option value="reference_object">Reference Object</option>
          </select>
        </div>

        <button
          onClick={search}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:bg-[var(--accent-dim)] transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search Beacons
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddBeaconForm
          onClose={() => setShowAddForm(false)}
          onAdded={() => { setShowAddForm(false); search() }}
        />
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {results.length} beacon{results.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MapPin className="w-8 h-8 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">No beacons found</p>
            <p className="text-[10px] text-gray-600 mt-1">
              Try a different search or add a new beacon to the registry.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map(beacon => (
              <div
                key={beacon.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-colors group"
              >
                <div className="shrink-0 w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)] font-mono">
                      {beacon.beacon_number}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-400 uppercase">
                      {beacon.beacon_type}
                    </span>
                    {beacon.condition && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        beacon.condition === 'good' ? 'bg-emerald-500/10 text-emerald-400' :
                        beacon.condition === 'disturbed' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {beacon.condition}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                    E: {beacon.easting.toFixed(3)} | N: {beacon.northing.toFixed(3)}
                    {beacon.elevation != null && ` | Elev: ${beacon.elevation.toFixed(2)}m`}
                    {beacon.distance_m != null && (
                      <span className="text-[var(--accent)] ml-2">
                        ({beacon.distance_m.toFixed(1)}m away)
                      </span>
                    )}
                  </div>
                  {beacon.county && (
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-600">
                      <Building2 className="w-2.5 h-2.5" />
                      {beacon.county}
                      {beacon.locality && ` — ${beacon.locality}`}
                      {beacon.sheet_number && ` (Sheet: ${beacon.sheet_number})`}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(beacon)}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 opacity-0 group-hover:opacity-100 transition-all"
                  title="Copy coordinates"
                >
                  {copiedId === beacon.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Add Beacon Form ─────────────────────────────────────────────────────

function AddBeaconForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [beaconNumber, setBeaconNumber] = useState('')
  const [beaconType, setBeaconType] = useState('concrete')
  const [easting, setEasting] = useState('')
  const [northing, setNorthing] = useState('')
  const [county, setCounty] = useState('')
  const [locality] = useState('')
  const [condition, setCondition] = useState('good')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/beacons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beaconNumber, beaconType,
          easting: parseFloat(easting), northing: parseFloat(northing),
          county, locality, condition,
        }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Failed to add beacon')
      }
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }, [beaconNumber, beaconType, easting, northing, county, locality, condition, onAdded])

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add Beacon to Registry</h3>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="beacon-number">Beacon Number</label>
          <input id="beacon-number" type="text" value={beaconNumber} onChange={e => setBeaconNumber(e.target.value)} placeholder="KP/12/345" className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs font-mono text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="type">Type</label>
          <select id="type" value={beaconType} onChange={e => setBeaconType(e.target.value)} className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)]">
            <option value="concrete">Concrete</option>
            <option value="iron_pin">Iron Pin</option>
            <option value="stone">Stone</option>
            <option value="pipe">Pipe</option>
            <option value="reference_object">Reference Object</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="easting-m">Easting (m)</label>
          <input id="easting-m" type="number" step="0.001" value={easting} onChange={e => setEasting(e.target.value)} placeholder="257412.800" className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs font-mono text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="northing-m">Northing (m)</label>
          <input id="northing-m" type="number" step="0.001" value={northing} onChange={e => setNorthing(e.target.value)} placeholder="9857641.200" className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs font-mono text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={county} onChange={e => setCounty(e.target.value)} placeholder="County" className="h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none" />
        <select value={condition} onChange={e => setCondition(e.target.value)} className="h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)]">
          <option value="good">Good Condition</option>
          <option value="disturbed">Disturbed</option>
          <option value="damaged">Damaged</option>
          <option value="missing">Missing</option>
        </select>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-9 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs text-gray-400 hover:text-gray-200">Cancel</button>
        <button
          onClick={handleSave}
          disabled={saving || !beaconNumber || !easting || !northing}
          className="flex-1 h-9 rounded-lg bg-[var(--accent)] text-black text-xs font-semibold hover:bg-[var(--accent-dim)] disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Add Beacon'}
        </button>
      </div>
    </div>
  )
}
