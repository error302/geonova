'use client'

/**
 * FieldRecordVault — Crowdsourced historic F/R index
 *
 * Search and contribute historic Field Record numbers spatially.
 * Surveyors can find old F/R numbers by searching near their project area,
 * saving days of archival research at Ardhi House.
 *
 * Features:
 * - Text search (F/R number, locality, surveyor name)
 * - Proximity search (by coordinate + radius)
 * - Contribute new records
 * - View results with distance, year, surveyor, parcels
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Search, MapPin, Plus, Loader2, CheckCircle2,
  Calendar, User, FileText, ChevronRight, X,
} from 'lucide-react'
import { VirtualList } from '@/components/shared/VirtualList'

interface FieldRecord {
  id: string
  fr_number: string
  fr_type: string
  easting: number
  northing: number
  county?: string
  locality?: string
  survey_year?: number
  surveyor_name?: string
  parcel_numbers?: string[]
  description?: string
  is_verified: boolean
  distance_m?: number
}

export function FieldRecordVault() {
  const [records, setRecords] = useState<FieldRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchMode, setSearchMode] = useState<'text' | 'proximity'>('text')
  const [query, setQuery] = useState('')
  const [easting, setEasting] = useState('')
  const [northing, setNorthing] = useState('')
  const [radius, setRadius] = useState('5000')
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchMode === 'text' && query) {
        params.set('q', query)
      } else if (searchMode === 'proximity') {
        if (!easting || !northing) {
          setError('Enter easting and northing for proximity search')
          setLoading(false)
          return
        }
        params.set('easting', easting)
        params.set('northing', northing)
        params.set('radius', radius)
      }
      params.set('limit', '50')

      const res = await fetch(`/api/field-records?${params}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setRecords(data.data?.records || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [searchMode, query, easting, northing, radius])

  useEffect(() => {
    search()
  }, [])

  return (
    <div className="space-y-4">
      {/* Search header */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">F/R Index Vault</h2>
              <p className="text-[10px] text-gray-500">Crowdsourced historic field record search</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Contribute
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-[var(--bg-tertiary)]/50 rounded-lg">
          <button
            onClick={() => setSearchMode('text')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              searchMode === 'text' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-gray-400'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Search by Text
          </button>
          <button
            onClick={() => setSearchMode('proximity')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              searchMode === 'proximity' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-gray-400'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Search by Location
          </button>
        </div>

        {/* Search inputs */}
        {searchMode === 'text' ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              aria-label="Search F/R number, locality, surveyor..."
              className="w-full h-10 pl-9 pr-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none"
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[9px] text-gray-500 uppercase mb-0.5" htmlFor="easting">Easting</label>
              <input id="easting" type="number" value={easting} onChange={e => setEasting(e.target.value)} placeholder="534850" className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono" />
            </div>
            <div>
              <label className="block text-[9px] text-gray-500 uppercase mb-0.5" htmlFor="northing">Northing</label>
              <input id="northing" type="number" value={northing} onChange={e => setNorthing(e.target.value)} placeholder="9574220" className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono" />
            </div>
            <div>
              <label className="block text-[9px] text-gray-500 uppercase mb-0.5" htmlFor="radius-m">Radius (m)</label>
              <input id="radius-m" aria-label="Radius (m)" type="number" value={radius} onChange={e => setRadius(e.target.value)} className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono" />
            </div>
          </div>
        )}

        <button
          onClick={search}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:bg-[var(--accent-dim)] disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search Records
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddRecordForm
          onClose={() => setShowAddForm(false)}
          onAdded={() => { setShowAddForm(false); search() }}
        />
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400">{error}</div>
      )}

      {/* Results */}
      <div className="card p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No field records found</p>
            <p className="text-[10px] text-gray-600 mt-1">
              Try a different search or contribute a record to the vault
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {records.length} record{records.length !== 1 ? 's' : ''} found
              </span>
            </div>
            {records.length > 30 ? (
              <VirtualList
                items={records}
                itemHeight={88}
                height={400}
                renderItem={(record) => (
                  <div className="p-1">
                    <div className="flex items-start gap-3 p-2 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-colors">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium font-mono text-[var(--text-primary)]">{record.fr_number}</span>
                          {record.is_verified && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {record.distance_m != null && (
                            <span className="text-[9px] text-[var(--accent)] font-medium">
                              {record.distance_m < 1000 ? `${record.distance_m.toFixed(0)}m away` : `${(record.distance_m / 1000).toFixed(1)}km away`}
                            </span>
                          )}
                        </div>
                        {record.locality && <div className="text-[10px] text-gray-500 mt-0.5">{record.county ? `${record.county} — ` : ''}{record.locality}</div>}
                        <div className="flex items-center gap-3 mt-1 text-[9px] text-gray-600">
                          {record.survey_year && <span>{record.survey_year}</span>}
                          {record.surveyor_name && <span>{record.surveyor_name}</span>}
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                    </div>
                  </div>
                )}
              />
            ) : (
            <div className="space-y-2">
              {records.map(record => (
                <div
                  key={record.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)]/30 transition-colors"
                >
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono text-[var(--text-primary)]">
                        {record.fr_number}
                      </span>
                      {record.is_verified && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      )}
                      {record.distance_m != null && (
                        <span className="text-[9px] text-[var(--accent)] font-medium">
                          {record.distance_m < 1000
                            ? `${record.distance_m.toFixed(0)}m away`
                            : `${(record.distance_m / 1000).toFixed(1)}km away`}
                        </span>
                      )}
                    </div>
                    {record.locality && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {record.county ? `${record.county} — ` : ''}{record.locality}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[9px] text-gray-600">
                      {record.survey_year && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {record.survey_year}
                        </span>
                      )}
                      {record.surveyor_name && (
                        <span className="flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" />
                          {record.surveyor_name}
                        </span>
                      )}
                    </div>
                    {record.parcel_numbers && record.parcel_numbers.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {record.parcel_numbers.slice(0, 3).map((pn, i) => (
                          <span key={`${pn}-${i}`} className="text-[8px] px-1 py-0.5 rounded bg-white/[0.04] text-gray-400 font-mono">
                            {pn}
                          </span>
                        ))}
                        {record.parcel_numbers.length > 3 && (
                          <span className="text-[8px] text-gray-600">+{record.parcel_numbers.length - 3} more</span>
                        )}
                      </div>
                    )}
                    {record.description && (
                      <p className="text-[10px] text-gray-600 mt-1">{record.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                </div>
              ))}
            </div>
            )}
          </>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
        <FileText className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-blue-400/70 leading-relaxed">
          The F/R Index Vault is a crowdsourced spatial archive of historic survey field records.
          Search by area to find old F/R numbers, bearings, and reference markers used in past surveys.
          Contribute records you possess to help the surveying community save archival research time.
        </p>
      </div>
    </div>
  )
}

