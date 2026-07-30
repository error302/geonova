'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { computeSuperelevationRunout } from '@/lib/engineering/p2Modules'

export default function SuperRunoutPage() {
  const [speed, setSpeed] = useState(60); const [radius, setRadius] = useState(200)
  const [laneW, setLaneW] = useState(3.5); const [lanes, setLanes] = useState(2)
  const [result, setResult] = useState<ReturnType<typeof computeSuperelevationRunout> | null>(null)
  const compute = () => setResult(computeSuperelevationRunout(speed, radius, laneW, lanes))
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader title="Superelevation Runout" subtitle="Cross-slope transition profile diagram" reference="RDM 1.3 Section 5.3" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {[['Design Speed (km/h)', speed, setSpeed], ['Radius (m)', radius, setRadius], ['Lane Width (m)', laneW, setLaneW], ['Number of Lanes', lanes, setLanes]].map(([label, val, set]) => (
            <div key={label as string}><label className="block text-sm text-zinc-400 mb-2">{label as string}</label><input type="number" step="0.1" value={val as number} onChange={e => (set as (n: number) => void)(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          ))}
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Compute Runout</button>
        </div>
        <div>{result ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[['Tangent Runout', result.tangentRunout, 'm', 'text-blue-400'], ['Runout Length', result.runoutLength, 'm', 'text-amber-400'], ['Total Transition', result.totalTransition, 'm', 'text-green-400']].map(([l, v, u, c]) => (
                <div key={l as string} className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">{l}</div><div className={`text-lg font-bold ${c}`}>{(v as number).toFixed(2)} {u}</div></div>
              ))}
            </div>
            <div className="overflow-x-auto max-h-64"><table className="w-full text-sm"><thead><tr className="text-zinc-500 border-b border-zinc-700"><th className="text-right py-2">Chainage (m)</th><th className="text-right py-2">Cross-Slope (%)</th><th className="text-left py-2">Phase</th></tr></thead><tbody>{result.profile.filter((_, i) => i % 5 === 0).map((p, i) => (<tr key={i} className="border-b border-zinc-800"><td className="py-1.5 text-right font-mono text-white">{p.chainage.toFixed(1)}</td><td className="py-1.5 text-right font-mono text-amber-400">{p.crossSlope.toFixed(3)}%</td><td className="py-1.5 text-left text-zinc-400">{p.description}</td></tr>))}</tbody></table></div>
          </div>
        ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter data and click Compute.</div>}</div>
      </div>
    </div>
  )
}
