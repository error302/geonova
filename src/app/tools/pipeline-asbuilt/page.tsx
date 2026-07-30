'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { analyzePipelineAsBuilt, type PipelinePoint } from '@/lib/engineering/p2Modules'

export default function PipelineAsBuiltPage() {
  const [csv, setCsv] = useState('0,1500.000,1502.500,300\n50,1499.500,1502.000,300\n100,1499.000,1501.500,300')
  const [result, setResult] = useState<ReturnType<typeof analyzePipelineAsBuilt> | null>(null)
  const compute = () => {
    const points: PipelinePoint[] = csv.trim().split('\n').map(l => { const [c, i, g, d] = l.split(',').map(Number); return { chainage: c || 0, invertElevation: i || 0, groundElevation: g || 0, pipeDiameter: d || 300 } })
    setResult(analyzePipelineAsBuilt(points))
  }
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Pipeline As-Built" subtitle="Invert levels, cover depth, joint schedule" reference="Kenya Water Pipeline Standards" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div><label className="block text-sm text-zinc-400 mb-2">Pipeline Points (chainage, invert, ground, diameter_mm)</label><textarea value={csv} onChange={e => setCsv(e.target.value)} rows={6} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm" /></div>
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Analyze Pipeline</button>
        </div>
        <div>{result ? (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700"><p className="text-sm text-zinc-300">{result.summary}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Min Cover</div><div className={`text-lg font-bold ${result.minCover < 0.6 ? 'text-red-400' : 'text-green-400'}`}>{result.minCover.toFixed(3)}m</div></div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Max Grade</div><div className="text-lg font-bold text-amber-400">{result.maxGrade.toFixed(2)}%</div></div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-zinc-500 border-b border-zinc-700"><th className="text-right py-2">Chainage</th><th className="text-right py-2">Invert</th><th className="text-right py-2">Ground</th><th className="text-right py-2">Cover</th><th className="text-right py-2">Grade</th><th className="text-center py-2">OK?</th></tr></thead><tbody>{result.points.map((p, i) => (<tr key={i} className="border-b border-zinc-800"><td className="py-1.5 text-right font-mono text-white">{p.chainage.toFixed(0)}</td><td className="py-1.5 text-right font-mono text-white">{p.invertElevation.toFixed(3)}</td><td className="py-1.5 text-right font-mono text-white">{p.groundElevation.toFixed(3)}</td><td className={`py-1.5 text-right font-mono ${p.coverAdequate ? 'text-green-400' : 'text-red-400'}`}>{p.coverDepth.toFixed(3)}</td><td className="py-1.5 text-right font-mono text-amber-400">{p.grade.toFixed(2)}%</td><td className="py-1.5 text-center">{p.coverAdequate ? '' : ''}</td></tr>))}</tbody></table></div>
          </div>
        ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter data and click Analyze.</div>}</div>
      </div>
    </div>
  )
}
