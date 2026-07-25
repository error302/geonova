'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { analyzeGrades } from '@/lib/engineering/p2Modules'

export default function GradeAnalysisPage() {
  const [csv, setCsv] = useState('0,1500\n200,1503\n400,1508\n600,1515\n800,1510\n1000,1505\n1200,1500')
  const [result, setResult] = useState<ReturnType<typeof analyzeGrades> | null>(null)
  const compute = () => {
    const profile = csv.trim().split('\n').map(l => { const [c, e] = l.split(',').map(Number); return { chainage: c || 0, elevation: e || 0 } })
    setResult(analyzeGrades(profile))
  }
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Grade Analysis" subtitle="Sustained grades, critical lengths, climbing lane warrants" reference="AASHTO Green Book | Kenya Road Standards" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div><label className="block text-sm text-zinc-400 mb-2">Grade Profile (chainage, elevation — one per line)</label><textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm" /></div>
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Analyze Grades</button>
        </div>
        <div>{result ? (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700"><p className="text-sm text-zinc-300">{result.summary}</p></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">Max Grade</div><div className="text-lg font-bold text-amber-400">{result.maxGrade.toFixed(2)}%</div></div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">Sustained</div><div className="text-lg font-bold text-orange-400">{result.sustainedGradeCount}</div></div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">Climbing Lanes</div><div className="text-lg font-bold text-red-400">{result.climbingLaneWarrants}</div></div>
            </div>
            <div className="overflow-x-auto max-h-64"><table className="w-full text-sm"><thead><tr className="text-zinc-500 border-b border-zinc-700"><th className="text-right py-2">From</th><th className="text-right py-2">To</th><th className="text-right py-2">Length</th><th className="text-right py-2">Grade %</th><th className="text-center py-2">Flags</th></tr></thead><tbody>{result.segments.map((s, i) => (<tr key={i} className="border-b border-zinc-800"><td className="py-1.5 text-right font-mono text-white">{s.startChainage.toFixed(0)}</td><td className="py-1.5 text-right font-mono text-white">{s.endChainage.toFixed(0)}</td><td className="py-1.5 text-right font-mono text-white">{s.length.toFixed(0)}m</td><td className={`py-1.5 text-right font-mono ${s.isCritical ? 'text-red-400' : s.isSustained ? 'text-amber-400' : 'text-green-400'}`}>{s.grade.toFixed(2)}%</td><td className="py-1.5 text-center">{s.needsClimbingLane ? '' : s.isCritical ? '' : s.isSustained ? '' : ''}</td></tr>))}</tbody></table></div>
          </div>
        ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter profile and click Analyze.</div>}</div>
      </div>
    </div>
  )
}
