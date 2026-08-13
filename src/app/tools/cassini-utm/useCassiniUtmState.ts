'use client'

// State + handlers for the Cassini ↔ UTM converter tool.
//
// Extracted from src/app/tools/cassini-utm/page.tsx as a custom hook so
// the page component stays a thin orchestrator. All React state, refs and
// event handlers live here.

import { useState, useMemo, useCallback, useRef } from 'react'
import {
  KENYA_TOPO_SHEETS,
  KENYA_SUB_SHEETS,
  SHEETS_WITH_SUBSHEETS,
  cassiniFeetToUTM,
  utmToCassiniFeet,
  verifyWithCommonPoints,
  utmToWGS84,
  estimateSheetAccuracy,
  computeHelmert4Params,
  convertCassiniToUTM,
  convertUTMToCassini,
  findSubSheet,
  estimateSubSheetAccuracy,
  getUtmZone,
} from '@/lib/geo/cassini'
import type {
  CassiniFeetPoint,
  UTMPoint,
  ConversionResult,
  TopoSheetParams,
  VerificationResult,
  CommonPoint,
  SubSheetDef,
  TransformMethod,
} from '@/lib/geo/cassini'
import { CASSINI_BATCH_EXAMPLE, UTM_BATCH_EXAMPLE, r1, r3 } from './formatHelpers'

