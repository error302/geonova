'use client'

/**
 * IdentifyPanel — Click any map feature to see all properties
 *
 * Inspired by QGIS Identify Tool. Shows:
 * - Feature type and status badge
 * - Owner information
 * - Geometry details (area, perimeter, centroid)
 * - Beacon list
 * - Action buttons (edit, copy, delete, zoom to)
 *
 * Slides in from the right when a feature is clicked.
 */

import { useState, useCallback } from 'react'
import {
  X, MapPin, User, Ruler, Navigation, Copy,
  Edit3, Trash2, ZoomIn, Building2,
  CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react'

export interface IdentifiedFeature {
  id: string
  type: 'parcel' | 'beacon' | 'line' | 'point'
  parcelNumber?: string
  ownerName?: string
  ownerId?: string
  ownerPhone?: string
  lrNumber?: string
  status?: 'registered' | 'pending' | 'disputed' | 'cancelled'
  areaHa?: number
  perimeterM?: number
  vertexCount?: number
  centroidE?: number
  centroidN?: number
  easting?: number
  northing?: number
  beaconNumber?: string
  beaconType?: string
  beacons?: Array<{
    beaconNumber: string
    easting: number
    northing: number
  }>
}

interface IdentifyPanelProps {
  feature: IdentifiedFeature | null
  onClose: () => void
  onEdit?: (feature: IdentifiedFeature) => void
  onDelete?: (feature: IdentifiedFeature) => void
  onZoomTo?: (feature: IdentifiedFeature) => void
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  registered: { color: 'text-[var(--success)]', bg: 'bg-[var(--success)]/10 border-emerald-500/30', icon: CheckCircle2 },
  pending: { color: 'text-[var(--warning)]', bg: 'bg-[var(--warning)]/10 border-amber-500/30', icon: Clock },
  disputed: { color: 'text-[var(--error)]', bg: 'bg-[var(--error)]/10 border-red-500/30', icon: AlertTriangle },
  cancelled: { color: 'text-[var(--text-secondary)]', bg: 'bg-[var(--bg-tertiary)]/10 border-[var(--border-hover)]/30', icon: X },
}

const TYPE_ICONS: Record<string, typeof MapPin> = {
  parcel: Building2,
  beacon: MapPin,
  line: Navigation,
  point: MapPin,
}

export function IdentifyPanel({ feature, onClose, onEdit, onDelete, onZoomTo }: IdentifyPanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    if (!feature) return
    const text = feature.parcelNumber
      ? `${feature.parcelNumber} | ${feature.ownerName || 'Unknown'} | ${feature.areaHa?.toFixed(4) || 0} ha`
      : `${feature.beaconNumber || 'Feature'} | E:${feature.easting?.toFixed(3)} N:${feature.northing?.toFixed(3)}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [feature])

  if (!feature) return null

  const TypeIcon = TYPE_ICONS[feature.type] || MapPin
  const statusCfg = feature.status ? STATUS_CONFIG[feature.status] : null
  const StatusIcon = statusCfg?.icon

  return (
    <div className="absolute top-[280px] right-3 z-30 w-80 max-h-[calc(100%-320px)] bg-[var(--bg-secondary)]/95 backdrop-blur-2xl border border-[var(--border-color)]/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]/[0.06] bg-gradient-to-r from-[#D17B47]/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <TypeIcon className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">Identify</span>
            <p className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider">{feature.type}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]/[0.06] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title + status */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {feature.parcelNumber || feature.beaconNumber || 'Feature'}
            </h3>
            {feature.lrNumber && (
              <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{feature.lrNumber}</p>
            )}
          </div>
          {statusCfg && StatusIcon && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border ${statusCfg.bg} ${statusCfg.color}`}>
              <StatusIcon className="w-3 h-3" />
              {feature.status?.toUpperCase()}
            </span>
          )}
        </div>

        {/* Owner information */}
        {feature.ownerName && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
              <User className="w-3 h-3" />
              Owner Information
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--bg-card)]/[0.02] border border-[var(--border-color)]/[0.06] space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Name</span>
                <span className="text-[var(--text-primary)] font-medium">{feature.ownerName}</span>
              </div>
              {feature.ownerId && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">ID</span>
                  <span className="text-[var(--text-secondary)] font-mono">{feature.ownerId}</span>
                </div>
              )}
              {feature.ownerPhone && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Phone</span>
                  <span className="text-[var(--text-secondary)] font-mono">{feature.ownerPhone}</span>
                </div>
              )}
              {feature.lrNumber && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Title</span>
                  <span className="text-[var(--text-secondary)] font-mono">{feature.lrNumber}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Geometry */}
        {(feature.areaHa != null || feature.easting != null) && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
              <Ruler className="w-3 h-3" />
              Geometry
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--bg-card)]/[0.02] border border-[var(--border-color)]/[0.06] space-y-1">
              {feature.areaHa != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Area</span>
                  <span className="text-[var(--text-primary)] font-mono">{feature.areaHa.toFixed(4)} ha</span>
                </div>
              )}
              {feature.perimeterM != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Perimeter</span>
                  <span className="text-[var(--text-secondary)] font-mono">{feature.perimeterM.toFixed(3)} m</span>
                </div>
              )}
              {feature.vertexCount != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Vertices</span>
                  <span className="text-[var(--text-secondary)]">{feature.vertexCount}</span>
                </div>
              )}
              {feature.centroidE != null && feature.centroidN != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Centroid</span>
                  <span className="text-[var(--text-secondary)] font-mono text-[10px]">
                    E:{feature.centroidE.toFixed(3)} N:{feature.centroidN.toFixed(3)}
                  </span>
                </div>
              )}
              {feature.easting != null && feature.northing != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Coordinate</span>
                  <span className="text-[var(--text-secondary)] font-mono text-[10px]">
                    E:{feature.easting.toFixed(3)} N:{feature.northing.toFixed(3)}
                  </span>
                </div>
              )}
              {feature.beaconType && (
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Type</span>
                  <span className="text-[var(--text-secondary)] capitalize">{feature.beaconType.replace('_', ' ')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Beacons list */}
        {feature.beacons && feature.beacons.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
              <MapPin className="w-3 h-3" />
              Beacons ({feature.beacons.length})
            </div>
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
              {feature.beacons.map((beacon, i) => (
                <div
                  key={`${beacon}-${i}`}
                  className="flex items-center gap-2 p-1.5 rounded-lg bg-[var(--bg-card)]/[0.02] border border-[var(--border-color)]/[0.04] hover:bg-[var(--bg-card)]/[0.04] transition-colors cursor-pointer"
                >
                  <div className="w-5 h-5 rounded bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-2.5 h-2.5 text-[var(--accent)]" />
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-secondary)] flex-1 truncate">{beacon.beaconNumber}</span>
                  <span className="text-[9px] text-[var(--text-muted)] font-mono">
                    {beacon.easting.toFixed(1)}, {beacon.northing.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-[var(--border-color)]/[0.06] flex items-center gap-1.5">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-[var(--bg-card)]/[0.04] border border-[var(--border-color)]/[0.06] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.08] transition-colors"
        >
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        {onZoomTo && (
          <button
            onClick={() => onZoomTo(feature)}
            className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-[var(--bg-card)]/[0.04] border border-[var(--border-color)]/[0.06] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)]/[0.08] transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            Zoom
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => onEdit(feature)}
            className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(feature)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--error)]/5 border border-red-500/20 text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
