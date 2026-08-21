'use client';

/**
 * BreaklineEditor — UI for importing, drawing, and auto-extracting breaklines
 *
 * Breaklines are edges that the TIN must respect (roads, bank tops,
 * slope toes, retaining walls). Without them, the TIN triangulates
 * across features, creating false terrain.
 *
 * Three input methods:
 * 1. Import from field data — feature codes like ROAD_EDGE, BANK_TOP, SLOPE_TOE
 * 2. Draw manually — click on the topo canvas to connect points
 * 3. Auto-extract — analyse triangle normals in the TIN and flag sharp
 *    dihedral-angle edges (Tier 2 feature, docs/ROADMAP.md).
 *
 * The surveyor's workflow:
 *   Import spot heights → Define breaklines → Generate contours
 *   The breaklines constrain the TIN so contours follow real terrain.
 */

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Link2, Upload, Mountain, Wand2, Download } from 'lucide-react'
import type { SpotHeight } from '@/lib/engine/contours'
import {
  extractBreaklinesFromPoints,
  toBreaklineArray,
  toGeoJSON,
  type BreaklineExtractionResult,
} from '@/lib/engine/breaklineExtraction'

// Extended SpotHeight with optional id + code for breakline editor
interface CodedSpotHeight extends SpotHeight {
  id?: string
  code?: string
}

// Feature codes that represent linear features (breaklines)
const BREAKLINE_CODES = [
  { code: 'ROAD_EDGE', label: 'Road Edge', color: '#e74c3c' },
  { code: 'ROAD_CL', label: 'Road Centreline', color: '#e67e22' },
  { code: 'BANK_TOP', label: 'Bank Top', color: '#8e44ad' },
  { code: 'BANK_TOE', label: 'Bank Toe / Slope Toe', color: '#9b59b6' },
  { code: 'WALL', label: 'Wall / Retaining', color: '#2c3e50' },
  { code: 'FENCE', label: 'Fence Line', color: '#27ae60' },
  { code: 'HEDGE', label: 'Hedge / Vegetation Edge', color: '#229954' },
  { code: 'WATER_EDGE', label: 'Water Edge / Riverbank', color: '#2980b9' },
  { code: 'Kerb', label: 'Kerb', color: '#f39c12' },
  { code: 'DITCH', label: 'Ditch / Drain', color: '#1abc9c' },
]

interface BreaklineEditorProps {
  points: CodedSpotHeight[]
  breaklines: Array<{ start: CodedSpotHeight; end: CodedSpotHeight }>
  onChange: (breaklines: Array<{ start: CodedSpotHeight; end: CodedSpotHeight }>) => void
}

