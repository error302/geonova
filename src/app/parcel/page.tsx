'use client'

import { useState } from 'react'
import { searchParcel, getSupportedCountries } from '@/lib/parcel/parcelSearch'
import { analyzeBoundarySituation } from '@/lib/legal/landLawEngine'

export default function ParcelSearchPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'legal'>('search')
  const [loading, setLoading] = useState(false)
  const [parcels, setParcels] = useState<any[]>([])
  const [legalGuidance, setLegalGuidance] = useState<any>(null)
  
  const [searchParams, setSearchParams] = useState({
    country: 'Kenya' as 'Kenya' | 'Uganda' | 'Tanzania',
    parcelId: '',
    county: '',
    region: ''
  })

  const countries = getSupportedCountries()

  const handleSearch = async () => {
    setLoading(true)
    try {
      const results = await searchParcel(searchParams)
      setParcels(results)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const handleLegalGuidance = (situation: string) => {
    const guidance = analyzeBoundarySituation(situation as any)
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
        <p className="text-[var(--text-muted)] mb-8">Search land registries and get legal boundary guidance</p>

        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === 'search'
                ? 'bg-sky-600 text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)]'
            }`}
          >
            Parcel Search
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
            <h2 className="text-xl font-semibold mb-4">Search Land Registry</h2>
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Country</label>
                <select
                  value={searchParams.country}
                  onChange={e => setSearchParams({ ...searchParams, country: e.target.value as any })}
                  className="w-full p-2 border rounded-lg"
                >
                  {countries.map((c: any) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  {searchParams.country === 'Kenya' ? 'Parcel ID' : searchParams.country === 'Uganda' ? 'Title Number' : 'Plot Number'}
                </label>
                <input
                  type="text"
                  value={searchParams.parcelId}
                  onChange={e => setSearchParams({ ...searchParams, parcelId: e.target.value })}
                  placeholder="e.g., NRM/KISUMU/12345"
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">
                  {searchParams.country === 'Tanzania' ? 'Region' : 'County/District'}
                </label>
                <input
                  type="text"
                  value={searchParams.country === 'Tanzania' ? searchParams.region : searchParams.county}
                  onChange={e => searchParams.country === 'Tanzania' 
                    ? setSearchParams({ ...searchParams, region: e.target.value })
                    : setSearchParams({ ...searchParams, county: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full bg-sky-600 text-white py-2 px-4 rounded-lg hover:bg-sky-700 disabled:opacity-50"
                >
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {parcels.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium text-[var(--text-muted)]">Found {parcels.length} Parcel(s)</h3>
                {parcels.map((parcel, i) => (
                  <div key={i} className="p-4 border rounded-lg hover:bg-[var(--bg-secondary)]">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-lg">{parcel.parcelId}</h4>
                        <p className="text-sm text-[var(--text-muted)]">
                          {parcel.registrySource} | {parcel.country}
                        </p>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm"><span className="font-medium">Owners:</span> {parcel.owners.join(', ')}</p>
                          <p className="text-sm"><span className="font-medium">Land Use:</span> {parcel.landUse}</p>
                          <p className="text-sm"><span className="font-medium">Tenure:</span> {parcel.tenure}</p>
                          <p className="text-sm"><span className="font-medium">Area:</span> {parcel.area.toLocaleString()} {parcel.areaUnit}</p>
                        </div>
                      </div>
                      {parcel.geometry && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                          Has Geometry
                        </span>
                      )}
                    </div>
                    {parcel.coordinates && (
                      <p className="text-xs text-[var(--text-muted)] mt-2">
                        Coordinates: {parcel.coordinates.latitude?.toFixed(5)}, {parcel.coordinates.longitude?.toFixed(5)}
                      </p>
                    )}
                  </div>
                ))}
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
                  {legalScenarios.map((scenario: any) => (
                    <button
                      key={scenario.id}
                      onClick={() => handleLegalGuidance(scenario.id)}
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
                        <li key={i} className="text-[var(--text-muted)]">✓ {r}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
                    <h4 className="font-medium mb-2 text-sm">References</h4>
                    {legalGuidance.references.map((ref: any, i: number) => (
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
