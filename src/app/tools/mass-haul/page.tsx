'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { optimizeMassHaul, type MassHaulPoint } from '@/lib/engineering/massHaulOptimization'

export default function MassHaulPage() {
  const [csvInput, setCsvInput] = useState('0,0\n100,50\n200,30\n300,-20\n400,-40\n500,10\n600,60\n700,0')
  const [freeHaul, setFreeHaul] = useState(100)
  const [overhaulRate, setOverhaulRate] = useState(5)
  const [result, setResult] = useState<ReturnType<typeof optimizeMassHaul> | null>(null)

  const compute = () => {
    const points: MassHaulPoint[] = csvInput.trim().split('\n').map(line => {
      const [ch, vol] = line.split(',').map(s => parseFloat(s.trim()))
      return { chainage: ch || 0, cumulativeVolume: vol || 0 }
    })
    setResult(optimizeMassHaul(points, freeHaul, overhaulRate))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Mass Haul Optimization" subtitle="Free-haul, overhaul, borrow/spoil analysis" reference="Punmia Ch.11 | Kenya Road Specs" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div><label className="block text-sm text-zinc-400 mb-2">Mass Haul Curve (chainage, cumulative_volume — one per line)</label><textarea value={csvInput} onChange={e => setCsvInput(e.target.value)} rows={8} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-zinc-400 mb-2">Free-Haul Limit (m)</label><input type="number" value={freeHaul} onChange={e => setFreeHaul(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">Overhaul Rate (KES/m³·m)</label><input type="number" value={overhaulRate} onChange={e => setOverhaulRate(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          </div>
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Optimize Mass Haul</button>
        </div>
        <div>
          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Free-Haul Volume</div><div className="text-lg font-bold text-green-400">{result.totalFreeHaulVolume.toFixed(1)} m³</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Overhaul</div><div className="text-lg font-bold text-amber-400">{result.totalOverhaul.toFixed(1)} m³·m</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Borrow</div><div className="text-lg font-bold text-red-400">{result.totalBorrow.toFixed(1)} m³</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Spoil</div><div className="text-lg font-bold text-blue-400">{result.totalSpoil.toFixed(1)} m³</div></div>
              </div>
              <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                <div className="text-sm font-bold text-white mb-2">Estimated Cost</div>
                <div className="text-2xl font-bold text-[var(--accent)]">KES {result.estimatedCost.toLocaleString()}</div>
                <div className="text-xs text-zinc-500 mt-1">Balance line at {result.balanceLine.toFixed(1)} m³</div>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-zinc-500 border-b border-zinc-700"><th className="text-right py-2">From</th><th className="text-right py-2">To</th><th className="text-right py-2">Vol (m³)</th><th className="text-right py-2">Avg Haul (m)</th><th className="text-right py-2">Overhaul</th><th className="text-right py-2">Type</th></tr></thead><tbody>{result.segments.map((s, i) => (<tr key={i} className="border-b border-zinc-800"><td className="py-1.5 text-right font-mono text-white">{s.fromChainage.toFixed(0)}</td><td className="py-1.5 text-right font-mono text-white">{s.toChainage.toFixed(0)}</td><td className="py-1.5 text-right font-mono text-white">{s.volume.toFixed(1)}</td><td className="py-1.5 text-right font-mono text-white">{s.avgHaulDistance.toFixed(1)}</td><td className="py-1.5 text-right font-mono text-amber-400">{s.overhaul > 0 ? `${s.overhaulVolume.toFixed(1)} m³·m` : '—'}</td><td className="py-1.5 text-right text-zinc-400">{s.isBorrow ? 'Borrow' : s.isSpoil ? 'Spoil' : 'Haul'}</td></tr>))}</tbody></table></div>
            </div>
          ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter mass haul data and click Optimize.</div>}
        </div>
      </div>
    </div>
  )
}
