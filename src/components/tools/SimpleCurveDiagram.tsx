'use client'

// SimpleCurveDiagram — professional plan-view SVG diagram of a circular
// curve, as used in road design / setting out sheets.
//
// Geometry convention (Ghilani & Wolf Ch.24, RDM 1.3 §5.2):
//   - PI = Point of Intersection (of the two tangent lines)
//   - PC (TC) = Point of Curvature — start of curve
//   - PT (CT) = Point of Tangency — end of curve
//   - R  = radius (perpendicular from centre O to the curve)
//   - Δ  = deflection (intersection) angle
//   - T  = tangent length, L = arc length, C = long chord, M = mid-ordinate
//
// The curve is drawn starting at PC heading in (bearing 0°), turning
// through Δ to PT. The two tangent lines meet at PI.

export interface SimpleCurveDiagramProps {
  radius: number
  deflectionDeg: number
  tangentLength: number
  arcLength: number
  longChord: number
  externalDistance: number
  midOrdinate: number
  pcChainage: number
  piChainage: number
  ptChainage: number
  /** Optional HTML table shown below the diagram. */
  showChainageTable?: boolean
}

const W = 640
const H = 460
const CX = 220
const CY = 290
const PAD = 30

const DARK_BG = '#0d1117'
const GRID = '#1a2233'
const TANGENT = '#f5f5f5'
const ARC = '#f59e0b'
const RADIUS = '#3b82f6'
const CHORD = '#a3e635'
const LABEL = '#e5e7eb'
const DIM = '#888'

