'use client'

import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  reduceGroundToGrid,
  ELLIPSOIDS,
  type GeodeticReductionOutput,
} from '@/lib/engine/geodeticReduction'
import { buildPrintDocument, openPrint } from '@/lib/print/buildPrintDocument'
import { Calculator, Globe, Printer } from 'lucide-react'

export default function GeodeticReductionPage() {
  const [groundDist, setGroundDist] = useState<string>('1250.450')
  const [ellipsoid, setEllipsoid] = useState<'clarke1880_modified' | 'clarke1858' | 'wgs84'>('clarke1880_modified')

  // Station 1
  const [e1, setE1] = useState<string>('254120.500')
  const [n1, setN1] = useState<string>('9860340.200')
  const [h1, setH1] = useState<string>('1680.00')
  const [nUndulation1, setNUndulation1] = useState<string>('-16.20')

  // Station 2
  const [e2, setE2] = useState<string>('255140.800')
  const [n2, setN2] = useState<string>('9861120.600')
  const [h2, setH2] = useState<string>('1710.50')
  const [nUndulation2, setNUndulation2] = useState<string>('-16.20')

  const [result, setResult] = useState<GeodeticReductionOutput | null>(null)
  const [error, setError] = useState<string>('')

  const handleCalculate = useCallback(() => {
    setError('')
    try {
      const s = parseFloat(groundDist)
      const easting1 = parseFloat(e1)
      const northing1 = parseFloat(n1)
      const elev1 = parseFloat(h1)
      const und1 = parseFloat(nUndulation1) || -16.2

      const easting2 = parseFloat(e2)
      const northing2 = parseFloat(n2)
      const elev2 = parseFloat(h2)
      const und2 = parseFloat(nUndulation2) || -16.2

      if (isNaN(s) || s <= 0) {
        setError('Please enter a valid positive ground distance.')
        return
      }

      if ([easting1, northing1, elev1, easting2, northing2, elev2].some(isNaN)) {
        setError('Please fill in all coordinates and elevation values.')
        return
      }

      const res = reduceGroundToGrid({
        groundDistance: s,
        fromPoint: {
          easting: easting1,
          northing: northing1,
          elevation: elev1,
          geoidUndulation: und1,
        },
        toPoint: {
          easting: easting2,
          northing: northing2,
          elevation: elev2,
          geoidUndulation: und2,
        },
        ellipsoid,
      })

      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation error')
    }
  }, [groundDist, e1, n1, h1, nUndulation1, e2, n2, h2, nUndulation2, ellipsoid])

  const handlePrint = () => {
    if (!result) return

    const stepsHtml = result.calculationSteps.map(step => `<li>${step}</li>`).join('')

    const bodyHtml = `
      <h2>Geodetic Reduction Computation Sheet</h2>
      <p><strong>Ellipsoid:</strong> ${ELLIPSOIDS[ellipsoid].name}</p>
      
      <table>
        <tr>
          <th>Parameter</th>
          <th class="right">Value</th>
          <th>Unit / Description</th>
        </tr>
        <tr>
          <td>Measured Ground Distance (S₀)</td>
          <td class="right mono">${result.groundDistance.toFixed(4)}</td>
          <td>metres (horizontal EDM)</td>
        </tr>
        <tr>
          <td>Mean Elevation (H)</td>
          <td class="right mono">${result.meanElevation.toFixed(3)}</td>
          <td>metres (Orthometric MSL)</td>
        </tr>
        <tr>
          <td>Mean Geoid Undulation (N)</td>
          <td class="right mono">${result.meanGeoidUndulation.toFixed(3)}</td>
          <td>metres (EGM2008)</td>
        </tr>
        <tr>
          <td>Ellipsoidal Height (h = H + N)</td>
          <td class="right mono">${result.ellipsoidalHeight.toFixed(3)}</td>
          <td>metres</td>
        </tr>
        <tr>
          <td>Mean Earth Radius of Curvature (R_m)</td>
          <td class="right mono">${result.meanRadiusOfCurvature.toFixed(1)}</td>
          <td>metres</td>
        </tr>
        <tr>
          <td><strong>Elevation / Sea Level Factor</strong></td>
          <td class="right mono font-bold">${result.elevationFactor.toFixed(8)}</td>
          <td>R_m / (R_m + h)</td>
        </tr>
        <tr>
          <td>Ellipsoidal Distance (S_ell)</td>
          <td class="right mono">${result.ellipsoidalDistance.toFixed(4)}</td>
          <td>metres</td>
        </tr>
        <tr>
          <td><strong>UTM Point Scale Factor (k)</strong></td>
          <td class="right mono font-bold">${result.gridPointScaleFactor.toFixed(8)}</td>
          <td>Point projection factor</td>
        </tr>
        <tr>
          <td><strong>Combined Scale Factor (CSF)</strong></td>
          <td class="right mono font-bold">${result.combinedScaleFactor.toFixed(8)}</td>
          <td>Elevation Factor × k</td>
        </tr>
        <tr style="background: #f0fdf4;">
          <td><strong>Final Projected Grid Distance (S_grid)</strong></td>
          <td class="right mono font-bold">${result.gridDistance.toFixed(4)}</td>
          <td>metres in Arc 1960 UTM</td>
        </tr>
        <tr>
          <td>Ground - Grid Difference</td>
          <td class="right mono">${(result.groundToGridDifference * 1000).toFixed(1)}</td>
          <td>millimetres</td>
        </tr>
        <tr>
          <td>Arc-to-Chord (t - T) Correction</td>
          <td class="right mono">${result.arcToChordCorrectionSeconds.toFixed(2)}</td>
          <td>arcseconds</td>
        </tr>
        <tr>
          <td>Meridian Grid Convergence (γ)</td>
          <td class="right mono">${result.gridConvergenceDMS}</td>
          <td>degrees/min/sec</td>
        </tr>
      </table>

      <h3>Step-by-Step Working & Mathematical Audit</h3>
      <ol style="font-family: monospace; font-size: 11px; line-height: 1.6;">
        ${stepsHtml}
      </ol>
    `

    const doc = buildPrintDocument(bodyHtml, {
      title: 'Geodetic Reduction Sheet — Survey of Kenya Standard',
      reference: 'Survey Regulations LN 168/1994 | RDM 1.1 Topographic Standards',
    })
    openPrint(doc)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
      <PageHeader
        title="Physical Geodetic Reduction"
        subtitle="3-step physical geodesy reduction: Slope to Sea Level (Orthometric H + Geoid N) to UTM Grid distance. Computes Combined Scale Factor (CSF), Arc-to-Chord (t-T), and Meridian Convergence."
        reference="Survey Regulations 1994 Reg 24/60 | Clarke 1880 / WGS84"
        badge="Geodesy"
      />

      {error && (
        <div className="mb-4 p-3 border border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_5%,transparent)] rounded-md text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Input Column */}
        <div className="lg:col-span-6 space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4 text-[var(--text-primary)] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--accent)]" /> Reference Datum & Ellipsoid
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="gr-ellipsoid" className="block text-xs text-[var(--text-muted)] mb-1">Ellipsoid Model</label>
                <select
                  id="gr-ellipsoid"
                  value={ellipsoid}
                  onChange={(e) => setEllipsoid(e.target.value as any)}
                  className="input text-xs w-full py-1.5"
                >
                  <option value="clarke1880_modified">Clarke 1880 (Modified) — Arc 1960 (Kenya Cadastre)</option>
                  <option value="wgs84">WGS 84 / GRS 80 (Global GNSS)</option>
                  <option value="clarke1858">Clarke 1858 — Cassini-Soldner (Colonial)</option>
                </select>
              </div>

              <div>
                <label htmlFor="gr-ground-dist" className="block text-xs text-[var(--text-muted)] mb-1">Measured Horizontal Ground Distance (m)</label>
                <input
                  id="gr-ground-dist"
                  type="number"
                  step="0.001"
                  value={groundDist}
                  onChange={(e) => setGroundDist(e.target.value)}
                  className="input font-mono text-sm w-full py-1.5"
                  placeholder="1250.450"
                />
              </div>
            </div>
          </div>

          {/* Station Coordinates */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Station 1 (Instrument Station)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="gr-st1-e" className="text-[11px] text-[var(--text-muted)]">Easting (m)</label>
                <input
                  id="gr-st1-e"
                  type="number"
                  step="0.001"
                  value={e1}
                  onChange={(e) => setE1(e.target.value)}
                  className="input font-mono text-xs w-full py-1"
                />
              </div>
              <div>
                <label htmlFor="gr-st1-n" className="text-[11px] text-[var(--text-muted)]">Northing (m)</label>
                <input
                  id="gr-st1-n"
                  type="number"
                  step="0.001"
                  value={n1}
                  onChange={(e) => setN1(e.target.value)}
                  className="input font-mono text-xs w-full py-1"
                />
              </div>
              <div>
                <label htmlFor="gr-st1-h" className="text-[11px] text-[var(--text-muted)]">Elevation H (m)</label>
                <input
                  id="gr-st1-h"
                  type="number"
                  step="0.01"
                  value={h1}
                  onChange={(e) => setH1(e.target.value)}
                  className="input font-mono text-xs w-full py-1"
                />
              </div>
              <div>
                <label htmlFor="gr-st1-und" className="text-[11px] text-[var(--text-muted)]">Geoid Undulation N (m)</label>
                <input
                  id="gr-st1-und"
                  type="number"
                  step="0.01"
                  value={nUndulation1}
                  onChange={(e) => setNUndulation1(e.target.value)}
                  className="input font-mono text-xs w-full py-1"
                />
              </div>
            </div>

            <hr className="border-[var(--border-color)] my-2" />

            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Station 2 (Target Station)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="gr-st2-e" className="text-[11px] text-[var(--text-muted)]">Easting (m)</label>
                <input
                  id="gr-st2-e"
                  type="number"
                  step="0.001"
                  value={e2}
                  onChange={(e) => setE2(e.target.value)}
                  className="input font-mono text-xs w-full py-1"
                />
              </div>
              <div>
                <label htmlFor="gr-st2-n" className="text-[11px] text-[var(--text-muted)]">Northing (m)</label>
                <input
                  id="gr-st2-n"
                  type="number"
                  step="0.001"
                  value={n2}
                  onChange={(e) => setN2(e.target.value)}
                  className="input font-mono text-xs w-full py-1"
                />
              </div>
              <div>
                <label htmlFor="gr-st2-h" className="text-[11px] text-[var(--text-muted)]">Elevation H (m)</label>
                <input
                  id="gr-st2-h"
                  type="number"
                  step="0.01"
                  value={h2}
                  onChange={(e) => setH2(e.target.value)}
                  className="input font-mono text-xs w-full py-1"
                />
              </div>
              <div>
                <label htmlFor="gr-st2-und" className="text-[11px] text-[var(--text-muted)]">Geoid Undulation N (m)</label>
                <input
                  id="gr-st2-und"
                  type="number"
                  step="0.01"
                  value={nUndulation2}
                  onChange={(e) => setNUndulation2(e.target.value)}
                  className="input font-mono text-xs w-full py-1"
                />
              </div>
            </div>

            <button
              onClick={handleCalculate}
              className="w-full py-2.5 bg-[var(--accent)] text-[var(--bg-primary)] font-bold text-sm rounded-lg hover:bg-[var(--accent-dim)] transition-colors flex items-center justify-center gap-2 mt-4 shadow-sm"
            >
              <Calculator className="w-4 h-4" /> Compute Geodetic Reduction
            </button>
          </div>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-6 space-y-4">
          {result ? (
            <div className="card p-5 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
                <h3 className="text-base font-bold text-[var(--text-primary)]">Reduction Results</h3>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-xs font-semibold hover:border-[var(--accent)] text-[var(--text-primary)] flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-[var(--accent)]" /> Export Print Sheet
                </button>
              </div>

              {/* Main Key Readouts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
                  <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Final Grid Distance</div>
                  <div className="text-xl font-mono font-bold text-[var(--accent)] mt-1">
                    {result.gridDistance.toFixed(4)} m
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    Diff: {(result.groundToGridDifference * 1000).toFixed(1)} mm
                  </div>
                </div>

                <div className="p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
                  <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">Combined Scale Factor (CSF)</div>
                  <div className="text-xl font-mono font-bold text-[var(--text-primary)] mt-1">
                    {result.combinedScaleFactor.toFixed(8)}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    Elev × UTM Point Scale
                  </div>
                </div>
              </div>

              {/* Reduction Breakdown Table */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)]">Elevation Factor [R_m / (R_m + h)]:</span>
                  <span className="font-mono font-semibold">{result.elevationFactor.toFixed(8)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)]">Ellipsoidal Distance (S_ell):</span>
                  <span className="font-mono font-semibold">{result.ellipsoidalDistance.toFixed(4)} m</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)]">UTM Point Scale Factor (k):</span>
                  <span className="font-mono font-semibold">{result.gridPointScaleFactor.toFixed(8)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)]">Arc-to-Chord (t - T) Correction:</span>
                  <span className="font-mono font-semibold">{result.arcToChordCorrectionSeconds.toFixed(2)}"</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)]">Meridian Grid Convergence (γ):</span>
                  <span className="font-mono font-semibold">{result.gridConvergenceDMS}</span>
                </div>
              </div>

              {/* Step by step computation audit */}
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2">Mathematical Reduction Steps</h4>
                <div className="p-3 bg-[var(--bg-tertiary)] rounded border border-[var(--border-color)] font-mono text-[11px] text-[var(--text-secondary)] space-y-1 max-h-48 overflow-y-auto">
                  {result.calculationSteps.map((step, idx) => (
                    <div key={idx}>{step}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-10 flex flex-col items-center justify-center text-center text-[var(--text-muted)] space-y-3 min-h-[350px]">
              <Globe className="w-10 h-10 text-[var(--accent)] opacity-50" />
              <p className="text-sm">Enter ground distance and station coordinates to compute full geodetic reduction.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
