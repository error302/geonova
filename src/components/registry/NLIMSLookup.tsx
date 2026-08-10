'use client';

import { useState } from 'react'
import { Search, Building2, AlertTriangle, Info, Check, Download } from 'lucide-react'
import type { NLIMSParcel, NLIMSSearchResult } from '@/types/nlims'

interface NLIMSLookupProps {
  initialParcel?: string
  onParcelVerified?: (parcel: NLIMSParcel) => void
}

export default function NLIMSLookup({ initialParcel = '', onParcelVerified }: NLIMSLookupProps) {
  const [parcelNumber, setParcelNumber] = useState(initialParcel)
  const [county, setCounty] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<NLIMSSearchResult | null>(null)

  const handleSearch = async () => {
    if (!parcelNumber.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const params = new URLSearchParams({ parcel: parcelNumber })
      if (county) params.append('county', county)

      const res = await fetch(`/api/nlims/lookup?${params}`)
      const data = (await res.json()) as NLIMSSearchResult
      setResult(data)
    } catch (error) {
      console.error('NLIMS lookup error:', error)
      setResult({ found: false, error: 'Failed to search registry', isMockData: false })
    }

    setLoading(false)
  }

  const handleUseInProject = () => {
    if (result?.parcel && onParcelVerified) {
      onParcelVerified(result.parcel)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row flex-wrap gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1" htmlFor="parcel-number">
            Parcel Number
          </label>
          <input id="parcel-number"
            type="text"
            value={parcelNumber}
            onChange={e => setParcelNumber(e.target.value.toUpperCase())}
 placeholder="e.g., NAIROBI BLOCK 2/1234"
            className="w-full p-2 border rounded-lg"
          />
        </div>
        <div className="w-full md:w-48">
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-1" htmlFor="county">
            County
          </label>
          <input id="county"
            type="text"
            value={county}
            onChange={e => setCounty(e.target.value)}
 placeholder="e.g., Nairobi"
            className="w-full p-2 border rounded-lg"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleSearch}
            disabled={loading || !parcelNumber.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin">[Wait]</span>
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search Registry
          </button>
        </div>
      </div>

      {result && result.found && result.parcel && (
        <div className="border rounded-xl overflow-hidden">
          <div className={`p-4 ${
            result.parcel.status === 'REGISTERED' ? 'bg-green-50' :
            result.parcel.status === 'DISPUTED' ? 'bg-red-50' :
            'bg-yellow-50'
          }`}>
            <div className="flex items-center gap-2">
              {result.parcel.status === 'REGISTERED' && (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-800">REGISTERED</span>
                </>
              )}
              {result.parcel.status === 'DISPUTED' && (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-800">DISPUTED</span>
                </>
              )}
              {result.parcel.status === 'PENDING' && (
                <>
                  <Info className="w-5 h-5 text-yellow-600" />
                  <span className="font-semibold text-yellow-800">PENDING REGISTRATION</span>
                </>
              )}
              {result.parcel.status === 'CANCELLED' && (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-800">CANCELLED</span>
                </>
              )}
            </div>
          </div>

          {result.parcel.status === 'DISPUTED' && (
            <div className="p-4 bg-red-100 border-b border-red-200">
              <p className="text-red-800 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> This parcel has a registered dispute. Proceed only with written 
                instruction from client. Cite: Survey Act Cap 299 s.22
              </p>
            </div>
          )}

          <div className="p-4 bg-white">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[var(--text-muted)]">Parcel</p>
                <p className="font-medium">{result.parcel.parcelNumber}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Title Deed</p>
                <p className="font-medium">{result.parcel.titleDeedNumber}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Area</p>
                <p className="font-medium">
                  {result.parcel.area.toFixed(4)} m² ({result.parcel.areaHectares.toFixed(6)} ha)
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Owner Type</p>
                <p className="font-medium">{result.parcel.ownerType}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">County</p>
                <p className="font-medium">{result.parcel.county}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--text-muted)]">Last Transaction</p>
                <p className="font-medium">
                  {result.parcel.lastTransactionType} — {result.parcel.lastTransactionDate}
                </p>
              </div>
            </div>

            {result.parcel.encumbrances.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 rounded-lg">
                <h4 className="font-medium text-amber-800 mb-2">Encumbrances</h4>
                <ul className="space-y-2">
                  {result.parcel.encumbrances.map((enc, i) => (
                    <li key={`${enc}-${i}`} className="text-sm">
                      <span className="font-medium">{enc.type}:</span> {enc.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.parcel.encumbrances.length === 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-[var(--text-muted)]">No encumbrances registered</p>
              </div>
            )}

            {result.isMockData && (
              <div className="mt-4 p-3 bg-gray-100 rounded-lg flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-600 mt-0.5" />
                <p className="text-sm text-gray-600">
                  Registry data pending live verification. Confirm with Land Registry 
                  before finalising survey.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50 border-t flex gap-3">
            <button
              onClick={handleUseInProject}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              <Building2 className="w-4 h-4" />
              Use in Project
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100">
              <Download className="w-4 h-4" />
              Download Certificate
            </button>
          </div>
        </div>
      )}

      {result && !result.found && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">
            {result.error || 'Parcel not found in registry'}
          </p>
        </div>
      )}
    </div>
  )
}
