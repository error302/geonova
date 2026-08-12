'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react'
import {
  Upload,
  Download,
  FilePlus,
  Settings2,
  Eye,
  BarChart3,
  Trash2,
  Link2,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react'
import Drawing from 'dxf-writer'
import {
  type SurveyPointWithCode,
  type FeatureCodeDef,
  type LayerMappingResult,
  getAllGroups,
  getFeatureCode,
  mapPointsToLayers,
  aciToHex,
  DXF_LINE_TYPE_PATTERNS,
} from '@/lib/topo/featureCodes'
import FeatureCodeBrowser from './FeatureCodeBrowser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SurveyPointRow extends SurveyPointWithCode {
  id: string          // local react key
  description?: string
}

interface DrawingSettings {
  scale: number
  includeSpotHeights: boolean
  includeTitleBlock: boolean
  contourInterval: number
  gridTickInterval: number
  includeLabels: boolean
  includeLegend: boolean
}

interface DrawingStats {
  totalPoints: number
  totalLayers: number
  joinableLineCount: number
  pointsByCategory: Record<string, number>
}

// ─── Default settings ───────────────────────────────────────────────────────

const DEFAULT_SETTINGS: DrawingSettings = {
  scale: 500,
  includeSpotHeights: true,
  includeTitleBlock: true,
  contourInterval: 1.0,
  gridTickInterval: 50,
  includeLabels: true,
  includeLegend: true,
}

// ─── Scale options ──────────────────────────────────────────────────────────

const SCALE_OPTIONS = [100, 250, 500, 1000, 2500]

// ─── Demo data generator ───────────────────────────────────────────────────

function generateDemoPoints(): SurveyPointRow[] {
  const baseE = 371000
  const baseN = 9845000

  const rows: Array<{ code: string; count: number; pattern: 'line' | 'scatter' }> = [
    { code: 'BND', count: 6, pattern: 'line' },
    { code: 'BLD', count: 5, pattern: 'line' },
    { code: 'BLD', count: 4, pattern: 'line' },
    { code: 'RD', count: 8, pattern: 'line' },
    { code: 'RD-CTR', count: 8, pattern: 'line' },
    { code: 'ELV', count: 5, pattern: 'line' },
    { code: 'ELV-POL', count: 5, pattern: 'scatter' },
    { code: 'SH', count: 12, pattern: 'scatter' },
    { code: 'TRV', count: 8, pattern: 'scatter' },
    { code: 'RIV', count: 7, pattern: 'line' },
    { code: 'BM', count: 2, pattern: 'scatter' },
    { code: 'CTRL', count: 2, pattern: 'scatter' },
    { code: 'WTR', count: 5, pattern: 'line' },
    { code: 'SLB', count: 4, pattern: 'scatter' },
  ]

  const points: SurveyPointRow[] = []
  let ptNum = 1

  for (const group of rows) {
    const def = getFeatureCode(group.code)
    for (let i = 0; i < group.count; i++) {
      const de = Math.random() * 80 - 40
      const dn = Math.random() * 80 - 40
      const z = 1200 + Math.random() * 50

      points.push({
        id: `demo-${ptNum}`,
        pointNumber: `${ptNum}`,
        easting: group.pattern === 'line'
          ? baseE + 10 * i + (Math.random() * 4 - 2)
          : baseE + de,
        northing: group.pattern === 'line'
          ? baseN + 5 * i + (Math.random() * 3 - 1.5)
          : baseN + dn,
        elevation: Math.round(z * 1000) / 1000,
        code: group.code,
        description: def?.description ?? '',
      })
      ptNum++
    }
  }
  return points
}

// ─── DXF generation ─────────────────────────────────────────────────────────

