'use client'

import { useState, useCallback } from 'react'
import { z } from 'zod'
import { Loader2, FileText, Download, MapPin, Activity, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { apiPost, ApiError } from '@/lib/api/client'
import { realtimeService } from '@/lib/realtime'
import * as Y from 'yjs'

// ponytail: response schemas — Phase 4 wave 2 will move these to src/lib/api/schemas/

const traverseLegSchema = z.object({
  from: z.string(),
  to: z.string(),
  bearing: z.number(),
  distance: z.number(),
  adjEasting: z.number(),
  adjNorthing: z.number(),
  rawDeltaE: z.number().optional(),
  rawDeltaN: z.number().optional(),
  correctionE: z.number().optional(),
  correctionN: z.number().optional(),
}).passthrough()

const traverseResultSchema = z.object({
  legs: z.array(traverseLegSchema),
  closingErrorE: z.number(),
  closingErrorN: z.number(),
  linearError: z.number(),
  precisionRatio: z.number(),
  adjustedAreaM2: z.number(),
  adjustedAreaHa: z.number(),
  angularMisclosureSec: z.number().optional(),
  angularToleranceSec: z.number().optional(),
  linearMisclosureM: z.number().optional(),
  perimeterM: z.number().optional(),
}).passthrough()

const dxfExportSchema = z.object({
  kind: z.string(),
  filename: z.string(),
  dxf: z.string(),
}).passthrough()

const geojsonExportSchema = z.object({
  kind: z.string(),
  filename: z.string(),
  geojson: z.any(),
}).passthrough()

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ExportToolbarProps {
  projectId: string
  projectName: string
  lrNumber?: string
  surveyType?: string
  hasTraverseData: boolean
  hasAdjustedCoords: boolean
  onAdjustmentComplete?: (result: any) => void
}

interface TraverseResult {
  legs: Array<{
    from: string
    to: string
    bearing: number
    distance: number
    adjEasting: number
    adjNorthing: number
    rawDeltaE: number
    rawDeltaN: number
    correctionE: number
    correctionN: number
  }>
  closingErrorE: number
  closingErrorN: number
  linearError: number
  precisionRatio: number
  adjustedAreaM2: number
  adjustedAreaHa: number
  angularMisclosureSec?: number
  angularToleranceSec?: number
  linearMisclosureM?: number
  perimeterM?: number
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExportToolbar({
  projectId,
  projectName,
  lrNumber = '',
  surveyType = 'cadastral',
  hasTraverseData,
  hasAdjustedCoords,
  onAdjustmentComplete,
}: ExportToolbarProps) {
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [formC22Loading, setFormC22Loading] = useState(false)
  const [dxfLoading, setDxfLoading] = useState(false)
  const [geojsonLoading, setGeojsonLoading] = useState(false)
  const [traverseResult, setTraverseResult] = useState<TraverseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const handleExportProject = useCallback(() => {
    try {
      const doc = realtimeService.getDoc(projectId)
      const stateUpdate = Y.encodeStateAsUpdate(doc)
      const blob = new Blob([stateUpdate as unknown as BlobPart], { type: 'application/octet-stream' })
      downloadBlob(blob, `${projectName.replace(/[^a-z0-9]/gi, '_')}.metardu`)
    } catch (err) {
      setError('Failed to export project: ' + (err as Error).message)
    }
  }, [projectId, projectName, downloadBlob])

  const handleImportProject = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.metardu'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const arrayBuffer = await file.arrayBuffer()
        const update = new Uint8Array(arrayBuffer)
        const doc = realtimeService.getDoc(projectId)
        Y.applyUpdate(doc, update)
      } catch (err) {
        setError('Failed to import project: ' + (err as Error).message)
      }
    }
    input.click()
  }, [projectId])

  const clearError = useCallback(() => setError(null), [])

  // -----------------------------------------------------------------------
  // 1. Run Adjustment
  // -----------------------------------------------------------------------

  const handleRunAdjustment = useCallback(async () => {
    try {
      setAdjustLoading(true)
      clearError()

      const result = await apiPost(
        '/api/compute/traverse',
        traverseResultSchema,
        {
          task: 'adjust',
          method: 'bowditch',
          surveyType,
          startPoint: { name: 'ST1', easting: 0, northing: 0 },
          legs: [], // caller should provide legs via project data
          closingPoint: { easting: 0, northing: 0 },
        },
      )

      setTraverseResult(result as unknown as TraverseResult)
      onAdjustmentComplete?.(result)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Adjustment failed')
      } else {
        setError((err as Error).message || 'Adjustment failed')
      }
    } finally {
      setAdjustLoading(false)
    }
  }, [surveyType, onAdjustmentComplete, clearError])

  // -----------------------------------------------------------------------
  // 2. Download Form C22
  // -----------------------------------------------------------------------

  const handleDownloadFormC22 = useCallback(async () => {
    try {
      setFormC22Loading(true)
      clearError()

      const legs = traverseResult?.legs || []

      // ponytail: binary download bypasses typed client (PDF response, not JSON)
      const res = await fetch('/api/submission/form-c22', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          lrNumber,
          legs: legs.map((l) => ({
            from: l.from,
            to: l.to,
            bearing: l.bearing,
            distance: l.distance,
            adjEasting: l.adjEasting,
            adjNorthing: l.adjNorthing,
            rawDeltaE: l.rawDeltaE || 0,
            rawDeltaN: l.rawDeltaN || 0,
            correctionE: l.correctionE || 0,
            correctionN: l.correctionN || 0,
          })),
          startPoint: {
            easting: legs[0]?.adjEasting || 0,
            northing: legs[0]?.adjNorthing || 0,
          },
          angularMisclosureSec: traverseResult?.angularMisclosureSec || 0,
          angularToleranceSec: traverseResult?.angularToleranceSec || 0,
          linearMisclosureM: traverseResult?.linearMisclosureM || traverseResult?.linearError || 0,
          perimeterM: traverseResult?.perimeterM || 0,
          precisionRatio: traverseResult?.precisionRatio || 0,
        }),
      })

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errData.error || 'Failed to generate Form C22')
      }

      const blob = await res.blob()
      const filename = lrNumber || 'draft'
      downloadBlob(blob, `Form_C22_${filename}.pdf`)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to download Form C22')
      } else {
        setError((err as Error).message || 'Failed to download Form C22')
      }
    } finally {
      setFormC22Loading(false)
    }
  }, [projectName, lrNumber, traverseResult, downloadBlob, clearError])

  // -----------------------------------------------------------------------
  // 3. Export DXF
  // -----------------------------------------------------------------------

  const handleExportDXF = useCallback(async () => {
    try {
      setDxfLoading(true)
      clearError()

      const legs = traverseResult?.legs || []
      const points = legs.map((l, i) => ({
        name: l.to || `PT${i + 1}`,
        easting: l.adjEasting,
        northing: l.adjNorthing,
        is_control: i === 0,
      }))

      const data = await apiPost(
        '/api/compute/export/dxf',
        dxfExportSchema,
        {
          projectName,
          points,
          traverseLegs: legs.map((l) => ({
            from: l.from,
            to: l.to,
            bearing: l.bearing,
            distance: l.distance,
          })),
        },
      )

      const blob = new Blob([data.dxf], { type: 'application/dxf' })
      downloadBlob(blob, data.filename)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'DXF export failed')
      } else {
        setError((err as Error).message || 'DXF export failed')
      }
    } finally {
      setDxfLoading(false)
    }
  }, [projectName, traverseResult, downloadBlob, clearError])

  // -----------------------------------------------------------------------
  // 4. Export GeoJSON
  // -----------------------------------------------------------------------

  const handleExportGeoJSON = useCallback(async () => {
    try {
      setGeojsonLoading(true)
      clearError()

      const legs = traverseResult?.legs || []
      const points = legs.map((l, i) => ({
        name: l.to || `PT${i + 1}`,
        easting: l.adjEasting,
        northing: l.adjNorthing,
        is_control: i === 0,
      }))

      const data = await apiPost(
        '/api/compute/export/geojson',
        geojsonExportSchema,
        {
          projectName,
          points,
        },
      )

      const blob = new Blob([JSON.stringify(data.geojson, null, 2)], {
        type: 'application/geo+json',
      })
      downloadBlob(blob, data.filename)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'GeoJSON export failed')
      } else {
        setError((err as Error).message || 'GeoJSON export failed')
      }
    } finally {
      setGeojsonLoading(false)
    }
  }, [projectName, traverseResult, downloadBlob, clearError])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex items-center gap-1.5">
      {/* Error banner */}
      {error && (
        <div className="mr-2 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-500">
          <span>{error}</span>
          <button
            onClick={clearError}
            className="ml-1 font-medium text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}

      {/* Run Adjustment */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportProject}
            className="gap-1.5"
          >
            <Upload className="size-3.5" />
            <span className="hidden xl:inline">Load Project</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Load offline .metardu file</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportProject}
            className="gap-1.5"
          >
            <Download className="size-3.5" />
            <span className="hidden xl:inline">Save Project</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Save to offline .metardu file</TooltipContent>
      </Tooltip>

      <div className="w-px h-6 bg-white/10 mx-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={adjustLoading || !hasTraverseData}
            onClick={handleRunAdjustment}
            className="gap-1.5"
          >
            {adjustLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Activity className="size-3.5" />
            )}
            <span className="hidden sm:inline">Run Adjustment</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasTraverseData
            ? 'Run Bowditch traverse adjustment'
            : 'Add traverse legs first'}
        </TooltipContent>
      </Tooltip>

      {/* Download Form C22 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={formC22Loading || !hasAdjustedCoords}
            onClick={handleDownloadFormC22}
            className="gap-1.5"
          >
            {formC22Loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileText className="size-3.5" />
            )}
            <span className="hidden sm:inline">Form C22</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasAdjustedCoords
            ? 'Download Form C22 computation sheet PDF'
            : 'Run adjustment first'}
        </TooltipContent>
      </Tooltip>

      {/* Export DXF */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={dxfLoading || !hasAdjustedCoords}
            onClick={handleExportDXF}
            className="gap-1.5"
          >
            {dxfLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            <span className="hidden sm:inline">DXF</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasAdjustedCoords
            ? 'Export traverse plan as DXF'
            : 'Run adjustment first'}
        </TooltipContent>
      </Tooltip>

      {/* Export GeoJSON */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={geojsonLoading || !hasAdjustedCoords}
            onClick={handleExportGeoJSON}
            className="gap-1.5"
          >
            {geojsonLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <MapPin className="size-3.5" />
            )}
            <span className="hidden sm:inline">GeoJSON</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasAdjustedCoords
            ? 'Export adjusted coordinates as GeoJSON'
            : 'Run adjustment first'}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
