'use client';

import React, { useMemo } from 'react'
import {
  computeCamberProfile,
  computeDetailedFormationLine,
  computeCutFillArea,
  parseSlopeRatio,
  determineSectionType,
  interpolateGroundAtCentre,
  formatChainage,
  type ProfilePoint,
  type RoadTemplate,
} from '@/lib/engineering/crossSectionGeometry'

// ─── TYPES ─────────────────────────────────────────────────────────────────────

export interface CrossSectionProps {
  chainage: number
  groundPoints: Array<{ offset: number; level: number }>
  template: RoadTemplate
  formationLevel?: number
  cutArea?: number
  fillArea?: number
  width?: number
  height?: number
  showLabels?: boolean
}

// ─── COLOUR CONSTANTS ──────────────────────────────────────────────────────────

const COLORS = {
  groundLine: '#92400E',         // brown
  groundFill: '#FEF3C7',         // tan
  carriageway: '#374151',        // dark grey
  shoulder: '#6B7280',           // lighter grey
  cutSlope: '#92400E',           // red-brown
  fillSlope: '#1E40AF',          // blue-grey
  subgrade: '#9CA3AF',           // grey dashed
  centreLine: '#6B7280',         // grey dashed
  cutFill: '#DC2626',            // red
  gridLine: '#E5E7EB',          // light grey
  offsetMarker: '#D1D5DB',       // light grey
  labelPrimary: '#111827',       // near black
  labelSecondary: '#6B7280',     // grey
  cutLabel: '#DC2626',           // red
  fillLabel: '#2563EB',          // blue
  dimensionLine: '#4B5563',      // medium grey
  dimensionArrow: '#374151',     // dark grey
  background: '#FAFAFA',         // near white
} as const

// ─── ARROW HEAD COMPONENT ──────────────────────────────────────────────────────

function ArrowHead({
  id,
  color = COLORS.dimensionArrow,
}: {
  id: string
  color?: string
}) {
  return (
    <defs>
      <marker
        id={id}
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
      </marker>
    </defs>
  )
}

// ─── DIMENSION LINE ────────────────────────────────────────────────────────────

