'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { analyzeEncumbrances, type Encumbrance, type EncumbranceType } from '@/lib/cadastral/sectionalAndEncumbrance'

export default function EncumbrancePage() {
  const [parcelArea, setParcelArea] = useState(10000)
  const [encumbrances, setEncumbrances] = useState<Array<{ type: EncumbranceType; description: string; holder: string; corridorWidth: number; coords: string }>>([
    { type: 'wayleave', description: 'KPLC 33kV power line', holder: 'Kenya Power', corridorWidth: 15, coords: '500000,9800000\n500100,9800000' },
  ])
  const [result, setResult] = useState<ReturnType<typeof analyzeEncumbrances> | null>(null)

  const add = () => setEncumbrances([...encumbrances, { type: 'easement', description: '', holder: '', corridorWidth: 3, coords: '' }])
  const remove = (i: number) => setEncumbrances(encumbrances.filter((_, idx) => idx !== i))

  const analyze = () => {
    const encs: Encumbrance[] = encumbrances.map((e, i) => ({
      id: `enc-${i}`,
      type: e.type,
      description: e.description,
      holder: e.holder,
      corridorWidth: e.corridorWidth,
      coordinates: e.coords.trim().split('\n').map(line => {
        const [east, north] = line.split(',').map(s => parseFloat(s.trim()))
        return { easting: east || 0, northing: north || 0 }
      }).filter(p => !isNaN(p.easting)),
      registeredDate: new Date().toISOString(),
    }))
    setResult(analyzeEncumbrances(encs, parcelArea))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Encumbrance Registration" subtitle="Wayleaves, easements, restrictions on parcels" reference="Land Registration Act 2012" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div><label className="block text-sm text-zinc-400 mb-2">Parcel Area (m²)</label><input type="number" value={parcelArea} onChange={e => setParcelArea(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          <div>
            <div className="flex justify-between items-center mb-2"><label className="text-sm text-zinc-400">Encumbrances</label><button onClick={add} className="text-xs px-2 py-1 bg-[var(--accent)] text-black rounded">+ Add</button></div>
            <div className="space-y-3">{encumbrances.map((e, i) => (
              <div key={i} className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 space-y-2">
                <div className="flex gap-2">
                  <select value={e.type} onChange={ev => { const v = [...encumbrances]; v[i].type = ev.target.value as EncumbranceType; setEncumbrances(v) }} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-xs"><option value="wayleave">Wayleave</option><option value="easement">Easement</option><option value="restriction">Restriction</option><option value="caveat">Caveat</option><option value="lease">Lease</option><option value="charge">Charge</option></select>
                  <input value={e.description} onChange={ev => { const v = [...encumbrances]; v[i].description = ev.target.value; setEncumbrances(v) }} placeholder="Description" className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-xs" />
                  <button onClick={() => remove(i)} className="text-red-400 text-xs px-1">×</button>
                </div>
                <input value={e.holder} onChange={ev => { const v = [...encumbrances]; v[i].holder = ev.target.value; setEncumbrances(v) }} placeholder="Holder/beneficiary" className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-xs" />
                <div className="flex gap-2">
                  <input type="number" value={e.corridorWidth} onChange={ev => { const v = [...encumbrances]; v[i].corridorWidth = +ev.target.value; setEncumbrances(v) }} placeholder="Width (m)" className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-xs" />
                  <textarea value={e.coords} onChange={ev => { const v = [...encumbrances]; v[i].coords = ev.target.value; setEncumbrances(v) }} placeholder="Coords (E,N per line)" rows={2} className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-xs font-mono" />
                </div>
              </div>
            ))}</div>
          </div>
          <button onClick={analyze} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Analyze Encumbrances</button>
        </div>
        <div>
          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">Affected Area</div><div className="text-lg font-bold text-amber-400">{result.totalAffectedArea.toFixed(2)} m²</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700"><div className="text-xs text-zinc-400">% of Parcel</div><div className="text-lg font-bold text-white">{result.affectedPercent.toFixed(2)}%</div></div>
              </div>
              <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700"><p className="text-sm text-zinc-300">{result.summary}</p></div>
              {result.restrictions.length > 0 && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"><p className="text-xs text-red-400 font-semibold">Development Restrictions: {result.restrictions.length}</p>{result.restrictions.map((r, i) => (<p key={i} className="text-xs text-zinc-400 mt-1">{r.type}: {r.description}</p>))}</div>}
            </div>
          ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Add encumbrances and click Analyze.</div>}
        </div>
      </div>
    </div>
  )
}
