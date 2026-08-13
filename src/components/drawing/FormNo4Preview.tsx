'use client';

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { CanvasPoint, CanvasLine } from './CoordinateCanvas'
import type { SubmissionPackage } from '@/lib/submission/types'

import { formatPlanDate } from '@/lib/drawing/dxfLayers'

const CoordinateCanvas = dynamic(() => import('./CoordinateCanvas').then(m => ({ default: m.CoordinateCanvas })), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 rounded h-64" />,
})

interface FormNo4PreviewProps {
  pkg: SubmissionPackage
  width?: number
  height?: number
}

function formatPlanDateLocal(date: string): string {
  return formatPlanDate(date)
}

export function FormNo4Preview({
  pkg,
  width = 800,
  height = 600
}: FormNo4PreviewProps) {
  const adjustedAreaHa = pkg.traverse.areaM2 / 10000
  const scale = useMemo(() => {
    const pts = pkg.traverse.points
    if (pts.length < 2) return 2500
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity
    pts.forEach(p => {
      minE = Math.min(minE, p.adjustedEasting)
      maxE = Math.max(maxE, p.adjustedEasting)
      minN = Math.min(minN, p.adjustedNorthing)
      maxN = Math.max(maxN, p.adjustedNorthing)
    })
    const w = maxE - minE, h = maxN - minN
    const scales = [500, 1000, 2500, 5000, 10000, 25000]
    for (const s of scales) {
      if (w / s <= 0.315 && h / s <= 0.222) return s
    }
    return 25000
  }, [pkg.traverse.points])

  const { points, lines } = useMemo(() => {
    const pts: CanvasPoint[] = pkg.traverse.points.map(p => ({
      id: p.pointName,
      name: p.pointName,
      easting: p.adjustedEasting,
      northing: p.adjustedNorthing,
      type: 'beacon' as const
    }))

    const lns: CanvasLine[] = pts.map((pt, i) => ({
      from: pt.id,
      to: pts[(i + 1) % pts.length].id,
      style: 'solid' as const
    }))

    return { points: pts, lines: lns }
  }, [pkg])

  const legs = useMemo(() => {
    return pkg.traverse.points.map((from, i) => {
      const to = pkg.traverse.points[(i + 1) % pkg.traverse.points.length]
      const dE = to.adjustedEasting - from.adjustedEasting
      const dN = to.adjustedNorthing - from.adjustedNorthing
      let bearing = Math.atan2(dE, dN) * (180 / Math.PI)
      if (bearing < 0) bearing += 360
      const distance = Math.sqrt(dE * dE + dN * dN)
      return {
        from: from.pointName,
        to: to.pointName,
        bearing,
        distance,
        midE: (from.adjustedEasting + to.adjustedEasting) / 2,
        midN: (from.adjustedNorthing + to.adjustedNorthing) / 2
      }
    })
  }, [pkg.traverse.points])

  return (
    <div className="space-y-3">
      <div className="bg-[#1a1a1a] border rounded-t-lg px-4 py-3 flex items-center justify-between text-sm">
        <div>
          <p className="font-semibold">FORM NO. 4 — SURVEY PLAN</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">
            LR No: {pkg.parcel.lrNumber} · Parcel No: {pkg.parcel.parcelNumber || pkg.parcel.lrNumber}
          </p>
          <p className="text-[var(--text-muted)] text-xs">
            {pkg.parcel.county} · {pkg.parcel.division || '-'} · {pkg.parcel.district}
          </p>
        </div>
        <div className="text-right text-xs text-[var(--text-muted)]">
          <p>{pkg.surveyor.fullName}</p>
          <p>ISK No: {pkg.surveyor.iskNumber || pkg.surveyor.registrationNumber}</p>
          <p>{pkg.surveyor.firmName}</p>
          <p>Date: {formatPlanDateLocal(pkg.generatedAt)}</p>
        </div>
      </div>

      <CoordinateCanvas
        points={points}
        lines={lines}
        width={width}
        height={height}
        showNorthArrow
        showScaleBar
        showGrid
        showAreaAnnotation
        areaAnnotation={`Area = ${adjustedAreaHa.toFixed(4)} Ha`}
        legs={legs.map(l => ({
          from: l.from,
          to: l.to,
          bearing: l.bearing,
          distance: l.distance,
          midX: l.midE,
          midY: l.midN
        }))}
      />

      <div className="bg-[#1a1a1a] border rounded-b-lg px-4 py-3 grid grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-[var(--text-muted)] text-xs">Area</p>
          <p className="font-medium">{adjustedAreaHa.toFixed(4)} Ha</p>
          <p className="text-[var(--text-muted)] text-xs">{pkg.traverse.areaM2.toFixed(2)} m²</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] text-xs">Perimeter</p>
          <p className="font-medium">{pkg.traverse.perimeterM.toFixed(3)} m</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] text-xs">Scale</p>
          <p className="font-medium">1:{scale}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] text-xs">Ref</p>
          <p className="font-medium">{pkg.submissionRef}</p>
          <p className="text-[var(--text-muted)] text-xs">R{pkg.revision.toString().padStart(2, '0')}</p>
        </div>
        {pkg.scaleFactor && (
          <div>
            <p className="text-[var(--text-muted)] text-xs">Scale Factor</p>
            <p className="font-medium">{pkg.scaleFactor.toFixed(6)}</p>
          </div>
        )}
        {pkg.meanElevation != null && (
          <div>
            <p className="text-[var(--text-muted)] text-xs">Mean Elevation</p>
            <p className="font-medium">{pkg.meanElevation.toFixed(2)} m</p>
          </div>
        )}
        {pkg.controlClass && (
          <div>
            <p className="text-[var(--text-muted)] text-xs">Control Class</p>
            <p className="font-medium">{pkg.controlClass} Order</p>
          </div>
        )}
      </div>
    </div>
  )
}