function DimensionLine({
  x1,
  y1,
  x2,
  y2,
  label,
  offsetDir = 15,
  id,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  offsetDir?: number
  id: string
}) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return null

  // Perpendicular direction for label offset
  const nx = -dy / len
  const ny = dx / len

  const midX = (x1 + x2) / 2 + nx * offsetDir
  const midY = (y1 + y2) / 2 + ny * offsetDir

  return (
    <g>
      <line
        x1={x1 + nx * 4}
        y1={y1 + ny * 4}
        x2={x2 + nx * 4}
        y2={y2 + ny * 4}
        stroke={COLORS.dimensionLine}
        strokeWidth={0.5}
        markerStart={`url(#arrow-${id})`}
        markerEnd={`url(#arrow-${id})`}
      />
      <text
        x={midX}
        y={midY + 2.5}
        fontSize="7"
        fill={COLORS.dimensionArrow}
        textAnchor="middle"
        fontFamily="monospace"
      >
        {label}
      </text>
    </g>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────

export function CrossSectionRenderer({
  chainage,
  groundPoints,
  template,
  formationLevel: propFormationLevel,
  cutArea: propCutArea,
  fillArea: propFillArea,
  width = 800,
  height = 400,
  showLabels = true,
}: CrossSectionProps) {
  const sectionType = useMemo(
    () => determineSectionType(groundPoints, propFormationLevel ?? 0),
    [groundPoints, propFormationLevel]
  )

  const computedFormationLevel = useMemo(() => {
    if (propFormationLevel !== undefined) return propFormationLevel
    // Default: ground level at centre
    const gl = interpolateGroundAtCentre(groundPoints)
    return gl !== null ? gl + 0.5 : 100
  }, [propFormationLevel, groundPoints])

  const isCut = sectionType === 'cut' || sectionType === 'mixed'
  const isFill = sectionType === 'fill' || sectionType === 'mixed'

  // Compute formation line
  const formationLine = useMemo(
    () =>
      computeDetailedFormationLine(
        template,
        computedFormationLevel,
        groundPoints,
        isCut
      ),
    [template, computedFormationLevel, groundPoints, isCut]
  )

  // Compute camber profile for carriageway detail
  const camberProfile = useMemo(
    () => computeCamberProfile(template.carriagewayWidth, template.camber, computedFormationLevel),
    [template.carriagewayWidth, template.camber, computedFormationLevel]
  )

  // Compute areas
  const areas = useMemo(() => {
    if (propCutArea !== undefined && propFillArea !== undefined) {
      return { cutArea: propCutArea, fillArea: propFillArea }
    }
    const netArea = computeCutFillArea(groundPoints, formationLine)
    if (netArea >= 0) {
      return { cutArea: netArea, fillArea: 0 }
    }
    return { cutArea: 0, fillArea: -netArea }
  }, [propCutArea, propFillArea, groundPoints, formationLine])

  // Compute subgrade line
  const subgradeLevel = computedFormationLevel - template.subgradeDepth

  // Auto-scale computation
  const { viewBox, toSvgX, toSvgY } = useMemo(() => {
    const allPoints: ProfilePoint[] = [
      ...groundPoints,
      ...formationLine,
    ]

    // Also consider subgrade
    const minOffset = Math.min(...allPoints.map(p => p.offset)) - 3
    const maxOffset = Math.max(...allPoints.map(p => p.offset)) + 3
    const minLevel = Math.min(
      ...allPoints.map(p => p.level),
      subgradeLevel
    ) - 1.5
    const maxLevel = Math.max(...allPoints.map(p => p.level)) + 1.5

    const dataWidth = maxOffset - minOffset
    const dataHeight = maxLevel - minLevel

    // Add 15% padding
    const padding = 0.15
    const paddedWidth = dataWidth * (1 + padding)
    const paddedHeight = dataHeight * (1 + padding)

    const vbX = minOffset - dataWidth * padding / 2
    const vbY = minLevel - dataHeight * padding / 2

    // Maintain aspect ratio matching the SVG element
    const aspectRatio = width / height
    const dataAspect = paddedWidth / paddedHeight

    let finalVbW: number
    let finalVbH: number
    if (dataAspect > aspectRatio) {
      // Data is wider — fit width, expand height
      finalVbW = paddedWidth
      finalVbH = paddedWidth / aspectRatio
    } else {
      // Data is taller — fit height, expand width
      finalVbH = paddedHeight
      finalVbW = paddedHeight * aspectRatio
    }

    // Centre the data in the viewBox
    const centerX = vbX + dataWidth / 2
    const centerY = vbY + dataHeight / 2
    const finalVbX = centerX - finalVbW / 2
    const finalVbY = centerY - finalVbH / 2

    const scaleX = (offset: number) =>
      ((offset - finalVbX) / finalVbW) * width
    const scaleY = (level: number) =>
      height - ((level - finalVbY) / finalVbH) * height

    return {
      viewBox: `${finalVbX} ${finalVbY} ${finalVbW} ${finalVbH}`,
      toSvgX: scaleX,
      toSvgY: scaleY,
    }
  }, [groundPoints, formationLine, subgradeLevel, width, height])

  // Sorted ground points for polyline
  const sortedGround = useMemo(
    () => [...groundPoints].sort((a, b) => a.offset - b.offset),
    [groundPoints]
  )

  // Centre ground level for cut/fill depth computation
  const centreGroundLevel = interpolateGroundAtCentre(groundPoints)
  const centreDepth =
    centreGroundLevel !== null
      ? centreGroundLevel - computedFormationLevel
      : 0

  // Formation template offsets
  const halfCW = template.carriagewayWidth / 2
  const shoulderEndOffset = halfCW + template.shoulderWidth

  // Slope ratios for labels
  const activeSlopeStr = isCut ? template.cutSlope : template.fillSlope
  let activeSlopeRatio = 0
  try {
    activeSlopeRatio = parseSlopeRatio(activeSlopeStr)
  } catch {
    // fallback
  }

  // Ground polygon points for fill below ground line
  const groundFillPoints = useMemo(() => {
    if (sortedGround.length < 2) return ''
    const yBottom = toSvgY(
      Math.min(...sortedGround.map(p => p.level)) - 2
    )
    const pts = sortedGround
      .map(p => `${toSvgX(p.offset).toFixed(1)},${toSvgY(p.level).toFixed(1)}`)
      .join(' ')
    // Close the polygon at the bottom
    return `${pts} ${toSvgX(sortedGround[sortedGround.length - 1].offset).toFixed(1)},${yBottom.toFixed(1)} ${toSvgX(sortedGround[0].offset).toFixed(1)},${yBottom.toFixed(1)}`
  }, [sortedGround, toSvgX, toSvgY])

  // Ground polyline points
  const groundPolyline = useMemo(
    () =>
      sortedGround
        .map(p => `${toSvgX(p.offset).toFixed(1)},${toSvgY(p.level).toFixed(1)}`)
        .join(' '),
    [sortedGround, toSvgX, toSvgY]
  )

  // Formation polyline points (carriageway only)
  const carriagewayPolyline = useMemo(
    () =>
      camberProfile
        .map(p => `${toSvgX(p.offset).toFixed(1)},${toSvgY(p.level).toFixed(1)}`)
        .join(' '),
    [camberProfile, toSvgX, toSvgY]
  )

  // Slope lines — separate left and right slope segments
  const leftSlopePoints = useMemo(() => {
    const leftShoulder = formationLine.find(
      p => Math.abs(p.offset - (-(halfCW + template.shoulderWidth))) < 0.01
    )
    const leftIntercept = formationLine[0]
    if (!leftShoulder || !leftIntercept) return null
    return {
      x1: toSvgX(leftShoulder.offset),
      y1: toSvgY(leftShoulder.level),
      x2: toSvgX(leftIntercept.offset),
      y2: toSvgY(leftIntercept.level),
    }
  }, [formationLine, halfCW, template.shoulderWidth, toSvgX, toSvgY])

  const rightSlopePoints = useMemo(() => {
    const rightShoulder = formationLine.find(
      p => Math.abs(p.offset - (halfCW + template.shoulderWidth)) < 0.01
    )
    const rightIntercept = formationLine[formationLine.length - 1]
    if (!rightShoulder || !rightIntercept) return null
    return {
      x1: toSvgX(rightShoulder.offset),
      y1: toSvgY(rightShoulder.level),
      x2: toSvgX(rightIntercept.offset),
      y2: toSvgY(rightIntercept.level),
    }
  }, [formationLine, halfCW, template.shoulderWidth, toSvgX, toSvgY])

  // Shoulder lines
  const leftShoulderLine = useMemo(() => {
    const edge = camberProfile.find(p => Math.abs(p.offset - (-halfCW)) < 0.01)
    const shoulder = formationLine.find(
      p => Math.abs(p.offset - (-(halfCW + template.shoulderWidth))) < 0.01
    )
    if (!edge || !shoulder) return null
    return {
      x1: toSvgX(edge.offset),
      y1: toSvgY(edge.level),
      x2: toSvgX(shoulder.offset),
      y2: toSvgY(shoulder.level),
    }
  }, [camberProfile, formationLine, halfCW, template.shoulderWidth, toSvgX, toSvgY])

  const rightShoulderLine = useMemo(() => {
    const edge = camberProfile.find(p => Math.abs(p.offset - halfCW) < 0.01)
    const shoulder = formationLine.find(
      p => Math.abs(p.offset - (halfCW + template.shoulderWidth)) < 0.01
    )
    if (!edge || !shoulder) return null
    return {
      x1: toSvgX(edge.offset),
      y1: toSvgY(edge.level),
      x2: toSvgX(shoulder.offset),
      y2: toSvgY(shoulder.level),
    }
  }, [camberProfile, formationLine, halfCW, template.shoulderWidth, toSvgX, toSvgY])

  // Centreline SVG X position
  const clX = toSvgX(0)
  const formSvgY = toSvgY(computedFormationLevel)
  const subgradeSvgY = toSvgY(subgradeLevel)

  // Section type label
  const sectionLabel = useMemo(() => {
    if (areas.cutArea > 0.01 && areas.fillArea > 0.01) {
      return 'CUT/FILL'
    }
    if (areas.cutArea > 0.01) {
      return 'CUT'
    }
    if (areas.fillArea > 0.01) {
      return 'FILL'
    }
    return 'LEVEL'
  }, [areas])

  const sectionLabelColor = useMemo(() => {
    if (areas.cutArea > 0.01 && areas.fillArea > 0.01) return '#7C3AED'
    if (areas.cutArea > 0.01) return COLORS.cutLabel
    if (areas.fillArea > 0.01) return COLORS.fillLabel
    return COLORS.labelSecondary
  }, [areas])

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      className="block"
      style={{ background: COLORS.background }}
      role="img"
      aria-label={`Cross-section at chainage ${formatChainage(chainage)}`}
    >
      {/* Arrow markers for dimensions */}
      <ArrowHead id="dim-start" />
      <ArrowHead id="dim-end" />
      <ArrowHead id="dim-v-start" />
      <ArrowHead id="dim-v-end" />

      {/* ── Grid: centreline ── */}
      <line
        x1={clX}
        y1={0}
        x2={clX}
        y2={height}
        stroke={COLORS.centreLine}
        strokeWidth={0.5}
        strokeDasharray="6,4"
      />

      {/* ── Offset markers ── */}
      {showLabels && (
        <>
          {[10, 20, 30, 40, 50].forEach(offset => {
            // Only render if within the view
            const svgXLeft = toSvgX(-offset)
            const svgXRight = toSvgX(offset)
            if (svgXLeft < 0 && svgXRight > width) return
            return (
              <g key={offset}>
                {svgXLeft > 0 && (
                  <>
                    <line
                      x1={svgXLeft}
                      y1={height - 8}
                      x2={svgXLeft}
                      y2={height - 2}
                      stroke={COLORS.offsetMarker}
                      strokeWidth={0.5}
                    />
                    <text
                      x={svgXLeft}
                      y={height - 0.5}
                      fontSize="5"
                      fill={COLORS.labelSecondary}
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {offset}
                    </text>
                  </>
                )}
                {svgXRight < width && (
                  <>
                    <line
                      x1={svgXRight}
                      y1={height - 8}
                      x2={svgXRight}
                      y2={height - 2}
                      stroke={COLORS.offsetMarker}
                      strokeWidth={0.5}
                    />
                    <text
                      x={svgXRight}
                      y={height - 0.5}
                      fontSize="5"
                      fill={COLORS.labelSecondary}
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      {offset}
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </>
      )}

      {/* ── Ground profile fill (below ground line) ── */}
      {groundFillPoints && (
        <polygon
          points={groundFillPoints}
          fill={COLORS.groundFill}
          stroke="none"
        />
      )}

      {/* ── Ground profile line ── */}
      <polyline
        points={groundPolyline}
        fill="none"
        stroke={COLORS.groundLine}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* ── Fill slope (right side if fill) ── */}
      {isFill && rightSlopePoints && (
        <line
          x1={rightSlopePoints.x1}
          y1={rightSlopePoints.y1}
          x2={rightSlopePoints.x2}
          y2={rightSlopePoints.y2}
          stroke={COLORS.fillSlope}
          strokeWidth={1.5}
          strokeDasharray="4,2"
        />
      )}
      {isFill && leftSlopePoints && (
        <line
          x1={leftSlopePoints.x1}
          y1={leftSlopePoints.y1}
          x2={leftSlopePoints.x2}
          y2={leftSlopePoints.y2}
          stroke={COLORS.fillSlope}
          strokeWidth={1.5}
          strokeDasharray="4,2"
        />
      )}

      {/* ── Cut slope (left side if cut) ── */}
      {isCut && leftSlopePoints && (
        <line
          x1={leftSlopePoints.x1}
          y1={leftSlopePoints.y1}
          x2={leftSlopePoints.x2}
          y2={leftSlopePoints.y2}
          stroke={COLORS.cutSlope}
          strokeWidth={1.5}
          strokeDasharray="4,2"
        />
      )}
      {isCut && rightSlopePoints && (
        <line
          x1={rightSlopePoints.x1}
          y1={rightSlopePoints.y1}
          x2={rightSlopePoints.x2}
          y2={rightSlopePoints.y2}
          stroke={COLORS.cutSlope}
          strokeWidth={1.5}
          strokeDasharray="4,2"
        />
      )}

      {/* ── Shoulders ── */}
      {leftShoulderLine && (
        <line
          x1={leftShoulderLine.x1}
          y1={leftShoulderLine.y1}
          x2={leftShoulderLine.x2}
          y2={leftShoulderLine.y2}
          stroke={COLORS.shoulder}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}
      {rightShoulderLine && (
        <line
          x1={rightShoulderLine.x1}
          y1={rightShoulderLine.y1}
          x2={rightShoulderLine.x2}
          y2={rightShoulderLine.y2}
          stroke={COLORS.shoulder}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}

      {/* ── Carriageway with camber ── */}
      <polyline
        points={carriagewayPolyline}
        fill="none"
        stroke={COLORS.carriageway}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* ── Subgrade (dashed) ── */}
      {template.subgradeDepth > 0 && (
        <line
          x1={toSvgX(-shoulderEndOffset - 2)}
          y1={subgradeSvgY}
          x2={toSvgX(shoulderEndOffset + 2)}
          y2={subgradeSvgY}
          stroke={COLORS.subgrade}
          strokeWidth={0.8}
          strokeDasharray="6,3"
        />
      )}

      {/* ── DIMENSIONS ── */}
      {showLabels && (
        <>
          {/* Carriageway width dimension */}
          <DimensionLine
            x1={toSvgX(-halfCW)}
            y1={formSvgY}
            x2={toSvgX(halfCW)}
            y2={formSvgY}
            label={`${template.carriagewayWidth.toFixed(1)}m`}
            offsetDir={12}
            id="cw"
          />

          {/* Left shoulder width dimension */}
          <DimensionLine
            x1={toSvgX(-halfCW)}
            y1={formSvgY}
            x2={toSvgX(-(halfCW + template.shoulderWidth))}
            y2={formSvgY}
            label={`${template.shoulderWidth.toFixed(1)}m`}
            offsetDir={-10}
            id="ls"
          />

          {/* Right shoulder width dimension */}
          <DimensionLine
            x1={toSvgX(halfCW)}
            y1={formSvgY}
            x2={toSvgX(halfCW + template.shoulderWidth)}
            y2={formSvgY}
            label={`${template.shoulderWidth.toFixed(1)}m`}
            offsetDir={10}
            id="rs"
          />

          {/* Cut/fill depth arrow at centreline */}
          {centreGroundLevel !== null && Math.abs(centreDepth) > 0.01 && (
            <g>
              <line
                x1={clX}
                y1={toSvgY(centreGroundLevel)}
                x2={clX}
                y2={formSvgY}
                stroke={centreDepth > 0 ? COLORS.cutLabel : COLORS.fillLabel}
                strokeWidth={0.8}
                markerStart={
                  centreDepth > 0
                    ? 'url(#dim-v-start)'
                    : 'url(#dim-v-end)'
                }
                markerEnd={
                  centreDepth > 0
                    ? 'url(#dim-v-end)'
                    : 'url(#dim-v-start)'
                }
              />
              <text
                x={clX + 6}
                y={(toSvgY(centreGroundLevel) + formSvgY) / 2 + 2.5}
                fontSize="7"
                fill={centreDepth > 0 ? COLORS.cutLabel : COLORS.fillLabel}
                fontFamily="monospace"
              >
                {Math.abs(centreDepth).toFixed(3)}m
              </text>
            </g>
          )}
        </>
      )}

      {/* ── LABELS ── */}
      {showLabels && (
        <>
          {/* Chainage label (top-left) */}
          <g>
            <rect
              x={8}
              y={8}
              width={90}
              height={18}
              rx={3}
              fill="white"
              fillOpacity={0.9}
              stroke="#E5E7EB"
              strokeWidth={0.5}
            />
            <text
              x={14}
              y={21}
              fontSize="9"
              fill={COLORS.labelPrimary}
              fontFamily="monospace"
              fontWeight="600"
            >
              CH {formatChainage(chainage)}
            </text>
          </g>

          {/* Cut/Fill area label (top-right) */}
          <g>
            <rect
              x={width - 140}
              y={8}
              width={132}
              height={18}
              rx={3}
              fill={sectionLabelColor}
              fillOpacity={0.1}
              stroke={sectionLabelColor}
              strokeWidth={0.5}
            />
            <text
              x={width - 134}
              y={21}
              fontSize="9"
              fill={sectionLabelColor}
              fontFamily="monospace"
              fontWeight="600"
            >
              {sectionLabel}{' '}
              {(sectionLabel === 'CUT' || sectionLabel === 'CUT/FILL') &&
                areas.cutArea.toFixed(2) + 'm\u00B2'}
              {sectionLabel === 'CUT/FILL' && ' / '}
              {(sectionLabel === 'FILL' || sectionLabel === 'CUT/FILL') &&
                areas.fillArea.toFixed(2) + 'm\u00B2'}
            </text>
          </g>

          {/* Formation level label */}
          <text
            x={clX + 4}
            y={formSvgY - 4}
            fontSize="6"
            fill={COLORS.labelSecondary}
            fontFamily="monospace"
          >
            FL {computedFormationLevel.toFixed(3)}
          </text>

          {/* Subgrade level label */}
          {template.subgradeDepth > 0 && (
            <text
              x={toSvgX(shoulderEndOffset + 3)}
              y={subgradeSvgY + 3}
              fontSize="6"
              fill={COLORS.labelSecondary}
              fontFamily="monospace"
            >
              SG {subgradeLevel.toFixed(3)}
            </text>
          )}

          {/* Slope ratio labels */}
          {leftSlopePoints && activeSlopeRatio > 0 && (
            <text
              x={(leftSlopePoints.x1 + leftSlopePoints.x2) / 2}
              y={Math.min(leftSlopePoints.y1, leftSlopePoints.y2) - 4}
              fontSize="6"
              fill={COLORS.labelSecondary}
              textAnchor="middle"
              fontFamily="monospace"
            >
              {activeSlopeStr}
            </text>
          )}
          {rightSlopePoints && activeSlopeRatio > 0 && (
            <text
              x={(rightSlopePoints.x1 + rightSlopePoints.x2) / 2}
              y={Math.min(rightSlopePoints.y1, rightSlopePoints.y2) - 4}
              fontSize="6"
              fill={COLORS.labelSecondary}
              textAnchor="middle"
              fontFamily="monospace"
            >
              {activeSlopeStr}
            </text>
          )}

          {/* Camber label */}
          <text
            x={clX}
            y={formSvgY + 12}
            fontSize="6"
            fill={COLORS.labelSecondary}
            textAnchor="middle"
            fontFamily="monospace"
          >
            {template.camber}% camber
          </text>

          {/* Ground level at centreline */}
          {centreGroundLevel !== null && (
            <text
              x={clX - 4}
              y={toSvgY(centreGroundLevel) - 4}
              fontSize="6"
              fill={COLORS.groundLine}
              textAnchor="end"
              fontFamily="monospace"
            >
              GL {centreGroundLevel.toFixed(3)}
            </text>
          )}

          {/* CL label */}
          <text
            x={clX}
            y={height - 12}
            fontSize="6"
            fill={COLORS.labelSecondary}
            textAnchor="middle"
            fontFamily="monospace"
            fontWeight="500"
          >
            CL
          </text>
        </>
      )}
    </svg>
  )
}

export default CrossSectionRenderer
