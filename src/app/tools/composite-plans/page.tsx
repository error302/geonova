'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { createCompositePlan, type CompositePlanParcel } from '@/lib/cadastral/p2Modules'

export default function CompositePlansPage() {
  const [csv, setCsv] = useState('LR/1,500,500100,9800100\nLR/2,800,500200,9800200\nLR/3,300,500050,9800050\nLR/4,1200,500300,9800300\nLR/5,650,500150,9800150')
  const [paperSize, setPaperSize] = useState<'A4'|'A3'|'A2'|'A1'|'A0'>('A1')
  const [result, setResult] = useState<ReturnType<typeof createCompositePlan> | null>(null)
  const compute = () => {
    const parcels: CompositePlanParcel[] = csv.trim().split('\n').map(l => { const [lr, area, e, n] = l.split(',').map(s => s.trim()); return { lrNumber: lr, area: parseFloat(area) || 0, easting: parseFloat(e) || 0, northing: parseFloat(n) || 0 } })
    setResult(createCompositePlan(parcels, paperSize))
  }
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader title="Composite Plans" subtitle="Multi-parcel layout on A1/A0 sheets, registry index" reference="Survey of Kenya: Registry Index Map Standards" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div><label className="block text-sm text-zinc-400 mb-2">Parcels (LR number, area m², easting, northing)</label><textarea value={csv} onChange={e => setCsv(e.target.value)} rows={6} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white font-mono text-sm" /></div>
          <div><label className="block text-sm text-zinc-400 mb-2">Paper Size</label><select value={paperSize} onChange={e => setPaperSize(e.target.value as any)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white"><option value="A4">A4</option><option value="A3">A3</option><option value="A2">A2</option><option value="A1">A1</option><option value="A0">A0</option></select></div>
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Generate Composite Plan</button>
        </div>
        <div>{result ? (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-700"><p className="text-sm text-zinc-300">{result.summary}</p></div>
            {result.sheets.map(sheet => (
              <div key={sheet.sheetNumber} className="p-4 bg-zinc-900 rounded-lg border border-zinc-700">
                <div className="flex justify-between mb-2"><span className="font-bold text-amber-400">Sheet {sheet.sheetNumber}</span><span className="text-xs text-zinc-500">1:{sheet.scale} on {sheet.paperSize}</span></div>
                <div className="space-y-1">{sheet.parcels.map(p => (<div key={p.lrNumber} className="flex justify-between text-xs"><span className="font-mono text-white">{p.lrNumber}</span><span className="text-zinc-400">{(p.area / 10000).toFixed(4)} ha</span></div>))}</div>
              </div>
            ))}
          </div>
        ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter parcels and click Generate.</div>}</div>
      </div>
    </div>
  )
}
