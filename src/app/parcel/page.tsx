'use client';

import { useState } from 'react'
import { analyzeBoundarySituation, type LegalGuidance } from '@/lib/legal/landLawEngine'

/**
 * Parcel Intelligence page.
 *
 * AUDIT FIX (2026-07-03):
 *   The "Parcel Search" tab previously called `searchParcel()` from
 *   `@/lib/parcel/parcelSearch`, which delegated to 3 mock-data libs
 *   (nlims.ts, nlis.ts, tanzania.ts) that all defined
 *   `const MOCK_*_DATA = []` and faked latency with setTimeout(500).
 *   Every search returned 0 results — the exact Minescan pattern.
 *
 *   Now the Parcel Search tab calls the REAL `/api/nlims/lookup` route,
 *   which checks personal vault → shared vault → NLIMS cache → live NLIMS API.
 *
 *   Uganda and Tanzania search removed (no real registry APIs — only
 *   mock libs existed, now deleted).
 *
 *   The Land Law Advisor tab was already real and is unchanged.
 */

interface NLIMSLookupResult {
  found: boolean
  parcel?: {
    parcelNumber: string
    registrationSection?: string
    county?: string
    area?: number
    areaHectares?: number
    ownerName?: string
    ownerType?: string
    titleDeedNumber?: string
    titleDeedDate?: string
    encumbrances?: string[]
    status?: string
    lastTransactionDate?: string
    lastTransactionType?: string
    source?: string
    fetchedAt?: string
  }
  isMockData?: boolean
  error?: string
  source?: string
  freshness?: string
  certificateDate?: string
}

