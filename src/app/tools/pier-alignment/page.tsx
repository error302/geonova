'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { computePierAlignment } from '@/lib/engineering/p2Modules'

export default function PierAlignmentPage() {
  const [bearing, setBearing] = useState(45); const [startE, setStartE] = useState(500000); const [startN, setStartN] = useState(9800000)
  const [chainages, setChainages] = useState('0,30,60,90,120'); const [offsets, setOffsets] = useState('-5,0,5')
  const [result, setResult] = useState<ReturnType<typeof computePierAlignment> | null>(null)
  const compute = () => {
    const ch = chainages.split(',').map(Number).filter(n => !isNaN(n))
    const off = offsets.split(',').map(Number).filter(n => !isNaN(n))
    setResult(computePierAlignment(bearing, startE, startN, ch, off))
  }
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Bridge Pier Alignment" subtitle="Perpendicular offsets from centerline at pier locations" reference="Bridge Surveying Standards" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {[['Centerline Bearing (°)', bearing, setBearing], ['Start Easting', startE, setStartE], ['Start Northing', startN, setStartN]].map(([l, v, s]) => (
            <div key={l as string}><label className="block text-sm text-zinc-400 mb-2">{l as string}</label><input type="number" step="0.1" value={v as number} onChange={e => (s as (n: number) => void)(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          ))}
          <div><label className="block text-sm text-zinc-400 mb-2">Pier Chainages (comma-sep, m)</label><input value={chainages} onChange={e => setChainages(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          <div><label className="block text-sm text-zinc-400 mb-2">Offset Distances (comma-sep, m)</label><input value={offsets} onChange={e => setOffsets(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Compute Pier Alignment</button>
        </div>
        <div>{result ? (
          <div className="space-y-4">
            {result.map(pier => (
              <div key={pier.pierNumber} className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                <div className="flex items-center justify-between mb-2"><span className="font-mono text-amber-400 font-bold">Pier {pier.pierNumber}</span><span className="text-xs text-zinc-500">Chainage {pier.pierChainage}m</span></div>
                <div className="text-xs text-zinc-400 mb-2">Center: E={pier.centerE.toFixed(3)} N={pier.centerN.toFixed(3)}</div>
                <table className="w-full text-xs"><thead><tr className="text-zinc-500"><th className="text-left py-1">Label</th><th className="text-right py-1">Offset</th><th className="text-right py-1">Easting</th><th className="text-right py-1">Northing</th></tr></thead><tbody>{pier.offsets.map(o => (<tr key={o.label} className="border-t border-zinc-800"><td className="py-1 font-mono text-amber-400">{o.label}</td><td className="py-1 text-right text-white">{o.offset}m</td><td className="py-1 text-right font-mono text-white">{o.easting.toFixed(3)}</td><td className="py-1 text-right font-mono text-white">{o.northing.toFixed(3)}</td></tr>))}</tbody></table>
              </div>
            ))}
          </div>
        ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter data and click Compute.</div>}</div>
      </div>
    </div>
  )
}
