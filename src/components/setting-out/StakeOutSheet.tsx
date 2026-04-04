'use client'

import { type SettingOutResult } from '@/lib/computations/settingOutEngine'

interface Props {
  result: SettingOutResult
  station: { e: string; n: string; rl: string; ih: string }
}

export default function StakeOutSheet({ result, station }: Props) {
  const { instrumentStation, backsight, bsBearing, rows } = result
  const date = new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="bg-white text-black p-6 font-mono" style={{ fontFamily: 'Courier New, monospace', fontSize: '13px' }}>
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-3 mb-4">
        <div className="text-lg font-bold tracking-wider">METARDU STAKE OUT SHEET</div>
        <div className="text-xs mt-1">Survey Act Cap 299 | RDM 1.1 (2025)</div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-xs border border-black p-3">
        <div>
          <div><span className="font-bold">Instrument Station:</span> E {instrumentStation.e.toFixed(3)}, N {instrumentStation.n.toFixed(3)}</div>
          <div><span className="font-bold">Station RL:</span> {instrumentStation.rl.toFixed(3)} m</div>
          <div><span className="font-bold">IH:</span> {instrumentStation.ih.toFixed(3)} m</div>
        </div>
        <div>
          <div><span className="font-bold">Backsight To:</span> E {backsight.e.toFixed(3)}, N {backsight.n.toFixed(3)}</div>
          <div><span className="font-bold">BS Bearing:</span> {bsBearing}</div>
          <div><span className="font-bold">Date:</span> {date}</div>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-left py-2 pr-4 font-bold text-sm">PEG</th>
            <th className="text-right py-2 pr-4 font-bold text-sm">ANGLE</th>
            <th className="text-right py-2 pr-4 font-bold text-sm">DISTANCE</th>
            <th className="text-right py-2 font-bold text-sm">NOTES</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any) => (
            <tr key={row.id} className="border-b border-gray-300">
              <td className="py-2 pr-4 font-bold">{row.id}</td>
              <td className="py-2 pr-4 text-right">{row.HzAngle}"</td>
              <td className="py-2 pr-4 text-right">{row.HD.toFixed(3)}m</td>
              <td className="py-2 text-right text-gray-600">RL={row.designRL.toFixed(3)} TH={row.TH.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Warning */}
      <div className="border-2 border-black p-3 text-center font-bold text-sm">
        ⚠ CHECK: Re-observe BS bearing before each instrument setup
      </div>

      {/* Footer */}
      <div className="mt-4 text-center text-xs text-gray-500">
        METARDU | Survey Act Cap 299 | RDM 1.1 (2025) | Generated {date}
      </div>
    </div>
  )
}
