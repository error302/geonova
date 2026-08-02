'use client'

// VerticalCurveProfile — professional profile (elevation) diagram of a
// parabolic vertical curve, as drawn on a road design profile sheet.
//
// Geometry (Ghilani & Wolf Ch.25, RDM 1.3 §5.4):
//   - BVC = Beginning of Vertical Curve (x = 0)
//   - EVC = End of Vertical Curve (x = L)
//   - VPI = Vertical Point of Intersection (where the tangents meet)
//   - y(x) = BVC_RL + (G1/100)·x + A·x²/(200·L)
//
// The profile plots chainage on the horizontal axis and reduced level (RL)
// on the vertical axis, overlaid with the two tangent grades (dashed) and
// the parabola (solid). BVC, VPI, EVC and the peak/sag point are marked.

export interface VerticalProfileRow {
  chainage: number
  x: number
  RL: number
  grade: number
}

export interface VerticalCurveProfileProps {
  rows: VerticalProfileRow[]
  bvcChainage: number
  evcChainage: number
  vpiChainage: number
  bvcRL: number
  evcRL: number
  vpiRL: number
  g1: number
  g2: number
  isCrest: boolean
  peakPoint?: { chainage: number; RL: number } | null
}

const W = 680
const H = 420
const ML = 70
const MR = 20
const MT = 30
const MB = 55

