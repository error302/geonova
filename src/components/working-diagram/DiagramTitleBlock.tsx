'use client'
import type { DiagramTitleBlock as TitleBlockType } from '@/lib/working-diagram/types'

interface Props {
  y: number
  width: number
  height: number
  titleBlock: TitleBlockType
}

export function DiagramTitleBlock({ y, width, height, titleBlock: t }: Props) {
  const col = width / 5
  const mid = y + height / 2
  return (
    <g>
      <line x1={8} y1={y} x2={width - 8} y2={y} stroke="#111" strokeWidth={1} />
      {[1,2,3,4].map(i => (
        <line key={i} x1={col * i} y1={y} x2={col * i} y2={y + height - 8} stroke="#555" strokeWidth={0.5} />
      ))}

      <text x={col * 0.5} y={mid - 8}  textAnchor="middle" fontSize={11} fontWeight="bold" fontFamily="monospace">{t.drawingTitle}</text>
      <text x={col * 0.5} y={mid + 8}  textAnchor="middle" fontSize={8} fontFamily="monospace">{t.parcelRef}</text>

      <text x={col * 1.5} y={mid - 10} textAnchor="middle" fontSize={8} fontFamily="monospace">Surveyor</text>
      <text x={col * 1.5} y={mid + 2}  textAnchor="middle" fontSize={9} fontWeight="bold" fontFamily="monospace">{t.surveyorName}</text>
      <text x={col * 1.5} y={mid + 14} textAnchor="middle" fontSize={8} fontFamily="monospace">{t.surveyorRegNo}</text>

      <text x={col * 2.5} y={mid - 10} textAnchor="middle" fontSize={8} fontFamily="monospace">Location</text>
      <text x={col * 2.5} y={mid + 2}  textAnchor="middle" fontSize={9} fontFamily="monospace">{t.county}</text>
      <text x={col * 2.5} y={mid + 14} textAnchor="middle" fontSize={8} fontFamily="monospace">{t.subcounty}</text>

      <text x={col * 3.5} y={mid - 10} textAnchor="middle" fontSize={8} fontFamily="monospace">{t.scaleNote}</text>
      <text x={col * 3.5} y={mid + 4}  textAnchor="middle" fontSize={8} fontFamily="monospace">UTM Zone: {t.utmZone}</text>

      <text x={col * 4.5} y={mid - 10} textAnchor="middle" fontSize={8} fontFamily="monospace">Date: {t.date}</text>
      <text x={col * 4.5} y={mid + 4}  textAnchor="middle" fontSize={8} fontFamily="monospace">By: {t.drawnBy ?? t.surveyorName}</text>
      <text x={col * 4.5} y={mid + 16} textAnchor="middle" fontSize={8} fontFamily="monospace">Chk: {t.checkedBy ?? '—'}</text>
    </g>
  )
}
