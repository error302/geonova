'use client'

import { type CrossSectionComputed, type RoadTemplate } from '@/lib/computations/earthworksEngine'

interface Props {
  section: CrossSectionComputed
  template: RoadTemplate
}

export default function CrossSectionDrawing({ section, template }: Props) {
  const { chainage, centrelineRL, formationRL, centreHeight, mode, cutArea, fillArea, groundPolygon, leftCatchPoint, rightCatchPoint } = section

  const halfWidth = template.carriagewayWidth / 2 + template.shoulderWidth

  const svgW = 500
  const svgH = 280
  const scaleX = 40
  const scaleY = 8
  const centreX = svgW / 2
  const refRL = Math.min(centrelineRL, formationRL) - 2
  const centreY = svgH / 2 + 30

  function toSvgX(x: number): number {
    return centreX + x * scaleX
  }
  function toSvgY(y: number): number {
    return centreY - (y - refRL) * scaleY
  }

  const leftFormX = toSvgX(-halfWidth)
  const rightFormX = toSvgX(halfWidth)
  const formTopY = toSvgY(formationRL)

  const groundPts = groundPolygon.map((p: any) => `${toSvgX(p.x).toFixed(1)},${toSvgY(p.y).toFixed(1)}`).join(' ')
  const cutPts = section.cutPolygon.map((p: any) => `${toSvgX(p.x).toFixed(1)},${toSvgY(p.y).toFixed(1)}`).join(' ')
  const fillPts = section.fillPolygon.map((p: any) => `${toSvgX(p.x).toFixed(1)},${toSvgY(p.y).toFixed(1)}`).join(' ')

  const fmtCh = (ch: number) => {
    const km = Math.floor(ch / 1000)
    const m = ch % 1000
    return km > 0 ? `${km}+${m.toFixed(3)}` : `${m.toFixed(3)}`
  }

  const modeColor = mode === 'cut' ? 'bg-red-900/30 text-red-400' : mode === 'fill' ? 'bg-blue-900/30 text-blue-400' : 'bg-yellow-900/30 text-yellow-400'
  const heightColor = centreHeight > 0 ? 'text-red-400' : 'text-blue-400'

  return (
    <div className="bg-white border border-[var(--border-color)] rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border-color)] flex justify-between items-center">
        <span className="text-xs font-mono font-semibold">Chainage {fmtCh(chainage)}</span>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${modeColor}`}>{mode.toUpperCase()}</span>
      </div>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ background: '#fafafa' }}>
        <line x1={centreX} y1={0} x2={centreX} y2={svgH} stroke="#ddd" strokeWidth="0.5" strokeDasharray="3,3" />
        <line x1={leftFormX} y1={formTopY} x2={rightFormX} y2={formTopY} stroke="#333" strokeWidth="2" />
        {groundPts && <polyline points={groundPts} fill="none" stroke="#5a8" strokeWidth="1.5" />}
        {cutPts && <polygon points={cutPts} fill="#ff000018" stroke="#cc0000" strokeWidth="0.5" />}
        {fillPts && <polygon points={fillPts} fill="#0000ff18" stroke="#0000cc" strokeWidth="0.5" />}
        {leftCatchPoint && (
          <circle cx={toSvgX(leftCatchPoint.offset)} cy={toSvgY(leftCatchPoint.rl)} r="3" fill="#ff6600" />
        )}
        {rightCatchPoint && (
          <circle cx={toSvgX(rightCatchPoint.offset)} cy={toSvgY(rightCatchPoint.rl)} r="3" fill="#ff6600" />
        )}
        <text x={centreX + 5} y={formTopY - 5} fontSize="9" fill="#333" fontFamily="monospace">
          {formationRL.toFixed(3)}
        </text>
        <line x1={centreX} y1={formTopY + 12} x2={rightFormX} y2={formTopY + 12} stroke="#666" strokeWidth="0.5" />
        <line x1={centreX} y1={formTopY + 9} x2={centreX} y2={formTopY + 15} stroke="#666" strokeWidth="0.5" />
        <line x1={rightFormX} y1={formTopY + 9} x2={rightFormX} y2={formTopY + 15} stroke="#666" strokeWidth="0.5" />
        <text x={(centreX + rightFormX) / 2} y={formTopY + 23} fontSize="8" fill="#666" textAnchor="middle" fontFamily="monospace">
          {halfWidth.toFixed(2)}m
        </text>
        <line x1={centreX + 5} y1={toSvgY(centrelineRL)} x2={centreX + 5} y2={formTopY} stroke="#666" strokeWidth="0.5" strokeDasharray="2,2" />
        <text x={centreX + 8} y={(toSvgY(centrelineRL) + formTopY) / 2 + 3} fontSize="8" fill="#666" fontFamily="monospace">
          {Math.abs(centreHeight).toFixed(3)}m
        </text>
      </svg>

      <div className="px-3 py-2 border-t border-[var(--border-color)] grid grid-cols-3 gap-2 text-xs font-mono">
        <div>
          <span className="text-[var(--text-muted)]">CL RL: </span>
          <span className="text-[var(--text-primary)]">{centrelineRL.toFixed(3)}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Form RL: </span>
          <span className="text-[var(--text-primary)]">{formationRL.toFixed(3)}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Centre H: </span>
          <span className={heightColor}>{centreHeight.toFixed(3)}m</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Cut Area: </span>
          <span className="text-red-400">{cutArea.toFixed(3)} m&sup2;</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Fill Area: </span>
          <span className="text-blue-400">{fillArea.toFixed(3)} m&sup2;</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Check: </span>
          <span className={section.arithmeticCheck.passed ? 'text-green-400' : 'text-red-400'}>
            {section.arithmeticCheck.passed ? 'PASS' : 'FAIL'}
          </span>
        </div>
      </div>
    </div>
  )
}
