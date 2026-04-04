'use client'

import { useState } from 'react'
import { ArrowRightLeft, Copy, Check } from 'lucide-react'
import type { DatumCode, TransformedCoord } from '@/types/gnss'

const DATUM_OPTIONS: { value: DatumCode; label: string }[] = [
  { value: 'WGS84', label: 'WGS84 (GPS)' },
  { value: 'ARC1960', label: 'ARC1960 (Kenya National)' },
  { value: 'CASSINI', label: 'Cassini-Soldner (Legacy)' },
  { value: 'GEOGRAPHIC_WGS84', label: 'Lat/Lon WGS84' },
  { value: 'GEOGRAPHIC_ARC', label: 'Lat/Lon ARC1960' },
  { value: 'UTM', label: 'UTM (specify zone)' },
]

export default function CoordinateTransformer() {
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [fromDatum, setFromDatum] = useState<DatumCode>('WGS84')
  const [toDatum, setToDatum] = useState<DatumCode>('ARC1960')
  const [fromZone, setFromZone] = useState('37')
  const [toZone, setToZone] = useState('37')
  const [fromHemisphere, setFromHemisphere] = useState<'N' | 'S'>('S')
  const [toHemisphere, setToHemisphere] = useState<'N' | 'S'>('S')
  
  // Single mode
  const [x, setX] = useState('')
  const [y, setY] = useState('')
  const [z, setZ] = useState('')
  
  // Batch mode
  const [batchInput, setBatchInput] = useState('')
  
  const [results, setResults] = useState<TransformedCoord[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const transform = async () => {
    setLoading(true)
    try {
      let coords = []
      
      if (mode === 'single') {
        coords = [{ x: parseFloat(x), y: parseFloat(y), z: z ? parseFloat(z) : undefined }]
      } else {
        // Parse batch input (CSV: id,x,y,z)
        coords = batchInput.split('\n')
          .filter((line: any) => line.trim())
          .map((line, i) => {
            const parts = line.split(',')
            return {
              id: parts[0] || String(i + 1),
              x: parseFloat(parts[1]),
              y: parseFloat(parts[2]),
              z: parts[3] ? parseFloat(parts[3]) : undefined
            }
          })
      }

      const response = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: coords,
          fromDatum,
          toDatum,
          fromZone: fromDatum === 'UTM' ? parseInt(fromZone) : undefined,
          fromHemisphere: fromDatum === 'UTM' ? fromHemisphere : undefined,
          toZone: toDatum === 'UTM' ? parseInt(toZone) : undefined,
          toHemisphere: toDatum === 'UTM' ? toHemisphere : undefined
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      
      setResults(data.results || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const copyResults = () => {
    const text = results.map((r: any) => 
      `${r.id || ''},${r.x?.toFixed(4)},${r.y?.toFixed(4)}${r.z !== undefined ? ',' + r.z.toFixed(3) : ''}`
    ).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('single')}
          className={`px-4 py-2 rounded-lg text-sm ${mode === 'single' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)]'}`}
        >
          Single
        </button>
        <button
          onClick={() => setMode('batch')}
          className={`px-4 py-2 rounded-lg text-sm ${mode === 'batch' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)]'}`}
        >
          Batch (CSV)
        </button>
      </div>

      {/* Datum Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">From Datum</label>
          <select
            value={fromDatum}
            onChange={e => setFromDatum(e.target.value as DatumCode)}
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg"
          >
            {DATUM_OPTIONS.map((d: any) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {fromDatum === 'UTM' && (
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                placeholder="Zone"
                value={fromZone}
                onChange={e => setFromZone(e.target.value)}
                className="w-20 px-2 py-1 bg-[var(--bg-tertiary)] border rounded text-sm"
              />
              <select
                value={fromHemisphere}
                onChange={e => setFromHemisphere(e.target.value as 'N' | 'S')}
                className="px-2 py-1 bg-[var(--bg-tertiary)] border rounded text-sm"
              >
                <option value="N">N</option>
                <option value="S">S</option>
              </select>
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">To Datum</label>
          <select
            value={toDatum}
            onChange={e => setToDatum(e.target.value as DatumCode)}
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg"
          >
            {DATUM_OPTIONS.map((d: any) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {toDatum === 'UTM' && (
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                placeholder="Zone"
                value={toZone}
                onChange={e => setToZone(e.target.value)}
                className="w-20 px-2 py-1 bg-[var(--bg-tertiary)] border rounded text-sm"
              />
              <select
                value={toHemisphere}
                onChange={e => setToHemisphere(e.target.value as 'N' | 'S')}
                className="px-2 py-1 bg-[var(--bg-tertiary)] border rounded text-sm"
              >
                <option value="N">N</option>
                <option value="S">S</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      {mode === 'single' ? (
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">X / Easting</label>
            <input
              type="number"
              value={x}
              onChange={e => setX(e.target.value)}
              placeholder="500000"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Y / Northing</label>
            <input
              type="number"
              value={y}
              onChange={e => setY(e.target.value)}
              placeholder="9900000"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Z / Elev (opt)</label>
            <input
              type="number"
              value={z}
              onChange={e => setZ(e.target.value)}
              placeholder="1500"
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-2">Paste CSV (id,x,y,z per line)</label>
          <textarea
            value={batchInput}
            onChange={e => setBatchInput(e.target.value)}
            placeholder="1,500000,9900000,1500&#10;2,500100,9900100,1510"
            rows={6}
            className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg font-mono text-sm"
          />
        </div>
      )}

      {/* Transform Button */}
      <button
        onClick={transform}
        disabled={loading || (mode === 'single' ? !x || !y : !batchInput)}
        className="w-full py-3 bg-[var(--accent)] text-black font-semibold rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <ArrowRightLeft className="w-4 h-4" />
        {loading ? 'Transforming...' : 'Transform'}
      </button>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Results</h3>
            <button
              onClick={copyResults}
              className="px-3 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-sm flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy CSV'}
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                <tr>
                  <th className="text-left p-2">ID</th>
                  <th className="text-right p-2">X</th>
                  <th className="text-right p-2">Y</th>
                  <th className="text-right p-2">Z</th>
                  <th className="text-right p-2">Round-trip</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)]">
                    <td className="p-2">{r.id || i + 1}</td>
                    <td className="p-2 text-right font-mono">{r.x?.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono">{r.y?.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono">{r.z?.toFixed(3) || '-'}</td>
                    <td className="p-2 text-right font-mono text-[var(--text-muted)]">
                      {r.roundTripError ? `${r.roundTripError.toFixed(2)}mm` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
