'use client'

// CutFillHeatMap — professional grid heat map for cut/fill volumes.
//
// Renders the per-cell `CutFillCell[]` returned by `computeCutFill` (see
// `src/lib/survey/surfaceTIN.ts`) as a color-graded grid where:
//   - RED  = CUT (ground above design — material to remove)
//   - BLUE = FILL (ground below design — material to add)
//   - White/neutral = no difference
//
// Overlaid with: grid coordinate frame, scale bar, north arrow, legend,
// and a small stats sidebar. Mirrors the styling of the contour generator
// map so the visual language stays consistent across METARDU.

import type { CutFillCell } from '@/lib/survey/surfaceTIN'

const SVG_WIDTH = 900
const SVG_HEIGHT = 650
const MARGIN = 60

export interface CutFillHeatMapProps {
  cells: CutFillCell[]
  gridSpacing: number
  /** Bounding box of the cells (computed from min/max x/y). */
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
}

function computeBounds(cells: CutFillCell[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const c of cells) {
    if (c.x < minX) minX = c.x
    if (c.x > maxX) maxX = c.x
    if (c.y < minY) minY = c.y
    if (c.y > maxY) maxY = c.y
  }
  return { minX, maxX, minY, maxY }
}

/**
 * Color for a cut/fill depth (meters). Positive = cut (red ramp),
 * negative = fill (blue ramp). Zero = neutral.
 */
function depthColor(diff: number, maxAbs: number): string {
  if (maxAbs <= 0) return '#2a2a2a'
  const t = Math.max(-1, Math.min(1, diff / maxAbs))
  if (t > 0) {
    // Cut: ramp neutral → amber → red
    const r = 255
    const g = Math.round(180 - t * 160)
    const b = Math.round(80 - t * 80)
    return `rgb(${r}, ${g}, ${b})`
  }
  if (t < 0) {
    // Fill: ramp neutral → light blue → deep blue
    const r = Math.round(80 + t * 80) // t is negative
    const g = Math.round(140 + t * 60)
    const b = 255
    return `rgb(${r}, ${g}, ${b})`
  }
  return '#2a2a2a'
}

