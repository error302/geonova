'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { evaluateAdversePossession } from '@/lib/cadastral/p2Modules'

export default function AdversePossessionPage() {
  const [startYear, setStartYear] = useState(2010)
  const [area, setArea] = useState(500)
  const [isOpen, setIsOpen] = useState(true)
  const [isExclusive, setIsExclusive] = useState(true)
  const [isHostile, setIsHostile] = useState(true)
  const [isContinuous, setIsContinuous] = useState(true)
  const [result, setResult] = useState<ReturnType<typeof evaluateAdversePossession> | null>(null)
  const compute = () => setResult(evaluateAdversePossession(startYear, new Date().getFullYear(), area, isOpen, isExclusive, isHostile, isContinuous))
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader title="Adverse Possession" subtitle="Evaluate 12-year occupation claim per Limitation Act" reference="Limitation of Actions Act (Kenya) | Section 38" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-zinc-400 mb-2">Occupation Start Year</label><input type="number" value={startYear} onChange={e => setStartYear(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">Area (m²)</label><input type="number" value={area} onChange={e => setArea(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          </div>
          <div className="space-y-2">
            {[['Open and notorious (visible to public)', isOpen, setIsOpen], ['Exclusive (not shared with others)', isExclusive, setIsExclusive], ['Hostile (without owner permission)', isHostile, setIsHostile], ['Continuous (no gaps in occupation)', isContinuous, setIsContinuous]].map(([label, val, set]) => (
              <label key={label as string} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"><input type="checkbox" checked={val as boolean} onChange={e => (set as (b: boolean) => void)(e.target.checked)} className="rounded" /> {label as string}</label>
            ))}
          </div>
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Evaluate Claim</button>
        </div>
        <div>{result ? (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${result.allElementsMet ? 'border-green-500/20 bg-green-500/5' : result.meetsStatutoryPeriod ? 'border-amber-500/20 bg-amber-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
              <p className={`text-sm font-semibold ${result.allElementsMet ? 'text-green-400' : result.meetsStatutoryPeriod ? 'text-amber-400' : 'text-red-400'}`}>{result.allElementsMet ? ' Claim Valid' : result.meetsStatutoryPeriod ? '! Partial Claim' : ' Period Not Met'}</p>
              <p className="text-xs text-zinc-500 mt-1">{result.recommendation}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Years of Occupation</div><div className="text-lg font-bold text-white">{result.yearsOfOccupation}</div></div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Years Remaining</div><div className="text-lg font-bold text-amber-400">{result.yearsRemaining}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['Open & Notorious', result.isOpenAndNotorious], ['Exclusive', result.isExclusive], ['Hostile', result.isHostile], ['Continuous', result.isContinuous]].map(([label, val]) => (
                <div key={label as string} className={`p-2 rounded-lg border text-center ${val ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}><span className="text-xs">{val ? '' : ''} {label as string}</span></div>
              ))}
            </div>
          </div>
        ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter data and click Evaluate.</div>}</div>
      </div>
    </div>
  )
}
