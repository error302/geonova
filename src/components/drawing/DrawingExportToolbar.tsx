'use client';

import { useState } from 'react'
import { logger } from '@/lib/logger'
import { Download, FileText, Map, Copy, Check, Loader2 } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ExportPoint {
  name: string
  easting: number
  northing: number
  elevation?: number
}

interface ExportLeg {
  from: string
  to: string
  bearing: number
  distance: number
}

interface DrawingExportToolbarProps {
  projectName: string
  points: ExportPoint[]
  legs?: ExportLeg[]
  className?: string
  /** UTM zone (default 37 for Kenya) */
  utmZone?: number
  /** UTM hemisphere (default 'S' for Kenya) */
  hemisphere?: 'N' | 'S'
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function safeFileName(name: string, ext: string) {
  const date = new Date().toISOString().split('T')[0]
  return `${name.replace(/\s+/g, '_')}_${date}.${ext}`
}

/* ------------------------------------------------------------------ */
/*  Export handlers                                                    */
/* ------------------------------------------------------------------ */

async function exportDXF(
  projectName: string,
  points: ExportPoint[],
  legs?: ExportLeg[],
): Promise<void> {
  const resp = await fetch('/api/compute/export/dxf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectName,
      points: points.map(p => ({
        name: p.name,
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation ?? undefined,
        is_control: false,
      })),
      traverseLegs: (legs ?? []).map(l => ({
        from: l.from,
        to: l.to,
        distance: l.distance,
        bearing: l.bearing,
      })),
    }),
  })
  const data = await resp.json() as { error?: string; filename?: string; dxf: string }
  if (!resp.ok) throw new Error(data.error || 'DXF export failed')
  const blob = new Blob([data.dxf], { type: 'application/dxf' })
  triggerDownload(blob, data.filename || safeFileName(projectName, 'dxf'))
}

/**
 * UTM to geographic (WGS84) conversion for client-side GeoJSON export.
 * Uses the Karney series expansion — equivalent to Metardu's server-side
 * utmToGeographic() but inline so the toolbar stays a pure client component.
 */
function utmToLatLon(
  easting: number,
  northing: number,
  zone: number,
  hemisphere: 'N' | 'S'
): { lat: number; lon: number } {
  const a = 6378137.0
  const f = 1 / 298.257223563
  const k0 = 0.9996
  const e = Math.sqrt(2 * f - f * f)
  const e2 = e * e
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const falseE = 500000.0
  const falseN = hemisphere === 'S' ? 10000000.0 : 0.0
  const x = easting - falseE
  const y = northing - falseN
  const M = y / k0
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256))
  const e1_2 = e1 * e1
  const e1_3 = e1_2 * e1
  const e1_4 = e1_3 * e1
  const phi1 = mu + (3 * e1 / 2 - 27 * e1_3 / 32) * Math.sin(2 * mu)
    + (21 * e1_2 / 16 - 55 * e1_4 / 32) * Math.sin(4 * mu)
    + (151 * e1_3 / 96) * Math.sin(6 * mu)
    + (1097 * e1_4 / 512) * Math.sin(8 * mu)
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1))
  const T1 = Math.tan(phi1) * Math.tan(phi1)
  const C1 = e2 * Math.cos(phi1) * Math.cos(phi1) / (1 - e2)
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5)
  const D = x / (N1 * k0)
  const lat = phi1 - (N1 * Math.tan(phi1) / R1)
    * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e2)
      * D * D * D * D / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1
        - 252 * e2 - 3 * C1 * C1) * D * D * D * D * D * D / 720)
  const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180
  const lon = lon0 + (D - (1 + 2 * T1 + C1) * D * D * D / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e2 + 24 * T1 * T1)
    * D * D * D * D * D / 120) / Math.cos(phi1)
  return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI }
}