function generateTopoDXF(
  points: SurveyPointWithCode[],
  settings: DrawingSettings,
  projectName = 'Topographic Survey',
): string {
  const drawing = new Drawing()
  drawing.setUnits('Meters')

  // Register line types
  for (const [, pattern] of Object.entries(DXF_LINE_TYPE_PATTERNS)) {
    if (pattern.elements.length > 0) {
      drawing.addLineType(pattern.name, pattern.name, pattern.elements)
    }
  }

  // Register layers from mapped results
  const layerResults = mapPointsToLayers(points)
  const registeredLayers = new Set<string>()

  // Standard annotation layers
  drawing.addLayer('ANNOTATIONS', 3, 'CONTINUOUS')
  drawing.addLayer('SPOT_HEIGHTS', 3, 'CONTINUOUS')
  drawing.addLayer('BORDER', 7, 'CONTINUOUS')
  drawing.addLayer('NORTH_ARROW', 7, 'CONTINUOUS')
  drawing.addLayer('SCALE_BAR', 7, 'CONTINUOUS')
  drawing.addLayer('TITLE_BLOCK', 7, 'CONTINUOUS')
  drawing.addLayer('LEGEND', 7, 'CONTINUOUS')
  drawing.addLayer('GRID', 8, 'DASHED')

  registeredLayers.add('ANNOTATIONS')
  registeredLayers.add('SPOT_HEIGHTS')
  registeredLayers.add('BORDER')
  registeredLayers.add('NORTH_ARROW')
  registeredLayers.add('SCALE_BAR')
  registeredLayers.add('TITLE_BLOCK')
  registeredLayers.add('LEGEND')
  registeredLayers.add('GRID')

  // Register each feature layer
  for (const lr of layerResults) {
    if (!registeredLayers.has(lr.layer)) {
      drawing.addLayer(lr.layer, lr.color, lr.lineType)
      registeredLayers.add(lr.layer)
    }
  }

  if (points.length === 0) return drawing.toDxfString()

  // ─── Compute extents ──────────────────────────────────────────────────
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.easting < minX) minX = p.easting
    if (p.easting > maxX) maxX = p.easting
    if (p.northing < minY) minY = p.northing
    if (p.northing > maxY) maxY = p.northing
  }
  const padding = Math.max(maxX - minX, maxY - minY) * 0.15
  minX -= padding; maxX += padding
  minY -= padding; maxY += padding

  // ─── Grid ticks ───────────────────────────────────────────────────────
  drawing.setActiveLayer('GRID')
  const gridInterval = settings.gridTickInterval
  const gridStartX = Math.floor(minX / gridInterval) * gridInterval
  const gridStartY = Math.floor(minY / gridInterval) * gridInterval
  for (let x = gridStartX; x <= maxX; x += gridInterval) {
    drawing.drawLine(x, minY, x, minY + 2)
    drawing.drawLine(x, maxY - 2, x, maxY)
  }
  for (let y = gridStartY; y <= maxY; y += gridInterval) {
    drawing.drawLine(minX, y, minX + 2, y)
    drawing.drawLine(maxX - 2, y, maxX, y)
  }

  // ─── Spot heights (cross marks + RL labels) ───────────────────────────
  if (settings.includeSpotHeights) {
    drawing.setActiveLayer('SPOT_HEIGHTS')
    const spotHeightCode = getFeatureCode('SH')
    for (const p of points) {
      if (p.code.toUpperCase() === 'SH' || (spotHeightCode && p.code.toUpperCase() === 'SH')) {
        const tick = (maxX - minX) * 0.005
        // Cross symbol
        drawing.drawLine(p.easting - tick, p.northing, p.easting + tick, p.northing)
        drawing.drawLine(p.easting, p.northing - tick, p.easting, p.northing + tick)
        // RL label
        if (p.elevation !== undefined) {
          drawing.drawText(
            p.easting + tick * 1.5,
            p.northing + tick * 0.5,
            (maxX - minX) * 0.008,
            0,
            p.elevation.toFixed(3),
          )
        }
      }
    }
  }

  // ─── Feature-coded points & polylines ─────────────────────────────────
  for (const lr of layerResults) {
    drawing.setActiveLayer(lr.layer)

    // Draw polylines (joined sequential lines)
    for (const poly of lr.polylines) {
      if (poly.length >= 2) {
        for (let i = 0; i < poly.length - 1; i++) {
          drawing.drawLine(poly[i].e, poly[i].n, poly[i + 1].e, poly[i + 1].n)
        }
      }
    }

    // Draw point markers
    for (const pt of lr.points) {
      drawing.drawPoint(pt.e, pt.n)
    }
  }

  // ─── Labels (ANNOTATIONS layer) ───────────────────────────────────────
  if (settings.includeLabels) {
    drawing.setActiveLayer('ANNOTATIONS')
    for (const lr of layerResults) {
      for (const pt of lr.points) {
        if (pt.label) {
          drawing.drawText(
            pt.e + (maxX - minX) * 0.006,
            pt.n + (maxY - minY) * 0.006,
            (maxX - minX) * 0.007,
            0,
            pt.label,
          )
        }
      }
    }
  }

  // ─── Border ───────────────────────────────────────────────────────────
  drawing.setActiveLayer('BORDER')
  drawing.drawLine(minX, minY, maxX, minY)
  drawing.drawLine(maxX, minY, maxX, maxY)
  drawing.drawLine(maxX, maxY, minX, maxY)
  drawing.drawLine(minX, maxY, minX, minY)
  // Inner border
  const inset = (maxX - minX) * 0.01
  drawing.drawLine(minX + inset, minY + inset, maxX - inset, minY + inset)
  drawing.drawLine(maxX - inset, minY + inset, maxX - inset, maxY - inset)
  drawing.drawLine(maxX - inset, maxY - inset, minX + inset, maxY - inset)
  drawing.drawLine(minX + inset, maxY - inset, minX + inset, minY + inset)

  // ─── North arrow ──────────────────────────────────────────────────────
  drawing.setActiveLayer('NORTH_ARROW')
  const arrowX = maxX - (maxX - minX) * 0.06
  const arrowY = maxY - (maxY - minY) * 0.06
  const arrowLen = (maxX - minX) * 0.04
  drawing.drawLine(arrowX, arrowY - arrowLen, arrowX, arrowY + arrowLen)
  drawing.drawLine(arrowX, arrowY + arrowLen, arrowX - arrowLen * 0.2, arrowY + arrowLen * 0.6)
  drawing.drawLine(arrowX, arrowY + arrowLen, arrowX + arrowLen * 0.2, arrowY + arrowLen * 0.6)
  drawing.drawText(arrowX, arrowY + arrowLen * 1.3, (maxX - minX) * 0.012, 0, 'N')

  // ─── Scale bar ────────────────────────────────────────────────────────
  drawing.setActiveLayer('SCALE_BAR')
  const sbX = minX + inset
  const sbY = minY - inset * 2
  const scaleBarLen = (maxX - minX) * 0.15
  drawing.drawLine(sbX, sbY, sbX + scaleBarLen, sbY)
  drawing.drawLine(sbX, sbY - inset * 0.3, sbX, sbY + inset * 0.3)
  drawing.drawLine(sbX + scaleBarLen, sbY - inset * 0.3, sbX + scaleBarLen, sbY + inset * 0.3)
  drawing.drawText(
    sbX + scaleBarLen / 2,
    sbY - inset * 0.8,
    (maxX - minX) * 0.008,
    0,
    `Scale 1:${settings.scale}`,
  )

  // ─── Title block ──────────────────────────────────────────────────────
  if (settings.includeTitleBlock) {
    drawing.setActiveLayer('TITLE_BLOCK')
    const tbX = minX + inset * 2
    const tbY = minY - inset * 5
    const titleSize = (maxX - minX) * 0.012
    const subSize = (maxX - minX) * 0.008

    drawing.drawText(tbX, tbY, titleSize, 0, 'REPUBLIC OF KENYA — TOPOGRAPHIC SURVEY')
    drawing.drawText(tbX, tbY - titleSize * 2, subSize, 0, `Project: ${projectName}`)
    drawing.drawText(tbX, tbY - titleSize * 3.5, subSize, 0, `Scale: 1:${settings.scale}`)
    drawing.drawText(tbX, tbY - titleSize * 5, subSize, 0, `Total Points: ${points.length}  |  Layers: ${layerResults.length}`)
    drawing.drawText(
      tbX,
      tbY - titleSize * 6.5,
      subSize * 0.85,
      0,
      `Date: ${new Date().toISOString().split('T')[0]}  |  Generated by METARDU`,
    )
    drawing.drawText(
      tbX,
      tbY - titleSize * 8,
      subSize * 0.85,
      0,
      `Coordinate System: Arc 1960 / UTM Zone ${minX > 500000 ? '37S' : '36N'}`,
    )
  }

  // ─── Legend ───────────────────────────────────────────────────────────
  if (settings.includeLegend && layerResults.length > 0) {
    drawing.setActiveLayer('LEGEND')
    const lgX = maxX - (maxX - minX) * 0.2
    const lgY = maxY - inset * 2
    const rowH = (maxY - minY) * 0.025
    const textH = (maxX - minX) * 0.007

    drawing.drawText(lgX, lgY, textH * 1.4, 0, 'LEGEND')

    let row = 0
    // Group legend entries by first code per layer
    for (const lr of layerResults) {
      const y = lgY - rowH * (row + 1)
      if (y < minY + inset * 5) break // Leave room below legend
      // Color swatch (small line)
      drawing.drawLine(lgX, y, lgX + (maxX - minX) * 0.015, y)
      // Layer name
      drawing.drawText(
        lgX + (maxX - minX) * 0.02,
        y,
        textH,
        0,
        `${lr.layer} (${lr.points.length} pts)`,
      )
      row++
    }
  }

  return drawing.toDxfString()
}

