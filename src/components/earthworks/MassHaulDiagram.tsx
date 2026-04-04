'use client'

import { type EarthworkResult } from '@/lib/computations/earthworksEngine'

interface Props {
  result: EarthworkResult
}

export default function MassHaulDiagram({ result }: Props) {
  const { massOrdinates, shrinkageFactor } = result

  if (massOrdinates.length < 2) return null

  const minCh = massOrdinates[0].chainage
  const maxCh = massOrdinates[massOrdinates.length - 1].chainage
  const chRange = maxCh - minCh || 1

  const maxOrd = Math.max(...massOrdinates.map((o: any) => o.ordinate), 0)
  const minOrd = Math.min(...massOrdinates.map((o: any) => o.ordinate), 0)
  const ordRange = Math.max(maxOrd - minOrd, 1)

  const svgW = 800
  const svgH = 300
  const padX = 60
  const padY = 30
  const plotW = svgW - padX * 2
  const plotH = svgH - padY * 2

  function toSvgX(ch: number): number {
    return padX + ((ch - minCh) / chRange) * plotW
  }
  function toSvgY(ord: number): number {
    return padY + ((maxOrd - ord) / ordRange) * plotH
  }

  // Build path
  const pathPts = massOrdinates.map((o, i) =>
    `${i === 0 ? 'M' : 'L'} ${toSvgX(o.chainage).toFixed(1)} ${toSvgY(o.ordinate).toFixed(1)}`
  ).join(' ')

  // Balance line (zero)
  const zeroY = toSvgY(0)

  // Fill surplus (above zero)
  let surplusPath = `M ${toSvgX(minCh).toFixed(1)} ${zeroY.toFixed(1)} `
  for (const o of massOrdinates) {
    if (o.ordinate >= 0) {
      surplusPath += `L ${toSvgX(o.chainage).toFixed(1)} ${toSvgY(o.ordinate).toFixed(1)} `
    }
  }
  surplusPath += `L ${toSvgX(maxCh).toFixed(1)} ${zeroY.toFixed(1)} Z`

  // Fill deficit (below zero)
  let deficitPath = `M ${toSvgX(minCh).toFixed(1)} ${zeroY.toFixed(1)} `
  for (const o of massOrdinates) {
    if (o.ordinate <= 0) {
      deficitPath += `L ${toSvgX(o.chainage).toFixed(1)} ${toSvgY(o.ordinate).toFixed(1)} `
    }
  }
  deficitPath += `L ${toSvgX(maxCh).toFixed(1)} ${zeroY.toFixed(1)} Z`

  // X axis ticks
  const numTicks = Math.min(10, massOrdinates.length)
  const tickStep = chRange / numTicks
  const xTicks: number[] = []
  for (let i = 0; i <= numTicks; i++) {
    xTicks.push(minCh + (i / numTicks) * chRange)
  }

  // Y axis ticks
  const ordStep = ordRange / 5
  const yTicks: number[] = []
  for (let i = 0; i <= 5; i++) {
    yTicks.push(minOrd + i * ordStep)
  }

  const fmtCh = (ch: number) => {
    const km = Math.floor(ch / 1000)
    const m = ch % 1000
    return km > 0 ? `${km}+${m.toFixed(0)}` : `${m.toFixed(0)}`
  }

  const maxIdx = massOrdinates.reduce((maxI, o, i, arr) => o.ordinate > arr[maxI].ordinate ? i : maxI, 0)
  const minIdx = massOrdinates.reduce((minI, o, i, arr) => o.ordinate < arr[minI].ordinate ? i : minI, 0)
  const peakOrd = massOrdinates[maxIdx]
  const troughOrd = massOrdinates[minIdx]

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
        <h3 className="text-sm font-semibold">Mass Haul Diagram</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Adjusted cut (&times; {shrinkageFactor} shrinkage) &minus; fill | Source: Ghilani &amp; Wolf Ch.26, Section 26.6
        </p>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ background: '#fafafa' }}>
          {/* Y axis */}
          <line x1={padX} y1={padY} x2={padX} y2={svgH - padY} stroke="#333" strokeWidth="1" />
          {/* X axis */}
          <line x1={padX} y1={svgH - padY} x2={svgW - padX} y2={svgH - padY} stroke="#333" strokeWidth="1" />

          {/* Balance line */}
          <line x1={padX} y1={zeroY} x2={svgW - padX} y2={zeroY} stroke="#888" strokeWidth="1" strokeDasharray="5,3" />

          {/* Surplus area */}
          <path d={surplusPath} fill="#ff660018" stroke="none" />
          {/* Deficit area */}
          <path d={deficitPath} fill="#0066ff18" stroke="none" />

          {/* Curve */}
          <path d={pathPts} fill="none" stroke="#333" strokeWidth="2" />

          {/* Peak annotation */}
          <circle cx={toSvgX(peakOrd.chainage)} cy={toSvgY(peakOrd.ordinate)} r="4" fill="#ff6600" />
          <text x={toSvgX(peakOrd.chainage) + 5} y={toSvgY(peakOrd.ordinate) - 5} fontSize="9" fill="#ff6600" fontFamily="monospace">
            Max: {peakOrd.ordinate.toFixed(1)} m&sup3;
          </text>

          {/* Trough annotation */}
          <circle cx={toSvgX(troughOrd.chainage)} cy={toSvgY(troughOrd.ordinate)} r="4" fill="#0066ff" />
          <text x={toSvgX(troughOrd.chainage) + 5} y={toSvgY(troughOrd.ordinate) + 14} fontSize="9" fill="#0066ff" fontFamily="monospace">
            Min: {troughOrd.ordinate.toFixed(1)} m&sup3;
          </text>

          {/* X axis ticks */}
          {xTicks.map((ch, i) => (
            <g key={i}>
              <line x1={toSvgX(ch)} y1={svgH - padY} x2={toSvgX(ch)} y2={svgH - padY + 5} stroke="#333" strokeWidth="0.5" />
              <text x={toSvgX(ch)} y={svgH - padY + 15} fontSize="8" fill="#666" textAnchor="middle" fontFamily="monospace">
                {fmtCh(ch)}
              </text>
            </g>
          ))}

          {/* Y axis ticks */}
          {yTicks.map((ord, i) => (
            <g key={i}>
              <line x1={padX - 5} y1={toSvgY(ord)} x2={padX} y2={toSvgY(ord)} stroke="#333" strokeWidth="0.5" />
              <text x={padX - 8} y={toSvgY(ord) + 3} fontSize="8" fill="#666" textAnchor="end" fontFamily="monospace">
                {ord >= 1000 ? `${(ord / 1000).toFixed(1)}k` : ord.toFixed(0)}
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text x={svgW / 2} y={svgH - 2} fontSize="9" fill="#333" textAnchor="middle" fontFamily="monospace">
            Chainage
          </text>
          <text x={12} y={svgH / 2} fontSize="9" fill="#333" textAnchor="middle" fontFamily="monospace" transform={`rotate(-90, 12, ${svgH / 2})`}>
            Mass Ordinate (m&sup3;)
          </text>
        </svg>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[var(--bg-tertiary)] rounded p-2">
            <p className="text-[var(--text-muted)]">Peak Ordinate</p>
            <p className="text-orange-400 text-sm">{peakOrd.ordinate.toFixed(2)} m&sup3;</p>
            <p className="text-[var(--text-muted)] text-[10px]">at {fmtCh(peakOrd.chainage)}</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded p-2">
            <p className="text-[var(--text-muted)]">Trough Ordinate</p>
            <p className="text-blue-400 text-sm">{troughOrd.ordinate.toFixed(2)} m&sup3;</p>
            <p className="text-[var(--text-muted)] text-[10px]">at {fmtCh(troughOrd.chainage)}</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded p-2">
            <p className="text-[var(--text-muted)]">Free Haul Distance</p>
            <p className="text-[var(--text-primary)] text-sm">100 m (RDM 1.3)</p>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded p-2">
            <p className="text-[var(--text-muted)]">Net Balance</p>
            <p className={`text-sm ${peakOrd.ordinate - Math.abs(troughOrd.ordinate) >= 0 ? 'text-yellow-400' : 'text-blue-400'}`}>
              {(peakOrd.ordinate - Math.abs(troughOrd.ordinate)).toFixed(2)} m&sup3;
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