function exportGeoJSON(
  projectName: string,
  points: ExportPoint[],
  utmZone = 37,
  hemisphere: 'N' | 'S' = 'S',
): void {
  // Convert UTM coordinates to WGS84 (RFC 7946 requires WGS84)
  const wgs84Coords = points.map(p => {
    const ll = utmToLatLon(p.easting, p.northing, utmZone, hemisphere)
    return [ll.lon, ll.lat] as [number, number]
  })
  const isClosed = wgs84Coords.length > 2
  if (isClosed) {
    wgs84Coords.push(wgs84Coords[0]) // close the polygon
  }

  const geojson = {
    type: 'FeatureCollection' as const,
    name: `${projectName}_WGS84`,
    crs: {
      type: 'name',
      properties: {
        name: `urn:ogc:def:crs:EPSG::4326`,
      },
    },
    features: [
      {
        type: 'Feature' as const,
        properties: {
          name: projectName,
          source_crs: `EPSG:${32600 + utmZone}${hemisphere === 'S' ? 0 : 0}`,
          source_zone: `${utmZone}${hemisphere}`,
        },
        geometry: {
          type: isClosed ? ('Polygon' as const) : ('LineString' as const),
          coordinates: isClosed ? [wgs84Coords] : wgs84Coords,
        },
      },
    ],
  }

  const blob = new Blob([JSON.stringify(geojson, null, 2)], {
    type: 'application/geo+json',
  })
  triggerDownload(blob, safeFileName(`${projectName}_WGS84`, 'geojson'))
}

async function exportPDF(
  projectName: string,
  points: ExportPoint[],
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape' })

  doc.setFontSize(16)
  doc.text(projectName, 14, 18)

  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(`Generated by METARDU  •  ${new Date().toLocaleString()}`, 14, 25)

  const head = [['#', 'Station', 'Easting (m)', 'Northing (m)', 'Elevation (m)']] as any
  const body = points.map((p, i) => [
    i + 1,
    p.name,
    p.easting.toFixed(4),
    p.northing.toFixed(4),
    p.elevation != null ? p.elevation.toFixed(4) : '—',
  ])

  autoTable(doc, {
    startY: 30,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 9 },
    headStyles: { fillColor: [34, 34, 34] },
  })

  doc.save(safeFileName(projectName, 'pdf'))
}

async function copyCoordinates(points: ExportPoint[]): Promise<void> {
  const header = 'Station\tEasting\tNorthing'
  const rows = points.map(
    p => `${p.name}\t${p.easting.toFixed(4)}\t${p.northing.toFixed(4)}`,
  )
  const text = [header, ...rows].join('\n')

  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DrawingExportToolbar({
  projectName,
  points,
  legs,
  className = '',
  utmZone = 37,
  hemisphere = 'S',
}: DrawingExportToolbarProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleDXF() {
    setLoading('dxf')
    try {
      await exportDXF(projectName, points, legs)
    } catch (err: unknown) {
      logger.error('DXF export failed:', { error: err })
    } finally {
      setLoading(null)
    }
  }

  function handleGeoJSON() {
    setLoading('geojson')
    try {
      exportGeoJSON(projectName, points, utmZone, hemisphere)
    } catch (err: unknown) {
      logger.error('GeoJSON export failed:', { error: err })
    } finally {
      setLoading(null)
    }
  }

  async function handlePDF() {
    setLoading('pdf')
    try {
      await exportPDF(projectName, points)
    } catch (err: unknown) {
      logger.error('PDF export failed:', { error: err })
    } finally {
      setLoading(null)
    }
  }

  async function handleCopy() {
    setLoading('copy')
    try {
      await copyCoordinates(points)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err: unknown) {
      logger.error('Copy failed:', { error: err })
    } finally {
      setLoading(null)
    }
  }

  const btnBase =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* DXF */}
      <button
        onClick={handleDXF}
        disabled={loading !== null || points.length === 0}
        className={`${btnBase} bg-blue-700 hover:bg-blue-600 text-white`}
        title="Export DXF"
      >
        {loading === 'dxf' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileText className="w-3.5 h-3.5" />
        )}
        DXF
      </button>

      {/* GeoJSON */}
      <button
        onClick={handleGeoJSON}
        disabled={loading !== null || points.length === 0}
        className={`${btnBase} bg-emerald-700 hover:bg-emerald-600 text-white`}
        title="Export GeoJSON"
      >
        {loading === 'geojson' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Map className="w-3.5 h-3.5" />
        )}
        GeoJSON
      </button>

      {/* PDF */}
      <button
        onClick={handlePDF}
        disabled={loading !== null || points.length === 0}
        className={`${btnBase} bg-rose-700 hover:bg-rose-600 text-white`}
        title="Export PDF"
      >
        {loading === 'pdf' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        PDF
      </button>

      {/* Copy Coordinates */}
      <button
        onClick={handleCopy}
        disabled={loading !== null || points.length === 0}
        className={`${btnBase} bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] border border-[var(--border-color)]`}
        title="Copy coordinates to clipboard"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : loading === 'copy' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

export type { ExportPoint, ExportLeg, DrawingExportToolbarProps }
