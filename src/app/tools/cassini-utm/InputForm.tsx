'use client'

// Input form — left panel of the Cassini ↔ UTM converter.
//
// Contains: direction toggle, topo sheet selector card (with sub-sheet
// dropdown, sub-sheet grid picker, transform method selector, sheet
// parameter display, common-points verification, user calibration,
// transformation details), input mode toggle, single-point input, and
// batch CSV input.
//
// Extracted from src/app/tools/cassini-utm/page.tsx.

import type { RefObject } from 'react'
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  MapPin,
  Settings2,
  Calculator,
  Crosshair,
  Upload,
} from 'lucide-react'
import {
  KENYA_TOPO_SHEETS,
  CLARKE_1858_A_FT,
  CLARKE_1880_A_M,
} from '@/lib/geo/cassini'
import type {
  SubSheetDef,
  TopoSheetParams,
  TransformMethod,
  VerificationResult,
} from '@/lib/geo/cassini'
import { SubSheetGridPicker } from './SubSheetInspector'
import { CommonPointsVerification, CalibrationResidualsTable } from './VerificationTable'

interface InputFormProps {
  // direction
  direction: 'cassini-to-utm' | 'utm-to-cassini'
  handleDirectionChange: (dir: 'cassini-to-utm' | 'utm-to-cassini') => void
  // sheet search & selection
  sheetSearch: string
  setSheetSearch: (v: string) => void
  filteredSheets: typeof KENYA_TOPO_SHEETS
  selectedSheetId: string
  setSelectedSheetId: (v: string) => void
  useCustomParams: boolean
  setUseCustomParams: (v: boolean) => void
  // sub-sheet
  selectedSubSheetId: string
  setSelectedSubSheetId: (v: string) => void
  setDetectedSubSheet: (v: undefined) => void
  detectedSubSheet?: SubSheetDef
  activeSubSheet?: SubSheetDef
  availableSubSheets: { subId: string; fullId: string; bounds: { minX: number; minY: number }; corners: unknown[] }[]
  hasSubSheets: boolean
  // transform method
  transformMethod: TransformMethod | 'auto'
  setTransformMethod: (v: TransformMethod | 'auto') => void
  // custom params
  customP: string
  setCustomP: (v: string) => void
  customQ: string
  setCustomQ: (v: string) => void
  customCx: string
  setCustomCx: (v: string) => void
  customCy: string
  setCustomCy: (v: string) => void
  // params collapsible
  paramsOpen: boolean
  setParamsOpen: (v: boolean) => void
  // active sheet
  activeSheet: TopoSheetParams
  // verification
  showVerification: boolean
  setShowVerification: (v: boolean) => void
  verificationResults: VerificationResult[]
  // calibration
  calibrationOpen: boolean
  setCalibrationOpen: (v: boolean) => void
  calibrationCsv: string
  setCalibrationCsv: (v: string) => void
  calibrationResult: TopoSheetParams | null
  calibrationErrors: string[]
  calibrationResiduals: VerificationResult[]
  handleCalibrate: () => void
  handleUseCalibrationParams: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  // input mode
  inputMode: 'single' | 'batch'
  setInputMode: (v: 'single' | 'batch') => void
  setBatchResults: (v: never[]) => void
  setBatchErrors: (v: never[]) => void
  setSingleResult: (v: null) => void
  // single point
  singleE: string
  setSingleE: (v: string) => void
  singleN: string
  setSingleN: (v: string) => void
  handleSingleConvert: () => void
  // batch
  batchText: string
  setBatchText: (v: string) => void
  handleBatchConvert: () => void
  handleLoadExample: () => void
}

