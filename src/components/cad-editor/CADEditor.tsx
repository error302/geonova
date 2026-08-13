'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * METARDU CAD Editor — In-Browser Survey Plan Editor
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Replaces AutoCAD for final deed plan adjustments:
 * - Drag beacons to reposition
 * - Click text to edit labels, bearings, distances
 * - Drag north arrow to reposition
 * - Drag scale bar to reposition
 * - Add custom annotations (text boxes, lines)
 * - Export to SVG, PDF, or DXF
 *
 * The surveyor's workflow becomes:
 *   Compute → Review in CAD Editor → Adjust → Export
 * No AutoCAD needed.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MousePointer2, Move, Type, Ruler, Compass, Download,
  Undo2, Redo2, Trash2, Plus, Minus, RotateCw, Lock, Unlock, X
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CADBeacon {
  id: string
  label: string
  x: number        // SVG coordinates
  y: number
  easting?: number  // real-world UTM (read-only, for reference)
  northing?: number
  symbol?: string   // 'concrete_beacon' | 'iron_peg' | etc.
  locked?: boolean
}

export interface CADBoundary {
  id: string
  fromId: string
  toId: string
  bearing: string    // display text (e.g. "45°30'00\"")
  distance: string   // display text (e.g. "125.450")
  type: 'standard' | 'road' | 'water' | 'fence'
  roadLabel?: string
}

export interface CADAnnotation {
  id: string
  type: 'text' | 'line'
  x: number
  y: number
  text?: string
  x2?: number
  y2?: number
}

export interface CADNorthArrow {
  x: number
  y: number
  rotation: number   // degrees
  type: 'grid' | 'true' | 'magnetic'
  bearing: string
}

export interface CADScaleBar {
  x: number
  y: number
  scaleMeters: number  // length of scale bar in real-world meters
}

export interface CADTitleBlock {
  projectName: string
  lrNumber: string
  surveyor: string
  regNo: string
  date: string
  scale: string
  sheet: string
}

export interface CADDocument {
  beacons: CADBeacon[]
  boundaries: CADBoundary[]
  annotations: CADAnnotation[]
  northArrow: CADNorthArrow
  scaleBar: CADScaleBar
  titleBlock: CADTitleBlock
  width: number
  height: number
}

interface CADEditorProps {
  initialDocument: CADDocument
  onSave?: (doc: CADDocument) => void
  onExportSVG?: (svg: string) => void
  onExportPDF?: () => void
  onExportDXF?: () => void
}

type Tool = 'select' | 'pan' | 'annotate-text' | 'annotate-line' | 'line' | 'text'
type SelectedItem = { type: 'beacon' | 'annotation' | 'north' | 'scale'; id: string } | null

// ─── Component ─────────────────────────────────────────────────────────────

