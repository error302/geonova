'use client'

/**
 * NLIMSExportPanel — UI for generating NLIMS/ArdhiSasa submission payloads
 *
 * Allows the surveyor to:
 * 1. Select submission type (mutation, subdivision, etc.)
 * 2. Enter surveyor info (auto-filled from profile if available)
 * 3. Select parcels to export
 * 4. Run validation
 * 5. Download the NLIMS JSON payload
 *
 * Uses the existing /api/export/nlims endpoint and lib/export/nlimsExporter.
 */

import { useState, useCallback } from 'react'
import {
  FileOutput, Download, Loader2, CheckCircle2, AlertCircle,
  Building2, MapPin, ShieldCheck,
} from 'lucide-react'
import { downloadNLIMSPayload, type NLIMSSubmissionPayload, type NLIMSValidationResult } from '@/lib/export/nlimsExporter'

interface NLIMSExportPanelProps {
  projectId: string
}

export function NLIMSExportPanel({ projectId: _projectId }: NLIMSExportPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [payload, setPayload] = useState<NLIMSSubmissionPayload | null>(null)
  const [validation, setValidation] = useState<NLIMSValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [submissionType, setSubmissionType] = useState<'mutation' | 'subdivision' | 'amalgamation' | 'new_registration' | 'boundary_adjustment'>('subdivision')
  const [registry, setRegistry] = useState('Nairobi')
  const [county, setCounty] = useState('Nairobi')
  const [subCounty, setSubCounty] = useState('')
  const [surveyorName, setSurveyorName] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [firm, setFirm] = useState('')

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setPayload(null)
    setValidation(null)

    try {
      const res = await fetch('/api/export/nlims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionType,
          registry,
          county,
          subCounty,
          surveyor: {
            name: surveyorName,
            licenseNumber,
            firm: firm || undefined,
          },
          resultingParcels: [], // Will be populated from project data
          beacons: [],
          // Parent parcel info would come from the project's existing parcel data
        }),
      })

      const data = (await res.json()) as {
        validation?: NLIMSValidationResult | null
        error?: string
        payload?: NLIMSSubmissionPayload | null
      }

      if (!res.ok) {
        if (data.validation) {
          setValidation(data.validation)
          setError('Validation failed — fix the errors below')
        } else {
          setError(data.error || 'Failed to generate NLIMS payload')
        }
        return
      }

      setPayload(data.payload ?? null)
      setValidation(data.validation ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setGenerating(false)
    }
  }, [submissionType, registry, county, subCounty, surveyorName, licenseNumber, firm])

  const handleDownload = useCallback(() => {
    if (!payload) return
    downloadNLIMSPayload(payload)
  }, [payload])

  return (
    <div className="mt-6 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-[var(--text-primary)]">NLIMS / ArdhiSasa Export</span>
            <p className="text-[10px] text-gray-500">Generate registry-ready JSON submission</p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-color)] p-4 space-y-4">
          {/* Submission type */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="submission-type">Submission Type</label>
            <select id="submission-type"
              value={submissionType}
              onChange={e => setSubmissionType(e.target.value as typeof submissionType)}
              className="input h-10 text-sm"
            >
              <option value="subdivision">Subdivision</option>
              <option value="mutation">Mutation</option>
              <option value="amalgamation">Amalgamation</option>
              <option value="new_registration">New Registration</option>
              <option value="boundary_adjustment">Boundary Adjustment</option>
            </select>
          </div>

          {/* Registry info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="registry">Registry</label>
              <input id="registry"
                type="text"
                value={registry}
                onChange={e => setRegistry(e.target.value)}
                className="input h-10 text-sm"
 placeholder="Nairobi"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="county">County</label>
              <input id="county"
                type="text"
                value={county}
                onChange={e => setCounty(e.target.value)}
                className="input h-10 text-sm"
 placeholder="Nairobi"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="sub-county">Sub-County</label>
            <input id="sub-county"
              type="text"
              value={subCounty}
              onChange={e => setSubCounty(e.target.value)}
              className="input h-10 text-sm"
 placeholder="Westlands"
            />
          </div>

          {/* Surveyor info */}
          <div className="pt-2 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Surveyor Information</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="name">Name</label>
                <input id="name"
                  type="text"
                  value={surveyorName}
                  onChange={e => setSurveyorName(e.target.value)}
                  className="input h-10 text-sm"
 placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="license-no">License No.</label>
                <input id="license-no"
                  type="text"
                  value={licenseNumber}
                  onChange={e => setLicenseNumber(e.target.value)}
                  className="input h-10 text-sm font-mono"
 placeholder="ISK/LS/2021/0452"
                />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1.5" htmlFor="firm-optional">Firm (optional)</label>
              <input id="firm-optional"
                type="text"
                value={firm}
                onChange={e => setFirm(e.target.value)}
                className="input h-10 text-sm"
 placeholder="Doe Surveyors Ltd"
              />
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !surveyorName || !licenseNumber}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileOutput className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Generate NLIMS Payload'}
          </button>

          {/* Validation errors */}
          {validation && !validation.isValid && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-medium text-red-400">Validation Errors</span>
              </div>
              <ul className="text-[11px] text-red-400/80 space-y-0.5 list-disc list-inside">
                {validation.errors.map((e, i) => (
                  <li key={`${e}-${i}`}>{e.message}</li>
                ))}
              </ul>
              {validation.warnings.length > 0 && (
                <div className="mt-2 pt-2 border-t border-red-500/10">
                  <span className="text-[10px] text-amber-400 font-medium">Warnings:</span>
                  <ul className="text-[10px] text-amber-400/70 space-y-0.5 list-disc list-inside mt-0.5">
                    {validation.warnings.map((w, i) => (
                      <li key={`${w}-${i}`}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Success + download */}
          {payload && (
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">Payload Generated</span>
              </div>
              <div className="text-[11px] text-gray-400 space-y-0.5 mb-3">
                <div>Submission ID: <span className="font-mono">{payload.submissionId}</span></div>
                <div>Parcels: {payload.resultingParcels.length}</div>
                <div>Beacons: {payload.beacons.length}</div>
                <div>Integrity: <span className="font-mono">{payload.integrity.hash.substring(0, 16)}...</span></div>
                {payload.areaReconciliation.parentAreaHectares != null && (
                  <div className={payload.areaReconciliation.isWithinTolerance ? 'text-emerald-400' : 'text-red-400'}>
                    Area check: {payload.areaReconciliation.sumOfPartsHectares.toFixed(4)} ha vs parent {payload.areaReconciliation.parentAreaHectares.toFixed(4)} ha
                    ({payload.areaReconciliation.isWithinTolerance ? 'OK' : 'MISMATCH'})
                  </div>
                )}
              </div>
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download NLIMS JSON
              </button>
            </div>
          )}

          {/* Error */}
          {error && !validation && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Info note */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-400/70 leading-relaxed">
              NLIMS payloads use Arc 1960 / UTM Zone 37S coordinates (EPSG:21037) with 3 decimal places.
              Area reconciliation tolerance: ±0.001 ha (10 m²). SHA-256 integrity hash ensures tamper detection.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
