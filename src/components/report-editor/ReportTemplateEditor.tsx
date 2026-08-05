'use client'

/**
 * ReportTemplateEditor — Drag-and-drop document layout designer
 *
 * Inspired by QGIS Print Composer. Lets surveyors design custom document
 * templates by placing elements on a canvas:
 * - Map view (auto-scaled to fit)
 * - Text blocks (titles, labels, surveyor info)
 * - Tables (beacon schedule, area schedule)
 * - North arrow
 * - Scale bar
 * - Company logo
 * - Grid overlay
 *
 * Features:
 * - Drag elements from palette to canvas
 * - Resize/move elements with mouse
 * - Per-element styling (font, color, position, size)
 * - Template presets (deed plan, mutation, traverse sheet)
 * - Save/load templates to localStorage
 * - Preview before generating PDF
 * - Lock elements to prevent accidental moves
 *
 * This gives surveyors full control over document layout without
 * needing a developer to modify templates.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Type, Map as MapIcon, Table, Navigation, Ruler,
  Image, Grid3x3, Save, FolderOpen, Eye, Trash2,
  Lock, Unlock, Copy, Download, Plus, Settings2,
  Move, Maximize2,
} from 'lucide-react'

type ElementType = 'text' | 'map' | 'table' | 'north_arrow' | 'scale_bar' | 'logo' | 'grid'

interface TemplateElement {
  id: string
  type: ElementType
  x: number      // mm from left
  y: number      // mm from top
  width: number  // mm
  height: number // mm
  locked: boolean
  // Type-specific properties
  text?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  align?: 'left' | 'center' | 'right'
  color?: string
  // Table
  tableData?: Array<Array<string>>
  // Map
  scale?: number
  // Logo
  logoUrl?: string
}

interface ReportTemplate {
  id: string
  name: string
  paperSize: 'A4' | 'A3' | 'A2' | 'A1'
  orientation: 'portrait' | 'landscape'
  elements: TemplateElement[]
}

// ---------------------------------------------------------------------------
// Paper sizes (mm)
// ---------------------------------------------------------------------------

const PAPER_DIMENSIONS = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
}

// ---------------------------------------------------------------------------
// Element palette
// ---------------------------------------------------------------------------

const ELEMENT_PALETTE: Array<{
  type: ElementType
  label: string
  icon: typeof Type
  defaultSize: { width: number; height: number }
}> = [
  { type: 'text', label: 'Text', icon: Type, defaultSize: { width: 80, height: 10 } },
  { type: 'map', label: 'Map', icon: MapIcon, defaultSize: { width: 150, height: 100 } },
  { type: 'table', label: 'Table', icon: Table, defaultSize: { width: 120, height: 60 } },
  { type: 'north_arrow', label: 'North Arrow', icon: Navigation, defaultSize: { width: 15, height: 20 } },
  { type: 'scale_bar', label: 'Scale Bar', icon: Ruler, defaultSize: { width: 50, height: 8 } },
  { type: 'logo', label: 'Logo', icon: Image, defaultSize: { width: 30, height: 15 } },
  { type: 'grid', label: 'Grid', icon: Grid3x3, defaultSize: { width: 150, height: 100 } },
]

// ---------------------------------------------------------------------------
// Template presets
// ---------------------------------------------------------------------------

const TEMPLATE_PRESETS: Array<{
  name: string
  description: string
  paperSize: 'A4' | 'A3' | 'A2' | 'A1'
  orientation: 'portrait' | 'landscape'
  elements: Omit<TemplateElement, 'id'>[]
}> = [
  {
    name: 'Deed Plan (A1 Landscape)',
    description: 'Standard SoK deed plan layout',
    paperSize: 'A1',
    orientation: 'landscape',
    elements: [
      { type: 'text', x: 297, y: 10, width: 297, height: 15, locked: false, text: 'REPUBLIC OF KENYA — DEED PLAN', fontSize: 8, fontWeight: 'bold', align: 'center' },
      { type: 'map', x: 20, y: 40, width: 400, height: 300, locked: false, scale: 2500 },
      { type: 'north_arrow', x: 410, y: 50, width: 15, height: 20, locked: false },
      { type: 'scale_bar', x: 30, y: 340, width: 50, height: 8, locked: false },
      { type: 'table', x: 440, y: 100, width: 130, height: 200, locked: false, tableData: [['BEACON', 'E', 'N'], ['MB/001', '534850.123', '9574220.456']] },
      { type: 'text', x: 440, y: 40, width: 130, height: 8, locked: false, text: 'LR No: ___________', fontSize: 4 },
      { type: 'text', x: 440, y: 320, width: 130, height: 20, locked: false, text: 'Surveyor: ___________\nLicense: ___________', fontSize: 3 },
    ],
  },
  {
    name: 'Mutation Form (A3 Landscape)',
    description: 'Subdivision mutation layout',
    paperSize: 'A3',
    orientation: 'landscape',
    elements: [
      { type: 'text', x: 148.5, y: 10, width: 297, height: 12, locked: false, text: 'MUTATION FORM', fontSize: 7, fontWeight: 'bold', align: 'center' },
      { type: 'map', x: 20, y: 40, width: 200, height: 150, locked: false, scale: 2500 },
      { type: 'north_arrow', x: 220, y: 50, width: 12, height: 16, locked: false },
      { type: 'scale_bar', x: 25, y: 195, width: 40, height: 6, locked: false },
      { type: 'table', x: 240, y: 60, width: 100, height: 120, locked: false, tableData: [['PARCEL', 'AREA (ha)'], ['001', '0.5000'], ['002', '0.7500']] },
      { type: 'text', x: 20, y: 260, width: 200, height: 15, locked: false, text: 'Surveyor: ___________  License: ___________', fontSize: 3 },
    ],
  },
  {
    name: 'Traverse Sheet (A4 Portrait)',
    description: 'Traverse computation sheet',
    paperSize: 'A4',
    orientation: 'portrait',
    elements: [
      { type: 'text', x: 105, y: 10, width: 210, height: 10, locked: false, text: 'TRAVERSE COMPUTATION SHEET', fontSize: 5, fontWeight: 'bold', align: 'center' },
      { type: 'table', x: 20, y: 40, width: 170, height: 200, locked: false, tableData: [['STATION', 'BEARING', 'DISTANCE', 'dE', 'dN']] },
      { type: 'text', x: 20, y: 260, width: 170, height: 15, locked: false, text: 'Linear Error: _______  Precision: 1:_______', fontSize: 3 },
    ],
  },
]

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ReportTemplateEditor() {
  const [template, setTemplate] = useState<ReportTemplate>({
    id: crypto.randomUUID(),
    name: 'Untitled Template',
    paperSize: 'A4',
    orientation: 'portrait',
    elements: [],
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingFrom, setDraggingFrom] = useState<ElementType | null>(null)
  const [draggingElement, setDraggingElement] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [resizing, setResizing] = useState<{ id: string; handle: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const paper = PAPER_DIMENSIONS[template.paperSize]
  const canvasWidth = template.orientation === 'landscape' ? paper.height : paper.width
  const canvasHeight = template.orientation === 'landscape' ? paper.width : paper.height

  // Scale canvas to fit viewport (1mm = 2px for display)
  const displayScale = 2
  const displayWidth = canvasWidth * displayScale
  const displayHeight = canvasHeight * displayScale

  // ─── Add element from palette ─────────────────────────────────
  const addElement = useCallback((type: ElementType) => {
    const paletteItem = ELEMENT_PALETTE.find(p => p.type === type)
    if (!paletteItem) return

    const newElement: TemplateElement = {
      id: crypto.randomUUID(),
      type,
      x: 20,
      y: 20,
      width: paletteItem.defaultSize.width,
      height: paletteItem.defaultSize.height,
      locked: false,
    }

    // Default text for text elements
    if (type === 'text') {
      newElement.text = 'Double-click to edit text'
      newElement.fontSize = 4
      newElement.fontWeight = 'normal'
      newElement.align = 'left'
    }
    if (type === 'table') {
      newElement.tableData = [['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']]
    }

    setTemplate(prev => ({
      ...prev,
      elements: [...prev.elements, newElement],
    }))
    setSelectedId(newElement.id)
  }, [])

  // ─── Move element ──────────────────────────────────────────────
  const handleElementMouseDown = useCallback((e: React.MouseEvent, element: TemplateElement) => {
    if (element.locked) return
    e.stopPropagation()
    setSelectedId(element.id)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const scale = rect.width / canvasWidth
    const mouseX = (e.clientX - rect.left) / scale
    const mouseY = (e.clientY - rect.top) / scale

    setDraggingElement({
      id: element.id,
      offsetX: mouseX - element.x,
      offsetY: mouseY - element.y,
    })
  }, [canvasWidth, canvasHeight])

  // ─── Resize element ────────────────────────────────────────────
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, elementId: string, handle: string) => {
    e.stopPropagation()
    e.preventDefault()
    setResizing({ id: elementId, handle })
  }, [])

  // ─── Mouse move (drag/resize) ──────────────────────────────────
  useEffect(() => {
    if (!draggingElement && !resizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const scale = rect.width / canvasWidth
      const mouseX = (e.clientX - rect.left) / scale
      const mouseY = (e.clientY - rect.top) / scale

      if (draggingElement) {
        setTemplate(prev => ({
          ...prev,
          elements: prev.elements.map(el =>
            el.id === draggingElement.id
              ? {
                  ...el,
                  x: Math.max(0, Math.min(canvasWidth - el.width, mouseX - draggingElement.offsetX)),
                  y: Math.max(0, Math.min(canvasHeight - el.height, mouseY - draggingElement.offsetY)),
                }
              : el
          ),
        }))
      }

      if (resizing) {
        setTemplate(prev => ({
          ...prev,
          elements: prev.elements.map(el => {
            if (el.id !== resizing.id) return el
            let { x, y, width, height } = el

            if (resizing.handle.includes('e')) width = Math.max(10, mouseX - x)
            if (resizing.handle.includes('s')) height = Math.max(10, mouseY - y)
            if (resizing.handle.includes('w')) {
              const newX = Math.min(x + width - 10, mouseX)
              width = width + (x - newX)
              x = newX
            }
            if (resizing.handle.includes('n')) {
              const newY = Math.min(y + height - 10, mouseY)
              height = height + (y - newY)
              y = newY
            }

            return { ...el, x, y, width, height }
          }),
        }))
      }
    }

    const handleMouseUp = () => {
      setDraggingElement(null)
      setResizing(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingElement, resizing, canvasWidth, canvasHeight])

  // ─── Delete element ────────────────────────────────────────────
  const deleteElement = useCallback((id: string) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.filter(e => e.id !== id),
    }))
    setSelectedId(null)
  }, [])

  // ─── Duplicate element ─────────────────────────────────────────
  const duplicateElement = useCallback((id: string) => {
    const element = template.elements.find(e => e.id === id)
    if (!element) return

    const newElement: TemplateElement = {
      ...element,
      id: crypto.randomUUID(),
      x: element.x + 10,
      y: element.y + 10,
    }

    setTemplate(prev => ({
      ...prev,
      elements: [...prev.elements, newElement],
    }))
    setSelectedId(newElement.id)
  }, [template.elements])

  // ─── Toggle lock ───────────────────────────────────────────────
  const toggleLock = useCallback((id: string) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.map(e =>
        e.id === id ? { ...e, locked: !e.locked } : e
      ),
    }))
  }, [])

  // ─── Update element property ───────────────────────────────────
  const updateElement = useCallback((id: string, updates: Partial<TemplateElement>) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.map(e =>
        e.id === id ? { ...e, ...updates } : e
      ),
    }))
  }, [])

  // ─── Load preset ───────────────────────────────────────────────
  const loadPreset = useCallback((preset: typeof TEMPLATE_PRESETS[0]) => {
    setTemplate({
      id: crypto.randomUUID(),
      name: preset.name,
      paperSize: preset.paperSize,
      orientation: preset.orientation,
      elements: preset.elements.map(e => ({ ...e, id: crypto.randomUUID() })),
    })
    setSelectedId(null)
  }, [])

  // ─── Save template ─────────────────────────────────────────────
  const saveTemplate = useCallback(() => {
    const templates = JSON.parse(localStorage.getItem('metardu-report-templates') || '[]')
    const existing = templates.findIndex((t: ReportTemplate) => t.id === template.id)
    if (existing >= 0) {
      templates[existing] = template
    } else {
      templates.push(template)
    }
    localStorage.setItem('metardu-report-templates', JSON.stringify(templates))
    alert(`Template "${template.name}" saved`)
  }, [template])

  // ─── Load saved templates ──────────────────────────────────────
  const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>([])
  const refreshSavedTemplates = useCallback(() => {
    const templates = JSON.parse(localStorage.getItem('metardu-report-templates') || '[]')
    setSavedTemplates(templates)
  }, [])

  useEffect(() => {
    refreshSavedTemplates()
  }, [refreshSavedTemplates])

  const loadTemplate = useCallback((t: ReportTemplate) => {
    setTemplate(t)
    setSelectedId(null)
  }, [])

  const selectedElement = template.elements.find(e => e.id === selectedId)

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Left sidebar — element palette + presets */}
      <div className="w-full lg:w-64 space-y-4">
        {/* Element palette */}
        <div className="card p-3">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Elements</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ELEMENT_PALETTE.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.type}
                  onClick={() => addElement(item.type)}
                  className="flex flex-col items-center gap-1 py-2 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5 transition-colors"
                >
                  <Icon className="w-4 h-4 text-gray-400" />
                  <span className="text-[9px] text-gray-400">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Template presets */}
        <div className="card p-3">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Presets</div>
          <div className="space-y-1.5">
            {TEMPLATE_PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => loadPreset(preset)}
                className="w-full text-left p-2 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5 transition-colors"
              >
                <div className="text-xs font-medium text-[var(--text-primary)]">{preset.name}</div>
                <div className="text-[9px] text-gray-500">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Saved templates */}
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Saved</div>
            <button onClick={refreshSavedTemplates} className="text-[9px] text-gray-500 hover:text-gray-300">
              Refresh
            </button>
          </div>
          {savedTemplates.length === 0 ? (
            <p className="text-[10px] text-gray-600 text-center py-2">No saved templates</p>
          ) : (
            <div className="space-y-1.5">
              {savedTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => loadTemplate(t)}
                  className="w-full text-left p-2 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/5 transition-colors"
                >
                  <div className="text-xs text-[var(--text-primary)] truncate">{t.name}</div>
                  <div className="text-[9px] text-gray-500">{t.paperSize} {t.orientation}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center — canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center gap-2">
            <input aria-label="Name"
              type="text"
              value={template.name}
              onChange={e => setTemplate(prev => ({ ...prev, name: e.target.value }))}
              className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[var(--accent)]/30 focus:outline-none"
            />
            <select
              value={template.paperSize}
              onChange={e => setTemplate(prev => ({ ...prev, paperSize: e.target.value as 'A4' | 'A3' | 'A2' | 'A1' }))}
              className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)]"
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="A2">A2</option>
              <option value="A1">A1</option>
            </select>
            <select
              value={template.orientation}
              onChange={e => setTemplate(prev => ({ ...prev, orientation: e.target.value as 'portrait' | 'landscape' }))}
              className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)]"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-1 px-2.5 h-8 rounded-lg text-xs font-medium ${
                showPreview ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)]' : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-gray-400'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
            <button
              onClick={saveTemplate}
              className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-[var(--accent)] text-black text-xs font-semibold hover:bg-[var(--accent-dim)]"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] p-8 flex items-start justify-center">
          <div
            ref={canvasRef}
            onClick={() => setSelectedId(null)}
            className="relative bg-white shadow-2xl"
            style={{
              width: displayWidth,
              height: displayHeight,
              backgroundImage: showPreview
                ? 'none'
                : `linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
                   linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)`,
              backgroundSize: `${displayScale * 10}px ${displayScale * 10}px`,
            }}
          >
            {/* Render elements */}
            {template.elements.map(element => (
              <ElementRenderer
                key={element.id}
                element={element}
                scale={displayScale}
                isSelected={element.id === selectedId}
                isPreview={showPreview}
                onMouseDown={(e) => handleElementMouseDown(e, element)}
                onResizeMouseDown={handleResizeMouseDown}
                onDelete={() => deleteElement(element.id)}
                onDuplicate={() => duplicateElement(element.id)}
                onToggleLock={() => toggleLock(element.id)}
                onEditText={(text) => updateElement(element.id, { text })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right sidebar — properties */}
      {selectedElement && (
        <div className="w-full lg:w-64">
          <PropertiesPanel
            element={selectedElement}
            onUpdate={(updates) => updateElement(selectedElement.id, updates)}
            onDelete={() => deleteElement(selectedElement.id)}
            onDuplicate={() => duplicateElement(selectedElement.id)}
            onToggleLock={() => toggleLock(selectedElement.id)}
          />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Element Renderer
// ---------------------------------------------------------------------------

function ElementRenderer({
  element,
  scale,
  isSelected,
  isPreview,
  onMouseDown,
  onResizeMouseDown,
  onDelete,
  onDuplicate,
  onToggleLock,
  onEditText,
}: {
  element: TemplateElement
  scale: number
  isSelected: boolean
  isPreview: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onResizeMouseDown: (e: React.MouseEvent, id: string, handle: string) => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleLock: () => void
  onEditText: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)

  const style: React.CSSProperties = {
    position: 'absolute',
    left: element.x * scale,
    top: element.y * scale,
    width: element.width * scale,
    height: element.height * scale,
    cursor: element.locked ? 'default' : 'move',
  }

  const content = () => {
    switch (element.type) {
      case 'text':
        return editing ? (
          <textarea
            autoFocus
            defaultValue={element.text}
            onBlur={(e) => { onEditText(e.target.value); setEditing(false) }}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}
            className="w-full h-full p-1 text-black bg-white border-2 border-blue-400 outline-none resize-none"
            style={{ fontSize: (element.fontSize || 4) * scale, fontWeight: element.fontWeight, textAlign: element.align }}
          />
        ) : (
          <div
            onDoubleClick={() => !element.locked && setEditing(true)}
            className="w-full h-full flex items-center"
            style={{
              fontSize: (element.fontSize || 4) * scale,
              fontWeight: element.fontWeight,
              textAlign: element.align,
              color: element.color || '#000',
              padding: '2px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {element.text || 'Double-click to edit'}
          </div>
        )

      case 'map':
        return (
          <div className="w-full h-full border-2 border-gray-400 bg-gray-100 flex items-center justify-center relative overflow-hidden">
            <MapIcon className="w-8 h-8 text-gray-300" />
            {element.scale && (
              <span className="absolute bottom-1 right-1 text-[8px] text-gray-500 font-mono">
                1:{element.scale}
              </span>
            )}
          </div>
        )

      case 'table':
        return (
          <div className="w-full h-full overflow-hidden border border-gray-400">
            <table className="w-full h-full">
              <tbody>
                {(element.tableData || []).map((row, i) => (
                  <tr key={`${row}-${i}`} className={i === 0 ? 'bg-gray-200 font-bold' : ''}>
                    {row.map((cell, j) => (
                      <td key={j} className="border border-gray-300 px-1 text-[8px] text-black">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )

      case 'north_arrow':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Navigation className="w-full h-3/4 text-black" />
            <span className="text-[8px] font-bold text-black">N</span>
          </div>
        )

      case 'scale_bar':
        return (
          <div className="w-full h-full flex flex-col items-center justify-center border border-gray-400 bg-white">
            <div className="flex w-full h-1/2">
              <div className="flex-1 bg-black"></div>
              <div className="flex-1 bg-white border-l border-black"></div>
              <div className="flex-1 bg-black"></div>
              <div className="flex-1 bg-white border-l border-black"></div>
            </div>
            <span className="text-[6px] text-black">0 25 50m</span>
          </div>
        )

      case 'logo':
        return (
          <div className="w-full h-full border-2 border-dashed border-gray-400 flex items-center justify-center bg-gray-50">
            {/* lucide-react icon (decorative) — hidden from AT; rule targets next/image components */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image aria-hidden="true" className="w-4 h-4 text-gray-400" />
          </div>
        )

      case 'grid':
        return (
          <div
            className="w-full h-full border border-gray-300"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                                 linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
              backgroundSize: `${scale * 10}px ${scale * 10}px`,
            }}
          />
        )
    }
  }

  return (
    <div
      style={style}
      onMouseDown={onMouseDown}
      className={isSelected && !isPreview ? 'ring-2 ring-blue-400' : ''}
    >
      {content()}

      {/* Resize handles (only when selected and not locked and not preview) */}
      {isSelected && !element.locked && !isPreview && (
        <>
          {/* Resize handles */}
          {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => (
            <div
              key={handle}
              onMouseDown={(e) => onResizeMouseDown(e, element.id, handle)}
              className="absolute w-2 h-2 bg-blue-400 border border-white"
              style={{
                cursor: `${handle}-resize`,
                ...(handle.includes('n') && { top: '-4px' }),
                ...(handle.includes('s') && { bottom: '-4px' }),
                ...(handle.includes('w') && { left: '-4px' }),
                ...(handle.includes('e') && { right: '-4px' }),
                ...(handle === 'n' || handle === 's' ? { left: '50%', transform: 'translateX(-50%)' } : {}),
                ...(handle === 'e' || handle === 'w' ? { top: '50%', transform: 'translateY(-50%)' } : {}),
              }}
            />
          ))}

          {/* Action buttons */}
          <div className="absolute -top-7 right-0 flex items-center gap-0.5 bg-white rounded shadow-lg p-0.5">
            <button onClick={(e) => { e.stopPropagation(); onToggleLock() }} className="w-5 h-5 flex items-center justify-center hover:bg-gray-100 rounded">
              {element.locked ? <Lock className="w-3 h-3 text-gray-600" /> : <Unlock className="w-3 h-3 text-gray-600" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDuplicate() }} className="w-5 h-5 flex items-center justify-center hover:bg-gray-100 rounded">
              <Copy className="w-3 h-3 text-gray-600" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="w-5 h-5 flex items-center justify-center hover:bg-red-100 rounded">
              <Trash2 className="w-3 h-3 text-red-500" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Properties Panel
// ---------------------------------------------------------------------------

function PropertiesPanel({
  element,
  onUpdate,
  onDelete,
  onDuplicate,
  onToggleLock,
}: {
  element: TemplateElement
  onUpdate: (updates: Partial<TemplateElement>) => void
  onDelete: () => void
  onDuplicate: () => void
  onToggleLock: () => void
}) {
  return (
    <div className="card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {element.type.replace('_', ' ')} Properties
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={onToggleLock} aria-label={element.locked ? 'Unlock element' : 'Lock element'} className="w-6 h-6 flex items-center justify-center hover:bg-white/[0.06] rounded">
            {element.locked ? <Lock className="w-3 h-3 text-gray-400" /> : <Unlock className="w-3 h-3 text-gray-400" />}
          </button>
          <button onClick={onDuplicate} aria-label="Duplicate element" className="w-6 h-6 flex items-center justify-center hover:bg-white/[0.06] rounded">
            <Copy className="w-3 h-3 text-gray-400" />
          </button>
          <button onClick={onDelete} aria-label="Delete element" className="w-6 h-6 flex items-center justify-center hover:bg-red-500/10 rounded">
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        </div>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-0.5">X (mm)</label>
          <input aria-label="X (mm)"
            type="number"
            value={Math.round(element.x)}
            onChange={e => onUpdate({ x: parseFloat(e.target.value) || 0 })}
            className="w-full h-7 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-0.5">Y (mm)</label>
          <input aria-label="Y (mm)"
            type="number"
            value={Math.round(element.y)}
            onChange={e => onUpdate({ y: parseFloat(e.target.value) || 0 })}
            className="w-full h-7 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)]"
          />
        </div>
      </div>

      {/* Size */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-0.5">Width (mm)</label>
          <input aria-label="Width (mm)"
            type="number"
            value={Math.round(element.width)}
            onChange={e => onUpdate({ width: parseFloat(e.target.value) || 10 })}
            className="w-full h-7 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-0.5">Height (mm)</label>
          <input aria-label="Height (mm)"
            type="number"
            value={Math.round(element.height)}
            onChange={e => onUpdate({ height: parseFloat(e.target.value) || 10 })}
            className="w-full h-7 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)]"
          />
        </div>
      </div>

      {/* Text-specific properties */}
      {element.type === 'text' && (
        <>
          <div>
            <label className="block text-[9px] text-gray-500 uppercase mb-0.5">Text Content</label>
            <textarea
              value={element.text || ''}
              onChange={e => onUpdate({ text: e.target.value })}
              rows={3}
              className="w-full px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-gray-500 uppercase mb-0.5">Font Size (mm)</label>
              <input aria-label="Font Size (mm)"
                type="number"
                step="0.5"
                value={element.fontSize || 4}
                onChange={e => onUpdate({ fontSize: parseFloat(e.target.value) || 4 })}
                className="w-full h-7 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-[9px] text-gray-500 uppercase mb-0.5">Align</label>
              <select
                value={element.align || 'left'}
                onChange={e => onUpdate({ align: e.target.value as 'left' | 'center' | 'right' })}
                className="w-full h-7 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)]"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onUpdate({ fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })}
              className={`px-2 h-7 rounded text-xs font-bold ${element.fontWeight === 'bold' ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30' : 'bg-[var(--bg-tertiary)] text-gray-400 border border-[var(--border-color)]'}`}
            >
              B
            </button>
            <input aria-label="Color picker"
              type="color"
              value={element.color || '#000000'}
              onChange={e => onUpdate({ color: e.target.value })}
              className="w-7 h-7 rounded border border-[var(--border-color)] cursor-pointer"
            />
          </div>
        </>
      )}

      {/* Map-specific properties */}
      {element.type === 'map' && (
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-0.5">Scale (1:N)</label>
          <select
            value={element.scale || 2500}
            onChange={e => onUpdate({ scale: parseInt(e.target.value) })}
            className="w-full h-7 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)]"
          >
            <option value={500}>1:500</option>
            <option value={1000}>1:1,000</option>
            <option value={2500}>1:2,500</option>
            <option value={5000}>1:5,000</option>
            <option value={10000}>1:10,000</option>
          </select>
        </div>
      )}
    </div>
  )
}
