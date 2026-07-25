'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { analyzeBoundaryDispute, type BoundaryPoint } from '@/lib/cadastral/titleAndDispute'

export default function BoundaryDisputePage() {
  const [legalCsv, setLegalCsv] = useState('500000,9800000\n500100,9800000\n500100,9800100\n500000,9800100')
  const [occupiedCsv, setOccupiedCsv] = useState('500000,9800000\n500105,9800000\n500105,9800095\n500000,9800095')
  const [result, setResult] = useState<ReturnType<typeof analyzeBoundaryDispute> | null>(null)

  const compute = () => {
    const parse = (csv: string): BoundaryPoint[] => csv.trim().split('\n').map(line => {
      const [e, n] = line.split(',').map(s => parseFloat(s.trim()))
      return { easting: e || 0, northing: n || 0 }
    })
    setResult(analyzeBoundaryDispute(parse(legalCsv), parse(occupiedCsv)))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Boundary Dispute Analysis" subtitle="Overlay legal boundary vs physical occupation" reference="Cap. 299 | Land Registration Act 2012" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div><label className="block text-sm text-zinc-400 mb-2">Legal Boundary (easting, northing — one per line)</label><textarea value={legalCsv} onChange={e => setLegalCsv(e.target.value)} rows={6} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm" /></div>
          <div><label className="block text-sm text-zinc-400 mb-2">Occupied Boundary (fence/wall GPS — easting, northing)</label><textarea value={occupiedCsv} onChange={e => setOccupiedCsv(e.target.value)} rows={6} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm" /></div>
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Analyze Dispute</button>
        </div>
        <div>
          {result ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${result.severity === 'none' ? 'border-green-500/20 bg-green-500/5' : result.severity === 'minor' ? 'border-amber-500/20 bg-amber-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                <p className={`text-sm font-semibold ${result.severity === 'none' ? 'text-green-400' : result.severity === 'minor' ? 'text-amber-400' : 'text-red-400'}`}>{result.severity === 'none' ? ' No encroachment' : result.severity === 'minor' ? '! Minor encroachment' : ' Major encroachment'}</p>
                <p className="text-xs text-zinc-500 mt-1">{result.summary}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Legal Area</div><div className="text-lg font-bold text-white">{result.legalArea.toFixed(2)} m²</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Occupied Area</div><div className="text-lg font-bold text-white">{result.occupiedArea.toFixed(2)} m²</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-red-500/20"><div className="text-xs text-zinc-400">Encroachment</div><div className="text-lg font-bold text-red-400">{result.encroachmentArea.toFixed(2)} m²</div><div className="text-xs text-zinc-500">{result.encroachmentPercent.toFixed(2)}% of legal</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Max Distance</div><div className="text-lg font-bold text-amber-400">{result.maxEncroachmentDistance.toFixed(3)} m</div></div>
              </div>
            </div>
          ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter boundary coordinates and click Analyze.</div>}
        </div>
      </div>
    </div>
  )
}
