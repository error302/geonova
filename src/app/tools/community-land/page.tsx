'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { computeCommunityLand } from '@/lib/cadastral/p2Modules'

export default function CommunityLandPage() {
  const [name, setName] = useState('Olosho-Oibor Community')
  const [county, setCounty] = useState('Kajiado')
  const [households, setHouseholds] = useState(250)
  const [csv, setCsv] = useState('500000,9800000\n500500,9800000\n500500,9800500\n500000,9800500')
  const [grazing, setGrazing] = useState(50)
  const [farming, setFarming] = useState(30)
  const [settlement, setSettlement] = useState(15)
  const [result, setResult] = useState<ReturnType<typeof computeCommunityLand> | null>(null)
  const compute = () => {
    const boundary = csv.trim().split('\n').map(l => { const [e, n] = l.split(',').map(Number); return { easting: e || 0, northing: n || 0 } })
    setResult(computeCommunityLand(boundary, name, county, households, { grazing: grazing / 100, farming: farming / 100, settlement: settlement / 100, public: (100 - grazing - farming - settlement) / 100 }))
  }
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader title="Community Land Survey" subtitle="Communal boundaries per Community Land Act 2016" reference="Community Land Act 2016 (Kenya)" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-zinc-400 mb-2">Community Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">County</label><input value={county} onChange={e => setCounty(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          </div>
          <div><label className="block text-sm text-zinc-400 mb-2">Number of Households</label><input type="number" value={households} onChange={e => setHouseholds(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          <div><label className="block text-sm text-zinc-400 mb-2">Boundary (easting, northing — one per line)</label><textarea value={csv} onChange={e => setCsv(e.target.value)} rows={5} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs text-zinc-400 mb-1">Grazing %</label><input type="number" value={grazing} onChange={e => setGrazing(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 mb-1">Farming %</label><input type="number" value={farming} onChange={e => setFarming(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm" /></div>
            <div><label className="block text-xs text-zinc-400 mb-1">Settlement %</label><input type="number" value={settlement} onChange={e => setSettlement(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-sm" /></div>
          </div>
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Compute Community Land</button>
        </div>
        <div>{result ? (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700"><p className="text-sm text-zinc-300">{result.summary}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Total Area</div><div className="text-lg font-bold text-white">{result.totalAreaHa.toFixed(4)} ha</div></div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Boundary Length</div><div className="text-lg font-bold text-white">{result.boundaryLength.toFixed(1)} m</div></div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Grazing</div><div className="text-lg font-bold text-green-400">{(result.grazingArea / 10000).toFixed(2)} ha</div></div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Farming</div><div className="text-lg font-bold text-amber-400">{(result.farmingArea / 10000).toFixed(2)} ha</div></div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Settlement</div><div className="text-lg font-bold text-blue-400">{(result.settlementArea / 10000).toFixed(2)} ha</div></div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Per Household</div><div className="text-lg font-bold text-[var(--accent)]">{result.householdQuota.toFixed(0)} m²</div></div>
            </div>
          </div>
        ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter data and click Compute.</div>}</div>
      </div>
    </div>
  )
}
