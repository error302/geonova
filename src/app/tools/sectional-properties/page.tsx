'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { createSectionalPlan, type SectionalFloor, type SectionalUnit } from '@/lib/cadastral/sectionalAndEncumbrance'

export default function SectionalPropertiesPage() {
  const [buildingName, setBuildingName] = useState('Riverside Apartments')
  const [lrNumber, setLrNumber] = useState('NAIROBI/BLOCK 72/1234')
  const [units, setUnits] = useState<Array<{ unitNumber: string; floor: number; type: SectionalUnit['type']; area: number; description: string }>>([
    { unitNumber: 'A1', floor: 0, type: 'residential', area: 85, description: '2-bedroom' },
    { unitNumber: 'A2', floor: 0, type: 'residential', area: 85, description: '2-bedroom' },
    { unitNumber: 'B1', floor: 1, type: 'residential', area: 90, description: '3-bedroom' },
    { unitNumber: 'P1', floor: -1, type: 'parking', area: 12, description: 'Parking bay' },
  ])
  const [plan, setPlan] = useState<ReturnType<typeof createSectionalPlan> | null>(null)

  const addUnit = () => setUnits([...units, { unitNumber: `U${units.length + 1}`, floor: 0, type: 'residential', area: 50, description: '' }])
  const removeUnit = (i: number) => setUnits(units.filter((_, idx) => idx !== i))

  const generate = () => {
    const floors: SectionalFloor[] = []
    const floorMap = new Map<number, typeof units>()
    for (const u of units) {
      if (!floorMap.has(u.floor)) floorMap.set(u.floor, [])
      floorMap.get(u.floor)!.push(u)
    }
    for (const [floor, floorUnits] of floorMap) {
      const sectionUnits: SectionalUnit[] = floorUnits.map((u, i) => ({
        id: `unit-${i}`, unitNumber: u.unitNumber, floor, type: u.type, area: u.area, description: u.description,
      }))
      const totalArea = sectionUnits.reduce((s, u) => s + u.area, 0) + 20 // +20 for common
      floors.push({ floor, name: floor === 0 ? 'Ground Floor' : floor > 0 ? `Floor ${floor}` : `Basement ${-floor}`, totalArea, units: sectionUnits })
    }
    floors.sort((a, b) => a.floor - b.floor)
    setPlan(createSectionalPlan(buildingName, lrNumber, floors))
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <PageHeader title="Sectional Properties" subtitle="Apartment units, parking, common areas per Act 2020" reference="Sectional Properties Act 2020 (Kenya)" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-zinc-400 mb-2">Building Name</label><input value={buildingName} onChange={e => setBuildingName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">LR Number</label><input value={lrNumber} onChange={e => setLrNumber(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2"><label className="text-sm text-zinc-400">Units</label><button onClick={addUnit} className="text-xs px-2 py-1 bg-[var(--accent)] text-black rounded">+ Add Unit</button></div>
            <div className="space-y-2 max-h-64 overflow-y-auto">{units.map((u, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={u.unitNumber} onChange={e => { const v = [...units]; v[i].unitNumber = e.target.value; setUnits(v) }} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-xs" />
                <input type="number" value={u.floor} onChange={e => { const v = [...units]; v[i].floor = +e.target.value; setUnits(v) }} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-xs" />
                <select value={u.type} onChange={e => { const v = [...units]; v[i].type = e.target.value as SectionalUnit['type']; setUnits(v) }} className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-xs"><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="parking">Parking</option><option value="common">Common</option></select>
                <input type="number" value={u.area} onChange={e => { const v = [...units]; v[i].area = +e.target.value; setUnits(v) }} className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-white text-xs" />
                <button onClick={() => removeUnit(i)} className="text-red-400 text-xs px-1">×</button>
              </div>
            ))}</div>
          </div>
          <button onClick={generate} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Generate Sectional Plan</button>
        </div>
        <div>
          {plan ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">Total Area</div><div className="text-lg font-bold text-white">{plan.totalArea.toFixed(0)} m²</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">Unit Area</div><div className="text-lg font-bold text-amber-400">{plan.totalUnitArea.toFixed(0)} m²</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">Common Area</div><div className="text-lg font-bold text-blue-400">{plan.totalCommonArea.toFixed(0)} m²</div></div>
              </div>
              <div className="overflow-x-auto"><h3 className="text-sm font-semibold text-white mb-2">Participation Quotas</h3><table className="w-full text-sm"><thead><tr className="text-zinc-500 border-b border-zinc-700"><th className="text-left py-2">Unit</th><th className="text-right py-2">Quota (%)</th></tr></thead><tbody>{plan.participationQuotas.map((q, i) => (<tr key={i} className="border-b border-zinc-800"><td className="py-1.5 font-mono text-amber-400">{q.unitNumber}</td><td className="py-1.5 text-right font-mono text-white">{q.quota.toFixed(4)}%</td></tr>))}</tbody></table></div>
            </div>
          ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Add units and click Generate.</div>}
        </div>
      </div>
    </div>
  )
}
