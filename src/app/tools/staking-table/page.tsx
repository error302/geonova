'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { ToolExportButtons } from '@/components/shared/ToolExportButtons'
import { computeCurveElements, generateChainageTable, generateStakingTable, type HorizontalCurveData } from '@/lib/engineering/stakingTable'

export default function StakingTablePage() {
  const [ipE, setIpE] = useState(500000)
  const [ipN, setIpN] = useState(9800000)
  const [deflection, setDeflection] = useState(30)
  const [radius, setRadius] = useState(200)
  const [ipChainage, setIpChainage] = useState(1000)
  const [incomingBearing, setIncomingBearing] = useState(45)
  const [interval, setInterval] = useState(20)
  const [offsets, setOffsets] = useState('-3.5,0,3.5')
  const [computed, setComputed] = useState<{ elements: any; chainageTable: any[]; stakingTable: any[] } | null>(null)

  const compute = () => {
    const data: HorizontalCurveData = { ipE, ipN, deflectionAngle: deflection, radius, ipChainage, incomingBearing }
    const elements = computeCurveElements(data)
    const chainageTable = generateChainageTable(data, elements, ipChainage + elements.tangent + 100)
    const offsetArr = offsets.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
    const stakingTable = generateStakingTable(data, elements, interval, undefined, undefined, offsetArr)
    setComputed({ elements, chainageTable, stakingTable })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader title="Staking Table" subtitle="Batch staking + chainage schedule for setting out" reference="Route Surveying Ch.6 | RDM 1.3" />
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm text-zinc-400 mb-2">IP Easting</label><input type="number" value={ipE} onChange={e => setIpE(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">IP Northing</label><input type="number" value={ipN} onChange={e => setIpN(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">Deflection Angle (°)</label><input type="number" step="0.1" value={deflection} onChange={e => setDeflection(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">Radius (m)</label><input type="number" value={radius} onChange={e => setRadius(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">IP Chainage (m)</label><input type="number" value={ipChainage} onChange={e => setIpChainage(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">Incoming Bearing (°)</label><input type="number" step="0.1" value={incomingBearing} onChange={e => setIncomingBearing(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">Stake Interval (m)</label><input type="number" value={interval} onChange={e => setInterval(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
            <div><label className="block text-sm text-zinc-400 mb-2">Offsets (comma-sep, m)</label><input type="text" value={offsets} onChange={e => setOffsets(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white" /></div>
          </div>
          <button onClick={compute} className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-black font-semibold rounded-lg">Generate Staking Table</button>
        </div>
        <div>
          {computed ? (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">T (m)</div><div className="text-lg font-bold text-amber-400">{computed.elements.tangent.toFixed(3)}</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">L (m)</div><div className="text-lg font-bold text-blue-400">{computed.elements.curveLength.toFixed(3)}</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">E (m)</div><div className="text-lg font-bold text-green-400">{computed.elements.external.toFixed(3)}</div></div>
                <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-700 text-center"><div className="text-xs text-zinc-400">M (m)</div><div className="text-lg font-bold text-violet-400">{computed.elements.midOrdinate.toFixed(3)}</div></div>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-zinc-500 border-b border-zinc-700"><th className="text-left py-2">Point</th><th className="text-left py-2">Description</th><th className="text-right py-2">Chainage</th><th className="text-right py-2">Easting</th><th className="text-right py-2">Northing</th><th className="text-right py-2">Bearing</th></tr></thead><tbody>{computed.chainageTable.map((r, i) => (<tr key={i} className="border-b border-zinc-800"><td className="py-2 font-mono text-amber-400">{r.point}</td><td className="py-2 text-zinc-300">{r.description}</td><td className="py-2 text-right font-mono text-white">{r.chainageLabel}</td><td className="py-2 text-right font-mono text-white">{r.easting.toFixed(3)}</td><td className="py-2 text-right font-mono text-white">{r.northing.toFixed(3)}</td><td className="py-2 text-right font-mono text-white">{r.bearing.toFixed(2)}°</td></tr>))}</tbody></table></div>
              <div className="overflow-x-auto"><h3 className="text-sm font-semibold text-white mb-2">Staking Table ({computed.stakingTable.length} stakes)</h3><table className="w-full text-sm"><thead><tr className="text-zinc-500 border-b border-zinc-700"><th className="text-right py-2">Chainage</th><th className="text-right py-2">Easting</th><th className="text-right py-2">Northing</th><th className="text-right py-2">Bearing</th><th className="text-right py-2">Segment</th></tr></thead><tbody>{computed.stakingTable.map((s, i) => (<tr key={i} className="border-b border-zinc-800"><td className="py-1.5 text-right font-mono text-amber-400">{s.chainageLabel}</td><td className="py-1.5 text-right font-mono text-white">{s.easting.toFixed(3)}</td><td className="py-1.5 text-right font-mono text-white">{s.northing.toFixed(3)}</td><td className="py-1.5 text-right font-mono text-white">{s.bearing.toFixed(2)}°</td><td className="py-1.5 text-right text-zinc-400">{s.segment}</td></tr>))}</tbody></table></div>
            </div>
          ) : <div className="p-6 bg-zinc-900 rounded-lg border border-zinc-700 text-center text-sm text-zinc-500">Enter curve data and click Generate.</div>}
        </div>
      </div>
    </div>
  )
}
