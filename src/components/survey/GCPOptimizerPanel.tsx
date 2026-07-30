'use client'

/**
 * GCPOptimizerPanel — Drone GCP planning and validation
 *
 * Features:
 * - Enter project area dimensions
 * - Auto-generate optimal GCP placement
 * - Validation checklist
 * - Export for Pix4D / WebODM
 * - Track GCP survey status
 */

import { useState, useCallback, useMemo } from 'react'
import {
  Drone, MapPin, CheckCircle2, AlertTriangle, Download,
  Plus, Loader2, Camera,
} from 'lucide-react'
import {
  generateGCPPlan,
  generateValidationChecklist,
  exportForPix4D,
  exportForWebODM,
  DEFAULT_UTM_ZONE,
  DEFAULT_HEMISPHERE,
  type GCPPlan,
  type GCPPoint,
} from '@/lib/engine/gcpOptimizer'

export function GCPOptimizerPanel() {
  const [areaHa, setAreaHa] = useState('')
  const [utmZone, setUtmZone] = useState<number>(DEFAULT_UTM_ZONE)
  const [hemisphere, setHemisphere] = useState<'N' | 'S'>(DEFAULT_HEMISPHERE)
  const [plan, setPlan] = useState<GCPPlan | null>(null)
  const [generating, setGenerating] = useState(false)

  const handleGenerate = useCallback(() => {
    const ha = parseFloat(areaHa)
    if (!isFinite(ha) || ha <= 0) return

    setGenerating(true)
    try {
      // Generate a simple rectangular boundary
      const sideM = Math.sqrt(ha * 10000)
      const boundary = [
        { easting: 0, northing: 0 },
        { easting: sideM, northing: 0 },
        { easting: sideM, northing: sideM },
        { easting: 0, northing: sideM },
      ]
      const newPlan = generateGCPPlan({ boundary, areaHa: ha })
      setPlan(newPlan)
    } finally {
      setGenerating(false)
    }
  }, [areaHa])

  const checklist = useMemo(() => {
    if (!plan) return []
    return generateValidationChecklist(plan)
  }, [plan])

  const handleExport = useCallback((format: 'pix4d' | 'webodm') => {
    if (!plan) return
    const csv = format === 'pix4d'
      ? exportForPix4D(plan.gcps, utmZone, hemisphere)
      : exportForWebODM(plan.gcps, utmZone, hemisphere)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gcp-export-${format}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [plan, utmZone, hemisphere])

  return (
    <div className="space-y-4">
      {/* Area input */}
      <div className="card p-4">
        <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1">Project Area (hectares)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            value={areaHa}
            onChange={e => setAreaHa(e.target.value)}
            aria-label="Project area in hectares" placeholder="10.5"
            className="flex-1 h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] font-mono"
          />
          <button
            onClick={handleGenerate}
            disabled={!areaHa || generating}
            className="flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold disabled:opacity-40"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Drone className="w-4 h-4" />}
            Plan GCPs
          </button>
        </div>
        {/* UTM zone + hemisphere for export correctness (P0-1) */}
        <div className="flex items-center gap-2 mt-2">
          <label className="text-[9px] text-gray-500 uppercase tracking-wider">UTM Zone</label>
          <input
            type="number"
            min={1}
            max={60}
            value={utmZone}
            onChange={e => {
              const z = parseInt(e.target.value, 10)
              if (z >= 1 && z <= 60) setUtmZone(z)
            }}
            aria-label="UTM zone (1 to 60)"
            className="w-16 h-7 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono text-center"
          />
          <div className="flex rounded-lg border border-[var(--border-color)] overflow-hidden">
            {(['N', 'S'] as const).map(h => (
              <button
                key={h}
                onClick={() => setHemisphere(h)}
                className={`px-3 h-7 text-xs font-mono ${hemisphere === h ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-gray-400'}`}
                aria-pressed={hemisphere === h}
                aria-label={`Hemisphere ${h === 'N' ? 'North' : 'South'}`}
              >
                {h}
              </button>
            ))}
          </div>
          <span className="text-[9px] text-gray-600">Used for Pix4D/WebODM WGS84 export</span>
        </div>
      </div>

      {/* Plan results */}
      {plan && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50 text-center">
              <div className="text-lg font-bold text-[var(--accent)]">{plan.totalGCPs}</div>
              <div className="text-[9px] text-gray-500 uppercase">GCPs</div>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50 text-center">
              <div className="text-lg font-bold text-emerald-400">±{plan.estimatedAccuracy}cm</div>
              <div className="text-[9px] text-gray-500 uppercase">Est. Accuracy</div>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]/50 text-center">
              <div className="text-lg font-bold text-gray-300">{plan.coveragePercent.toFixed(0)}%</div>
              <div className="text-[9px] text-gray-500 uppercase">Coverage</div>
            </div>
          </div>

          {/* GCP list */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--text-primary)]">GCP Placement</span>
              <div className="flex items-center gap-1">
                <button onClick={() => handleExport('pix4d')} className="flex items-center gap-1 px-2 h-7 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[10px] text-gray-400">
                  <Download className="w-3 h-3" /> Pix4D
                </button>
                <button onClick={() => handleExport('webodm')} className="flex items-center gap-1 px-2 h-7 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[10px] text-gray-400">
                  <Download className="w-3 h-3" /> WebODM
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {plan.gcps.map(gcp => (
                <div key={gcp.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02] border border-[var(--border-color)]">
                  <div className={`shrink-0 w-7 h-7 rounded flex items-center justify-center ${
                    gcp.status === 'validated' ? 'bg-emerald-500/10' :
                    gcp.status === 'surveyed' ? 'bg-blue-500/10' : 'bg-gray-500/10'
                  }`}>
                    <MapPin className={`w-3.5 h-3.5 ${
                      gcp.status === 'validated' ? 'text-emerald-400' :
                      gcp.status === 'surveyed' ? 'text-blue-400' : 'text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-[var(--text-primary)]">{gcp.name}</div>
                    <div className="text-[9px] text-gray-500 font-mono">E:{gcp.easting.toFixed(1)} N:{gcp.northing.toFixed(1)}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {gcp.rtkFixed && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    {gcp.photoCaptured && <Camera className="w-3 h-3 text-blue-400" />}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      gcp.status === 'validated' ? 'bg-emerald-500/10 text-emerald-400' :
                      gcp.status === 'surveyed' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-gray-500/10 text-gray-400'
                    }`}>{gcp.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Validation checklist */}
          <div className="card p-4">
            <span className="text-xs font-semibold text-[var(--text-primary)] mb-2 block">Field Validation Checklist</span>
            <div className="space-y-1.5">
              {checklist.map((item, i) => (
                <div key={`${item}-${i}`} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
                  {item.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <span className={`flex-1 text-xs ${item.completed ? 'text-emerald-400' : 'text-gray-400'}`}>{item.item}</span>
                  <span className="text-[9px] text-gray-500">{item.gcpsCompleted}/{item.totalGCPs}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