export function CutFillHeatMap({ cells, gridSpacing, bounds: boundsProp }: CutFillHeatMapProps) {
  if (cells.length === 0) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6 text-center text-sm text-[var(--text-muted)]">
        No grid cells computed.
      </div>
    )
  }

  const bounds = boundsProp ?? computeBounds(cells)
  const rangeX = bounds.maxX - bounds.minX || 1
  const rangeY = bounds.maxY - bounds.minY || 1

  const usableW = SVG_WIDTH - 2 * MARGIN
  const usableH = SVG_HEIGHT - 2 * MARGIN

  // Maintain aspect ratio: scale = min so map fits without stretching.
  const scale = Math.min(usableW / rangeX, usableH / rangeY)
  const cellPx = gridSpacing * scale
  const drawW = rangeX * scale
  const drawH = rangeY * scale
  const offX = MARGIN + (usableW - drawW) / 2
  const offY = MARGIN + (usableH - drawH) / 2

  const toSvgX = (x: number) => offX + (x - bounds.minX) * scale
  const toSvgY = (y: number) => offY + (bounds.maxY - y) * scale

  // Max |diff| for color scaling.
  const maxAbs = Math.max(0.01, ...cells.map(c => Math.abs(c.diff)))

  // Color legend entries — 9 discrete steps from cut to fill.
  const legendSteps: { color: string; label: string; value: number }[] = []
  const steps = 9
  for (let i = 0; i < steps; i++) {
    const t = (i - (steps - 1) / 2) / ((steps - 1) / 2) // -1..+1
    const val = t * maxAbs
    legendSteps.push({
      color: depthColor(val, maxAbs),
      label: `${val >= 0 ? '+' : ''}${val.toFixed(2)} m`,
      value: val,
    })
  }

  // Grid line ticks (6 horizontal, 6 vertical).
  const numTicks = 6
  const xTicks: number[] = []
  const yTicks: number[] = []
  for (let i = 0; i <= numTicks; i++) {
    xTicks.push(bounds.minX + (rangeX * i) / numTicks)
    yTicks.push(bounds.minY + (rangeY * i) / numTicks)
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Cut / Fill Heat Map</h3>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            Grid {gridSpacing} m · {cells.length} cells
          </p>
        </div>

        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full rounded" style={{ maxHeight: '700px', background: '#0d1117' }}>
          {/* Map frame */}
          <rect x={MARGIN} y={MARGIN} width={usableW} height={usableH} fill="#0d1117" stroke="#30363d" strokeWidth="1" />

          {/* Grid lines */}
          {xTicks.map((e, i) => {
            const x = toSvgX(e)
            return <line key={`gx${i}`} x1={x} y1={MARGIN} x2={x} y2={MARGIN + usableH} stroke="#1a2233" strokeWidth="0.5" />
          })}
          {yTicks.map((n, i) => {
            const y = toSvgY(n)
            return <line key={`gy${i}`} x1={MARGIN} y1={y} x2={MARGIN + usableW} y2={y} stroke="#1a2233" strokeWidth="0.5" />
          })}

          {/* Cell rectangles colored by cut/fill depth */}
          {cells.map((c, i) => {
            const half = gridSpacing / 2
            const x = toSvgX(c.x - half)
            const y = toSvgY(c.y + half) // y inverted
            return (
              <rect
                key={`c${i}`}
                x={x.toFixed(2)}
                y={y.toFixed(2)}
                width={cellPx}
                height={cellPx}
                fill={depthColor(c.diff, maxAbs)}
                opacity={0.85}
                stroke="#0d1117"
                strokeWidth="0.2"
              />
            )
          })}

          {/* Boundary of sampled area */}
          <rect
            x={offX}
            y={offY}
            width={drawW}
            height={drawH}
            fill="none"
            stroke="#f5f5f5"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />

          {/* Easting tick labels (bottom) */}
          {xTicks.map((e, i) => {
            const x = toSvgX(e)
            return (
              <g key={`tx${i}`}>
                <text x={x.toFixed(2)} y={SVG_HEIGHT - MARGIN / 3} fill="#888" fontSize="9" fontFamily="monospace" textAnchor="middle">
                  {e.toFixed(1)}
                </text>
                <line x1={x} y1={MARGIN + usableH} x2={x} y2={MARGIN + usableH + 5} stroke="#555" strokeWidth="0.5" />
              </g>
            )
          })}

          {/* Northing tick labels (left) */}
          {yTicks.map((n, i) => {
            const y = toSvgY(n)
            return (
              <g key={`ty${i}`}>
                <text x={MARGIN / 2} y={(y + 3).toFixed(2)} fill="#888" fontSize="9" fontFamily="monospace" textAnchor="middle">
                  {n.toFixed(1)}
                </text>
                <line x1={MARGIN - 5} y1={y} x2={MARGIN} y2={y} stroke="#555" strokeWidth="0.5" />
              </g>
            )
          })}

          {/* Axis labels */}
          <text x={MARGIN + usableW / 2} y={SVG_HEIGHT - 5} fill="#888" fontSize="11" fontFamily="sans-serif" textAnchor="middle">Easting (m)</text>
          <text
            x={10}
            y={MARGIN + usableH / 2}
            fill="#888"
            fontSize="11"
            fontFamily="sans-serif"
            textAnchor="middle"
            transform={`rotate(-90, 10, ${MARGIN + usableH / 2})`}
          >
            Northing (m)
          </text>

          {/* Corner coordinates */}
          <g fill="#666" fontSize="8" fontFamily="monospace">
            <text x={MARGIN + 3} y={MARGIN + 11} textAnchor="start">N {bounds.minY.toFixed(1)}  E {bounds.minX.toFixed(1)}</text>
            <text x={MARGIN + usableW - 3} y={MARGIN + 11} textAnchor="end">N {bounds.minY.toFixed(1)}  E {bounds.maxX.toFixed(1)}</text>
            <text x={MARGIN + 3} y={MARGIN + usableH - 4} textAnchor="start">N {bounds.maxY.toFixed(1)}  E {bounds.minX.toFixed(1)}</text>
            <text x={MARGIN + usableW - 3} y={MARGIN + usableH - 4} textAnchor="end">N {bounds.maxY.toFixed(1)}  E {bounds.maxX.toFixed(1)}</text>
          </g>

          {/* Title block (top-right) */}
          <text x={MARGIN + usableW - 4} y={MARGIN + 24} fill="#ccc" fontSize="12" fontFamily="sans-serif" fontWeight="600" textAnchor="end">CUT / FILL HEAT MAP</text>

          {/* North arrow */}
          <g transform={`translate(${SVG_WIDTH - 40}, ${MARGIN + 30})`}>
            <line x1="0" y1="20" x2="0" y2="0" stroke="#aaa" strokeWidth="1.5" />
            <polygon points="0,0 -4,8 4,8" fill="#aaa" />
            <text x="0" y="32" fill="#aaa" fontSize="10" textAnchor="middle" fontFamily="sans-serif">N</text>
          </g>

          {/* Scale bar */}
          {(() => {
            const scaleBarWorldLen = rangeX / 5
            const scaleBarSvgLen = (scaleBarWorldLen * scale)
            const sbX = MARGIN + usableW - scaleBarSvgLen
            const sbY = SVG_HEIGHT - MARGIN / 3 - 2
            return (
              <g>
                <rect x={sbX} y={sbY - 4} width={scaleBarSvgLen} height={8} fill="none" stroke="#aaa" strokeWidth="1" />
                <rect x={sbX} y={sbY - 4} width={scaleBarSvgLen / 2} height={8} fill="#aaa" />
                <text x={(sbX + scaleBarSvgLen / 2).toFixed(2)} y={(sbY - 8).toFixed(2)} fill="#aaa" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  {scaleBarWorldLen.toFixed(1)} m
                </text>
              </g>
            )
          })()}
        </svg>

        {/* Color legend (discrete swatches) */}
        <div className="mt-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mr-1">FILL</span>
            {[...legendSteps].reverse().map((s, i) => (
              <div key={`leg${i}`} className="flex flex-col items-center gap-1" title={s.label}>
                <div className="w-6 h-4 rounded-sm border border-[var(--border-color)]" style={{ background: s.color }} />
                <span className="text-[9px] font-mono text-[var(--text-secondary)] tabular-nums">{s.label}</span>
              </div>
            ))}
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider ml-1">CUT</span>
          </div>
        </div>
      </div>
    </div>
  )
}