export function useCassiniUtmState() {
  // ── Direction ──
  const [direction, setDirection] = useState<'cassini-to-utm' | 'utm-to-cassini'>('cassini-to-utm')

  // ── Sheet Search ──
  const [sheetSearch, setSheetSearch] = useState('')

  // ── Topo Sheet Selection ──
  const [selectedSheetId, setSelectedSheetId] = useState<string>(KENYA_TOPO_SHEETS[0].id)
  const [useCustomParams, setUseCustomParams] = useState(false)

  // ── Filtered sheets list ──
  const filteredSheets = useMemo(() => {
    if (!sheetSearch.trim()) return KENYA_TOPO_SHEETS
    const q = sheetSearch.toLowerCase().trim()
    return KENYA_TOPO_SHEETS.filter(s =>
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    )
  }, [sheetSearch])

  // ── Sub-sheet Selection ──
  const [selectedSubSheetId, setSelectedSubSheetId] = useState<string>('__auto__')
  const [detectedSubSheet, setDetectedSubSheet] = useState<SubSheetDef | undefined>(undefined)

  // ── Transform Method ──
  const [transformMethod, setTransformMethod] = useState<TransformMethod | 'auto'>('auto')
  const [customP, setCustomP] = useState('0.3048')
  const [customQ, setCustomQ] = useState('0')
  const [customCx, setCustomCx] = useState('277474.6')
  const [customCy, setCustomCy] = useState('10000198.4')
  const [paramsOpen, setParamsOpen] = useState(false)

  // ── Input Mode ──
  const [inputMode, setInputMode] = useState<'single' | 'batch'>('single')

  // ── Single Point Inputs ──
  const [singleE, setSingleE] = useState('')
  const [singleN, setSingleN] = useState('')

  // ── Batch Input ──
  const [batchText, setBatchText] = useState('')

  // ── Results ──
  const [singleResult, setSingleResult] = useState<ConversionResult | null>(null)
  const [batchResults, setBatchResults] = useState<ConversionResult[]>([])
  const [batchErrors, setBatchErrors] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  // ── Verification ──
  const [showVerification, setShowVerification] = useState(false)

  // ── Calibration ──
  const [calibrationOpen, setCalibrationOpen] = useState(false)
  const [calibrationCsv, setCalibrationCsv] = useState('')
  const [calibrationResult, setCalibrationResult] = useState<TopoSheetParams | null>(null)
  const [calibrationErrors, setCalibrationErrors] = useState<string[]>([])
  const [calibrationResiduals, setCalibrationResiduals] = useState<VerificationResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Derived: available sub-sheets for selected sheet ──
  const availableSubSheets = useMemo(() => {
    if (useCustomParams) return []
    return KENYA_SUB_SHEETS.filter(ss => ss.sheetId === selectedSheetId)
  }, [useCustomParams, selectedSheetId])

  const hasSubSheets = availableSubSheets.length > 0

  // ── Derived: active sub-sheet ──
  const activeSubSheet = useMemo(() => {
    if (selectedSubSheetId === '__auto__') return detectedSubSheet
    return availableSubSheets.find(ss => ss.subId === selectedSubSheetId)
  }, [selectedSubSheetId, detectedSubSheet, availableSubSheets])

  // ── Derived Sheet Params (resolves to actual params used for conversion) ──
  const activeSheet: TopoSheetParams = useMemo(() => {
    if (useCustomParams) {
      return {
        id: 'custom',
        name: 'Custom Parameters',
        description: 'User-defined Helmert transformation parameters.',
        P: parseFloat(customP) || 0.3048,
        Q: parseFloat(customQ) || 0,
        Cx: parseFloat(customCx) || 0,
        Cy: parseFloat(customCy) || 0,
        commonPoints: [],
      }
    }
    // If sub-sheet is active, use its Helmert params
    if (activeSubSheet) return activeSubSheet.helmertParams
    return KENYA_TOPO_SHEETS.find(s => s.id === selectedSheetId) ?? KENYA_TOPO_SHEETS[0]
  }, [useCustomParams, selectedSheetId, customP, customQ, customCx, customCy, activeSubSheet])

  // ── Accuracy Grade (enhanced for sub-sheets) ──
  const accuracyInfo = useMemo(() => {
    if (activeSubSheet) {
      const sa = estimateSubSheetAccuracy(activeSubSheet)
      return { rmseM: sa.rmseMM / 1000, rmseMM: sa.rmseMM, grade: sa.grade }
    }
    return estimateSheetAccuracy(activeSheet)
  }, [activeSheet, activeSubSheet])

  const accuracyColorClass = useMemo(() => {
    switch (accuracyInfo.grade) {
      case 'EXCELLENT': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
      case 'GOOD': return 'bg-green-500/10 border-green-500/20 text-green-400'
      case 'MODERATE': return 'bg-amber-500/10 border-amber-500/20 text-amber-400'
      case 'LOW': return 'bg-red-500/10 border-red-500/20 text-red-400'
      default: return 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400'
    }
  }, [accuracyInfo.grade])

  const accuracyBadgeClass = useMemo(() => {
    switch (accuracyInfo.grade) {
      case 'EXCELLENT': return 'bg-emerald-500/20 text-emerald-300'
      case 'GOOD': return 'bg-green-500/20 text-green-300'
      case 'MODERATE': return 'bg-amber-500/20 text-amber-300'
      case 'LOW': return 'bg-red-500/20 text-red-300'
      default: return 'bg-zinc-500/20 text-zinc-300'
    }
  }, [accuracyInfo.grade])

  // ── WGS84 from single result (zone-aware) ──
  const singleWGS84 = useMemo(() => {
    if (!singleResult) return null
    const zone = getUtmZone(activeSheet.id)
    return utmToWGS84(singleResult.utmE, singleResult.utmN, zone)
  }, [singleResult, activeSheet.id])

  // ── Calibration Handler ──
  const handleCalibrate = useCallback(() => {
    const lines = calibrationCsv.trim().split('\n').filter(l => l.trim())
    const points: CommonPoint[] = []
    const errors: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const parts = line.split(',').map(s => s.trim())
      if (parts.length < 5) {
        errors.push(`Line ${i + 1}: Expected "station,cassN_ft,cassE_ft,utmN_m,utmE_m" — skipped`)
        continue
      }
      const station = parts[0]
      const cassN = parseFloat(parts[1])
      const cassE = parseFloat(parts[2])
      const utmN = parseFloat(parts[3])
      const utmE = parseFloat(parts[4])
      if ([cassN, cassE, utmN, utmE].some(isNaN)) {
        errors.push(`Line ${i + 1} (${station}): Invalid coordinates — skipped`)
        continue
      }
      points.push({ station, cassN, cassE, utmN, utmE })
    }

    setCalibrationErrors(errors)
    if (points.length < 2) {
      setCalibrationResult(null)
      setCalibrationResiduals([])
      if (errors.length === 0) {
        errors.push('Need at least 2 common points to compute parameters')
      }
      setCalibrationErrors(errors)
      return
    }

    try {
      const params = computeHelmert4Params(points)
      setCalibrationResult(params as TopoSheetParams)
      setCalibrationResiduals(verifyWithCommonPoints(params as TopoSheetParams))
    } catch (err) {
      setCalibrationResult(null)
      setCalibrationResiduals([])
      errors.push(`Computation error: ${err instanceof Error ? err.message : String(err)}`)
      setCalibrationErrors(errors)
    }
  }, [calibrationCsv])

  const handleUseCalibrationParams = useCallback(() => {
    if (!calibrationResult) return
    setCustomP(String(calibrationResult.P))
    setCustomQ(String(calibrationResult.Q))
    setCustomCx(String(calibrationResult.Cx))
    setCustomCy(String(calibrationResult.Cy))
    setUseCustomParams(true)
    setCalibrationOpen(false)
  }, [calibrationResult])

  // ── Verification Results ──
  const verificationResults = useMemo(() => {
    if (!showVerification || activeSheet.commonPoints.length === 0) return []
    return verifyWithCommonPoints(activeSheet)
  }, [showVerification, activeSheet])

  // ── Auto-detect sub-sheet from coordinates ──
  const detectSubSheetFromCoords = useCallback((e: number, n: number) => {
    if (!SHEETS_WITH_SUBSHEETS.has(selectedSheetId)) return undefined
    return findSubSheet(selectedSheetId, e, n)
  }, [selectedSheetId])

  // ── Reset results on direction change ──
  const handleDirectionChange = useCallback((dir: 'cassini-to-utm' | 'utm-to-cassini') => {
    setDirection(dir)
    setSingleResult(null)
    setBatchResults([])
    setBatchErrors([])
    setBatchText('')
    setDetectedSubSheet(undefined)
  }, [])

  // ── Single Convert ──
  const handleSingleConvert = useCallback(() => {
    const e = parseFloat(singleE)
    const n = parseFloat(singleN)
    if (isNaN(e) || isNaN(n)) return

    // Auto-detect sub-sheet if available
    const detected = detectSubSheetFromCoords(e, n)
    if (detected) setDetectedSubSheet(detected)
    const sub = selectedSubSheetId === '__auto__' ? detected : activeSubSheet

    if (direction === 'cassini-to-utm') {
      const pts: CassiniFeetPoint[] = [{ easting: e, northing: n }]
      if (sub && transformMethod !== 'helmert4') {
        const results = convertCassiniToUTM(pts, sub)
        setSingleResult(results[0])
      } else {
        const results = cassiniFeetToUTM(pts, sub ? sub.helmertParams : activeSheet)
        setSingleResult(results[0])
      }
    } else {
      const pts: UTMPoint[] = [{ easting: e, northing: n }]
      if (sub && transformMethod !== 'helmert4') {
        const results = convertUTMToCassini(pts, sub)
        setSingleResult(results[0])
      } else {
        const results = utmToCassiniFeet(pts, sub ? sub.helmertParams : activeSheet)
        setSingleResult(results[0])
      }
    }
  }, [singleE, singleN, direction, activeSheet, activeSubSheet, selectedSubSheetId, transformMethod, detectSubSheetFromCoords])

  // ── Batch Convert ──
  const handleBatchConvert = useCallback(() => {
    const lines = batchText.trim().split('\n').filter(l => l.trim())
    const validResults: ConversionResult[] = []
    const errors: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const parts = line.split(',').map(s => s.trim())

      if (parts.length < 3) {
        errors.push(`Line ${i + 1}: Expected "id,easting,northing" — skipped`)
        continue
      }
      const id = parts[0]
      const e = parseFloat(parts[1])
      const n = parseFloat(parts[2])
      if (isNaN(e) || isNaN(n)) {
        errors.push(`Line ${i + 1} (${id}): Invalid coordinates — skipped`)
        continue
      }

      // Auto-detect sub-sheet per point
      const detected = detectSubSheetFromCoords(e, n)
      const sub = selectedSubSheetId === '__auto__' ? detected : activeSubSheet
      const params = sub ? sub.helmertParams : activeSheet

      if (direction === 'cassini-to-utm') {
        const results = cassiniFeetToUTM([{ id, easting: e, northing: n }], params)
        validResults.push(results[0])
      } else {
        const results = utmToCassiniFeet([{ id, easting: e, northing: n }], params)
        validResults.push(results[0])
      }
    }

    setBatchResults(validResults)
    setBatchErrors(errors)
  }, [batchText, direction, activeSheet, activeSubSheet, selectedSubSheetId, detectSubSheetFromCoords])

  // ── Load Example ──
  const handleLoadExample = useCallback(() => {
    const example = direction === 'cassini-to-utm' ? CASSINI_BATCH_EXAMPLE : UTM_BATCH_EXAMPLE
    setBatchText(example)
    setBatchResults([])
    setBatchErrors([])
  }, [direction])

  // ── Copy helpers ──
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  const handleCopySingle = useCallback(() => {
    if (!singleResult) return
        const lines = [
      `Cassini-Soldner ↔ UTM Conversion (Helmert 4-Parameter)`,
      `Topo Sheet: ${activeSheet.name}`,
      `Datum: Arc 1960 / UTM Zone 37S`,
      ``,
      direction === 'cassini-to-utm'
        ? `Source Cassini: E = ${r1(singleResult.cassiniE)} ft, N = ${r1(singleResult.cassiniN)} ft`
        : `Source UTM: E = ${r3(singleResult.utmE)} m, N = ${r3(singleResult.utmN)} m`,
      direction === 'cassini-to-utm'
        ? `Result UTM: E = ${r3(singleResult.utmE)} m, N = ${r3(singleResult.utmN)} m`
        : `Result Cassini: E = ${r1(singleResult.cassiniE)} ft, N = ${r1(singleResult.cassiniN)} ft`,
      `Conformal E: ${r1(singleResult.conformalE)} ft`,
    ]
    if (singleResult.warning) {
      lines.push(`Warning: ${singleResult.warning}`)
    }
    copyToClipboard(lines.join('\n'))
  }, [singleResult, activeSheet, direction, copyToClipboard])

  const handleCopyBatchCsv = useCallback(() => {
    if (batchResults.length === 0) return
    const srcUnit = direction === 'cassini-to-utm' ? 'ft' : 'm'
    const tgtUnit = direction === 'cassini-to-utm' ? 'm' : 'ft'
    const header = `ID,Src_E(${srcUnit}),Src_N(${srcUnit}),Tgt_E(${tgtUnit}),Tgt_N(${tgtUnit}),Conformal_E(ft)`
    const rows = batchResults.map(r =>
      [
        r.id ?? '',
        direction === 'cassini-to-utm' ? r1(r.cassiniE) : r3(r.utmE),
        direction === 'cassini-to-utm' ? r1(r.cassiniN) : r3(r.utmN),
        direction === 'cassini-to-utm' ? r3(r.utmE) : r1(r.cassiniE),
        direction === 'cassini-to-utm' ? r3(r.utmN) : r1(r.cassiniN),
        r1(r.conformalE),
      ].join(',')
    )
    copyToClipboard([header, ...rows].join('\n'))
  }, [batchResults, direction, copyToClipboard])

  const handleDownloadCsv = useCallback(() => {
    if (batchResults.length === 0) return
    const srcUnit = direction === 'cassini-to-utm' ? 'ft' : 'm'
    const tgtUnit = direction === 'cassini-to-utm' ? 'm' : 'ft'
    const header = `ID,Src_E(${srcUnit}),Src_N(${srcUnit}),Tgt_E(${tgtUnit}),Tgt_N(${tgtUnit}),Conformal_E(ft)`
    const rows = batchResults.map(r =>
      [
        r.id ?? '',
        direction === 'cassini-to-utm' ? r1(r.cassiniE) : r3(r.utmE),
        direction === 'cassini-to-utm' ? r1(r.cassiniN) : r3(r.utmN),
        direction === 'cassini-to-utm' ? r3(r.utmE) : r1(r.cassiniE),
        direction === 'cassini-to-utm' ? r3(r.utmN) : r1(r.cassiniN),
        r1(r.conformalE),
      ].join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cassini-utm-${direction}-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [batchResults, direction])

  return {
    // direction
    direction,
    handleDirectionChange,
    // sheet search
    sheetSearch,
    setSheetSearch,
    filteredSheets,
    // sheet selection
    selectedSheetId,
    setSelectedSheetId,
    useCustomParams,
    setUseCustomParams,
    // sub-sheet
    selectedSubSheetId,
    setSelectedSubSheetId,
    detectedSubSheet,
    setDetectedSubSheet,
    availableSubSheets,
    hasSubSheets,
    activeSubSheet,
    // transform method
    transformMethod,
    setTransformMethod,
    // custom params
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
    // input mode
    inputMode,
    setInputMode,
    // single point
    singleE,
    setSingleE,
    singleN,
    setSingleN,
    singleResult,
    setSingleResult,
    singleWGS84,
    // batch
    batchText,
    setBatchText,
    batchResults,
    setBatchResults,
    batchErrors,
    setBatchErrors,
    handleBatchConvert,
    handleLoadExample,
    handleCopyBatchCsv,
    handleDownloadCsv,
    // copy state
    copied,
    handleCopySingle,
    // verification
    showVerification,
    setShowVerification,
    verificationResults,
    // calibration
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
    // active sheet + accuracy
    activeSheet,
    accuracyInfo,
    accuracyColorClass,
    accuracyBadgeClass,
    // conversion
    handleSingleConvert,
  }
}

export type UseCassiniUtmStateReturn = ReturnType<typeof useCassiniUtmState>