export function InputForm(props: InputFormProps) {
  const {
    direction,
    handleDirectionChange,
    sheetSearch,
    setSheetSearch,
    filteredSheets,
    selectedSheetId,
    setSelectedSheetId,
    useCustomParams,
    setUseCustomParams,
    selectedSubSheetId,
    setSelectedSubSheetId,
    setDetectedSubSheet,
    detectedSubSheet,
    activeSubSheet,
    availableSubSheets,
    hasSubSheets,
    transformMethod,
    setTransformMethod,
    customP,
    setCustomP,
    customQ,
    setCustomQ,
    customCx,
    setCustomCx,
    customCy,
    setCustomCy,
    paramsOpen,
    setParamsOpen,
    activeSheet,
    showVerification,
    setShowVerification,
    verificationResults,
    calibrationOpen,
    setCalibrationOpen,
    calibrationCsv,
    setCalibrationCsv,
    calibrationResult,
    calibrationErrors,
    calibrationResiduals,
    handleCalibrate,
    handleUseCalibrationParams,
    fileInputRef,
    inputMode,
    setInputMode,
    setBatchResults,
    setBatchErrors,
    setSingleResult,
    singleE,
    setSingleE,
    singleN,
    setSingleN,
    handleSingleConvert,
    batchText,
    setBatchText,
    handleBatchConvert,
    handleLoadExample,
  } = props

  return (
    <div className="space-y-6">
      {/* ── 1. Direction Toggle ── */}
      <div className="flex gap-2">
        <button
          onClick={() => handleDirectionChange('cassini-to-utm')}
          className={`btn flex-1 ${direction === 'cassini-to-utm' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Cassini (ft) → UTM (m)
        </button>
        <button
          onClick={() => handleDirectionChange('utm-to-cassini')}
          className={`btn flex-1 ${direction === 'utm-to-cassini' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <ArrowRightLeft className="h-4 w-4" />
          UTM (m) → Cassini (ft)
        </button>
      </div>

      {/* ── 2. Topo Sheet Selector Card ── */}
      <div className="card">
        <div className="card-header">
          <span className="label flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-[var(--accent)]" />
            Topographic Sheet
          </span>
        </div>
        <div className="card-body space-y-4">
          {/* Search + Dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label text-xs text-[var(--text-muted)]" htmlFor="cassini-sheet-select">Select Sheet</label>
              <span className="text-[10px] text-[var(--text-muted)]">{KENYA_TOPO_SHEETS.length} sheets loaded</span>
            </div>
            <input
               id="cassini-sheet-select" type="text"
              className="input mb-1.5 text-xs"
              aria-label="Search sheets" placeholder="Search sheets... (e.g. 148, Nairobi, zone 36)"
              value={sheetSearch}
              onChange={e => setSheetSearch(e.target.value)}
            />
            <select
              aria-label="Cassini sheet"
              className="input"
              value={useCustomParams ? '__custom__' : selectedSheetId}
              onChange={e => {
                if (e.target.value === '__custom__') {
                  setUseCustomParams(true)
                } else {
                  setUseCustomParams(false)
                  setSelectedSheetId(e.target.value)
                }
              }}
            >
              {filteredSheets.length > 0 ? filteredSheets.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.description.substring(0, 80)}
                </option>
              )) : (
                <option disabled>No sheets match search</option>
              )}
              <option value="__custom__">Custom Helmert Parameters...</option>
            </select>
            {sheetSearch.trim() && filteredSheets.length > 0 && (
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                Showing {filteredSheets.length} of {KENYA_TOPO_SHEETS.length} sheets
              </p>
            )}
          </div>

          {/* Sub-sheet selector (when sheet has sub-sheets) */}
          {!useCustomParams && hasSubSheets && (
            <div>
              <label className="label text-xs text-[var(--text-muted)] mb-1 block">
                Sub-sheet
                {activeSubSheet && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300">
                    EXCELLENT &lt;10mm
                  </span>
                )}
              </label>
              <select
                aria-label="Sub-sheet"
                className="input"
                value={selectedSubSheetId}
                onChange={e => {
                  setSelectedSubSheetId(e.target.value)
                  if (e.target.value !== '__auto__') setDetectedSubSheet(undefined)
                }}
              >
                <option value="__auto__">[Search] Auto-detect from coordinates</option>
                {availableSubSheets.map(ss => (
                  <option key={ss.fullId} value={ss.subId}>
                    Sub-sheet {ss.subId} ({ss.bounds.minX.toFixed(0)}, {ss.bounds.minY.toFixed(0)}) — {ss.corners.length} corners
                  </option>
                ))}
              </select>
              {detectedSubSheet && selectedSubSheetId === '__auto__' && (
                <p className="mt-1 text-[10px] text-emerald-400">
                   Auto-detected sub-sheet {detectedSubSheet.fullId}
                </p>
              )}
            </div>
          )}

          {/* Visual 5×5 sub-sheet grid picker */}
          {!useCustomParams && hasSubSheets && (
            <SubSheetGridPicker
              selectedSheetId={selectedSheetId}
              selectedSubSheetId={selectedSubSheetId}
              setSelectedSubSheetId={setSelectedSubSheetId}
              setDetectedSubSheet={setDetectedSubSheet}
              detectedSubSheet={detectedSubSheet}
              activeSubSheet={activeSubSheet}
            />
          )}

          {/* Method selector */}
          {!useCustomParams && (
            <div>
              <label className="label text-xs text-[var(--text-muted)] mb-1 block" htmlFor="transform-method">Transform Method</label>
              <select id="transform-method"
                className="input"
                value={transformMethod}
                onChange={e => setTransformMethod(e.target.value as TransformMethod | 'auto')}
              >
                <option value="auto">Auto (best available — sub-sheet if detected)</option>
                <option value="helmert4">Helmert 4-param (conformal correction)</option>
                <option value="affine6">Affine 6-param (Rainsford — raw coordinates)</option>
              </select>
            </div>
          )}

          {/* Preset: show sheet params as readonly */}
          {!useCustomParams && !activeSubSheet && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs text-[var(--text-muted)]" htmlFor="p-scale-factor">P (scale factor)</label>
                <input id="p-scale-factor" aria-label="P" className="input font-mono text-xs opacity-75" value={activeSheet.P} readOnly />
              </div>
              <div>
                <label className="label text-xs text-[var(--text-muted)]" htmlFor="q-rotation-factor">Q (rotation factor)</label>
                <input id="q-rotation-factor" aria-label="Q" className="input font-mono text-xs opacity-75" value={activeSheet.Q} readOnly />
              </div>
              <div>
                <label className="label text-xs text-[var(--text-muted)]" htmlFor="cx-easting-trans">Cx (easting trans.)</label>
                <input id="cx-easting-trans" aria-label="Cx" className="input font-mono text-xs opacity-75" value={activeSheet.Cx} readOnly />
              </div>
              <div>
                <label className="label text-xs text-[var(--text-muted)]" htmlFor="cy-northing-trans">Cy (northing trans.)</label>
                <input id="cy-northing-trans" aria-label="Cy" className="input font-mono text-xs opacity-75" value={activeSheet.Cy} readOnly />
              </div>
            </div>
          )}

          {/* Custom: editable fields */}
          {useCustomParams && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs text-[var(--text-muted)]" htmlFor="p-scale-factor-2">P (scale factor)</label>
                <input id="p-scale-factor-2"
                  className="input font-mono text-xs"
                  value={customP}
                  onChange={e => setCustomP(e.target.value)}
 placeholder="0.3048"
                />
              </div>
              <div>
                <label className="label text-xs text-[var(--text-muted)]" htmlFor="q-rotation-factor-2">Q (rotation factor)</label>
                <input id="q-rotation-factor-2"
                  className="input font-mono text-xs"
                  value={customQ}
                  onChange={e => setCustomQ(e.target.value)}
 placeholder="0"
                />
              </div>
              <div>
                <label className="label text-xs text-[var(--text-muted)]" htmlFor="cx-easting-translation-m">Cx (easting translation, m)</label>
                <input id="cx-easting-translation-m"
                  className="input font-mono text-xs"
                  value={customCx}
                  onChange={e => setCustomCx(e.target.value)}
 placeholder="277474.6"
                />
              </div>
              <div>
                <label className="label text-xs text-[var(--text-muted)]" htmlFor="cy-northing-translation-m">Cy (northing translation, m)</label>
                <input id="cy-northing-translation-m"
                  className="input font-mono text-xs"
                  value={customCy}
                  onChange={e => setCustomCy(e.target.value)}
 placeholder="10000198.4"
                />
              </div>
            </div>
          )}

          {/* Collapsible common points */}
          {!useCustomParams && activeSheet.commonPoints.length > 0 && (
            <CommonPointsVerification
              showVerification={showVerification}
              setShowVerification={setShowVerification}
              commonPointCount={activeSheet.commonPoints.length}
              verificationResults={verificationResults}
            />
          )}

          {/* ── User Calibration Section ── */}
          <div>
            <button
              onClick={() => setCalibrationOpen(!calibrationOpen)}
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors w-full text-left"
            >
              {calibrationOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <Settings2 className="h-3 w-3" />
              Calibrate Custom Sheet
            </button>
            {calibrationOpen && (
              <div className="mt-3 space-y-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <p className="text-[10px] text-[var(--text-muted)]">
                  Enter common control points (CSV) to derive custom Helmert parameters via least-squares.
                  Format: <code className="font-mono">station,cassN_ft,cassE_ft,utmN_m,utmE_m</code>
                </p>
                <textarea
                  className="input font-mono text-xs resize-none"
                  rows={4}
                  value={calibrationCsv}
                  onChange={e => setCalibrationCsv(e.target.value)}
                  placeholder={"SKP209,-348685.6,-130490.6,9893875.453,237730.756\n149S3,-533392.5,22492.0,9837592.78,284419.1\nSKP208,-514849.9,-132480.9,9843205.245,237160.304"}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCalibrate}
                    disabled={!calibrationCsv.trim()}
                    className="btn btn-primary flex-1 text-xs"
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    Compute Parameters
                  </button>
                  <input
                    ref={fileInputRef as unknown as React.RefObject<HTMLInputElement>}
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const text = ev.target?.result
                        if (typeof text === 'string') {
                          // Strip BOM if present
                          const clean = text.replace(/^\uFEFF/, '')
                          setCalibrationCsv(clean)
                        }
                      }
                      reader.readAsText(file)
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-secondary text-xs"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Import File
                  </button>
                </div>

                {/* Calibration errors */}
                {calibrationErrors.length > 0 && (
                  <div className="space-y-1">
                    {calibrationErrors.map((err, i) => (
                      <p key={`${err}-${i}`} className="text-[10px] text-[var(--warning)]">{err}</p>
                    ))}
                  </div>
                )}

                {/* Calibration result */}
                {calibrationResult && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
                        <p className="text-[10px] text-[var(--text-muted)]">P (scale)</p>
                        <p className="font-mono text-xs text-[var(--accent)]">{calibrationResult.P}</p>
                      </div>
                      <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
                        <p className="text-[10px] text-[var(--text-muted)]">Q (rotation)</p>
                        <p className="font-mono text-xs text-[var(--accent)]">{calibrationResult.Q}</p>
                      </div>
                      <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
                        <p className="text-[10px] text-[var(--text-muted)]">Cx (easting trans.)</p>
                        <p className="font-mono text-xs text-[var(--accent)]">{calibrationResult.Cx}</p>
                      </div>
                      <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)]">
                        <p className="text-[10px] text-[var(--text-muted)]">Cy (northing trans.)</p>
                        <p className="font-mono text-xs text-[var(--accent)]">{calibrationResult.Cy}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleUseCalibrationParams}
                      className="btn btn-primary w-full text-xs"
                    >
                      <Crosshair className="h-3.5 w-3.5" />
                      Use These Parameters
                    </button>

                    {/* Calibration residuals */}
                    <CalibrationResidualsTable residuals={calibrationResiduals} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Collapsible transformation details */}
          <div>
            <button
              onClick={() => setParamsOpen(!paramsOpen)}
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              {paramsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Transformation details
            </button>
            {paramsOpen && (
              <pre className="mt-2 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap">
{`Formula:
  E_UTM  = P × E_conformal + Q × |N_cass| + Cx
  N_UTM  = -Q × E_conformal + P × |N_cass| + Cy

  E_conformal = E + E³/(6×a×b) + E⁵/(24×a²×b²)

Clarke 1858 (input):  a = ${CLARKE_1858_A_FT.toLocaleString()} ft
Clarke 1880 (output): a = ${CLARKE_1880_A_M.toLocaleString()} m
Datum: Arc 1960 / UTM Zone 37S
Central meridian: 39°E, Scale: 0.9996`}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Input Mode Toggle ── */}
      <div className="flex gap-2">
        <button
          onClick={() => { setInputMode('single'); setBatchResults([]); setBatchErrors([]) }}
          className={`btn flex-1 text-xs ${inputMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Single Point
        </button>
        <button
          onClick={() => { setInputMode('batch'); setSingleResult(null) }}
          className={`btn flex-1 text-xs ${inputMode === 'batch' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Batch (CSV)
        </button>
      </div>

      {/* ── 4. Single Point Input ── */}
      {inputMode === 'single' && (
        <div className="card">
          <div className="card-header">
            <span className="label text-sm font-semibold">
              {direction === 'cassini-to-utm' ? 'Cassini Coordinates (FEET)' : 'UTM Coordinates (METRES)'}
            </span>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label text-xs text-[var(--text-muted)]">
                  Easting ({direction === 'cassini-to-utm' ? 'ft' : 'm'})
                </label>
                <input aria-label="Easting ({direction === 'cassini-to-utm' ? 'ft' : 'm'})"
                  className="input font-mono"
                  value={singleE}
                  onChange={e => setSingleE(e.target.value)}
                  placeholder={direction === 'cassini-to-utm' ? '-130490.6' : '237730.756'}
                />
              </div>
              <div>
                <label className="label text-xs text-[var(--text-muted)]">
                  Northing ({direction === 'cassini-to-utm' ? 'ft' : 'm'})
                </label>
                <input aria-label="Northing ({direction === 'cassini-to-utm' ? 'ft' : 'm'})"
                  className="input font-mono"
                  value={singleN}
                  onChange={e => setSingleN(e.target.value)}
                  placeholder={direction === 'cassini-to-utm' ? '-348685.6' : '9893875.453'}
                />
              </div>
            </div>

            <button
              onClick={handleSingleConvert}
              disabled={!singleE || !singleN}
              className="btn btn-primary w-full"
            >
              Convert
            </button>
          </div>
        </div>
      )}

      {/* ── 5. Batch Input ── */}
      {inputMode === 'batch' && (
        <div className="card">
          <div className="card-header">
            <span className="label text-sm font-semibold">
              Batch Input (CSV) — {direction === 'cassini-to-utm' ? 'Cassini (ft)' : 'UTM (m)'}
            </span>
          </div>
          <div className="card-body space-y-3">
            <textarea
              className="input font-mono text-xs resize-none"
              rows={6}
              value={batchText}
              onChange={e => setBatchText(e.target.value)}
              placeholder={
                direction === 'cassini-to-utm'
                  ? 'id,easting_ft,northing_ft\nSKP209,-130490.6,-348685.6\n149S3,22492.0,-533392.5'
                  : 'id,easting_m,northing_m\nP1,237730.756,9893875.453\nP2,284419.1,9837592.78'
              }
            />
            <div className="flex gap-2">
              <button
                onClick={handleBatchConvert}
                disabled={!batchText.trim()}
                className="btn btn-primary flex-1"
              >
                Convert Batch
              </button>
              <button
                onClick={handleLoadExample}
                className="btn btn-secondary"
              >
                Load Example
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