export function VerticalCurveProfile({
  rows,
  bvcChainage,
  evcChainage,
  vpiChainage,
  bvcRL,
  evcRL,
  vpiRL,
  g1,
  g2,
  isCrest,
  peakPoint,
}: VerticalCurveProfileProps) {
  const plotW = W - ML - MR
  const plotH = H - MT - MB

  const chainages = rows.map(r => r.chainage)
  const rls = rows.map(r => r.RL)
  const minCh = Math.min(bvcChainage, ...chainages)
  const maxCh = Math.max(evcChainage, ...chainages)
  const padCh = (maxCh - minCh) * 0.06 || 1
  const minRl = Math.min(bvcRL, evcRL, vpiRL, ...rls) - 2
  const maxRl = Math.max(bvcRL, evcRL, vpiRL, ...rls) + 2

  const chRange = (maxCh - minCh) + 2 * padCh || 1
  const rlRange = maxRl - minRl || 1

  const px = (ch: number) => ML + ((ch - (minCh - padCh)) / chRange) * plotW
  const py = (rl: number) => MT + plotH - ((rl - minRl) / rlRange) * plotH

  // Parabola path
  const parabolaPath = rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${px(r.chainage).toFixed(1)},${py(r.RL).toFixed(1)}`).join(' ')

  // Tangent grade lines
  const tangentInEndX = px(vpiChainage)
  const tangentInEndY = py(vpiRL)
  const tangentInStartX = px(bvcChainage)
  const tangentInStartY = py(bvcRL)
  const tangentOutStartX = px(vpiChainage)
  const tangentOutStartY = py(vpiRL)
  const tangentOutEndX = px(evcChainage)
  const tangentOutEndY = py(evcRL)

  // X axis ticks
  const xTicks = 8
  const xTickVals: number[] = []
  for (let i = 0; i <= xTicks; i++) xTickVals.push((minCh - padCh) + (chRange * i) / xTicks)

  // Y axis ticks
  const yTicks = 6
  const yTickVals: number[] = []
  for (let i = 0; i <= yTicks; i++) yTickVals.push(minRl + (rlRange * i) / yTicks)

  const peakX = peakPoint ? px(peakPoint.chainage) : 0
  const peakY = peakPoint ? py(peakPoint.RL) : 0

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Vertical Curve Profile</h3>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            {isCrest ? 'Crest' : 'Sag'} · G1 {g1.toFixed(2)}% → G2 {g2.toFixed(2)}%
          </p>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded" style={{ maxHeight: '460px', background: '#0d1117' }}>
          {/* Grid + axis frame */}
          {xTickVals.map((ch, i) => {
            const x = px(ch)
            return (
              <g key={`tx${i}`}>
                <line x1={x} y1={MT} x2={x} y2={MT + plotH} stroke="#1a2233" strokeWidth="0.5" />
                <text x={x.toFixed(1)} y={H - MB + 16} fill="#888" fontSize="9" fontFamily="monospace" textAnchor="middle">
                  {ch.toFixed(0)}
                </text>
              </g>
            )
          })}
          {yTickVals.map((rl, i) => {
            const y = py(rl)
            return (
              <g key={`ty${i}`}>
                <line x1={ML} y1={y.toFixed(1)} x2={ML + plotW} y2={y.toFixed(1)} stroke="#1a2233" strokeWidth="0.5" />
                <text x={ML - 8} y={(y + 3).toFixed(1)} fill="#888" fontSize="9" fontFamily="monospace" textAnchor="end">
                  {rl.toFixed(1)}
                </text>
              </g>
            )
          })}
          <line x1={ML} y1={MT} x2={ML} y2={MT + plotH} stroke="#30363d" strokeWidth="1" />
          <line x1={ML} y1={MT + plotH} x2={ML + plotW} y2={MT + plotH} stroke="#30363d" strokeWidth="1" />

          {/* Axis labels */}
          <text x={ML + plotW / 2} y={H - 8} fill="#888" fontSize="11" fontFamily="sans-serif" textAnchor="middle">Chainage (m)</text>
          <text
            x={16}
            y={MT + plotH / 2}
            fill="#888"
            fontSize="11"
            fontFamily="sans-serif"
            textAnchor="middle"
            transform={`rotate(-90, 16, ${MT + plotH / 2})`}
          >
            Reduced Level (m)
          </text>

          {/* Tangent grades (dashed) */}
          <line x1={tangentInStartX} y1={tangentInStartY} x2={tangentInEndX} y2={tangentInEndY} stroke="#f472b6" strokeWidth="1.5" strokeDasharray="6 4" />
          <line x1={tangentOutStartX} y1={tangentOutStartY} x2={tangentOutEndX} y2={tangentOutEndY} stroke="#f472b6" strokeWidth="1.5" strokeDasharray="6 4" />

          {/* Parabola */}
          <path d={parabolaPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

          {/* Points */}
          <circle cx={px(bvcChainage)} cy={py(bvcRL)} r="5" fill="#22c55e" stroke="#fff" strokeWidth="1" />
          <circle cx={px(evcChainage)} cy={py(evcRL)} r="5" fill="#22c55e" stroke="#fff" strokeWidth="1" />
          <circle cx={px(vpiChainage)} cy={py(vpiRL)} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1" />
          {peakPoint && <circle cx={peakX} cy={peakY} r="5" fill="#a855f7" stroke="#fff" strokeWidth="1" />}

          {/* Labels */}
          <text x={px(bvcChainage) - 6} y={py(bvcRL) + 20} fill="#22c55e" fontSize="11" fontWeight="600" fontFamily="sans-serif" textAnchor="middle">BVC</text>
          <text x={px(evcChainage) - 6} y={py(evcRL) + 20} fill="#22c55e" fontSize="11" fontWeight="600" fontFamily="sans-serif" textAnchor="middle">EVC</text>
          <text x={px(vpiChainage) + 8} y={py(vpiRL) + 18} fill="#ef4444" fontSize="11" fontWeight="600" fontFamily="sans-serif">VPI</text>
          {peakPoint && (
            <text x={peakX + 8} y={peakY - 8} fill="#a855f7" fontSize="11" fontWeight="600" fontFamily="sans-serif">
              {isCrest ? 'Peak' : 'Low Pt'}
            </text>
          )}

          {/* Grade labels */}
          <text x={(px(bvcChainage) + px(vpiChainage)) / 2} y={py(bvcRL) - 10} fill="#f472b6" fontSize="10" fontFamily="monospace" textAnchor="middle">G1 = {g1.toFixed(2)}%</text>
          <text x={(px(vpiChainage) + px(evcChainage)) / 2} y={py(evcRL) + 30} fill="#f472b6" fontSize="10" fontFamily="monospace" textAnchor="middle">G2 = {g2.toFixed(2)}%</text>

          {/* Key dimensions */}
          <text x={px(bvcChainage)} y={H - MB - 6} fill="#888" fontSize="9" fontFamily="monospace" textAnchor="start">L = {((rows[rows.length - 1]?.chainage ?? evcChainage) - bvcChainage).toFixed(1)} m</text>
        </svg>
      </div>
    </div>
  )
}