export function SimpleCurveDiagram({
  radius,
  deflectionDeg,
  tangentLength,
  arcLength,
  longChord,
  externalDistance,
  midOrdinate,
  pcChainage,
  piChainage,
  ptChainage,
  showChainageTable = true,
}: SimpleCurveDiagramProps) {
  const R = radius
  const delta = (deflectionDeg * Math.PI) / 180
  const tLength = tangentLength
  const lLength = arcLength
  const cChord = longChord

  // Scale to fit the drawing area. The widest extent is roughly the chord
  // plus the external distance; the tallest is the radius + external.
  const scale = Math.min((W - 2 * PAD) / (Math.max(cChord, tLength * 1.1) + PAD), (H - 2 * PAD) / (R + R * 0.55))
  const px = (meters: number) => meters * scale

  // PC is at the origin of the local coordinate system, heading east (bearing 0°).
  // PI = PC + tangent along incoming bearing.
  const pcX = CX - px(tLength) * 0.15
  const pcY = CY
  const piX = pcX + px(tLength)
  const piY = pcY

  // Centre of curve: perpendicular to tangent at PC, inward (below in screen coords).
  const cX = pcX
  const cY = pcY + px(R)

  // PT: rotate (0, R) vector about centre by Δ.
  const ptLocalX = R * Math.sin(delta)
  const ptLocalY = R * Math.cos(delta)
  const ptX = cX + px(ptLocalX)
  const ptY = cY + px(ptLocalY)

  // Arc path — sample points along the circular arc from PC to PT.
  const arcPoints: { x: number; y: number }[] = []
  const N = 60
  for (let i = 0; i <= N; i++) {
    const theta = (i / N) * delta
    const ax = R * Math.sin(theta)
    const ay = R * Math.cos(theta)
    arcPoints.push({ x: cX + px(ax), y: cY + px(ay) })
  }
  const arcPath = arcPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // Radius lines: centre → PC and centre → PT.
  const radiusPCPath = `M${cX.toFixed(1)},${cY.toFixed(1)} L${pcX.toFixed(1)},${pcY.toFixed(1)}`
  const radiusPTPath = `M${cX.toFixed(1)},${cY.toFixed(1)} L${ptX.toFixed(1)},${ptY.toFixed(1)}`

  // Tangent lines from PI to PC and PI to PT.
  const tangentPCPath = `M${piX.toFixed(1)},${piY.toFixed(1)} L${pcX.toFixed(1)},${pcY.toFixed(1)}`
  const tangentPTPath = `M${piX.toFixed(1)},${piY.toFixed(1)} L${ptX.toFixed(1)},${ptY.toFixed(1)}`

  // Long chord PC→PT.
  const chordPath = `M${pcX.toFixed(1)},${pcY.toFixed(1)} L${ptX.toFixed(1)},${ptY.toFixed(1)}`

  // External distance: from PI to midpoint of arc.
  const midTheta = delta / 2
  const midArcX = cX + px(R * Math.sin(midTheta))
  const midArcY = cY + px(R * Math.cos(midTheta))
  const extX = (piX + midArcX) / 2
  const extY = (piY + midArcY) / 2

  // Mid-ordinate: from midpoint of long chord to midpoint of arc.
  const chordMidX = (pcX + ptX) / 2
  const chordMidY = (pcY + ptY) / 2

  // Dimension label positions.
  const radiusLabelX = (cX + pcX) / 2 + 12
  const radiusLabelY = (cY + pcY) / 2 + 6

  const arcMid = arcPoints[Math.floor(N / 2)]
  const arcLabelX = arcMid.x + 6
  const arcLabelY = arcMid.y - 8

  const chordLabelX = (pcX + ptX) / 2 - 4
  const chordLabelY = (pcY + ptY) / 2 - 8

  const tangentMidX = (pcX + piX) / 2
  const tangentMidY = (pcY + piY) / 2 - 12

  // Deflection angle marker at PI.
  const angX = piX + px(tLength) * 0.12
  const angY = piY - px(tLength) * 0.12
  const arcAngR = px(tLength) * 0.18

  const chainageRows = [
    { label: 'PC (TC) chainage', value: `${pcChainage.toFixed(3)} m` },
    { label: 'PI chainage', value: `${piChainage.toFixed(3)} m` },
    { label: 'PT (CT) chainage', value: `${ptChainage.toFixed(3)} m` },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Curve Diagram — Plan View</h3>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            R {R.toFixed(1)} m · Δ {deflectionDeg.toFixed(2)}°
          </p>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded" style={{ maxHeight: '480px', background: DARK_BG }}>
          {/* Grid */}
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`gx${i}`} x1={i * (W / 8)} y1={0} x2={i * (W / 8)} y2={H} stroke={GRID} strokeWidth="0.5" />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={`gy${i}`} x1={0} y1={i * (H / 6)} x2={W} y2={i * (H / 6)} stroke={GRID} strokeWidth="0.5" />
          ))}

          {/* Tangent lines */}
          <path d={tangentPCPath} fill="none" stroke={TANGENT} strokeWidth="2" strokeLinecap="round" />
          <path d={tangentPTPath} fill="none" stroke={TANGENT} strokeWidth="2" strokeLinecap="round" />

          {/* Radius lines */}
          <path d={radiusPCPath} fill="none" stroke={RADIUS} strokeWidth="1.2" strokeDasharray="6 4" />
          <path d={radiusPTPath} fill="none" stroke={RADIUS} strokeWidth="1.2" strokeDasharray="6 4" />

          {/* Long chord */}
          <path d={chordPath} fill="none" stroke={CHORD} strokeWidth="1.2" strokeDasharray="4 3" />

          {/* Arc */}
          <path d={arcPath} fill="none" stroke={ARC} strokeWidth="3" strokeLinecap="round" />

          {/* Deflection angle marker at PI */}
          <path
            d={`M${piX},${piY} L${angX},${piY} L${piX + arcAngR * Math.cos(-0.5)},${angY}`}
            fill="none"
            stroke="#f472b6"
            strokeWidth="1"
          />

          {/* Points */}
          <circle cx={piX} cy={piY} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1" />
          <circle cx={pcX} cy={pcY} r="5" fill="#22c55e" stroke="#fff" strokeWidth="1" />
          <circle cx={ptX} cy={ptY} r="5" fill="#22c55e" stroke="#fff" strokeWidth="1" />
          <circle cx={cX} cy={cY} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1" />

          {/* Labels */}
          <text x={piX + 8} y={piY - 8} fill={LABEL} fontSize="12" fontWeight="600" fontFamily="sans-serif">PI</text>
          <text x={pcX - 8} y={pcY - 8} fill={LABEL} fontSize="12" fontWeight="600" fontFamily="sans-serif" textAnchor="end">PC</text>
          <text x={ptX + 8} y={ptY + 16} fill={LABEL} fontSize="12" fontWeight="600" fontFamily="sans-serif">PT</text>
          <text x={cX + 10} y={cY + 16} fill={LABEL} fontSize="12" fontWeight="600" fontFamily="sans-serif">O</text>

          {/* Radius label */}
          <text x={radiusLabelX} y={radiusLabelY} fill={RADIUS} fontSize="11" fontFamily="monospace">R = {R.toFixed(1)} m</text>

          {/* Arc label */}
          <text x={arcLabelX} y={arcLabelY} fill={ARC} fontSize="11" fontFamily="monospace">L = {lLength.toFixed(1)} m</text>

          {/* Chord label */}
          <text x={chordLabelX} y={chordLabelY} fill={CHORD} fontSize="11" fontFamily="monospace" textAnchor="end">C = {cChord.toFixed(1)} m</text>

          {/* Tangent label */}
          <text x={tangentMidX} y={tangentMidY} fill={TANGENT} fontSize="11" fontFamily="monospace" textAnchor="middle">T = {tLength.toFixed(1)} m</text>

          {/* External distance / mid-ordinate */}
          <text x={extX} y={extY} fill="#f472b6" fontSize="10" fontFamily="monospace" textAnchor="middle">E = {externalDistance.toFixed(2)} m</text>
          <text x={chordMidX + 6} y={chordMidY + 4} fill={DIM} fontSize="9" fontFamily="monospace" textAnchor="middle">M = {midOrdinate.toFixed(2)} m</text>

          {/* Δ label near PI */}
          <text x={piX + 16} y={piY - 26} fill="#f472b6" fontSize="11" fontWeight="600" fontFamily="sans-serif">Δ = {deflectionDeg.toFixed(2)}°</text>

          {/* North arrow */}
          <g transform={`translate(${W - 34}, 26)`}>
            <line x1="0" y1="16" x2="0" y2="0" stroke="#aaa" strokeWidth="1.5" />
            <polygon points="0,0 -4,7 4,7" fill="#aaa" />
            <text x="0" y="26" fill="#aaa" fontSize="10" textAnchor="middle" fontFamily="sans-serif">N</text>
          </g>
        </svg>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-center gap-4 flex-wrap text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-1 inline-block rounded" style={{ background: ARC }} /> Arc (L)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block rounded" style={{ background: TANGENT }} /> Tangent (T)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block rounded" style={{ background: CHORD }} /> Long chord (C)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 inline-block rounded" style={{ background: RADIUS }} /> Radius (R)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#ef4444' }} /> PI</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#22c55e' }} /> PC / PT</span>
        </div>
      </div>

      {showChainageTable && (
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-[var(--border-color)]">
            <h4 className="text-xs font-semibold text-[var(--text-primary)]">Key Chainages</h4>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {chainageRows.map((row) => (
                <tr key={row.label} className="border-t border-[var(--border-color)]/30">
                  <td className="px-4 py-2 text-[var(--text-muted)]">{row.label}</td>
                  <td className="px-4 py-2 text-right font-mono text-[var(--text-primary)]">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