export default function ParcelSearchPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'legal'>('search')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<NLIMSLookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [legalGuidance, setLegalGuidance] = useState<LegalGuidance | null>(null)

  const [parcelNumber, setParcelNumber] = useState('')
  const [county, setCounty] = useState('')

  const handleSearch = async () => {
    if (!parcelNumber.trim()) {
      setError('Enter a parcel number to search')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const params = new URLSearchParams({ parcel: parcelNumber.trim() })
      if (county.trim()) params.set('county', county.trim())

      const res = await fetch(`/api/nlims/lookup?${params}`, {
        credentials: 'include',
      })
      const data: NLIMSLookupResult = await res.json()

      if (!res.ok) {
        setError(data.error || `Search failed (HTTP ${res.status})`)
      } else if (!data.found) {
        setError(data.error || 'Parcel not found in vault or NLIMS cache. Live NLIMS API requires NLIMS_API_KEY to be configured server-side.')
      } else {
        setResult(data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const handleLegalGuidance = (situation: 'missing_monument' | 'overlap' | 'area_discrepancy' | 'encroachment' | 'coordinate_mismatch' | 'subdivision') => {
    const guidance = analyzeBoundarySituation(situation)
    setLegalGuidance(guidance)
  }

  const legalScenarios = [
    { id: 'missing_monument', label: 'Missing Boundary Monument' },
    { id: 'overlap', label: 'Parcel Boundary Overlap' },
    { id: 'area_discrepancy', label: 'Area Discrepancy' },
    { id: 'encroachment', label: 'Encroachment Detected' },
    { id: 'coordinate_mismatch', label: 'Coordinate Mismatch' },
    { id: 'subdivision', label: 'Subdivision Compliance' }
  ]

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Parcel Intelligence</h1>
        <p className="text-[var(--text-muted)] mb-8">Search Kenya NLIMS land registry and get legal boundary guidance</p>

        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'search'
                ? 'bg-sky-600 text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)]'
            }`}
          >
            Parcel Search (Kenya NLIMS)
          </button>
          <button
            onClick={() => setActiveTab('legal')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'legal'
                ? 'bg-sky-600 text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)]'
            }`}
          >
            Land Law Advisor
          </button>
        </div>

        {activeTab === 'search' && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-xl font-semibold mb-2">Search Land Registry</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Searches your personal parcel vault, the community shared vault, and the NLIMS cache.
              Live NLIMS API lookups require <code className="text-xs bg-[var(--bg-tertiary)] px-1 rounded">NLIMS_API_KEY</code> to be configured server-side.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="md:col-span-2">
                <label htmlFor="parcel-number" className="block text-sm font-medium text-[var(--text-muted)] mb-1">Parcel Number</label>
                <input
                  id="parcel-number"
                  type="text"
                  value={parcelNumber}
                  onChange={e => setParcelNumber(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="e.g., NRM/KISUMU/12345"
                  className="w-full p-2 border rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)]"
                />
              </div>
              <div>
                <label htmlFor="parcel-county" className="block text-sm font-medium text-[var(--text-muted)] mb-1">County (optional)</label>
                <input
                  id="parcel-county"
                  type="text"
                  value={county}
                  onChange={e => setCounty(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="e.g., Nairobi"
                  className="w-full p-2 border rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border-color)]"
                />
              </div>
            </div>

            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-sky-600 text-white py-2 px-6 rounded-lg hover:bg-sky-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Searching...' : 'Search NLIMS'}
            </button>

            {error && (
              <div className="mt-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
                {error}
              </div>
            )}

            {result && result.found && result.parcel && (
              <div className="mt-6 p-5 border rounded-lg bg-[var(--bg-secondary)] border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg text-[var(--text-primary)]">
                    {result.parcel.parcelNumber}
                  </h3>
                  <div className="flex gap-2">
                    {result.source && (
                      <span className="px-2 py-1 bg-blue-500/15 text-blue-400 text-xs rounded">
                        {result.source.replace(/_/g, ' ')}
                      </span>
                    )}
                    {result.isMockData && (
                      <span className="px-2 py-1 bg-yellow-500/15 text-yellow-400 text-xs rounded">
                        cached
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  {result.parcel.county && (
                    <div><span className="text-[var(--text-muted)]">County:</span> <span className="text-[var(--text-primary)]">{result.parcel.county}</span></div>
                  )}
                  {result.parcel.registrationSection && (
                    <div><span className="text-[var(--text-muted)]">Section:</span> <span className="text-[var(--text-primary)]">{result.parcel.registrationSection}</span></div>
                  )}
                  {result.parcel.areaHectares != null && (
                    <div><span className="text-[var(--text-muted)]">Area:</span> <span className="text-[var(--text-primary)]">{result.parcel.areaHectares.toFixed(4)} ha</span></div>
                  )}
                  {result.parcel.titleDeedNumber && (
                    <div><span className="text-[var(--text-muted)]">Title Deed:</span> <span className="text-[var(--text-primary)]">{result.parcel.titleDeedNumber}</span></div>
                  )}
                  {result.parcel.status && (
                    <div><span className="text-[var(--text-muted)]">Status:</span> <span className="text-[var(--text-primary)]">{result.parcel.status}</span></div>
                  )}
                  {result.parcel.ownerType && (
                    <div><span className="text-[var(--text-muted)]">Owner Type:</span> <span className="text-[var(--text-primary)]">{result.parcel.ownerType}</span></div>
                  )}
                  {result.certificateDate && (
                    <div><span className="text-[var(--text-muted)]">Certificate Date:</span> <span className="text-[var(--text-primary)]">{result.certificateDate}</span></div>
                  )}
                  {result.freshness && (
                    <div><span className="text-[var(--text-muted)]">Freshness:</span> <span className="text-[var(--text-primary)]">{result.freshness}</span></div>
                  )}
                </div>

                {result.parcel.ownerName && result.parcel.ownerName !== '[Community Shared - Owner Hidden]' && (
                  <div><span className="text-[var(--text-muted)] text-sm">Owner:</span> <span className="text-[var(--text-primary)] text-sm">{result.parcel.ownerName}</span></div>
                )}

                {result.parcel.encumbrances && result.parcel.encumbrances.length > 0 && (
                  <div>
                    <span className="text-[var(--text-muted)] text-sm">Encumbrances:</span>
                    <ul className="text-sm text-[var(--text-primary)] ml-4 mt-1">
                      {result.parcel.encumbrances.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                )}

                {result.parcel.fetchedAt && (
                  <p className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-color)]">
                    Data fetched: {new Date(result.parcel.fetchedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'legal' && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-xl font-semibold mb-4">Land Law Advisory System</h2>
            <p className="text-[var(--text-muted)] mb-6">
              Get professional guidance on boundary situations based on cadastral surveying principles.
              References: Brown's Boundary Control and Legal Principles
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3">Select Situation</h3>
                <div className="space-y-2">
                  {legalScenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      onClick={() => handleLegalGuidance(scenario.id as 'missing_monument' | 'overlap' | 'area_discrepancy' | 'encroachment' | 'coordinate_mismatch' | 'subdivision')}
                      className="w-full text-left p-3 border rounded-lg hover:bg-[var(--bg-secondary)] hover:border-sky-300 transition"
                    >
                      {scenario.label}
                    </button>
                  ))}
                </div>
              </div>

              {legalGuidance && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${
                    legalGuidance.severity === 'critical' ? 'bg-red-50 border border-red-200' :
                    legalGuidance.severity === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-blue-50 border border-blue-200'
                  }`}>
                    <h3 className="font-semibold">{legalGuidance.scenario}</h3>
                    <span className={`text-xs px-2 py-1 rounded uppercase ${
                      legalGuidance.severity === 'critical' ? 'bg-red-200 text-red-800' :
                      legalGuidance.severity === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-blue-200 text-blue-800'
                    }`}>
                      {legalGuidance.severity}
                    </span>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Principles</h4>
                    <ul className="text-sm space-y-1">
                      {legalGuidance.principles.map((p: string, i: number) => (
                        <li key={i} className="text-[var(--text-muted)]">• {p}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="text-sm space-y-1">
                      {legalGuidance.recommendations.map((r: string, i: number) => (
                        <li key={i} className="text-[var(--text-muted)]"> {r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
                    <h4 className="font-medium mb-2 text-sm">References</h4>
                    {legalGuidance.references.map((ref: { book: string; chapter: string }, i: number) => (
                      <p key={i} className="text-xs text-[var(--text-muted)]">
                        {ref.book}, Chapter: {ref.chapter}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
