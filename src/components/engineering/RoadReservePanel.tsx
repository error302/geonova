'use client';

import { useState, useMemo, useCallback } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  ROAD_RESERVE_STANDARDS,
  getRoadReserveWidth,
  checkRoadReserveCompliance,
  estimateAcquisitionArea,
  determineAcquisitionType,
  type AcquisitionType,
} from '@/lib/engineering/roadReserve'
import {
  Ruler,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  LandPlot,
  Building2,
  ArrowRightLeft,
  Zap,
} from 'lucide-react'

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface RoadReservePanelProps {
  roadClass: string
  roadLength?: number
  existingRoadWidth?: number
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const ACQUISITION_STYLES: Record<AcquisitionType, { label: string; color: string; bg: string }> = {
  full: {
    label: 'Full Acquisition',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  },
  partial: {
    label: 'Partial Acquisition',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  },
  wayleave: {
    label: 'Wayleave / Easement',
    color: 'text-sky-700 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',
  },
  none: {
    label: 'No Acquisition',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  },
}

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// ────────────────────────────────────────────────────────────
// SVG Cross-Section Diagram
// ────────────────────────────────────────────────────────────

interface CrossSectionSVGProps {
  reserveWidth: number
  carriagewayWidth: number
  shoulderWidth: number
  wayleaveWidth?: number
}

function CrossSectionDiagram({
  reserveWidth,
  carriagewayWidth,
  shoulderWidth,
  wayleaveWidth,
}: CrossSectionSVGProps) {
  const svgWidth = 700
  const svgHeight = 220
  const padding = 30
  const usableWidth = svgWidth - padding * 2
  const groundY = 110
  const groundLineY = groundY + 50

  // Scale factor: reserveWidth maps to usableWidth
  const scale = usableWidth / reserveWidth
  const centreX = svgWidth / 2

  const cw = carriagewayWidth * scale
  const sw = shoulderWidth * scale
  const rw = reserveWidth * scale

  // Wayleave bands (from reserve edge inward)
  const wlW = wayleaveWidth ? wayleaveWidth * scale : 0

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      className="w-full h-auto rounded-lg border bg-muted/30"
      role="img"
      aria-label="Road reserve cross-section diagram"
    >
      {/* Title */}
      <text x={svgWidth / 2} y={22} textAnchor="middle" className="text-[11px] font-semibold fill-foreground">
        Road Reserve Cross-Section (Not to Scale)
      </text>

      {/* Ground fill */}
      <rect
        x={centreX - rw / 2}
        y={groundY}
        width={rw}
        height={groundLineY - groundY + 30}
        fill="#e2e8f0"
        opacity={0.5}
        rx={2}
      />

      {/* Wayleave bands (left and right) */}
      {wlW > 0 && (
        <>
          <rect
            x={centreX - rw / 2}
            y={groundY}
            width={wlW}
            height={groundLineY - groundY}
            fill="#bae6fd"
            opacity={0.5}
            rx={1}
          />
          <rect
            x={centreX + rw / 2 - wlW}
            y={groundY}
            width={wlW}
            height={groundLineY - groundY}
            fill="#bae6fd"
            opacity={0.5}
            rx={1}
          />
          {/* Wayleave label left */}
          <text x={centreX - rw / 2 + wlW / 2} y={groundLineY + 16} textAnchor="middle" className="text-[9px] fill-sky-700">
            Wayleave
          </text>
          <text x={centreX - rw / 2 + wlW / 2} y={groundLineY + 28} textAnchor="middle" className="text-[9px] fill-sky-700">
            {wayleaveWidth}m
          </text>
          {/* Wayleave label right */}
          <text x={centreX + rw / 2 - wlW / 2} y={groundLineY + 16} textAnchor="middle" className="text-[9px] fill-sky-700">
            Wayleave
          </text>
          <text x={centreX + rw / 2 - wlW / 2} y={groundLineY + 28} textAnchor="middle" className="text-[9px] fill-sky-700">
            {wayleaveWidth}m
          </text>
        </>
      )}

      {/* Left reserve area (green) */}
      <rect
        x={centreX - rw / 2 + (wlW > 0 ? wlW : 0)}
        y={groundY}
        width={rw / 2 - cw / 2 - sw + (wlW > 0 ? -wlW : 0)}
        height={groundLineY - groundY}
        fill="#bbf7d0"
        opacity={0.7}
      />
      {/* Right reserve area (green) */}
      <rect
        x={centreX + cw / 2 + sw}
        y={groundY}
        width={rw / 2 - cw / 2 - sw - (wlW > 0 ? wlW : 0)}
        height={groundLineY - groundY}
        fill="#bbf7d0"
        opacity={0.7}
      />

      {/* Left shoulder */}
      <rect
        x={centreX - cw / 2 - sw}
        y={groundY}
        width={sw}
        height={groundLineY - groundY}
        fill="#94a3b8"
        rx={1}
      />
      {/* Right shoulder */}
      <rect
        x={centreX + cw / 2}
        y={groundY}
        width={sw}
        height={groundLineY - groundY}
        fill="#94a3b8"
        rx={1}
      />

      {/* Carriageway */}
      <rect
        x={centreX - cw / 2}
        y={groundY}
        width={cw}
        height={groundLineY - groundY}
        fill="#64748b"
        rx={2}
      />

      {/* Centreline (dashed) */}
      <line
        x1={centreX}
        y1={groundY - 10}
        x2={centreX}
        y2={groundLineY + 5}
        stroke="#f59e0b"
        strokeWidth={2}
        strokeDasharray="6 4"
      />

      {/* Carriageway edge lines */}
      <line x1={centreX - cw / 2} y1={groundY} x2={centreX - cw / 2} y2={groundLineY} stroke="white" strokeWidth={2} />
      <line x1={centreX + cw / 2} y1={groundY} x2={centreX + cw / 2} y2={groundLineY} stroke="white" strokeWidth={2} />

      {/* Shoulder edge lines */}
      <line x1={centreX - cw / 2 - sw} y1={groundY} x2={centreX - cw / 2 - sw} y2={groundLineY} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 3" />
      <line x1={centreX + cw / 2 + sw} y1={groundY} x2={centreX + cw / 2 + sw} y2={groundLineY} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 3" />

      {/* Reserve boundary lines */}
      <line x1={centreX - rw / 2} y1={groundY - 5} x2={centreX - rw / 2} y2={groundLineY + 5} stroke="#16a34a" strokeWidth={2.5} />
      <line x1={centreX + rw / 2} y1={groundY - 5} x2={centreX + rw / 2} y2={groundLineY + 5} stroke="#16a34a" strokeWidth={2.5} />

      {/* Width dimension lines and labels */}
      {/* Reserve width — top */}
      <line x1={centreX - rw / 2} y1={groundY - 8} x2={centreX + rw / 2} y2={groundY - 8} stroke="#16a34a" strokeWidth={1} markerStart="url(#arrowStart)" markerEnd="url(#arrowEnd)" />
      <rect x={centreX - 35} y={groundY - 22} width={70} height={14} rx={2} fill="white" opacity={0.9} />
      <text x={centreX} y={groundY - 12} textAnchor="middle" className="text-[10px] font-semibold fill-green-700">
        Reserve {reserveWidth}m
      </text>

      {/* Carriageway — bottom */}
      <line x1={centreX - cw / 2} y1={groundLineY + 8} x2={centreX + cw / 2} y2={groundLineY + 8} stroke="#475569" strokeWidth={1} />
      <rect x={centreX - 40} y={groundLineY + 12} width={80} height={14} rx={2} fill="white" opacity={0.9} />
      <text x={centreX} y={groundLineY + 23} textAnchor="middle" className="text-[10px] font-medium fill-slate-600">
        Carriageway {carriagewayWidth}m
      </text>

      {/* Left shoulder label */}
      <text x={centreX - cw / 2 - sw / 2} y={groundY + (groundLineY - groundY) / 2 + 4} textAnchor="middle" className="text-[9px] fill-white font-medium">
        {shoulderWidth}m
      </text>
      {/* Right shoulder label */}
      <text x={centreX + cw / 2 + sw / 2} y={groundY + (groundLineY - groundY) / 2 + 4} textAnchor="middle" className="text-[9px] fill-white font-medium">
        {shoulderWidth}m
      </text>

      {/* Centreline label */}
      <text x={centreX} y={groundY - 2} textAnchor="middle" className="text-[8px] fill-amber-700 font-semibold">CL</text>

      {/* Legend */}
      <rect x={padding} y={svgHeight - 30} width={12} height={8} rx={1} fill="#bbf7d0" stroke="#16a34a" strokeWidth={0.5} />
      <text x={padding + 16} y={svgHeight - 23} className="text-[9px] fill-muted-foreground">Reserve</text>
      <rect x={padding + 65} y={svgHeight - 30} width={12} height={8} rx={1} fill="#94a3b8" />
      <text x={padding + 81} y={svgHeight - 23} className="text-[9px] fill-muted-foreground">Shoulder</text>
      <rect x={padding + 145} y={svgHeight - 30} width={12} height={8} rx={1} fill="#64748b" />
      <text x={padding + 161} y={svgHeight - 23} className="text-[9px] fill-muted-foreground">Carriageway</text>
      <line x1={padding + 235} y1={svgHeight - 26} x2={padding + 255} y2={svgHeight - 26} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" />
      <text x={padding + 259} y={svgHeight - 23} className="text-[9px] fill-muted-foreground">Centreline</text>
      {wlW > 0 && (
        <>
          <rect x={padding + 325} y={svgHeight - 30} width={12} height={8} rx={1} fill="#bae6fd" opacity={0.5} />
          <text x={padding + 341} y={svgHeight - 23} className="text-[9px] fill-muted-foreground">Wayleave</text>
        </>
      )}

      {/* Arrow markers */}
      <defs>
        <marker id="arrowStart" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
          <path d="M6 0 L0 3 L6 6" fill="none" stroke="#16a34a" strokeWidth={1} />
        </marker>
        <marker id="arrowEnd" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto">
          <path d="M0 0 L6 3 L0 6" fill="none" stroke="#16a34a" strokeWidth={1} />
        </marker>
      </defs>
    </svg>
  )
}