export function BreaklineEditor({ points, breaklines, onChange }: BreaklineEditorProps) {
  const [mode, setMode] = useState<'import' | 'draw' | 'auto' | 'list'>('list')
  const [drawStart, setDrawStart] = useState<string | null>(null)
  const [autoThreshold, setAutoThreshold] = useState(30)
  const [autoMinLength, setAutoMinLength] = useState(0)
  const [selectedBreaklineIds, setSelectedBreaklineIds] = useState<Set<number>>(new Set())

  // Import breaklines from feature-coded points
  const importFromCodes = useCallback(() => {
    const newBreaklines: Array<{ start: CodedSpotHeight; end: CodedSpotHeight }> = []

    for (const def of BREAKLINE_CODES) {
      // Find consecutive points with this code
      const codedPoints = points.filter(p => p.code === def.code || p.name?.startsWith(def.code))
      if (codedPoints.length < 2) continue

      // Connect consecutive points as breakline segments
      for (let i = 0; i < codedPoints.length - 1; i++) {
        // Check if already exists
        const exists = breaklines.some(b =>
          (b.start.id === codedPoints[i].id && b.end.id === codedPoints[i + 1].id) ||
          (b.start.id === codedPoints[i + 1].id && b.end.id === codedPoints[i].id)
        )
        if (!exists) {
          newBreaklines.push({
            start: codedPoints[i],
            end: codedPoints[i + 1],
          })
        }
      }
    }

    if (newBreaklines.length > 0) {
      onChange([...breaklines, ...newBreaklines])
    }
  }, [points, breaklines, onChange])

  // Draw breakline by selecting two points
  const handlePointClick = useCallback((pointId: string) => {
    if (!drawStart) {
      setDrawStart(pointId)
    } else if (drawStart !== pointId) {
      const start = points.find(p => p.id ?? p.name === drawStart)
      const end = points.find(p => (p.id ?? p.name) === pointId)
      if (start && end) {
        onChange([...breaklines, { start: start as SpotHeight, end: end as SpotHeight }])
      }
      setDrawStart(null)
    } else {
      setDrawStart(null)
    }
  }, [drawStart, points, breaklines, onChange])

  const removeBreakline = useCallback((index: number) => {
    onChange(breaklines.filter((_, i) => i !== index))
  }, [breaklines, onChange])

  const availableCodedPoints = BREAKLINE_CODES.reduce((count, def) => {
    return count + points.filter(p => p.code === def.code || p.name?.startsWith(def.code)).length
  }, 0)

  // ─── Auto-extraction (Tier 2) ────────────────────────────────────────────
  const extractionResult: BreaklineExtractionResult | null = useMemo(() => {
    if (mode !== 'auto' || points.length < 3) return null
    try {
      return extractBreaklinesFromPoints(points, {
        thresholdDegrees: autoThreshold,
        minPolylineLength: autoMinLength,
      })
    } catch {
      return null
    }
  }, [mode, points, autoThreshold, autoMinLength])

  const toggleSelectBreakline = useCallback((idx: number) => {
    setSelectedBreaklineIds(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }, [])

  const addSelectedAutoBreaklines = useCallback(() => {
    if (!extractionResult) return
    // Use linear interpolation on the TIN to get approximate elevations
    // at each polyline vertex. For now we use a flat 0 elevation — the
    // caller can re-interpolate from the surface if needed.
    const newOnes = toBreaklineArray(
      { ...extractionResult, breaklines: extractionResult.breaklines.filter((_, i) =>
        selectedBreaklineIds.has(i)) }
    )
    if (newOnes.length === 0) return
    onChange([
      ...breaklines,
      ...newOnes.map(b => ({
        start: { ...b.start, id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } as CodedSpotHeight,
        end: { ...b.end } as CodedSpotHeight,
      })),
    ])
    setSelectedBreaklineIds(new Set())
  }, [extractionResult, selectedBreaklineIds, breaklines, onChange])

  const exportAutoBreaklinesGeoJSON = useCallback(() => {
    if (!extractionResult || extractionResult.breaklines.length === 0) return
    const gj = toGeoJSON(extractionResult)
    const blob = new Blob([JSON.stringify(gj, null, 2)], {
      type: 'application/geo+json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auto-breaklines-${Date.now()}.geojson`
    a.click()
    URL.revokeObjectURL(url)
  }, [extractionResult])

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Mountain className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Breaklines</h3>
        <span className="text-xs text-[var(--text-muted)]">({breaklines.length} defined)</span>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 flex-wrap">
        <Button
          variant={mode === 'list' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('list')}
          className="text-xs"
        >
          List
        </Button>
        <Button
          variant={mode === 'import' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('import')}
          className="text-xs"
        >
          <Upload className="w-3 h-3 mr-1" /> Import
        </Button>
        <Button
          variant={mode === 'draw' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('draw')}
          className="text-xs"
        >
          <Link2 className="w-3 h-3 mr-1" /> Draw
        </Button>
        <Button
          variant={mode === 'auto' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('auto')}
          className="text-xs"
          title="Auto-extract breaklines from TIN mesh (Tier 2)"
        >
          <Wand2 className="w-3 h-3 mr-1" /> Auto
        </Button>
      </div>

      {/* Import mode */}
      {mode === 'import' && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)]">
            Auto-detect breaklines from feature-coded points.
            {availableCodedPoints > 0
              ? ` Found ${availableCodedPoints} coded points.`
              : ' No coded points found — assign feature codes in the field book first.'}
          </p>
          <div className="flex flex-wrap gap-1">
            {BREAKLINE_CODES.map(def => {
              const count = points.filter(p => p.code === def.code || p.name?.startsWith(def.code)).length
              if (count === 0) return null
              return (
                <span
                  key={def.code}
                  className="text-xs px-2 py-0.5 rounded-full border"
                  style={{ borderColor: def.color, color: def.color }}
                >
                  {def.label}: {count}
                </span>
              )
            })}
          </div>
          <Button
            onClick={importFromCodes}
            disabled={availableCodedPoints < 2}
            size="sm"
            className="text-xs w-full"
          >
            <Plus className="w-3 h-3 mr-1" /> Import {availableCodedPoints >= 2 ? `${availableCodedPoints} breakline points` : '(need 2+ coded points)'}
          </Button>
        </div>
      )}

      {/* Draw mode */}
      {mode === 'draw' && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)]">
            {drawStart
              ? `Click a second point to create a breakline (started from ${points.find(p => p.id ?? p.name === drawStart)?.name ?? '?'})`
              : 'Click a point to start a breakline, then click another to connect them.'}
          </p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {points.slice(0, 50).map(p => (
              <button
                key={p.id ?? p.name}
                onClick={() => handlePointClick(p.id ?? p.name)}
                className={`w-full text-left text-xs px-2 py-1 rounded flex items-center justify-between transition-colors ${
                  drawStart === p.id
                    ? 'bg-purple-600 text-white'
                    : 'hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                }`}
              >
                <span className="font-mono">{p.name}</span>
                <span className="text-[var(--text-muted)]">
                  E:{p.easting.toFixed(1)} N:{p.northing.toFixed(1)} Z:{p.elevation.toFixed(2)}
                </span>
              </button>
            ))}
            {points.length > 50 && (
              <p className="text-xs text-[var(--text-muted)] text-center pt-1">
                Showing first 50 of {points.length} points
              </p>
            )}
          </div>
        </div>
      )}

      {/* Auto-extract mode (Tier 2) */}
      {mode === 'auto' && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Auto-detect breaklines by computing triangle normals on the TIN and
            flagging edges where the dihedral angle exceeds the threshold. Lower
            the threshold to catch subtle slope changes; raise it to find only
            major ridges and toe-of-bank lines.
          </p>

          {points.length < 3 ? (
            <p className="text-xs text-amber-400">
              Need at least 3 points to build a TIN. Add spot heights first.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-[var(--text-muted)] flex items-center justify-between">
                  <span>Dihedral threshold</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {autoThreshold}°
                  </span>
                </Label>
                <input
                  type="range"
                  min={5}
                  max={75}
                  step={1}
                  value={autoThreshold}
                  onChange={e => setAutoThreshold(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                  <span>5° (loose)</span>
                  <span>30° (default)</span>
                  <span>75° (strict)</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-[var(--text-muted)] flex items-center justify-between">
                  <span>Min polyline length (m)</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {autoMinLength.toFixed(1)}
                  </span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={autoMinLength}
                  onChange={e => setAutoMinLength(Math.max(0, Number(e.target.value)))}
                  className="font-mono text-xs h-7 bg-[var(--bg-secondary)] border-[var(--border-color)]"
                />
              </div>

              {extractionResult && (
                <>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">
                        Candidates
                      </div>
                      <div className="font-mono text-[var(--text-primary)] text-base">
                        {extractionResult.candidateEdgeCount}
                      </div>
                    </div>
                    <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">
                        Interior edges
                      </div>
                      <div className="font-mono text-[var(--text-primary)] text-base">
                        {extractionResult.interiorEdgeCount}
                      </div>
                    </div>
                    <div className="bg-[var(--bg-secondary)] rounded p-2 text-center">
                      <div className="text-[var(--text-muted)] text-[10px] uppercase tracking-wide">
                        Polylines
                      </div>
                      <div className="font-mono text-[var(--text-primary)] text-base">
                        {extractionResult.breaklines.length}
                      </div>
                    </div>
                  </div>

                  {extractionResult.breaklines.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] text-center py-3">
                      No breaklines detected at {autoThreshold}° threshold.
                      Try lowering it.
                    </p>
                  ) : (
                    <>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {extractionResult.breaklines.map((bl, i) => {
                          const isSelected = selectedBreaklineIds.has(i)
                          const cls = bl.classification
                          const clsColor =
                            cls === 'ridge'
                              ? 'text-red-400 border-red-700/50'
                              : cls === 'slope-change'
                                ? 'text-amber-400 border-amber-700/50'
                                : 'text-zinc-400 border-zinc-700/50'
                          return (
                            <button
                              key={i}
                              onClick={() => toggleSelectBreakline(i)}
                              className={`w-full text-left text-xs px-2 py-1.5 rounded flex items-center justify-between transition-colors border ${
                                isSelected
                                  ? 'bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] border-[var(--accent)]'
                                  : 'bg-[var(--bg-secondary)] ' + clsColor
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  readOnly
                                  className="accent-[var(--accent)]"
                                />
                                <span className="font-mono">#{i + 1}</span>
                                <span className={`text-[10px] uppercase tracking-wide ${clsColor.split(' ')[0]}`}>
                                  {cls}
                                </span>
                              </span>
                              <span className="font-mono text-[var(--text-muted)]">
                                {bl.maxDihedral.toFixed(1)}° · {bl.length.toFixed(1)} m · {bl.edgeCount} ed.
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={addSelectedAutoBreaklines}
                          disabled={selectedBreaklineIds.size === 0}
                          size="sm"
                          className="text-xs flex-1"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add {selectedBreaklineIds.size > 0
                            ? `${selectedBreaklineIds.size} selected`
                            : 'selected'}
                        </Button>
                        <Button
                          onClick={exportAutoBreaklinesGeoJSON}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          title="Download all auto-detected breaklines as GeoJSON"
                        >
                          <Download className="w-3 h-3 mr-1" /> GeoJSON
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* List mode */}
      {mode === 'list' && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {breaklines.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] text-center py-4">
              No breaklines defined. Use Import or Draw to add them.
            </p>
          ) : (
            breaklines.map((b, i) => (
              <div
                key={`${b}-${i}`}
                className="flex items-center justify-between text-xs px-2 py-1 rounded bg-[var(--bg-secondary)]"
              >
                <span className="font-mono text-[var(--text-secondary)]">
                  {b.start.name} → {b.end.name}
                </span>
                <button
                  onClick={() => removeBreakline(i)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
