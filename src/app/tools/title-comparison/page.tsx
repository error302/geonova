'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { compareTitleDimensions, type TitleDimension, type SurveyedDimension } from '@/lib/cadastral/titleAndDispute'

export default function TitleComparisonPage() {
  const [titleCsv, setTitleCsv] = useState('A-B,45.0000,100.000\nB-C,135.0000,80.000\nC-A,250.0000,120.000')
  const [surveyedCsv, setSurveyedCsv] = useState('A-B,45.0010,100.005\nB-C,135.0020,80.010\nC-A,250.0015,119.990')
  const [result, setResult] = useState<ReturnType<typeof compareTitleDimensions> | null>(null)

  const compute = () => {
    const parse = (csv: string): TitleDimension[] => csv.trim().split('\n').map(line => {
      const [label, bearing, distance] = line.split(',').map(s => s.trim())
      return { label, bearing: parseFloat(bearing) || 0, distance: parseFloat(distance) || 0 }
    })
    const title = parse(titleCsv)
    const surveyed: SurveyedDimension[] = parse(surveyedCsv)
    setResult(compareTitleDimensions(title, surveyed))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Title Dimension Check" subtitle="Compare surveyed vs title deed dimensions" reference="Survey Regulations 1994 | Cap. 299" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div><label className="block text-sm text-zinc-400 mb-2">Title Deed Dimensions (label, bearing, distance)</label><textarea value={titleCsv} onChange={e => setTitleCsv(e.target.value)} rows={5} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm" /></div>
          <div><label className="block text-sm text-zinc-400 mb-2">Surveyed Dimensions (label, bearing, distance)</label><textarea value={surveyedCsv} onChange={e => setSurveyedCsv(e.target.value)} rows={5} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm" /></div>
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Compare Dimensions</button>
        </div>
        <div>
          {result ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${result.allWithinTolerance ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                <p className={`text-sm font-semibold ${result.allWithinTolerance ? 'text-green-400' : 'text-red-400'}`}>{result.allWithinTolerance ? ' All dimensions within tolerance' : ' Discrepancies detected'}</p>
                <p className="text-xs text-zinc-500 mt-1">{result.summary}</p>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-zinc-500 border-b border-zinc-700"><th className="text-left py-2">Leg</th><th className="text-right py-2">Title Brg</th><th className="text-right py-2">Surv Brg</th><th className="text-right py-2">ΔBrg (")</th><th className="text-right py-2">Title Dist</th><th className="text-right py-2">Surv Dist</th><th className="text-right py-2">ΔDist (mm)</th><th className="text-center py-2">Status</th></tr></thead><tbody>{result.comparisons.map((c, i) => (<tr key={i} className="border-b border-zinc-800"><td className="py-2 font-mono text-amber-400">{c.label}</td><td className="py-2 text-right font-mono text-white">{c.titleBearing.toFixed(4)}°</td><td className="py-2 text-right font-mono text-white">{c.surveyedBearing.toFixed(4)}°</td><td className={`py-2 text-right font-mono ${c.bearingWithinTolerance ? 'text-green-400' : 'text-red-400'}`}>{c.bearingDifference.toFixed(1)}</td><td className="py-2 text-right font-mono text-white">{c.titleDistance.toFixed(3)}</td><td className="py-2 text-right font-mono text-white">{c.surveyedDistance.toFixed(3)}</td><td className={`py-2 text-right font-mono ${c.distanceWithinTolerance ? 'text-green-400' : 'text-red-400'}`}>{c.distanceDifference.toFixed(1)}</td><td className="py-2 text-center">{c.severity === 'ok' ? '' : c.severity === 'warn' ? '' : ''}</td></tr>))}</tbody></table></div>
            </div>
          ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter title and surveyed dimensions, then click Compare.</div>}
        </div>
      </div>
    </div>
  )
}