// ────────────────────────────────────────────────────────────
// Placeholder parcel list for future integration
// ────────────────────────────────────────────────────────────

interface PlaceholderParcel {
  id: string
  lrNo: string
  owner: string
  overlapPct: number
  hasBuilding: boolean
}

const PLACEHOLDER_PARCELS: PlaceholderParcel[] = [
  { id: '1', lrNo: 'LR 12345/456', owner: 'Kamau J.', overlapPct: 95, hasBuilding: true },
  { id: '2', lrNo: 'LR 12345/457', owner: 'Ochieng W.', overlapPct: 45, hasBuilding: false },
  { id: '3', lrNo: 'LR 12345/458', owner: 'Wanjiku M.', overlapPct: 12, hasBuilding: false },
  { id: '4', lrNo: 'LR 12345/459', owner: 'Kipruto D.', overlapPct: 62, hasBuilding: true },
  { id: '5', lrNo: 'LR 12345/460', owner: 'Hassan A.', overlapPct: 5, hasBuilding: false },
]

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────

export default function RoadReservePanel({
  roadClass,
  roadLength,
  existingRoadWidth: propExistingWidth,
}: RoadReservePanelProps) {
  // ── State ──
  const standards = ROAD_RESERVE_STANDARDS[roadClass]
  const reserveInfo = getRoadReserveWidth(roadClass)

  const [proposedWidth, setProposedWidth] = useState<string>(
    String(reserveInfo.standard),
  )
  const [roadLengthInput, setRoadLengthInput] = useState<string>(
    String(roadLength ?? 1000),
  )
  const [existingWidth, setExistingWidth] = useState<string>(
    String(propExistingWidth ?? 0),
  )
  const [wayleaveWidth, setWayleaveWidth] = useState<string>('3.0')
  const [showWayleave, setShowWayleave] = useState(true)

  // ── Computed values ──
  const proposedNum = parseFloat(proposedWidth) || 0
  const roadLengthNum = parseFloat(roadLengthInput) || 0
  const existingNum = parseFloat(existingWidth) || 0
  const wayleaveNum = parseFloat(wayleaveWidth) || 0

  const compliance = useMemo(
    () => checkRoadReserveCompliance(roadClass, proposedNum),
    [roadClass, proposedNum],
  )

  const acquisition = useMemo(
    () => estimateAcquisitionArea(roadLengthNum, proposedNum, existingNum),
    [roadLengthNum, proposedNum, existingNum],
  )

  const handleProposedWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      if (v === '' || /^\d*\.?\d*$/.test(v)) {
        setProposedWidth(v)
      }
    },
    [],
  )

  const handleLengthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      if (v === '' || /^\d*\.?\d*$/.test(v)) {
        setRoadLengthInput(v)
      }
    },
    [],
  )

  const handleExistingWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      if (v === '' || /^\d*\.?\d*$/.test(v)) {
        setExistingWidth(v)
      }
    },
    [],
  )

  const handleWayleaveChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      if (v === '' || /^\d*\.?\d*$/.test(v)) {
        setWayleaveWidth(v)
      }
    },
    [],
  )

  // ── Render ──
  if (!standards) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">
            Select a valid road class to view road reserve information.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* ────────────────────────────────────────────────── */}
      {/* Card 1: Road Reserve Standard                     */}
      {/* ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-primary" />
            <CardTitle>Road Reserve Standard</CardTitle>
          </div>
          <CardDescription>
            Class {roadClass} — {standards.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Minimum Reserve</p>
              <p className="text-lg font-bold">{standards.reserveWidthMin}m</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Standard Reserve</p>
              <p className="text-lg font-bold">{standards.reserveWidthStd}m</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Carriageway</p>
              <p className="text-lg font-bold">{standards.carriagewayStd}m</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-1">Shoulder</p>
              <p className="text-lg font-bold">{standards.shoulderStd}m</p>
            </div>
          </div>

          {/* Quick reference for all classes */}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              View all road classes
            </summary>
            <div className="mt-2 rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-1.5 font-medium">Class</th>
                    <th className="text-left px-3 py-1.5 font-medium">Description</th>
                    <th className="text-right px-3 py-1.5 font-medium">Min (m)</th>
                    <th className="text-right px-3 py-1.5 font-medium">Std (m)</th>
                    <th className="text-right px-3 py-1.5 font-medium">CW (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(ROAD_RESERVE_STANDARDS).map((s) => (
                    <tr
                      key={s.class}
                      className={
                        s.class === roadClass
                          ? 'bg-primary/5 font-semibold'
                          : 'border-t'
                      }
                    >
                      <td className="px-3 py-1.5">{s.class}</td>
                      <td className="px-3 py-1.5">{s.description}</td>
                      <td className="text-right px-3 py-1.5">{s.reserveWidthMin}</td>
                      <td className="text-right px-3 py-1.5">{s.reserveWidthStd}</td>
                      <td className="text-right px-3 py-1.5">{s.carriagewayStd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────── */}
      {/* Card 2: Compliance Check                          */}
      {/* ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <CardTitle>Reserve Width Compliance</CardTitle>
            </div>
            {compliance.compliant ? (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Compliant
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800">
                <XCircle className="h-3 w-3 mr-1" />
                Non-Compliant
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proposed-width">Proposed Reserve Width (m)</Label>
              <Input
                id="proposed-width"
                type="text"
                inputMode="decimal"
                value={proposedWidth}
                onChange={handleProposedWidthChange}
                placeholder={String(reserveInfo.standard)}
              />
              <p className="text-xs text-muted-foreground">
                Minimum required: <span className="font-semibold">{standards.reserveWidthMin}m</span>
                {' · '}Standard: <span className="font-semibold">{standards.reserveWidthStd}m</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Compliance Status</Label>
              <div className="h-9 flex items-center">
                {compliance.compliant ? (
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Meets minimum ({formatNumber(proposedNum)}m ≥ {standards.reserveWidthMin}m)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Deficit of {formatNumber(compliance.deficit)}m
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0m</span>
              <span>Min: {standards.reserveWidthMin}m</span>
              <span>Std: {standards.reserveWidthStd}m</span>
            </div>
            <div className="relative h-3 rounded-full bg-muted overflow-hidden">
              {/* Standard zone marker */}
              <div
                className="absolute top-0 h-full w-px bg-foreground/30 z-10"
                style={{
                  left: `${Math.min(100, (standards.reserveWidthStd / (standards.reserveWidthStd * 1.5)) * 100)}%`,
                }}
              />
              {/* Minimum zone marker */}
              <div
                className="absolute top-0 h-full w-px bg-destructive/50 z-10"
                style={{
                  left: `${Math.min(100, (standards.reserveWidthMin / (standards.reserveWidthStd * 1.5)) * 100)}%`,
                }}
              />
              {/* Fill */}
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  compliance.compliant ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.min(100, (proposedNum / (standards.reserveWidthStd * 1.5)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────── */}
      {/* Card 3: Cross-Section Diagram                     */}
      {/* ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            <CardTitle>Corridor Cross-Section</CardTitle>
          </div>
          <CardDescription>
            Visual representation of the road reserve, carriageway, and shoulders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CrossSectionDiagram
            reserveWidth={proposedNum || standards.reserveWidthStd}
            carriagewayWidth={standards.carriagewayStd}
            shoulderWidth={standards.shoulderStd}
            wayleaveWidth={showWayleave ? wayleaveNum : undefined}
          />
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────── */}
      {/* Card 4: Acquisition Estimate                      */}
      {/* ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LandPlot className="h-4 w-4 text-primary" />
            <CardTitle>Land Acquisition Estimate</CardTitle>
          </div>
          <CardDescription>
            Estimated area required for the road reserve corridor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="road-length">Road Length (m)</Label>
              <Input
                id="road-length"
                type="text"
                inputMode="decimal"
                value={roadLengthInput}
                onChange={handleLengthChange}
                placeholder="1000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="existing-width">Existing Road Width (m)</Label>
              <Input
                id="existing-width"
                type="text"
                inputMode="decimal"
                value={existingWidth}
                onChange={handleExistingWidthChange}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Width of existing carriageway + shoulders already acquired
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reserve Width</Label>
              <div className="h-9 flex items-center rounded-md border bg-muted/50 px-3">
                <span className="text-sm font-medium">{formatNumber(proposedNum)}m</span>
              </div>
            </div>
          </div>

          <Separator />

          {roadLengthNum > 0 && proposedNum > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Total Reserve Area</p>
                <p className="text-xl font-bold">{formatNumber(acquisition.totalReserveArea)}</p>
                <p className="text-xs text-muted-foreground">sqm</p>
              </div>
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">New Acquisition</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                  {formatNumber(acquisition.newAcquisitionArea)}
                </p>
                <p className="text-xs text-muted-foreground">sqm</p>
              </div>
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Total Acres</p>
                <p className="text-xl font-bold">{formatNumber(acquisition.totalAcres)}</p>
                <p className="text-xs text-muted-foreground">ac</p>
              </div>
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Total Hectares</p>
                <p className="text-xl font-bold">{formatNumber(acquisition.totalHectares)}</p>
                <p className="text-xs text-muted-foreground">ha</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Enter road length and reserve width to see acquisition estimates.
            </p>
          )}

          {existingNum > 0 && acquisition.newAcquisitionArea > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {formatNumber(acquisition.newAcquisitionArea)} sqm of new land acquisition required beyond the
                existing {formatNumber(existingNum)}m road width.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────── */}
      {/* Card 5: Property Impact Summary                   */}
      {/* ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle>Property Impact Assessment</CardTitle>
          </div>
          <CardDescription>
            Affected parcels and acquisition classification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">LR No.</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Owner</th>
                    <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground">Overlap</th>
                    <th className="text-center px-4 py-2.5 font-medium text-xs text-muted-foreground">Structure</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {PLACEHOLDER_PARCELS.map((parcel) => {
                    const acqType = determineAcquisitionType(parcel.overlapPct, parcel.hasBuilding)
                    const style = ACQUISITION_STYLES[acqType]
                    return (
                      <tr key={parcel.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs">{parcel.lrNo}</td>
                        <td className="px-4 py-2.5">{parcel.owner}</td>
                        <td className="text-right px-4 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={parcel.overlapPct} className="w-16 h-1.5" />
                            <span className="text-xs tabular-nums w-10 text-right">
                              {parcel.overlapPct}%
                            </span>
                          </div>
                        </td>
                        <td className="text-center px-4 py-2.5">
                          {parcel.hasBuilding ? (
                            <Building2 className="h-3.5 w-3.5 inline text-muted-foreground" />
                          ) : (
                            <LandPlot className="h-3.5 w-3.5 inline text-muted-foreground/50" />
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${style.bg} ${style.color}`}
                          >
                            {style.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {(
              Object.entries(ACQUISITION_STYLES) as [AcquisitionType, (typeof ACQUISITION_STYLES)[AcquisitionType]][]
            ).map(([key, style]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`h-2.5 w-2.5 rounded-sm border ${style.bg}`} />
                <span className="text-xs text-muted-foreground">{style.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">
            Parcel data is placeholder for future GIS integration.
          </p>
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────── */}
      {/* Card 6: Wayleave Section                          */}
      {/* ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <CardTitle>Wayleave / Utility Corridor</CardTitle>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input aria-label="Showwayleave"
                type="checkbox"
                checked={showWayleave}
                onChange={(e) => setShowWayleave(e.target.checked)}
                className="rounded border-input h-4 w-4"
              />
              <span className="text-xs text-muted-foreground">Show on diagram</span>
            </label>
          </div>
          <CardDescription>
            Utility wayleaves are accommodated within the road reserve corridor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wayleave-width">Wayleave Width (m)</Label>
              <Input
                id="wayleave-width"
                type="text"
                inputMode="decimal"
                value={wayleaveWidth}
                onChange={handleWayleaveChange}
                placeholder="3.0"
              />
            </div>
            <div className="space-y-2">
              <Label>Typical Wayleave Widths</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Water', width: 3 },
                  { label: 'Power', width: 4 },
                  { label: 'Fibre', width: 3 },
                  { label: 'Gas', width: 6 },
                  { label: 'Sewer', width: 5 },
                ].map((w) => (
                  <button
                    key={w.label}
                    type="button"
                    onClick={() => setWayleaveWidth(String(w.width))}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    {w.label}
                    <span className="text-muted-foreground">{w.width}m</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-3 flex items-start gap-2">
            <Zap className="h-4 w-4 text-sky-600 dark:text-sky-400 mt-0.5 shrink-0" />
            <div className="text-xs text-sky-800 dark:text-sky-200 space-y-1">
              <p>
                Wayleaves are utility easements within the road reserve. They do not require separate
                land acquisition but must be within the gazetted reserve width.
              </p>
              <p>
                Standard wayleave widths: 3–6m depending on utility type. Multiple utilities
                may share a common wayleave corridor.
              </p>
            </div>
          </div>

          {/* Wayleave vs reserve check */}
          {wayleaveNum > 0 && proposedNum > 0 && (
            <div className="text-xs">
              {wayleaveNum * 2 <= proposedNum ? (
                <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    Wayleave ({wayleaveNum}m × 2 = {formatNumber(wayleaveNum * 2)}m) fits within
                    reserve ({formatNumber(proposedNum)}m)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                  <XCircle className="h-3.5 w-3.5" />
                  <span>
                    Wayleave ({wayleaveNum}m × 2 = {formatNumber(wayleaveNum * 2)}m) exceeds reserve width ({formatNumber(proposedNum)}m).
                    Reserve may need widening.
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