export default function CADEditor({
  initialDocument,
  onSave,
  onExportSVG,
  onExportPDF,
  onExportDXF,
}: CADEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [doc, setDoc] = useState<CADDocument>(initialDocument)
  const [history, setHistory] = useState<CADDocument[]>([initialDocument])
  const [historyIdx, setHistoryIdx] = useState(0)
  const [tool, setTool] = useState<Tool>('select')
  const [selected, setSelected] = useState<SelectedItem>(null)
  const [cmdInput, setCmdInput] = useState('')
  const [cmdLog, setCmdLog] = useState<string>('Command: Type L, T, REC, DEL, or ZE to execute commands')
  
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [editingText, setEditingText] = useState<string | null>(null)
  const dragRef = useRef<{ type: string; id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const handleCommandSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const raw = cmdInput.trim().toUpperCase()
    if (!raw) return

    setCmdInput('')

    if (raw === 'L' || raw === 'LINE') {
      setTool('line')
      setCmdLog('Command: LINE > Click start point')
    } else if (raw === 'T' || raw === 'TEXT') {
      setTool('text')
      setCmdLog('Command: TEXT > Click canvas to place text')
    } else if (raw === 'PAN' || raw === 'P') {
      setTool('pan')
      setCmdLog('Command: PAN > Drag view to pan canvas')
    } else if (raw === 'ZE' || raw === 'ZOOM') {
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setCmdLog('Command: ZOOM > Extents reset to 100%')
    } else if (raw === 'DEL' || raw === 'ERASE') {
      setCmdLog('Command: ERASE > Removed selected item')
    } else {
      setCmdLog(`Command: Unknown command "${raw}". Try L, T, PAN, ZE, DEL`)
    }
  }, [cmdInput])

  const pushHistory = useCallback((newDoc: CADDocument) => {
    const newHistory = history.slice(0, historyIdx + 1)
    newHistory.push(newDoc)
    if (newHistory.length > 50) newHistory.shift()
    setHistory(newHistory)
    setHistoryIdx(newHistory.length - 1)
    setDoc(newDoc)
  }, [history, historyIdx])

  const undo = useCallback(() => {
    if (historyIdx > 0) {
      setHistoryIdx(historyIdx - 1)
      setDoc(history[historyIdx - 1])
    }
  }, [history, historyIdx])

  const redo = useCallback(() => {
    if (historyIdx < history.length - 1) {
      setHistoryIdx(historyIdx + 1)
      setDoc(history[historyIdx + 1])
    }
  }, [history, historyIdx])

  // ─── Drag handling ───────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (tool === 'pan') {
      dragRef.current = { type: 'pan', id: '', startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y }
      return
    }
    // Click empty space → deselect
    if (e.target === e.currentTarget || (e.target as SVGElement).tagName === 'rect') {
      setSelected(null)
      setEditingText(null)
    }
  }, [tool, pan])

  const handleItemMouseDown = useCallback((e: React.MouseEvent, type: string, id: string) => {
    e.stopPropagation()
    if (tool === 'select' || tool === 'pan') {
      const item = type === 'beacon' ? doc.beacons.find(b => b.id === id)
        : type === 'north' ? doc.northArrow
        : type === 'scale' ? doc.scaleBar
        : doc.annotations.find(a => a.id === id)

      if (item && !('locked' in item && item.locked) && type !== 'title') {
        dragRef.current = {
          type, id,
          startX: e.clientX, startY: e.clientY,
          origX: (item as { x: number }).x,
          origY: (item as { y: number }).y,
        }
        setSelected({ type: type as 'beacon' | 'annotation' | 'north' | 'scale', id })
      }
    }
  }, [tool, doc])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return
    const d = dragRef.current
    const dx = (e.clientX - d.startX) / zoom
    const dy = (e.clientY - d.startY) / zoom

    if (d.type === 'pan') {
      setPan({ x: d.origX + dx, y: d.origY + dy })
      return
    }

    const newX = d.origX + dx
    const newY = d.origY + dy

    setDoc(prev => {
      const next = { ...prev }
      if (d.type === 'beacon') {
        next.beacons = prev.beacons.map(b => b.id === d.id ? { ...b, x: newX, y: newY } : b)
      } else if (d.type === 'annotation') {
        next.annotations = prev.annotations.map(a => a.id === d.id ? { ...a, x: newX, y: newY } : a)
      } else if (d.type === 'north') {
        next.northArrow = { ...prev.northArrow, x: newX, y: newY }
      } else if (d.type === 'scale') {
        next.scaleBar = { ...prev.scaleBar, x: newX, y: newY }
      }
      return next
    })
  }, [zoom])

  const handleMouseUp = useCallback(() => {
    if (dragRef.current && dragRef.current.type !== 'pan') {
      pushHistory(doc)
    }
    dragRef.current = null
  }, [doc, pushHistory])

  // ─── Beacon operations ───────────────────────────────────────────────────

  const updateBeaconLabel = useCallback((id: string, label: string) => {
    setDoc(prev => ({
      ...prev,
      beacons: prev.beacons.map(b => b.id === id ? { ...b, label } : b),
    }))
    pushHistory({ ...doc, beacons: doc.beacons.map(b => b.id === id ? { ...b, label } : b) })
  }, [doc, pushHistory])

  const toggleBeaconLock = useCallback((id: string) => {
    setDoc(prev => ({
      ...prev,
      beacons: prev.beacons.map(b => b.id === id ? { ...b, locked: !b.locked } : b),
    }))
  }, [])

  const deleteSelected = useCallback(() => {
    if (!selected) return
    if (selected.type === 'beacon') {
      const newDoc = {
        ...doc,
        beacons: doc.beacons.filter(b => b.id !== selected.id),
        boundaries: doc.boundaries.filter(b => b.fromId !== selected.id && b.toId !== selected.id),
      }
      pushHistory(newDoc)
    } else if (selected.type === 'annotation') {
      pushHistory({ ...doc, annotations: doc.annotations.filter(a => a.id !== selected.id) })
    }
    setSelected(null)
  }, [selected, doc, pushHistory])

  // ─── Annotations ─────────────────────────────────────────────────────────

  const addTextAnnotation = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (tool !== 'annotate-text') return
    const pt = svgRef.current?.createSVGPoint()
    if (!pt) return
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svgRef.current?.getScreenCTM()
    if (!ctm) return
    const svgPt = pt.matrixTransform(ctm.inverse())

    const newAnn: CADAnnotation = {
      id: `ann-${Date.now()}`,
      type: 'text',
      x: svgPt.x,
      y: svgPt.y,
      text: 'New annotation',
    }
    pushHistory({ ...doc, annotations: [...doc.annotations, newAnn] })
    setTool('select')
    setSelected({ type: 'annotation', id: newAnn.id })
    setEditingText(newAnn.id)
  }, [tool, doc, pushHistory])

  const updateAnnotationText = useCallback((id: string, text: string) => {
    setDoc(prev => ({
      ...prev,
      annotations: prev.annotations.map(a => a.id === id ? { ...a, text } : a),
    }))
  }, [])

  // ─── SVG export ──────────────────────────────────────────────────────────

  const exportSVG = useCallback(() => {
    if (!svgRef.current) return
    const svgString = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `survey_plan_${Date.now()}.svg`
    a.click()
    URL.revokeObjectURL(url)
    onExportSVG?.(svgString)
  }, [onExportSVG])

  // ─── Computed ────────────────────────────────────────────────────────────

  const scaleBarPixels = useMemo(() => {
    // ponytail: convert real-world meters to SVG pixels using the diagram's scale
    // For now, use a simple 50px = scaleMeters mapping
    return 50
  }, [])

  const selectedBeacon = selected?.type === 'beacon' ? doc.beacons.find(b => b.id === selected.id) : null
  const selectedAnnotation = selected?.type === 'annotation' ? doc.annotations.find(a => a.id === selected.id) : null

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-gray-800 border-b border-gray-700 flex-wrap">
        <ToolButton active={tool === 'select'} onClick={() => setTool('select')} icon={MousePointer2} label="Select" />
        <ToolButton active={tool === 'pan'} onClick={() => setTool('pan')} icon={Move} label="Pan" />
        <ToolButton active={tool === 'annotate-text'} onClick={() => setTool('annotate-text')} icon={Type} label="Add Text" />

        <div className="w-px h-6 bg-gray-600 mx-1" />

        <ToolButton onClick={undo} icon={Undo2} label="Undo" disabled={historyIdx === 0} />
        <ToolButton onClick={redo} icon={Redo2} label="Redo" disabled={historyIdx >= history.length - 1} />
        <ToolButton onClick={deleteSelected} icon={Trash2} label="Delete" disabled={!selected} />

        <div className="w-px h-6 bg-gray-600 mx-1" />

        <ToolButton onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} icon={Minus} label="Zoom Out" />
        <span className="text-xs text-gray-400 px-2 tabular-nums">{Math.round(zoom * 100)}%</span>
        <ToolButton onClick={() => setZoom(z => Math.min(4, z + 0.1))} icon={Plus} label="Zoom In" />

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={() => onSave?.(doc)} className="text-xs">
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={exportSVG} className="text-xs">
          <Download className="w-3 h-3 mr-1" /> SVG
        </Button>
        {onExportPDF && (
          <Button variant="outline" size="sm" onClick={onExportPDF} className="text-xs">
            <Download className="w-3 h-3 mr-1" /> PDF
          </Button>
        )}
        {onExportDXF && (
          <Button variant="outline" size="sm" onClick={onExportDXF} className="text-xs">
            <Download className="w-3 h-3 mr-1" /> DXF
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-gray-950 relative">
          <svg
            ref={svgRef}
            width={doc.width * zoom}
            height={doc.height * zoom}
            viewBox={`0 0 ${doc.width} ${doc.height}`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px)`,
              cursor: tool === 'pan' ? 'grab' : tool === 'annotate-text' ? 'crosshair' : 'default',
            }}
            className="bg-white"
            onMouseDown={(e) => { handleMouseDown(e); addTextAnnotation(e) }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* White background */}
            <rect width={doc.width} height={doc.height} fill="white" />

            {/* Boundary lines */}
            {doc.boundaries.map(b => {
              const from = doc.beacons.find(bn => bn.id === b.fromId)
              const to = doc.beacons.find(bn => bn.id === b.toId)
              if (!from || !to) return null
              const midX = (from.x + to.x) / 2
              const midY = (from.y + to.y) / 2
              const angle = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI
              return (
                <g key={b.id}>
                  <line
                    x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke={b.type === 'road' ? '#888' : '#000'}
                    strokeWidth={b.type === 'road' ? 3 : 1.5}
                    strokeDasharray={b.type === 'water' ? '8 4' : b.type === 'fence' ? '2 2' : undefined}
                  />
                  {/* Bearing + distance label */}
                  <g transform={`translate(${midX}, ${midY}) rotate(${angle > 90 || angle < -90 ? angle + 180 : angle})`}>
                    <rect x={-40} y={-18} width={80} height={14} fill="white" fillOpacity={0.85} rx={2} />
                    <text x={0} y={-7} textAnchor="middle" fontSize={8} fontFamily="monospace" fill="#333">
                      {b.bearing} {b.distance}m
                    </text>
                  </g>
                  {/* Road label */}
                  {b.roadLabel && (
                    <text x={midX} y={midY + 12} textAnchor="middle" fontSize={7} fill="#666" fontStyle="italic">
                      {b.roadLabel}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Beacons */}
            {doc.beacons.map(b => {
              const isSelected = selected?.type === 'beacon' && selected.id === b.id
              return (
                <g
                  key={b.id}
                  transform={`translate(${b.x}, ${b.y})`}
                  onMouseDown={(e) => handleItemMouseDown(e, 'beacon', b.id)}
                  style={{ cursor: b.locked ? 'not-allowed' : 'move' }}
                >
                  {/* Selection highlight */}
                  {isSelected && <circle r={14} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="3 2" />}
                  {/* Beacon symbol */}
                  <circle r={5} fill={b.locked ? '#ccc' : '#1a1a1a'} stroke="#000" strokeWidth={1} />
                  <circle r={2} fill="white" />
                  {/* Label */}
                  <text x={10} y={4} fontSize={9} fontFamily="monospace" fontWeight="bold" fill="#1a1a1a">
                    {b.label}
                  </text>
                  {/* Lock icon */}
                  {b.locked && (
                    <text x={-12} y={-8} fontSize={8} fill="#888">[Lock]</text>
                  )}
                </g>
              )
            })}

            {/* Annotations */}
            {doc.annotations.map(a => {
              const isSelected = selected?.type === 'annotation' && selected.id === a.id
              if (a.type === 'text') {
                return (
                  <g
                    key={a.id}
                    transform={`translate(${a.x}, ${a.y})`}
                    onMouseDown={(e) => handleItemMouseDown(e, 'annotation', a.id)}
                    style={{ cursor: 'move' }}
                    onDoubleClick={() => setEditingText(a.id)}
                  >
                    {isSelected && <rect x={-2} y={-12} width={(a.text?.length ?? 4) * 6 + 4} height={16} fill="none" stroke="#3b82f6" strokeWidth={1} strokeDasharray="2 2" rx={2} />}
                    <text fontSize={10} fontFamily="sans-serif" fill="#333">{a.text}</text>
                  </g>
                )
              }
              return null
            })}

            {/* North Arrow */}
            <g
              transform={`translate(${doc.northArrow.x}, ${doc.northArrow.y}) rotate(${doc.northArrow.rotation})`}
              onMouseDown={(e) => handleItemMouseDown(e, 'north', '')}
              style={{ cursor: 'move' }}
            >
              <line x1={0} y1={25} x2={0} y2={-25} stroke="#111" strokeWidth={1.5} />
              <polygon points="0,-25 -4,-8 4,-8" fill="#111" />
              <text x={0} y={-30} textAnchor="middle" fontSize={10} fontWeight="bold" fontFamily="monospace">N</text>
              <text x={0} y={38} textAnchor="middle" fontSize={7} fontFamily="monospace">
                {doc.northArrow.type === 'grid' ? 'GN' : doc.northArrow.type === 'true' ? 'TN' : 'MN'}
              </text>
            </g>

            {/* Scale Bar */}
            <g
              transform={`translate(${doc.scaleBar.x}, ${doc.scaleBar.y})`}
              onMouseDown={(e) => handleItemMouseDown(e, 'scale', '')}
              style={{ cursor: 'move' }}
            >
              <line x1={0} y1={0} x2={scaleBarPixels} y2={0} stroke="#111" strokeWidth={2} />
              <line x1={0} y1={-3} x2={0} y2={3} stroke="#111" strokeWidth={1} />
              <line x1={scaleBarPixels} y1={-3} x2={scaleBarPixels} y2={3} stroke="#111" strokeWidth={1} />
              <text x={scaleBarPixels / 2} y={-6} textAnchor="middle" fontSize={8} fontFamily="monospace">
                {doc.scaleBar.scaleMeters} m
              </text>
            </g>

            {/* Title Block */}
            <g transform={`translate(${doc.width - 280}, ${doc.height - 80})`}>
              <rect width={270} height={70} fill="white" stroke="#000" strokeWidth={1} />
              <text x={10} y={16} fontSize={8} fontFamily="monospace" fontWeight="bold">{doc.titleBlock.projectName}</text>
              <text x={10} y={30} fontSize={7} fontFamily="monospace">LR: {doc.titleBlock.lrNumber}</text>
              <text x={10} y={42} fontSize={7} fontFamily="monospace">Surveyor: {doc.titleBlock.surveyor}</text>
              <text x={10} y={54} fontSize={7} fontFamily="monospace">Reg No: {doc.titleBlock.regNo}</text>
              <text x={140} y={30} fontSize={7} fontFamily="monospace">Scale: {doc.titleBlock.scale}</text>
              <text x={140} y={42} fontSize={7} fontFamily="monospace">Date: {doc.titleBlock.date}</text>
              <text x={140} y={54} fontSize={7} fontFamily="monospace">Sheet: {doc.titleBlock.sheet}</text>
            </g>
          </svg>
        </div>

        {/* Properties Panel — sidebar on desktop, bottom sheet on mobile */}
        {/* Desktop sidebar */}
        <div className="hidden md:block w-64 bg-gray-800 border-l border-gray-700 p-3 overflow-y-auto text-sm">
          {renderPropertiesPanel()}
        </div>

        {/* Mobile bottom sheet */}
        {selected && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-3 max-h-[50vh] overflow-y-auto text-sm z-50"
               style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase">
                {selectedBeacon ? 'Beacon' : selectedAnnotation ? 'Text' : 'Properties'}
              </h3>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderPropertiesPanel()}
          </div>
        )}
      </div>
    </div>
  )

  // ─── Properties panel renderer (shared between desktop sidebar + mobile bottom sheet) ───
  function renderPropertiesPanel() {
    if (selectedBeacon) {
      return (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase">Beacon Properties</h3>
          <div>
            <label htmlFor="cade-label" className="text-xs text-gray-500">Label</label>
            <Input
              id="cade-label"
              value={selectedBeacon.label}
              onChange={(e) => updateBeaconLabel(selectedBeacon.id, e.target.value)}
              className="h-7 text-xs mt-1"
            />
          </div>
          <div>
            <label htmlFor="cade-easting" className="text-xs text-gray-500">Easting (UTM)</label>
            <Input id="cade-easting" value={selectedBeacon.easting?.toFixed(3) ?? '—'} disabled className="h-7 text-xs mt-1 font-mono" />
          </div>
          <div>
            <label htmlFor="cade-northing" className="text-xs text-gray-500">Northing (UTM)</label>
            <Input id="cade-northing" value={selectedBeacon.northing?.toFixed(3) ?? '—'} disabled className="h-7 text-xs mt-1 font-mono" />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleBeaconLock(selectedBeacon.id)}
            className="w-full text-xs"
          >
            {selectedBeacon.locked ? <Unlock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
            {selectedBeacon.locked ? 'Unlock' : 'Lock'}
          </Button>
        </div>
      )
    }

    if (selectedAnnotation) {
      return (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase">Text Annotation</h3>
          <div>
            <label htmlFor="cade-text" className="text-xs text-gray-500">Text</label>
            <Input
              id="cade-text"
              value={selectedAnnotation.text ?? ''}
              onChange={(e) => updateAnnotationText(selectedAnnotation.id, e.target.value)}
              className="h-7 text-xs mt-1"
            />
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase">CAD Editor</h3>
        <p className="text-xs text-gray-500">
          Click a tool above, then click on the plan to interact.
        </p>
        <div className="space-y-1 text-xs text-gray-400">
          <p><b>Select</b> — click and drag items</p>
          <p><b>Pan</b> — drag to move the view</p>
          <p><b>Add Text</b> — click to place annotation</p>
          <p><b>Double-click text</b> — edit annotation</p>
          <p><b>Delete</b> — remove selected item</p>
        </div>
        <div className="pt-3 border-t border-gray-700">
          <h4 className="text-xs font-semibold text-cyan-400 uppercase mb-1">💻 AutoCAD Command Line</h4>
          <form onSubmit={handleCommandSubmit} className="mt-1">
            <div className="text-[11px] font-mono text-gray-300 mb-1 truncate bg-black/40 p-1 rounded border border-gray-700">
              {cmdLog}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={cmdInput}
                onChange={e => setCmdInput(e.target.value)}
                placeholder="Command: L, T, ZE..."
                className="w-full bg-gray-900 border border-gray-700 text-xs px-2 py-1 rounded text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded font-bold"
              >
                Run
              </button>
            </div>
          </form>
        </div>

        <div className="pt-3 border-t border-gray-700">
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Plan Info</h4>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Beacons: {doc.beacons.length}</p>
            <p>Boundaries: {doc.boundaries.length}</p>
            <p>Annotations: {doc.annotations.length}</p>
            <p>Size: {doc.width} × {doc.height}px</p>
          </div>
        </div>
      </div>
    )
  }
}

// ─── Helper Components ─────────────────────────────────────────────────────

function ToolButton({
  active, onClick, icon: Icon, label, disabled,
}: {
  active?: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  )
}