// ─── Add Record Form ─────────────────────────────────────────────

function AddRecordForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [frNumber, setFrNumber] = useState('')
  const [easting, setEasting] = useState('')
  const [northing, setNorthing] = useState('')
  const [county, setCounty] = useState('')
  const [locality, setLocality] = useState('')
  const [surveyYear, setSurveyYear] = useState('')
  const [surveyorName, setSurveyorName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/field-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frNumber, easting: parseFloat(easting), northing: parseFloat(northing),
          county, locality, surveyYear: surveyYear ? parseInt(surveyYear) : null,
          surveyorName, description,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }, [frNumber, easting, northing, county, locality, surveyYear, surveyorName, description, onAdded])

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-primary)]">Contribute F/R Record</span>
        <button onClick={onClose} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-0.5" htmlFor="f-r-number">F/R Number *</label>
          <input id="f-r-number" type="text" value={frNumber} onChange={e => setFrNumber(e.target.value)} placeholder="FR/123/456" className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono" />
        </div>
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-0.5" htmlFor="survey-year">Survey Year</label>
          <input id="survey-year" type="number" value={surveyYear} onChange={e => setSurveyYear(e.target.value)} placeholder="1995" className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-0.5" htmlFor="easting-2">Easting *</label>
          <input id="easting-2" type="number" value={easting} onChange={e => setEasting(e.target.value)} placeholder="534850" className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono" />
        </div>
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-0.5" htmlFor="northing-2">Northing *</label>
          <input id="northing-2" type="number" value={northing} onChange={e => setNorthing(e.target.value)} placeholder="9574220" className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white font-mono" />
        </div>
      </div>
      <input type="text" value={county} onChange={e => setCounty(e.target.value)} placeholder="County" className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white" />
      <input type="text" value={locality} onChange={e => setLocality(e.target.value)} placeholder="Locality" className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white" />
      <input type="text" value={surveyorName} onChange={e => setSurveyorName(e.target.value)} placeholder="Original Surveyor" className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white" />
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (bearings, tie points, reference markers)..." rows={2} className="w-full px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-white resize-none" />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={handleSave} disabled={saving || !frNumber || !easting || !northing} className="w-full h-8 rounded bg-[var(--accent)] text-black text-xs font-semibold disabled:opacity-40">
        {saving ? 'Saving...' : 'Contribute to Vault'}
      </button>
    </div>
  )
}
