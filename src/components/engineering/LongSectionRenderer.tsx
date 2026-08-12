'use client';

import React, { useMemo } from 'react'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface Station {
  chainage: number
  groundLevel: number
  designLevel?: number
}

interface DesignStation extends Station {
  designLevel: number
}

interface VerticalIP {
  chainage: number
  reducedLevel: number
  kValue?: number
  gradientIn?: number
  gradientOut?: number
  curveLength?: number
}

interface ProjectInfo {
  roadName: string
  roadClass: string
  designSpeed: number
  startChainage: number
  datum: string
}

interface LongSectionProps {
  stations: Station[]
  verticalIPs?: VerticalIP[]
  projectInfo?: ProjectInfo
  width?: number
  height?: number
  chainageInterval?: number
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Format chainage as "K+MMM" e.g. 120 → "0+120", 1020 → "1+020" */
function formatChainage(c: number): string {
  const km = Math.floor(c / 1000)
  const m = Math.round(c % 1000)
  return `${km}+${m.toString().padStart(3, '0')}`
}

/** Round a raw scale ratio to a "nice" engineering number (1, 2, 5, 10 …) */
function niceScale(raw: number): number {
  if (raw <= 0) return 1
  const log = Math.floor(Math.log10(raw))
  const base = Math.pow(10, log)
  const norm = raw / base
  if (norm <= 1.5) return Math.round(base)
  if (norm <= 3.5) return Math.round(2 * base)
  if (norm <= 7.5) return Math.round(5 * base)
  return Math.round(10 * base)
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function LongSectionRenderer({
  stations,
  verticalIPs = [],
  projectInfo,
  width = 1200,
  height = 500,
  chainageInterval = 20,
}: LongSectionProps) {
  /* ---- layout constants ---- */
  const ML = 70          // left margin  (elevation labels)
  const MR = 30          // right margin
  const MT = 60          // top margin   (title block)
  const MB = 90          // bottom margin(chainage labels)
  const plotW = width - ML - MR
  const plotH = height - MT - MB
  const plotBottom = MT + plotH
  const plotRight = ML + plotW

  /* ---- data ranges (always computed so hooks are stable) ---- */
  const { minC, maxC, minE, maxE, rangeC, rangeE } = useMemo(() => {
    if (stations.length === 0) return { minC: 0, maxC: 100, minE: 0, maxE: 10, rangeC: 100, rangeE: 10 }
    const cs = stations.map(s => s.chainage)
    const es = stations.flatMap(s =>
      [s.groundLevel, s.designLevel].filter((v): v is number => v !== undefined),
    )
    const lo = Math.floor(Math.min(...es)) - 1
    const hi = Math.ceil(Math.max(...es)) + 1
    return { minC: Math.min(...cs), maxC: Math.max(...cs), minE: lo, maxE: hi, rangeC: Math.max(...cs) - Math.min(...cs) || 1, rangeE: hi - lo || 1 }
  }, [stations])

  const xS = (c: number) => ML + ((c - minC) / rangeC) * plotW
  const yS = (e: number) => MT + plotH - ((e - minE) / rangeE) * plotH

  /* ---- vertical curve derivations ---- */
  const curves = useMemo(() =>
    verticalIPs.map(vip => {
      const g1 = vip.gradientIn ?? 0
      const g2 = vip.gradientOut ?? 0
      const aDiff = Math.abs(g2 - g1)
      const K = vip.kValue ?? (vip.curveLength != null ? vip.curveLength / (aDiff || 1) : 50)
      const L = vip.curveLength ?? K * aDiff

      const bvcC = vip.chainage - L / 2
      const evcC = vip.chainage + L / 2
      // gradients treated as percent → divide by 100 for ratio
      const bvcE = vip.reducedLevel - (g1 / 100) * (L / 2)
      const evcE = vip.reducedLevel + (g2 / 100) * (L / 2)

      return { bvcC, bvcE, evcC, evcE, vipC: vip.chainage, vipE: vip.reducedLevel, L, K, g1, g2 }
    }),
    [verticalIPs],
  )

  /* ---- grid lines ---- */
  const { hLines, vLines } = useMemo(() => {
    const hl: { y: number; major: boolean; elev: number }[] = []
    for (let e = Math.ceil(minE); e <= Math.floor(maxE); e++)
      hl.push({ y: yS(e), major: e % 5 === 0, elev: e })

    const vl: { x: number; major: boolean; chainage: number }[] = []
    const first = Math.ceil(minC / chainageInterval) * chainageInterval
    for (let c = first; c <= maxC; c += chainageInterval)
      vl.push({ x: xS(c), major: c % 100 === 0, chainage: c })

    return { hLines: hl, vLines: vl }
  }, [minE, maxE, minC, maxC, chainageInterval])

  /* ---- SVG path data ---- */
  const {
    groundPoly,
    groundFill,
    designPoly,
    cutFillSegs,
    cfAnnotations,
    transitions,
    groundRLLabels,
  } = useMemo(() => {
    const gp = stations.map(s => `${xS(s.chainage)},${yS(s.groundLevel)}`).join(' ')
    const gf = stations.length
      ? `M${xS(stations[0].chainage)},${plotBottom} L${gp} L${xS(stations[stations.length - 1].chainage)},${plotBottom} Z`
      : ''

    const ds = stations.filter((s): s is DesignStation => s.designLevel != null)
    const dp = ds.map(s => `${xS(s.chainage)},${yS(s.designLevel)}`).join(' ')

    /* cut / fill quads */
    const cfs: { type: 'cut' | 'fill'; path: string }[] = []
    for (let i = 0; i < ds.length - 1; i++) {
      const a = ds[i], b = ds[i + 1]
      const ax = xS(a.chainage), ayg = yS(a.groundLevel), ayd = yS(a.designLevel)
      const bx = xS(b.chainage), byg = yS(b.groundLevel), byd = yS(b.designLevel)
      cfs.push({
        path: `M${ax},${ayg} L${bx},${byg} L${bx},${byd} L${ax},${ayd} Z`,
        type: ((a.groundLevel - a.designLevel) + (b.groundLevel - b.designLevel)) / 2 >= 0 ? 'cut' : 'fill',
      })
    }

    /* cut / fill text annotations */
    const cfa = ds.map(s => {
      const diff = s.groundLevel - s.designLevel
      return {
        x: xS(s.chainage),
        gy: yS(s.groundLevel),
        dy: yS(s.designLevel),
        my: (yS(s.groundLevel) + yS(s.designLevel)) / 2,
        type: diff >= 0 ? ('cut' as const) : ('fill' as const),
        amt: Math.abs(diff),
        ch: s.chainage,
      }
    })

    /* transition points (cut ↔ fill) */
    const tr: { x: number; y: number; type: 'cut' | 'fill' }[] = []
    for (let i = 1; i < ds.length; i++) {
      const prev = ds[i - 1], cur = ds[i]
      const pd = prev.groundLevel - prev.designLevel
      const cd = cur.groundLevel - cur.designLevel
      if ((pd >= 0) !== (cd >= 0)) {
        const t = Math.abs(pd) / (Math.abs(pd) + Math.abs(cd))
        const tc = prev.chainage + t * (cur.chainage - prev.chainage)
        const te = prev.groundLevel + t * (cur.groundLevel - prev.groundLevel)
        tr.push({ x: xS(tc), y: yS(te), type: cd >= 0 ? 'cut' : 'fill' })
      }
    }

    /* ground RL labels every 100 m */
    const grl = stations
      .filter(s => s.chainage % 100 === 0)
      .map(s => ({ x: xS(s.chainage), y: yS(s.groundLevel), rl: s.groundLevel }))

    return { groundPoly: gp, groundFill: gf, designPoly: dp, cutFillSegs: cfs, cfAnnotations: cfa, transitions: tr, groundRLLabels: grl }
  }, [stations, minC, maxC, minE, maxE])

  /* ---- table rows ---- */
  const tableRows = useMemo(() => {
    const ds = stations.filter((s): s is DesignStation => s.designLevel != null)
    return ds.map((s, i) => {
      let grade = ''
      if (i > 0) {
        const prev = ds[i - 1]
        const dist = s.chainage - prev.chainage
        if (dist > 0) grade = ((s.designLevel - prev.designLevel) / dist * 100).toFixed(2) + '%'
      }
      const diff = s.groundLevel - s.designLevel
      return {
        chainage: s.chainage,
        groundRL: s.groundLevel.toFixed(3),
        designRL: s.designLevel.toFixed(3),
        grade,
        cut: diff > 0 ? diff.toFixed(3) : '',
        fill: diff < 0 ? Math.abs(diff).toFixed(3) : '',
      }
    })
  }, [stations])

  /* ---- indicative scales (assuming A1 plot area ≈ 700 × 500 mm) ---- */
  const hScaleNum = niceScale((rangeC * 1000) / 700)
  const vScaleNum = niceScale((rangeE * 1000) / 500)

  /* ------------------------------------------------------------------ */
  /*  Empty state                                                        */
  /* ------------------------------------------------------------------ */
  if (stations.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-muted-foreground"
        style={{ minHeight: height }}
      >
        <div className="text-center">
          <p className="text-lg font-medium">No survey station data</p>
          <p className="text-sm mt-1">Provide station chainage and ground levels to render the long section.</p>
        </div>
      </div>
    )
  }

  const hasDesign = stations.some(s => s.designLevel != null)

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <div className="w-full space-y-4">
      {/* ============ SVG Drawing ============ */}
      <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ minWidth: 800 }}
          xmlns="http://www.w3.org/2000/svg"
          fontFamily="'Inter', 'Segoe UI', system-ui, sans-serif"
        >
          {/* ---- clip region ---- */}
          <defs>
            <clipPath id="ls-plot">
              <rect x={ML} y={MT} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* ---- plot background ---- */}
          <rect x={ML} y={MT} width={plotW} height={plotH} fill="#f9fafb" />

          {/* ---- grid ---- */}
          <g>
            {hLines.map((l, i) => (
              <line key={`hg${i}`} x1={ML} y1={l.y} x2={plotRight} y2={l.y}
                stroke={l.major ? '#d1d5db' : '#e5e7eb'} strokeWidth={l.major ? 1 : 0.5} />
            ))}
            {vLines.map((l, i) => (
              <line key={`vg${i}`} x1={l.x} y1={MT} x2={l.x} y2={plotBottom}
                stroke={l.major ? '#d1d5db' : '#e5e7eb'} strokeWidth={l.major ? 1 : 0.5} />
            ))}
          </g>

          {/* ---- clipped drawing content ---- */}
          <g clipPath="url(#ls-plot)">
            {/* ground profile fill */}
            <path d={groundFill} fill="rgba(210,180,140,0.3)" />

            {/* cut / fill fills */}
            {cutFillSegs.map((s, i) => (
              <path key={`cf${i}`} d={s.path}
                fill={s.type === 'cut' ? 'rgba(239,68,68,0.13)' : 'rgba(59,130,246,0.13)'} />
            ))}

            {/* vertical curve highlights */}
            {curves.map((cv, i) => {
              const bx = xS(cv.bvcC), by = yS(cv.bvcE)
              const vx = xS(cv.vipC), vy = yS(cv.vipE)
              const ex = xS(cv.evcC), ey = yS(cv.evcE)
              return (
                <g key={`vc${i}`}>
                  <path d={`M${bx},${by} Q${vx},${vy} ${ex},${ey} L${ex},${plotBottom} L${bx},${plotBottom} Z`}
                    fill="rgba(34,197,94,0.07)" />
                  <path d={`M${bx},${by} Q${vx},${vy} ${ex},${ey}`}
                    fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinecap="round" />
                  <circle cx={bx} cy={by} r={4} fill="#16a34a" stroke="#fff" strokeWidth={1.5} />
                  <circle cx={ex} cy={ey} r={4} fill="#16a34a" stroke="#fff" strokeWidth={1.5} />
                  <circle cx={vx} cy={vy} r={3} fill="#fff" stroke="#16a34a" strokeWidth={2} />
                </g>
              )
            })}

            {/* ground profile polyline */}
            <polyline points={groundPoly} fill="none" stroke="#8B4513" strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />

            {/* design grade line */}
            {hasDesign && (
              <polyline points={designPoly} fill="none" stroke="#2563EB" strokeWidth={1.5}
                strokeDasharray="8,4" strokeLinejoin="round" strokeLinecap="round" />
            )}

            {/* cut / fill annotations */}
            {cfAnnotations
              .filter(a => a.amt > 0.05)
              .map((a, i) => (
                <text key={`a${i}`} x={a.x} y={a.my + 3} textAnchor="middle" fontSize={9}
                  fontWeight={600} fill={a.type === 'cut' ? '#dc2626' : '#2563eb'}>
                  {a.type === 'cut' ? 'C' : 'F'} {a.amt.toFixed(2)}m
                </text>
              ))}

            {/* transition triangles */}
            {transitions.map((t, i) => (
              <polygon key={`tr${i}`}
                points={`${t.x},${t.y - 6} ${t.x - 4},${t.y + 4} ${t.x + 4},${t.y + 4}`}
                fill={t.type === 'fill' ? '#2563eb' : '#dc2626'} stroke="#fff" strokeWidth={1} />
            ))}
          </g>

          {/* ---- ground RL labels every 100 m ---- */}
          {groundRLLabels.map((l, i) => (
            <g key={`gl${i}`}>
              <circle cx={l.x} cy={l.y} r={2.5} fill="#8B4513" />
              <text x={l.x + 6} y={l.y - 4} fontSize={8} fill="#8B4513" fontFamily="monospace">
                {l.rl.toFixed(2)}
              </text>
            </g>
          ))}

          {/* ---- plot border ---- */}
          <rect x={ML} y={MT} width={plotW} height={plotH} fill="none" stroke="#374151" strokeWidth={1.5} />

          {/* ---- elevation labels (left axis) ---- */}
          {hLines.map((l, i) => (
            <text key={`el${i}`} x={ML - 8} y={l.y + 4} textAnchor="end"
              fontSize={l.major ? 10 : 8} fill={l.major ? '#374151' : '#9ca3af'}
              fontFamily="monospace">
              {l.elev.toFixed(1)}
            </text>
          ))}

          {/* ---- chainage labels + ticks (bottom) ---- */}
          {vLines.map((l, i) => (
            <g key={`cl${i}`}>
              <line x1={l.x} y1={plotBottom} x2={l.x} y2={plotBottom + (l.major ? 8 : 4)}
                stroke="#374151" strokeWidth={l.major ? 1 : 0.5} />
              {l.major ? (
                <text x={l.x} y={plotBottom + 22} textAnchor="middle" fontSize={10}
                  fill="#374151" fontFamily="monospace">
                  {formatChainage(l.chainage)}
                </text>
              ) : (
                <text x={l.x} y={plotBottom + 16} textAnchor="middle" fontSize={8}
                  fill="#9ca3af" fontFamily="monospace">
                  {(l.chainage % 100).toString().padStart(2, '0')}
                </text>
              )}
            </g>
          ))}

          {/* ---- vertical curve annotations ---- */}
          {curves.map((cv, i) => {
            const vx = xS(cv.vipC)
            const vy = yS(cv.vipE)
            const labelY = Math.max(vy - 20, MT + 14)
            return (
              <g key={`va${i}`}>
                <rect x={vx - 72} y={labelY - 20} width={144} height={28} rx={3}
                  fill="rgba(255,255,255,0.85)" stroke="#bbf7d0" strokeWidth={0.8} />
                <text x={vx} y={labelY - 6} textAnchor="middle" fontSize={8} fontWeight={600} fill="#15803d">
                  VPI {formatChainage(cv.vipC)} &nbsp; RL {cv.vipE.toFixed(2)}
                </text>
                <text x={vx} y={labelY + 5} textAnchor="middle" fontSize={7} fill="#16a34a">
                  K={cv.K.toFixed(0)} &nbsp; L={cv.L.toFixed(0)}m &nbsp; {cv.g1.toFixed(2)}% → {cv.g2.toFixed(2)}%
                </text>
                {/* BVC / EVC labels */}
                <text x={xS(cv.bvcC)} y={yS(cv.bvcE) - 8} textAnchor="middle" fontSize={7} fontWeight={600} fill="#16a34a">
                  BVC
                </text>
                <text x={xS(cv.evcC)} y={yS(cv.evcE) - 8} textAnchor="middle" fontSize={7} fontWeight={600} fill="#16a34a">
                  EVC
                </text>
              </g>
            )
          })}

          {/* ---- title block ---- */}
          <g>
            <rect x={3} y={3} width={width - 6} height={50} rx={4}
              fill="rgba(255,255,255,0.92)" stroke="#e5e7eb" strokeWidth={1} />
            {/* road name */}
            <text x={14} y={22} fontSize={15} fontWeight={700} fill="#111827" letterSpacing={0.5}>
              {(projectInfo?.roadName ?? 'Unnamed Road').toUpperCase()}
            </text>
            {/* class / speed */}
            <text x={14} y={38} fontSize={10} fill="#6b7280">
              {projectInfo?.roadClass ?? '—'}&ensp;|&ensp;Design Speed: {projectInfo?.designSpeed ?? '—'} km/h
            </text>
            {/* datum / scale */}
            <text x={14} y={50} fontSize={9} fill="#9ca3af">
              Datum: {projectInfo?.datum ?? '—'}&ensp;|&ensp;Scale: H 1:{hScaleNum}&ensp;V 1:{vScaleNum}
            </text>
            {/* LONG SECTION title */}
            <text x={plotRight - 4} y={22} textAnchor="end" fontSize={14} fontWeight={700} fill="#374151">
              LONG SECTION
            </text>
            {/* date */}
            <text x={plotRight - 4} y={38} textAnchor="end" fontSize={9} fill="#9ca3af">
              {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </text>
            {/* station count */}
            <text x={plotRight - 4} y={50} textAnchor="end" fontSize={9} fill="#9ca3af">
              {stations.length} stations &ensp;|&ensp; {formatChainage(minC)} – {formatChainage(maxC)}
            </text>
          </g>

          {/* ---- axis titles ---- */}
          <text x={ML + plotW / 2} y={height - 8} textAnchor="middle" fontSize={11}
            fontWeight={600} fill="#6b7280" letterSpacing={1}>
            CHAINAGE (m)
          </text>
          <text x={16} y={MT + plotH / 2} textAnchor="middle" fontSize={11}
            fontWeight={600} fill="#6b7280" letterSpacing={1}
            transform={`rotate(-90,16,${MT + plotH / 2})`}>
            REDUCED LEVEL (m)
          </text>

          {/* ---- legend (bottom-right) ---- */}
          <g transform={`translate(${plotRight - 150},${MT + 8})`}>
            <rect x={0} y={0} width={145} height={56} rx={3} fill="rgba(255,255,255,0.9)" stroke="#e5e7eb" />
            <line x1={8} y1={12} x2={28} y2={12} stroke="#8B4513" strokeWidth={2} />
            <text x={34} y={15} fontSize={8} fill="#374151">Ground Profile</text>
            <line x1={8} y1={26} x2={28} y2={26} stroke="#2563EB" strokeWidth={1.5} strokeDasharray="6,3" />
            <text x={34} y={29} fontSize={8} fill="#374151">Design Grade Line</text>
            <line x1={8} y1={40} x2={28} y2={40} stroke="#16a34a" strokeWidth={2.5} />
            <text x={34} y={43} fontSize={8} fill="#374151">Vertical Curve</text>
            <rect x={8} y={48} width={20} height={4} rx={1} fill="rgba(239,68,68,0.3)" />
            <text x={34} y={53} fontSize={7} fill="#9ca3af">Cut</text>
            <rect x={68} y={48} width={20} height={4} rx={1} fill="rgba(59,130,246,0.3)" />
            <text x={94} y={53} fontSize={7} fill="#9ca3af">Fill</text>
          </g>
        </svg>
      </div>

      {/* ============ Data Table ============ */}
      {hasDesign && tableRows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
                <th className="px-4 py-2.5 font-semibold">Chainage</th>
                <th className="px-4 py-2.5 font-semibold">Ground RL</th>
                <th className="px-4 py-2.5 font-semibold">Design RL</th>
                <th className="px-4 py-2.5 font-semibold">Grade</th>
                <th className="px-4 py-2.5 font-semibold text-red-600">Cut (m)</th>
                <th className="px-4 py-2.5 font-semibold text-blue-600">Fill (m)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableRows.map((r, i) => (
                <tr key={`${r}-${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                  <td className="px-4 py-1.5 font-mono text-xs">{formatChainage(r.chainage)}</td>
                  <td className="px-4 py-1.5 font-mono text-xs">{r.groundRL}</td>
                  <td className="px-4 py-1.5 font-mono text-xs">{r.designRL}</td>
                  <td className="px-4 py-1.5 font-mono text-xs text-gray-500">{r.grade}</td>
                  <td className={`px-4 py-1.5 font-mono text-xs font-semibold ${r.cut ? 'text-red-600' : 'text-gray-300'}`}>
                    {r.cut || '—'}
                  </td>
                  <td className={`px-4 py-1.5 font-mono text-xs font-semibold ${r.fill ? 'text-blue-600' : 'text-gray-300'}`}>
                    {r.fill || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* summary footer */}
            <tfoot>
              <tr className="bg-gray-100 text-xs font-semibold">
                <td colSpan={4} className="px-4 py-2 text-gray-600">Totals</td>
                <td className="px-4 py-2 font-mono text-red-600">
                  {tableRows.reduce((s, r) => s + parseFloat(r.cut || '0'), 0).toFixed(3)}
                </td>
                <td className="px-4 py-2 font-mono text-blue-600">
                  {tableRows.reduce((s, r) => s + parseFloat(r.fill || '0'), 0).toFixed(3)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
