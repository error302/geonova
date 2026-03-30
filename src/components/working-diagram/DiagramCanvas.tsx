'use client'
import React, { useRef } from 'react'
import type { WorkingDiagram, BoundaryType, SubArea } from '@/lib/working-diagram/types'
import { computePositions, normalizeToViewport, polygonCentroid } from '@/lib/working-diagram/traverse'
import { formatLegacy } from '@/lib/working-diagram/units'
import { NorthArrow } from './NorthArrow'
import { DiagramTitleBlock } from './DiagramTitleBlock'

interface Props {
  diagram: WorkingDiagram
  width?: number
  height?: number
}

export default function DiagramCanvas({ diagram, width = 1122, height = 794 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const PADDING = 90
  const TITLE_H = 80

  const drawH = height - TITLE_H

  const rawPositions = computePositions(diagram.beacons, diagram.boundaries)
  const positions = normalizeToViewport(rawPositions, width, drawH, PADDING)

  const linePath = (fromId: string, toId: string) => {
    const a = positions.get(fromId)
    const b = positions.get(toId)
    if (!a || !b) return ''
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`
  }

  const midpoint = (fromId: string, toId: string) => {
    const a = positions.get(fromId)
    const b = positions.get(toId)
    if (!a || !b) return { x: 0, y: 0 }
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  const lineAngleDeg = (fromId: string, toId: string) => {
    const a = positions.get(fromId)
    const b = positions.get(toId)
    if (!a || !b) return 0
    const angle = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI)
    return angle > 90 || angle < -90 ? angle + 180 : angle
  }

  const subAreaPolygon = (area: SubArea): string => {
    return area.beaconIds
      .map(id => {
        const p = positions.get(id)
        return p ? `${p.x},${p.y}` : ''
      })
      .filter(Boolean)
      .join(' ')
  }

  const STROKE_STYLES: Record<BoundaryType, React.SVGProps<SVGPathElement>> = {
    standard:         { stroke: '#111', strokeWidth: 1.5, strokeDasharray: 'none' },
    surveyed_road:    { stroke: '#555', strokeWidth: 1.2, strokeDasharray: 'none' },
    unsurveyed_road:  { stroke: '#555', strokeWidth: 1.2, strokeDasharray: '8 4' },
    water:            { stroke: '#4a90d9', strokeWidth: 1.5, strokeDasharray: '2 2' },
    fence:            { stroke: '#333', strokeWidth: 1, strokeDasharray: '4 2 1 2' },
  }

  return (
    <svg
      ref={svgRef}
      id="working-diagram-svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#fff', fontFamily: 'monospace' }}
    >
      <defs>
        <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#aaa" strokeWidth="0.8" />
        </pattern>
        <pattern id="cross_hatch" width="6" height="6" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#aaa" strokeWidth="0.6" />
          <line x1="0" y1="0" x2="6" y2="0" stroke="#aaa" strokeWidth="0.6" />
        </pattern>
        <pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="0.8" fill="#aaa" />
        </pattern>
      </defs>

      {diagram.subAreas.map(area => (
        <polygon
          key={area.id}
          points={subAreaPolygon(area)}
          fill={
            area.fillPattern === 'none'
              ? area.fillColor
              : `url(#${area.fillPattern})`
          }
          fillOpacity={0.35}
          stroke="none"
        />
      ))}

      {diagram.boundaries.map(line => {
        const style = STROKE_STYLES[line.boundaryType]
        const mid = midpoint(line.fromBeaconId, line.toBeaconId)
        const angle = lineAngleDeg(line.fromBeaconId, line.toBeaconId)

        return (
          <g key={line.id}>
            <path
              d={linePath(line.fromBeaconId, line.toBeaconId)}
              fill="none"
              {...style}
            />
            {line.boundaryType === 'surveyed_road' && (
              <path
                d={linePath(line.fromBeaconId, line.toBeaconId)}
                fill="none"
                stroke="#555"
                strokeWidth={1.2}
                transform={`translate(0, 5)`}
              />
            )}

            <text
              x={mid.x}
              y={mid.y - 10}
              textAnchor="middle"
              fontSize={9}
              fill="#111"
              fontFamily="monospace"
              transform={`rotate(${angle}, ${mid.x}, ${mid.y})`}
            >
              {line.bearingDMS}
            </text>

            <text
              x={mid.x}
              y={mid.y + 16}
              textAnchor="middle"
              fontSize={9}
              fill="#111"
              fontFamily="monospace"
              transform={`rotate(${angle}, ${mid.x}, ${mid.y})`}
            >
              {line.distanceMeters.toFixed(2)}m
              {line.showLegacy && line.legacyUnit && line.legacyDistance !== undefined
                ? ` / ${formatLegacy(line.legacyDistance, line.legacyUnit)}`
                : ''}
            </text>

            {line.boundaryType === 'unsurveyed_road' && line.roadLabel && (
              <text
                x={mid.x}
                y={mid.y + 28}
                textAnchor="middle"
                fontSize={8}
                fill="#555"
                fontStyle="italic"
                transform={`rotate(${angle}, ${mid.x}, ${mid.y})`}
              >
                {line.roadLabel}
              </text>
            )}
            {line.boundaryType === 'surveyed_road' && line.roadLabel && (
              <text
                x={mid.x}
                y={mid.y + 28}
                textAnchor="middle"
                fontSize={8}
                fill="#555"
                transform={`rotate(${angle}, ${mid.x}, ${mid.y})`}
              >
                {line.roadLabel}
              </text>
            )}
          </g>
        )
      })}

      {diagram.beacons.map(beacon => {
        const p = positions.get(beacon.id)
        if (!p) return null
        return (
          <g key={beacon.id}>
            {beacon.symbol === 'concrete_beacon' && (
              <>
                <circle cx={p.x} cy={p.y} r={5} fill="#fff" stroke="#111" strokeWidth={1.5} />
                <circle cx={p.x} cy={p.y} r={2} fill="#111" />
              </>
            )}
            {beacon.symbol === 'iron_peg' && (
              <rect x={p.x - 3} y={p.y - 3} width={6} height={6} fill="#fff" stroke="#111" strokeWidth={1.5} />
            )}
            {beacon.symbol === 'old_beacon' && (
              <>
                <circle cx={p.x} cy={p.y} r={5} fill="none" stroke="#111" strokeWidth={1.5} strokeDasharray="2 1" />
                <circle cx={p.x} cy={p.y} r={2} fill="#111" />
              </>
            )}
            {(beacon.symbol === 'reference_mark' || beacon.symbol === 'intersection_beacon') && (
              <>
                <line x1={p.x - 6} y1={p.y} x2={p.x + 6} y2={p.y} stroke="#111" strokeWidth={1.2} />
                <line x1={p.x} y1={p.y - 6} x2={p.x} y2={p.y + 6} stroke="#111" strokeWidth={1.2} />
              </>
            )}
            {beacon.symbol === 'nail' && (
              <circle cx={p.x} cy={p.y} r={2} fill="#111" />
            )}
            {beacon.symbol === 'none' && (
              <circle cx={p.x} cy={p.y} r={2} fill="none" stroke="#111" strokeWidth={1} />
            )}
            <text
              x={p.x + 7}
              y={p.y - 5}
              fontSize={9}
              fontWeight="bold"
              fill="#111"
              fontFamily="monospace"
            >
              {beacon.label}
            </text>
          </g>
        )
      })}

      {diagram.subAreas.map(area => {
        const centroid = polygonCentroid(area.beaconIds, positions)
        return (
          <g key={area.id}>
            <text
              x={centroid.x}
              y={centroid.y - 8}
              textAnchor="middle"
              fontSize={11}
              fontWeight="bold"
              fill="#222"
              fontFamily="monospace"
            >
              {area.label}
            </text>
            <text
              x={centroid.x}
              y={centroid.y + 8}
              textAnchor="middle"
              fontSize={10}
              fill="#222"
              fontFamily="monospace"
            >
              {area.areaHa.toFixed(4)} Ha
            </text>
            {area.areaAcres !== undefined && (
              <text
                x={centroid.x}
                y={centroid.y + 22}
                textAnchor="middle"
                fontSize={9}
                fill="#555"
                fontFamily="monospace"
              >
                ({area.areaAcres.toFixed(3)} Ac)
              </text>
            )}
          </g>
        )
      })}

      <NorthArrow
        x={width - 70}
        y={40}
        bearing={diagram.north.bearing}
        type={diagram.north.type}
      />

      <DiagramTitleBlock
        y={drawH}
        width={width}
        height={TITLE_H}
        titleBlock={diagram.titleBlock}
      />

      <rect
        x={4} y={4}
        width={width - 8}
        height={height - 8}
        fill="none"
        stroke="#111"
        strokeWidth={2}
      />
      <rect
        x={8} y={8}
        width={width - 16}
        height={height - 16}
        fill="none"
        stroke="#111"
        strokeWidth={0.5}
      />
    </svg>
  )
}
