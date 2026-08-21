'use client';

import { useEffect, useRef, useMemo, useState } from 'react'
import Konva from 'konva'
import { logEngineeringCompute } from '@/lib/engineering/compute'
import { initialiseDXFLayers, addStandardTitleBlock, DXF_LAYERS } from '@/lib/drawing/dxfLayers'

export interface ProfilePoint {
  chainage: number
  groundLevel: number
  formationLevel?: number
}

export interface StationLevel {
  chainage: number
  groundLevel: number
  formationLevel: number
  cut: number
  fill: number
}

interface LongitudinalSectionProps {
  points: ProfilePoint[]
  title?: string
  hScale?: number
  vScale?: number
  width?: number
  height?: number
  showTable?: boolean
  projectId?: string
  editable?: boolean
  projectData?: {
    lr_number?: string;
    county?: string;
    district?: string;
    locality?: string;
  };
  surveyorProfile?: {
    fullName: string;
    registrationNumber: string;
    firmName: string;
  } | null;
}

export function LongitudinalSection({
  points,
  title = 'LONGITUDINAL SECTION',
  hScale = 2000,
  vScale = 200,
  width = 900,
  height = 500,
  showTable = false,
  projectId,
  editable = false,
  projectData,
  surveyorProfile,
}: LongitudinalSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [designLevels, setDesignLevels] = useState<number[]>(
    points.map(p => p.formationLevel ?? p.groundLevel)
  )

  const pointsWithDesign = useMemo(() => {
    return points.map((p, i) => ({
      ...p,
      formationLevel: designLevels[i]
    }))
  }, [points, designLevels])

  const stationLevels: StationLevel[] = useMemo(() => {
    return pointsWithDesign.map(p => ({
      chainage: p.chainage,
      groundLevel: p.groundLevel,
      formationLevel: p.formationLevel ?? p.groundLevel,
      cut: p.formationLevel != null ? Math.max(0, p.groundLevel - p.formationLevel) : 0,
      fill: p.formationLevel != null ? Math.max(0, p.formationLevel - p.groundLevel) : 0
    }))
  }, [pointsWithDesign])

  const totalCut = useMemo(() => stationLevels.reduce((sum, s) => sum + s.cut, 0), [stationLevels])
  const totalFill = useMemo(() => stationLevels.reduce((sum, s) => sum + s.fill, 0), [stationLevels])

  useEffect(() => {
    setDesignLevels(points.map(p => p.formationLevel ?? p.groundLevel))
  }, [points])

  useEffect(() => {
    if (!containerRef.current || pointsWithDesign.length < 2) return

    const stage = new Konva.Stage({ container: containerRef.current, width, height })
    const layer = new Konva.Layer()
    stage.add(layer)

    const marginLeft = 80
    const marginRight = 40
    const marginTop = 40
    const drawHeight = height - 80

    const minCh = Math.min(...pointsWithDesign.map(p => p.chainage))
    const maxCh = Math.max(...pointsWithDesign.map(p => p.chainage))
    const minGL = Math.min(...pointsWithDesign.map(p => Math.min(p.groundLevel, p.formationLevel ?? p.groundLevel)))
    const maxGL = Math.max(...pointsWithDesign.map(p => Math.max(p.groundLevel, p.formationLevel ?? p.groundLevel)))
    const glRange = maxGL - minGL || 1

    const drawWidth = width - marginLeft - marginRight
    const chRange = maxCh - minCh || 1

    const hPPM = drawWidth / chRange
    const vPPM = drawHeight / (glRange * (hScale / vScale))

    function toCanvas(chainage: number, elevation: number) {
      return {
        x: marginLeft + (chainage - minCh) * hPPM,
        y: marginTop + drawHeight - (elevation - minGL) * vPPM * (hScale / vScale)
      }
    }

    const elevStep = 5
    const firstElev = Math.ceil(minGL / elevStep) * elevStep
    for (let el = firstElev; el <= maxGL + elevStep; el += elevStep) {
      const { y } = toCanvas(minCh, el)
      if (y < marginTop || y > marginTop + drawHeight) continue
      layer.add(new Konva.Line({
        points: [marginLeft, y, marginLeft + drawWidth, y],
        stroke: '#2a2a2a', strokeWidth: 0.5, dash: [4, 4]
      }))
      layer.add(new Konva.Text({
        x: 2, y: y - 6,
        text: `${el.toFixed(0)}`,
        fontSize: 9, fill: '#666'
      }))
    }

    layer.add(new Konva.Line({
      points: [marginLeft, marginTop, marginLeft, marginTop + drawHeight],
      stroke: '#555', strokeWidth: 1
    }))
    layer.add(new Konva.Line({
      points: [marginLeft, marginTop + drawHeight, marginLeft + drawWidth, marginTop + drawHeight],
      stroke: '#555', strokeWidth: 1
    }))

    const groundPts: number[] = []
    pointsWithDesign.forEach(p => {
      const { x, y } = toCanvas(p.chainage, p.groundLevel)
      groundPts.push(x, y)
    })
    layer.add(new Konva.Line({
      points: groundPts, stroke: '#66cc66', strokeWidth: 2
    }))

    const formationPts = pointsWithDesign.filter(p => p.formationLevel != null)
    if (formationPts.length >= 2) {
      const fPts: number[] = []
      formationPts.forEach(p => {
        const level = p.formationLevel
        if (level === undefined) return
        const { x, y } = toCanvas(p.chainage, level)
        fPts.push(x, y)
      })
      layer.add(new Konva.Line({
        points: fPts, stroke: '#e8a020', strokeWidth: 1.5, dash: [6, 3]
      }))
    }

    for (let i = 0; i < pointsWithDesign.length - 1; i++) {
      const p1 = pointsWithDesign[i]
      const p2 = pointsWithDesign[i + 1]
      if (p1.formationLevel == null || p2.formationLevel == null) continue

      const g1 = toCanvas(p1.chainage, p1.groundLevel)
      const f1 = toCanvas(p1.chainage, p1.formationLevel)
      const g2 = toCanvas(p2.chainage, p2.groundLevel)
      const f2 = toCanvas(p2.chainage, p2.formationLevel)

      const isCut = p1.groundLevel > p1.formationLevel

      layer.add(new Konva.Line({
        points: [g1.x, g1.y, g2.x, g2.y, f2.x, f2.y, f1.x, f1.y],
        closed: true,
        fill: isCut ? 'rgba(255,100,0,0.15)' : 'rgba(80,160,255,0.15)',
        stroke: 'transparent'
      }))
    }

    const tableY = marginTop + drawHeight + 10
    const chainStep = Math.ceil(chRange / 10 / 100) * 100
    for (let ch = Math.ceil(minCh / chainStep) * chainStep; ch <= maxCh; ch += chainStep) {
      const { x } = toCanvas(ch, minGL)
      layer.add(new Konva.Line({
        points: [x, marginTop, x, marginTop + drawHeight],
        stroke: '#1a1a1a', strokeWidth: 0.5
      }))
      layer.add(new Konva.Text({
        x: x - 15, y: tableY,
        text: `${ch.toFixed(0)}`,
        fontSize: 9, fill: '#888'
      }))
    }

    layer.add(new Konva.Text({
      x: marginLeft, y: 8,
      text: `${title}  |  H: 1:${hScale}  V: 1:${vScale}`,
      fontSize: 11, fill: '#aaa', fontStyle: 'bold'
    }))

    layer.add(new Konva.Line({
      points: [marginLeft, height - 15, marginLeft + 20, height - 15],
      stroke: '#66cc66', strokeWidth: 2
    }))
    layer.add(new Konva.Text({
      x: marginLeft + 24, y: height - 21,
      text: 'Ground', fontSize: 9, fill: '#66cc66'
    }))
    layer.add(new Konva.Line({
      points: [marginLeft + 80, height - 15, marginLeft + 100, height - 15],
      stroke: '#e8a020', strokeWidth: 1.5, dash: [6, 3]
    }))
    layer.add(new Konva.Text({
      x: marginLeft + 104, y: height - 21,
      text: 'Formation', fontSize: 9, fill: '#e8a020'
    }))
    layer.add(new Konva.Rect({
      x: marginLeft + 180, y: height - 19,
      width: 12, height: 8,
      fill: 'rgba(255,100,0,0.3)'
    }))
    layer.add(new Konva.Text({
      x: marginLeft + 196, y: height - 21,
      text: 'Cut', fontSize: 9, fill: '#ffaa66'
    }))
    layer.add(new Konva.Rect({
      x: marginLeft + 230, y: height - 19,
      width: 12, height: 8,
      fill: 'rgba(80,160,255,0.3)'
    }))
    layer.add(new Konva.Text({
      x: marginLeft + 246, y: height - 21,
      text: 'Fill', fontSize: 9, fill: '#66aaff'
    }))

    layer.draw()
    return () => { stage.destroy() }
  }, [pointsWithDesign, title, hScale, vScale, width, height])

  const exportDXF = async () => {
    const { default: Drawing } = await import('dxf-writer')
    const drawing = new Drawing()
    initialiseDXFLayers(drawing)

    addStandardTitleBlock(drawing, {
      drawingTitle: 'LONGITUDINAL SECTION SURVEY',
      lrNumber: projectData?.lr_number ?? 'N/A',
      county: projectData?.county ?? 'N/A',
      district: projectData?.district ?? 'N/A',
      locality: projectData?.locality ?? 'N/A',
      areaHa: 0,
      perimeterM: 0,
      surveyorName: surveyorProfile?.fullName ?? 'N/A',
      registrationNumber: surveyorProfile?.registrationNumber ?? 'N/A',
      firmName: surveyorProfile?.firmName ?? 'N/A',
      date: new Date().toLocaleDateString('en-KE'),
      submissionRef: 'N/A',
      coordinateSystem: 'Arc 1960 / UTM Zone 37S (SRID: 21037)',
      scale: '1:2500',
      sheetNumber: '1 of 1',
      revision: 'R00',
    })

    const minCh = Math.min(...pointsWithDesign.map(p => p.chainage))
    const minGL = Math.min(...pointsWithDesign.map(p => p.groundLevel))
    const hScaleFactor = 1 / hScale
    const vScaleFactor = 1 / vScale

    drawing.setActiveLayer(DXF_LAYERS.PROFILE.name)
    for (let i = 0; i < pointsWithDesign.length - 1; i++) {
      const p1 = pointsWithDesign[i]
      const p2 = pointsWithDesign[i + 1]
      drawing.drawLine(
        (p1.chainage - minCh) * hScaleFactor,
        (p1.groundLevel - minGL) * vScaleFactor,
        (p2.chainage - minCh) * hScaleFactor,
        (p2.groundLevel - minGL) * vScaleFactor
      )
    }

    const formPts = pointsWithDesign.filter(p => p.formationLevel != null)
    if (formPts.length >= 2) {
      drawing.setActiveLayer(DXF_LAYERS.CENTRELINE.name)
      for (let i = 0; i < formPts.length - 1; i++) {
        const p1 = formPts[i]
        const p2 = formPts[i + 1]
        const level1 = p1.formationLevel
        const level2 = p2.formationLevel
        if (level1 === undefined || level2 === undefined) continue
        drawing.drawLine(
          (p1.chainage - minCh) * hScaleFactor,
          (level1 - minGL) * vScaleFactor,
          (p2.chainage - minCh) * hScaleFactor,
          (level2 - minGL) * vScaleFactor
        )
      }
    }

    drawing.setActiveLayer(DXF_LAYERS.CHAIN.name)
    pointsWithDesign.forEach(p => {
      drawing.drawText(
        (p.chainage - minCh) * hScaleFactor,
        -0.005,
        0.002,
        0,
        `${p.chainage.toFixed(0)}`
      )
    })

    logEngineeringCompute('longitudinal_section', { points: pointsWithDesign.length }, 
      { totalCut, totalFill }, { projectId })

    const dxfString = drawing.toDxfString()
    const blob = new Blob([dxfString], { type: 'application/dxf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `profile_${projectId || 'export'}.dxf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const updateDesignLevel = (index: number, value: number) => {
    const newLevels = [...designLevels]
    newLevels[index] = value
    setDesignLevels(newLevels)
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div ref={containerRef} className="rounded-lg overflow-hidden bg-[#111]" style={{ width, height }} />
      </div>
      
      <div className="flex justify-end gap-2">
        <button
          onClick={exportDXF}
          className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export DXF
        </button>
      </div>

      {showTable && stationLevels.length > 0 && (
        <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg">
          <div className="flex justify-between items-center px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
            <span className="text-sm font-medium">Station Levels</span>
            <div className="flex gap-4 text-xs">
              <span className="text-orange-400">Total Cut: {totalCut.toFixed(2)} m³/area</span>
              <span className="text-blue-400">Total Fill: {totalFill.toFixed(2)} m³/area</span>
            </div>
          </div>
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] text-xs">
                <th className="text-left py-1.5 px-3">Ch.</th>
                <th className="text-right py-1.5 px-3">G.L.</th>
                <th className="text-right py-1.5 px-3">F.L.</th>
                <th className="text-right py-1.5 px-3">Cut</th>
                <th className="text-right py-1.5 px-3">Fill</th>
              </tr>
            </thead>
            <tbody>
              {stationLevels.slice(0, 15).map((row, i) => (
                <tr key={`${row}-${i}`} className="border-b border-[color-mix(in_srgb,var(--border-color)_30%,transparent)]">
                  <td className="py-1.5 px-3">{row.chainage.toFixed(0)}</td>
                  <td className="py-1.5 px-3 text-right">{row.groundLevel.toFixed(2)}</td>
                  <td className="py-1.5 px-3 text-right">
                    {editable ? (
                      <input aria-label="Design level (F.L.)"
                        type="number"
                        step={0.01}
                        value={designLevels[i]}
                        onChange={(e) => updateDesignLevel(i, Number(e.target.value))}
                        className="w-20 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-1 py-0.5 text-right text-sm"
                      />
                    ) : (
                      row.formationLevel.toFixed(2)
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-right text-orange-400">{row.cut > 0 ? row.cut.toFixed(2) : '-'}</td>
                  <td className="py-1.5 px-3 text-right text-blue-400">{row.fill > 0 ? row.fill.toFixed(2) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