// ─── Download helper ────────────────────────────────────────────────────────

function downloadDXF(dxfString: string, filename: string) {
  const blob = new Blob([dxfString], { type: 'application/dxf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Stats calculator ──────────────────────────────────────────────────────

function computeStats(
  points: SurveyPointRow[],
  layerResults: LayerMappingResult[],
): DrawingStats {
  const catCount: Record<string, number> = {}
  let joinableLines = 0

  for (const p of points) {
    const def = getFeatureCode(p.code)
    const cat = def?.category ?? 'other'
    catCount[cat] = (catCount[cat] || 0) + 1
  }

  for (const lr of layerResults) {
    joinableLines += lr.polylines.length
  }

  return {
    totalPoints: points.length,
    totalLayers: layerResults.length,
    joinableLineCount: joinableLines,
    pointsByCategory: catCount,
  }
}

// ─── CSV parser ─────────────────────────────────────────────────────────────

function parseCSV(text: string): SurveyPointRow[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const header = lines[0].toUpperCase()
  const points: SurveyPointRow[] = []

  // Detect column order from header
  const cols = header.split(/[,;\t]+/)
  const eIdx = cols.findIndex(c => c.includes('EAST') || c.includes('E') || c.includes('X'))
  const nIdx = cols.findIndex(c => c.includes('NORTH') || c.includes('N') || c.includes('Y'))
  const rlIdx = cols.findIndex(c => c.includes('RL') || c.includes('ELEV') || c.includes('Z') || c.includes('H'))
  const codeIdx = cols.findIndex(c => c.includes('CODE') || c.includes('FC') || c.includes('FEATURE'))
  const ptIdx = cols.findIndex(c => c.includes('POINT') || c.includes('NO') || c.includes('ID') || c.includes('NUM'))
  const descIdx = cols.findIndex(c => c.includes('DESC') || c.includes('REMARK'))

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(/[,;\t]+/).map(v => v.trim())
    if (vals.length < 2) continue

    const easting = eIdx >= 0 ? parseFloat(vals[eIdx]) : parseFloat(vals[0])
    const northing = nIdx >= 0 ? parseFloat(vals[nIdx]) : parseFloat(vals[1])
    if (isNaN(easting) || isNaN(northing)) continue

    points.push({
      id: `csv-${i}`,
      pointNumber: ptIdx >= 0 && vals[ptIdx] ? vals[ptIdx] : `${i}`,
      easting,
      northing,
      elevation: rlIdx >= 0 ? parseFloat(vals[rlIdx]) || undefined : undefined,
      code: codeIdx >= 0 ? (vals[codeIdx] || 'UNK').toUpperCase() : 'UNK',
      description: descIdx >= 0 ? vals[descIdx] : '',
    })
  }
  return points
}

// ─── SVG preview ────────────────────────────────────────────────────────────

function SvgPreview({ points }: { points: SurveyPointRow[] }) {
  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-zinc-500">
        Import points to see preview
      </div>
    )
  }

  const w = 360
  const h = 220
  const margin = 16

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.easting < minX) minX = p.easting
    if (p.easting > maxX) maxX = p.easting
    if (p.northing < minY) minY = p.northing
    if (p.northing > maxY) maxY = p.northing
  }
  const worldW = maxX - minX || 1
  const worldH = maxY - minY || 1

  const toSvgX = (e: number) => margin + ((e - minX) / worldW) * (w - 2 * margin)
  const toSvgY = (n: number) => margin + ((maxY - n) / worldH) * (h - 2 * margin)

  // Get unique codes and assign colors
  const codeColorMap = new Map<string, string>()
  const palette = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#6366f1',
    '#84cc16', '#e879f9', '#facc15', '#fb923c', '#a78bfa',
  ]
  let colorIdx = 0
  for (const p of points) {
    if (!codeColorMap.has(p.code)) {
      codeColorMap.set(p.code, palette[colorIdx % palette.length])
      colorIdx++
    }
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full bg-zinc-950 rounded" style={{ '--bg-tertiary': '#09090b' } as React.CSSProperties}>
      {/* Grid lines */}
      <g stroke="#27272a" strokeWidth="0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const x = margin + (i / 4) * (w - 2 * margin)
          return <line key={`gv${i}`} x1={x} y1={margin} x2={x} y2={h - margin} />
        })}
        {Array.from({ length: 4 }).map((_, i) => {
          const y = margin + (i / 3) * (h - 2 * margin)
          return <line key={`gh${i}`} x1={margin} y1={y} x2={w - margin} y2={y} />
        })}
      </g>
      {/* Points */}
      {points.map(p => {
        const sx = toSvgX(p.easting)
        const sy = toSvgY(p.northing)
        const color = codeColorMap.get(p.code) || '#666'
        return (
          <circle key={p.id} cx={sx} cy={sy} r={2.5} fill={color} opacity={0.85}>
            <title>{`${p.pointNumber ?? ''} ${p.code} (${p.easting.toFixed(1)}, ${p.northing.toFixed(1)})`}</title>
          </circle>
        )
      })}
      {/* Legend (compact) */}
      <g transform={`translate(${w - margin - 80}, ${margin + 4})`}>
        {Array.from(codeColorMap.entries()).map(([code, color], idx) => (
          <g key={code} transform={`translate(0, ${idx * 11})`}>
            <circle cx={4} cy={4} r={3} fill={color} />
            <text x={10} y={7} fill="#a1a1aa" fontSize={8} fontFamily="monospace">{code}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

// ─── Manual add row ─────────────────────────────────────────────────────────

function ManualAddRow({ onAdd }: { onAdd: (pt: SurveyPointRow) => void }) {
  const [ptNum, setPtNum] = useState('')
  const [easting, setEasting] = useState('')
  const [northing, setNorthing] = useState('')
  const [rl, setRl] = useState('')
  const [code, setCode] = useState('SH')

  const handleAdd = useCallback(() => {
    const e = parseFloat(easting)
    const n = parseFloat(northing)
    if (isNaN(e) || isNaN(n)) return

    onAdd({
      id: `manual-${Date.now()}`,
      pointNumber: ptNum || undefined,
      easting: e,
      northing: n,
      elevation: rl ? parseFloat(rl) || undefined : undefined,
      code: code.toUpperCase(),
      description: getFeatureCode(code)?.description ?? '',
    })

    setPtNum('')
    setEasting('')
    setNorthing('')
    setRl('')
  }, [ptNum, easting, northing, rl, code, onAdd])

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-zinc-900/50 border border-zinc-800 rounded-md">
      <Input
        placeholder="#"
        value={ptNum}
        onChange={e => setPtNum(e.target.value)}
        className="h-7 w-14 text-xs bg-zinc-800 border-zinc-700 text-zinc-300"
      />
      <Input
        placeholder="Easting"
        value={easting}
        onChange={e => setEasting(e.target.value)}
        className="h-7 w-28 text-xs bg-zinc-800 border-zinc-700 text-zinc-300"
      />
      <Input
        placeholder="Northing"
        value={northing}
        onChange={e => setNorthing(e.target.value)}
        className="h-7 w-28 text-xs bg-zinc-800 border-zinc-700 text-zinc-300"
      />
      <Input
        placeholder="RL"
        value={rl}
        onChange={e => setRl(e.target.value)}
        className="h-7 w-20 text-xs bg-zinc-800 border-zinc-700 text-zinc-300"
      />
      <Input
        placeholder="Code"
        value={code}
        onChange={e => setCode(e.target.value)}
        className="h-7 w-20 text-xs bg-zinc-800 border-zinc-700 text-zinc-300 font-mono"
      />
      <Button size="sm" variant="outline" onClick={handleAdd} className="h-7 text-xs">
        <Plus size={12} />
        Add
      </Button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

interface TopoDrawingComposerProps {
  projectId?: string
}

export default function TopoDrawingComposer({ projectId }: TopoDrawingComposerProps) {
  const [points, setPoints] = useState<SurveyPointRow[]>([])
  const [settings, setSettings] = useState<DrawingSettings>(DEFAULT_SETTINGS)
  const [codeDialogOpen, setCodeDialogOpen] = useState(false)
  const [editingPointId, setEditingPointId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showStats, setShowStats] = useState(true)
  const [showLayerPreview] = useState(true)
  const [activeTab, setActiveTab] = useState<'points' | 'layers' | 'preview'>('points')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Derived state ─────────────────────────────────────────────────────
  const layerResults = useMemo(
    () => mapPointsToLayers(points.map(({ id: _id, description: _description, ...rest }) => rest)),
    [points],
  )

  const stats = useMemo(
    () => computeStats(points, layerResults),
    [points, layerResults],
  )

  // Group layers by category for preview
  const layersByCategory = useMemo(() => {
    const groups = getAllGroups()
    const result: Array<{ category: string; categoryName: string; layers: LayerMappingResult[] }> = []

    // Build a direct layer-name to category map (O(n) instead of O(n*m*find))
    const layerCatMap = new Map<string, string>()
    for (const p of points) {
      const def = getFeatureCode(p.code)
      if (def && !layerCatMap.has(def.dxfLayer)) {
        layerCatMap.set(def.dxfLayer, def.category)
      }
    }

    for (const group of groups) {
      const matching = layerResults.filter(lr => {
        const cat = layerCatMap.get(lr.layer)
        if (!cat) return lr.layer.toLowerCase().includes(group.category)
        return cat === group.category
      })
      if (matching.length === 0) continue
      result.push({
        category: group.category,
        categoryName: group.name,
        layers: matching,
      })
    }
    return result
  }, [layerResults, points])

  // ─── Actions ───────────────────────────────────────────────────────────

  const handleImportCSV = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCSV(reader.result as string)
      if (parsed.length > 0) {
        setPoints(prev => [...prev, ...parsed])
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  const handleLoadDemo = useCallback(() => {
    setPoints(generateDemoPoints())
  }, [])

  const handleClearPoints = useCallback(() => {
    setPoints([])
  }, [])

  const handleRemovePoint = useCallback((id: string) => {
    setPoints(prev => prev.filter(p => p.id !== id))
  }, [])

  const handleAddPoint = useCallback((pt: SurveyPointRow) => {
    setPoints(prev => [...prev, pt])
  }, [])

  const handleCodeSelect = useCallback((code: FeatureCodeDef) => {
    if (editingPointId) {
      setPoints(prev =>
        prev.map(p =>
          p.id === editingPointId
            ? { ...p, code: code.code, description: code.description }
            : p,
        ),
      )
    }
    setCodeDialogOpen(false)
    setEditingPointId(null)
  }, [editingPointId])

  const handleOpenCodeDialog = useCallback((pointId: string) => {
    setEditingPointId(pointId)
    setCodeDialogOpen(true)
  }, [])

  const handleExportDXF = useCallback(() => {
    if (points.length === 0) return
    const surveyPoints: SurveyPointWithCode[] = points.map(({ id: _id, description: _description, ...rest }) => rest)
    const dxf = generateTopoDXF(surveyPoints, settings, projectId ?? 'Topographic Survey')
    const date = new Date().toISOString().split('T')[0]
    downloadDXF(dxf, `topo_${projectId ?? 'survey'}_${date}.dxf`)
  }, [points, settings, projectId])

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4" style={{ '--bg-tertiary': '#09090b', '--border-color': '#3f3f46', '--accent': '#3b82f6', '--text-muted': '#71717a' } as React.CSSProperties}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-zinc-900 border border-zinc-700 rounded-lg">
        <div className="flex items-center gap-3">
          <Layers size={20} className="text-blue-400" />
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Topo Drawing Composer</h2>
            <p className="text-xs text-zinc-500">
              {points.length > 0
                ? `${points.length} points across ${stats.totalLayers} layers`
                : 'Import survey points to begin'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs border-zinc-600 text-zinc-300 hover:bg-zinc-800">
            <Upload size={14} />
            Import CSV
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleImportCSV} className="hidden" />
          <Button variant="outline" size="sm" onClick={handleLoadDemo} className="text-xs border-zinc-600 text-zinc-300 hover:bg-zinc-800">
            <FilePlus size={14} />
            Load Demo
          </Button>
          {points.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleClearPoints} className="text-xs border-red-800/50 text-red-400 hover:bg-red-900/20">
                <Trash2 size={14} />
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportDXF} className="text-xs border-blue-600/50 text-blue-400 hover:bg-blue-900/20 hover:text-blue-300">
                <Download size={14} />
                Export DXF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-700 rounded-lg p-1">
        {[
          { key: 'points' as const, label: 'Points', icon: <FilePlus size={14} /> },
          { key: 'layers' as const, label: 'Layers', icon: <Layers size={14} /> },
          { key: 'preview' as const, label: 'Preview', icon: <Eye size={14} /> },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.key === 'layers' && stats.totalLayers > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-zinc-800 text-zinc-400">
                {stats.totalLayers}
              </Badge>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left column: main content ──────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* TAB: Points */}
          {activeTab === 'points' && (
            <div className="space-y-3">
              {/* Manual add row */}
              <ManualAddRow onAdd={handleAddPoint} />

              {/* Points table */}
              <div className="border border-zinc-700 rounded-lg overflow-hidden bg-zinc-900">
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-zinc-800">
                      <tr className="text-zinc-400 border-b border-zinc-700">
                        <th className="px-2 py-2 text-left font-medium">#</th>
                        <th className="px-2 py-2 text-right font-medium">Easting</th>
                        <th className="px-2 py-2 text-right font-medium">Northing</th>
                        <th className="px-2 py-2 text-right font-medium">RL</th>
                        <th className="px-2 py-2 text-left font-medium">Code</th>
                        <th className="px-2 py-2 text-left font-medium">Description</th>
                        <th className="px-2 py-2 text-center font-medium w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {points.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                            No points imported. Use CSV import, load demo data, or add manually.
                          </td>
                        </tr>
                      )}
                      {points.map((p, idx) => {
                        const def = getFeatureCode(p.code)
                        return (
                          <tr
                            key={p.id}
                            className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors"
                          >
                            <td className="px-2 py-1.5 text-zinc-500">{p.pointNumber ?? idx + 1}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-zinc-300">
                              {p.easting.toFixed(3)}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-zinc-300">
                              {p.northing.toFixed(3)}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono text-zinc-400">
                              {p.elevation !== undefined ? p.elevation.toFixed(3) : '—'}
                            </td>
                            <td className="px-2 py-1.5">
                              <button
                                onClick={() => handleOpenCodeDialog(p.id)}
                                className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs font-mono font-semibold transition-colors hover:bg-zinc-700"
                                style={{
                                  color: def ? (aciToHex(def.color) === '#FFFFFF' ? '#94a3b8' : aciToHex(def.color)) : '#71717a',
                                }}
                                title="Click to change code"
                              >
                                {p.code}
                                {def?.joinLines && <Link2 size={10} className="text-blue-400/50" />}
                              </button>
                            </td>
                            <td className="px-2 py-1.5 text-zinc-400 truncate max-w-[160px]">
                              {p.description || def?.description || '—'}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                onClick={() => handleRemovePoint(p.id)}
                                className="text-zinc-600 hover:text-red-400 transition-colors"
                                title="Remove point"
                              >
                                <X size={12} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Layers */}
          {activeTab === 'layers' && (
            <div className="border border-zinc-700 rounded-lg bg-zinc-900 overflow-hidden">
              <ScrollArea className="max-h-[500px]">
                <div className="p-3 space-y-3">
                  {layersByCategory.length === 0 && (
                    <div className="py-8 text-center text-sm text-zinc-500">
                      Import points to see layer breakdown
                    </div>
                  )}
                  {layersByCategory.map(group => (
                    <div key={group.category}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          {group.categoryName}
                        </span>
                        <div className="flex-1 h-px bg-zinc-800" />
                      </div>
                      <div className="space-y-1">
                        {group.layers.map(lr => (
                          <div
                            key={lr.layer}
                            className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-800/40 hover:bg-zinc-800/70 transition-colors"
                          >
                            <span
                              className="w-3 h-3 rounded-sm shrink-0 border border-zinc-600"
                              style={{ backgroundColor: aciToHex(lr.color) === '#FFFFFF' ? '#52525b' : aciToHex(lr.color) }}
                            />
                            <span className="font-mono text-xs text-zinc-300 flex-1">{lr.layer}</span>
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-zinc-700 text-zinc-300">
                              {lr.points.length} pts
                            </Badge>
                            {lr.polylines.length > 0 && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-blue-900/30 text-blue-400">
                                {lr.polylines.length} lines
                              </Badge>
                            )}
                            <span className="text-[10px] text-zinc-600 font-mono">{lr.lineType}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* TAB: Preview */}
          {activeTab === 'preview' && (
            <div className="border border-zinc-700 rounded-lg bg-zinc-900 overflow-hidden">
              <div className="p-4 h-[400px]">
                <SvgPreview points={points} />
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: settings & stats ─────────────────────────── */}
        <div className="space-y-4 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto lg:pr-1">

          {/* Drawing Settings */}
          <div className="border border-zinc-700 rounded-lg bg-zinc-900 overflow-hidden">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Settings2 size={14} className="text-zinc-400" />
                Drawing Settings
              </span>
              {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showSettings && (
              <div className="px-4 pb-4 space-y-3 border-t border-zinc-800">
                {/* Scale */}
                <div className="pt-3">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Drawing Scale</div>
                  <div className="flex gap-1 mt-1.5">
                    {SCALE_OPTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => setSettings(prev => ({ ...prev, scale: s }))}
                        className={`flex-1 px-2 py-1 rounded text-xs font-mono transition-colors border ${
                          settings.scale === s
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        1:{s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      aria-label="Include spot height labels"
                      checked={settings.includeSpotHeights}
                      onCheckedChange={v => setSettings(prev => ({ ...prev, includeSpotHeights: !!v }))}
                      className="border-zinc-600"
                    />
                    <span className="text-xs text-zinc-300">Include spot height labels</span>
                  </div>
                  <div className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      aria-label="Include title block"
                      checked={settings.includeTitleBlock}
                      onCheckedChange={v => setSettings(prev => ({ ...prev, includeTitleBlock: !!v }))}
                      className="border-zinc-600"
                    />
                    <span className="text-xs text-zinc-300">Include title block</span>
                  </div>
                  <div className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      aria-label="Include point labels"
                      checked={settings.includeLabels}
                      onCheckedChange={v => setSettings(prev => ({ ...prev, includeLabels: !!v }))}
                      className="border-zinc-600"
                    />
                    <span className="text-xs text-zinc-300">Include point labels</span>
                  </div>
                  <div className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      aria-label="Include legend"
                      checked={settings.includeLegend}
                      onCheckedChange={v => setSettings(prev => ({ ...prev, includeLegend: !!v }))}
                      className="border-zinc-600"
                    />
                    <span className="text-xs text-zinc-300">Include legend</span>
                  </div>
                </div>

                {/* Contour & Grid intervals */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="tdc-contour-interval" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Contour Interval (m)</label>
                    <Input
                      id="tdc-contour-interval"
                      type="number"
                      step="0.5"
                      min="0.25"
                      value={settings.contourInterval}
                      onChange={e => setSettings(prev => ({ ...prev, contourInterval: parseFloat(e.target.value) || 1 }))}
                      className="h-8 mt-1 text-xs bg-zinc-800 border-zinc-700 text-zinc-300"
                    />
                  </div>
                  <div>
                    <label htmlFor="tdc-grid-tick" className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Grid Tick (m)</label>
                    <Input
                      id="tdc-grid-tick"
                      type="number"
                      step="10"
                      min="10"
                      value={settings.gridTickInterval}
                      onChange={e => setSettings(prev => ({ ...prev, gridTickInterval: parseFloat(e.target.value) || 50 }))}
                      className="h-8 mt-1 text-xs bg-zinc-800 border-zinc-700 text-zinc-300"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="border border-zinc-700 rounded-lg bg-zinc-900 overflow-hidden">
            <button
              onClick={() => setShowStats(!showStats)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <BarChart3 size={14} className="text-zinc-400" />
                Statistics
              </span>
              {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showStats && (
              <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded bg-zinc-800/50">
                    <div className="text-lg font-bold text-blue-400">{stats.totalPoints}</div>
                    <div className="text-[10px] text-zinc-500">Points</div>
                  </div>
                  <div className="text-center p-2 rounded bg-zinc-800/50">
                    <div className="text-lg font-bold text-emerald-400">{stats.totalLayers}</div>
                    <div className="text-[10px] text-zinc-500">Layers</div>
                  </div>
                  <div className="text-center p-2 rounded bg-zinc-800/50">
                    <div className="text-lg font-bold text-amber-400">{stats.joinableLineCount}</div>
                    <div className="text-[10px] text-zinc-500">Lines</div>
                  </div>
                </div>

                {Object.keys(stats.pointsByCategory).length > 0 && (
                  <div className="space-y-1 mt-2">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Points by Category</div>
                    {Object.entries(stats.pointsByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, count]) => (
                        <div key={cat} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400 capitalize flex-1">{cat}</span>
                          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500/60 rounded-full"
                              style={{ width: `${Math.min(100, (count / stats.totalPoints) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 font-mono w-6 text-right">{count}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Layer Preview Summary */}
          {showLayerPreview && layerResults.length > 0 && (
            <div className="border border-zinc-700 rounded-lg bg-zinc-900 overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={14} className="text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-200">Layer Preview</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-zinc-800 text-zinc-400 ml-auto">
                    {layerResults.length} layers
                  </Badge>
                </div>
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-1 pr-2">
                    {layerResults.map(lr => (
                      <div key={lr.layer} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{
                            backgroundColor:
                              aciToHex(lr.color) === '#FFFFFF' ? '#52525b' : aciToHex(lr.color),
                          }}
                        />
                        <span className="font-mono text-zinc-400 flex-1 truncate">{lr.layer}</span>
                        <span className="text-zinc-600">{lr.points.length}</span>
                      </div>
                    ))}
                    
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Code picker dialog ──────────────────────────────────────── */}
      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="sm:max-w-[520px] bg-zinc-900 border-zinc-700 p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-zinc-100">Select Feature Code</DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Choose a feature code to assign to the selected point
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            <FeatureCodeBrowser
              onSelect={handleCodeSelect}
              selectedCode={editingPointId ? points.find(p => p.id === editingPointId)?.code : undefined}
              compact={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
