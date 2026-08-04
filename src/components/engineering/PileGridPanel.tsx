'use client';

import React, { useState, useMemo, useCallback } from 'react'
import {
  generatePileGrid,
  computeSettingOut,
  generatePileGridDXF,
  pileGridToCSV,
  formatBearingDMS,
} from '@/lib/engineering/pileGrid'
import type {
  PileGridDefinition,
  PileGridResult,
  PileSettingOutData,
} from '@/lib/engineering/pileGrid'

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

const DEMO_DEFINITION: PileGridDefinition = {
  name: 'Block A – Pile Cap Grid',
  originEasting: 372456.789,
  originNorthing: 9987654.321,
  originRL: 1152.500,
  rows: 4,
  columns: 5,
  rowSpacing: 3.0,
  columnSpacing: 4.0,
  rotation: 15,
  startLabel: 'A1',
  labelRowsAs: 'alpha',
  labelColumnsAs: 'numeric',
  pileType: 'pile',
  pileDiameter: 600,
  depth: 18,
  coordinateSystem: 'Arc 1960 / UTM Zone 37S',
}

const DEFAULT_DEFINITION: PileGridDefinition = {
  name: '',
  originEasting: 357000,
  originNorthing: 9988000,
  originRL: 1150.0,
  rows: 3,
  columns: 4,
  rowSpacing: 3.0,
  columnSpacing: 3.0,
  rotation: 0,
  startLabel: 'A1',
  labelRowsAs: 'alpha',
  labelColumnsAs: 'numeric',
  pileType: 'pile',
  pileDiameter: 600,
  depth: 12,
  coordinateSystem: 'Arc 1960 / UTM Zone 37S',
}

// ─── INPUT CLASS ──────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono placeholder-zinc-500 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-colors outline-none'

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────

export default function PileGridPanel() {
  // Grid definition state
  const [gridDef, setGridDef] = useState<PileGridDefinition>(DEFAULT_DEFINITION)

  // Generated result
  const [gridResult, setGridResult] = useState<PileGridResult | null>(null)

  // Setting-out station
  const [stationE, setStationE] = useState('')
  const [stationN, setStationN] = useState('')
  const [stationRL, setStationRL] = useState('')
  const [stationHI, setStationHI] = useState('1.550')
  const [settingOutData, setSettingOutData] = useState<PileSettingOutData[]>([])

  // UI state
  const [activeTab, setActiveTab] = useState<'grid' | 'settingout'>('grid')

  // ─── ACTIONS ───────────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    if (gridDef.rows < 1 || gridDef.columns < 1) return
    const r = generatePileGrid(gridDef)
    setGridResult(r)
    setSettingOutData([])
  }, [gridDef])

  const handleLoadDemo = useCallback(() => {
    setGridDef(DEMO_DEFINITION)
    const r = generatePileGrid(DEMO_DEFINITION)
    setGridResult(r)
    setSettingOutData([])
    setStationE('372450.000')
    setStationN('9987648.000')
    setStationRL('1154.200')
    setStationHI('1.550')
  }, [])

  const handleComputeSettingOut = useCallback(() => {
    if (!gridResult) return
    const sE = parseFloat(stationE)
    const sN = parseFloat(stationN)
    const sRL = parseFloat(stationRL)
    const sHI = parseFloat(stationHI)
    if (isNaN(sE) || isNaN(sN) || isNaN(sRL) || isNaN(sHI)) return
    const data = computeSettingOut(gridResult.piles, sE, sN, sRL, sHI)
    setSettingOutData(data)
  }, [gridResult, stationE, stationN, stationRL, stationHI])

  const handleExportCSV = useCallback(() => {
    if (!gridResult) return
    const csv = pileGridToCSV(gridResult)
    downloadFile(csv, `pile_grid_${gridResult.definition.name.replace(/\s+/g, '_')}_${Date.now()}.csv`, 'text/csv')
  }, [gridResult])

  const handleExportDXF = useCallback(() => {
    if (!gridResult) return
    const dxf = generatePileGridDXF(gridResult)
    downloadFile(dxf, `pile_grid_${gridResult.definition.name.replace(/\s+/g, '_')}_${Date.now()}.dxf`, 'application/dxf')
  }, [gridResult])

  const handleExportSettingOutCSV = useCallback(() => {
    if (settingOutData.length === 0) return
    const header = 'Label,Easting,Northing,Design RL,Bearing (DMS),Bearing (Deg),Horizontal Distance (m),Target Height (m)'
    const rows = settingOutData.map((d) =>
      [
        d.pile.label,
        d.pile.easting.toFixed(4),
        d.pile.northing.toFixed(4),
        d.pile.designRL.toFixed(4),
        d.bearingDMS,
        d.bearingDeg.toFixed(4),
        d.horizontalDistance.toFixed(4),
        d.targetHeight.toFixed(4),
      ].join(',')
    )
    const csv = [header, ...rows].join('\n')
    downloadFile(csv, `setting_out_${Date.now()}.csv`, 'text/csv')
  }, [settingOutData])

  // ─── SVG VISUALISATION ────────────────────────────────────────────────

  const svgContent = useMemo(() => {
    if (!gridResult) return null
    return <PileGridSVG result={gridResult} />
  }, [gridResult])

  // ─── RENDER ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Pile / Column Grid Setting Out
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">Foundation grid coordinate computation &amp; stake-out data</p>
          </div>
          <button
            onClick={handleLoadDemo}
            className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-700 hover:text-white transition-colors"
          >
            Load Demo Data
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* ── GRID DEFINITION FORM ──────────────────────────────────── */}
        <section className="bg-zinc-900 rounded-lg border border-zinc-700 p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
            Grid Definition
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <FormField label="Grid Name">
              <input
                type="text"
                value={gridDef.name}
                onChange={(e) => setGridDef({ ...gridDef, name: e.target.value })}
                className={inputClass}
                aria-label="Grid name" placeholder="Block A – Pile Cap"
              />
            </FormField>

            {/* Pile Type */}
            <FormField label="Pile / Element Type">
              <select
                aria-label="Pile / Element Type"
                value={gridDef.pileType}
                onChange={(e) => setGridDef({ ...gridDef, pileType: e.target.value as PileGridDefinition['pileType'] })}
                className={inputClass}
              >
                <option value="pile">Pile</option>
                <option value="column">Column</option>
                <option value="pier">Pier</option>
                <option value="abutment">Abutment</option>
              </select>
            </FormField>

            {/* Coordinate System */}
            <FormField label="Coordinate System">
              <input
                type="text"
                value={gridDef.coordinateSystem}
                onChange={(e) => setGridDef({ ...gridDef, coordinateSystem: e.target.value })}
                className={inputClass}
                aria-label="Coordinate system" placeholder="Arc 1960 / UTM Zone 37S"
              />
            </FormField>

            {/* Start Label */}
            <FormField label="Start Label">
              <input
                type="text"
                value={gridDef.startLabel}
                onChange={(e) => setGridDef({ ...gridDef, startLabel: e.target.value })}
                className={inputClass}
                aria-label="Start label" placeholder="A1"
              />
            </FormField>

            {/* Origin Easting */}
            <FormField label="Origin Easting (m)">
              <input aria-label="Origineasting"
                type="number"
                step="0.001"
                value={gridDef.originEasting}
                onChange={(e) => setGridDef({ ...gridDef, originEasting: parseFloat(e.target.value) || 0 })}
                className={inputClass}
              />
            </FormField>

            {/* Origin Northing */}
            <FormField label="Origin Northing (m)">
              <input aria-label="Originnorthing"
                type="number"
                step="0.001"
                value={gridDef.originNorthing}
                onChange={(e) => setGridDef({ ...gridDef, originNorthing: parseFloat(e.target.value) || 0 })}
                className={inputClass}
              />
            </FormField>

            {/* Origin RL */}
            <FormField label="Origin RL (m)">
              <input aria-label="Originrl"
                type="number"
                step="0.001"
                value={gridDef.originRL}
                onChange={(e) => setGridDef({ ...gridDef, originRL: parseFloat(e.target.value) || 0 })}
                className={inputClass}
              />
            </FormField>

            {/* Rotation */}
            <FormField label="Rotation (degrees)">
              <input aria-label="Rotation"
                type="number"
                step="0.1"
                value={gridDef.rotation}
                onChange={(e) => setGridDef({ ...gridDef, rotation: parseFloat(e.target.value) || 0 })}
                className={inputClass}
              />
            </FormField>

            {/* Rows */}
            <FormField label="Rows">
              <input aria-label="Rows"
                type="number"
                min="1"
                max="100"
                value={gridDef.rows}
                onChange={(e) => setGridDef({ ...gridDef, rows: Math.max(1, parseInt(e.target.value) || 1) })}
                className={inputClass}
              />
            </FormField>

            {/* Columns */}
            <FormField label="Columns">
              <input aria-label="Columns"
                type="number"
                min="1"
                max="100"
                value={gridDef.columns}
                onChange={(e) => setGridDef({ ...gridDef, columns: Math.max(1, parseInt(e.target.value) || 1) })}
                className={inputClass}
              />
            </FormField>

            {/* Row Spacing */}
            <FormField label="Row Spacing (m)">
              <input aria-label="Rowspacing"
                type="number"
                step="0.01"
                min="0.1"
                value={gridDef.rowSpacing}
                onChange={(e) => setGridDef({ ...gridDef, rowSpacing: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                className={inputClass}
              />
            </FormField>

            {/* Column Spacing */}
            <FormField label="Column Spacing (m)">
              <input aria-label="Columnspacing"
                type="number"
                step="0.01"
                min="0.1"
                value={gridDef.columnSpacing}
                onChange={(e) => setGridDef({ ...gridDef, columnSpacing: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                className={inputClass}
              />
            </FormField>

            {/* Label Rows As */}
            <FormField label="Label Rows As">
              <div className="flex items-center gap-4 mt-1">
                <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="labelRowsAs" aria-label="Label Rows As"
                    value="alpha"
                    checked={gridDef.labelRowsAs === 'alpha'}
                    onChange={() => setGridDef({ ...gridDef, labelRowsAs: 'alpha' })}
                    className="accent-blue-500"
                  />
                  Alpha (A, B, C...)
                </label>
                <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="labelRowsAs" aria-label="Label Rows As"
                    value="numeric"
                    checked={gridDef.labelRowsAs === 'numeric'}
                    onChange={() => setGridDef({ ...gridDef, labelRowsAs: 'numeric' })}
                    className="accent-blue-500"
                  />
                  Numeric (1, 2, 3...)
                </label>
              </div>
            </FormField>

            {/* Label Columns As */}
            <FormField label="Label Columns As">
              <div className="flex items-center gap-4 mt-1">
                <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="labelColumnsAs" aria-label="Label Columns As"
                    value="alpha"
                    checked={gridDef.labelColumnsAs === 'alpha'}
                    onChange={() => setGridDef({ ...gridDef, labelColumnsAs: 'alpha' })}
                    className="accent-blue-500"
                  />
                  Alpha (A, B, C...)
                </label>
                <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="labelColumnsAs" aria-label="Label Columns As"
                    value="numeric"
                    checked={gridDef.labelColumnsAs === 'numeric'}
                    onChange={() => setGridDef({ ...gridDef, labelColumnsAs: 'numeric' })}
                    className="accent-blue-500"
                  />
                  Numeric (1, 2, 3...)
                </label>
              </div>
            </FormField>

            {/* Pile Diameter */}
            <FormField label="Pile Diameter (mm)">
              <input aria-label="Pile quantity"
                type="number"
                step="1"
                min="0"
                value={gridDef.pileDiameter ?? ''}
                onChange={(e) => setGridDef({ ...gridDef, pileDiameter: e.target.value ? parseFloat(e.target.value) : undefined })}
                className={inputClass}
              />
            </FormField>

            {/* Depth */}
            <FormField label="Design Depth (m)">
              <input aria-label="Pile length"
                type="number"
                step="0.1"
                min="0"
                value={gridDef.depth ?? ''}
                onChange={(e) => setGridDef({ ...gridDef, depth: e.target.value ? parseFloat(e.target.value) : undefined })}
                className={inputClass}
              />
            </FormField>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleGenerate}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
            >
              Generate Grid
            </button>
            <span className="text-xs text-zinc-400">
              {gridDef.rows} x {gridDef.columns} = {gridDef.rows * gridDef.columns} {gridDef.pileType}{gridDef.rows * gridDef.columns !== 1 ? 's' : ''}
            </span>
          </div>
        </section>

        {/* ── RESULTS ──────────────────────────────────────────────────── */}
        {gridResult && (
          <>
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-700 w-fit">
              <button
                onClick={() => setActiveTab('grid')}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'grid'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                Grid Coordinates
              </button>
              <button
                onClick={() => setActiveTab('settingout')}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'settingout'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                Setting Out
              </button>
            </div>

            {activeTab === 'grid' && (
              <div className="space-y-6">
                {/* ── SUMMARY CARDS ───────────────────────────────────── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryCard
                    label="Total Piles"
                    value={gridResult.totalPiles.toString()}
                    sub={`${gridDef.pileType}s`}
                    colorClass="border-blue-500/30 bg-blue-950/20"
                    valueClass="text-blue-400"
                  />
                  <SummaryCard
                    label="Grid Area"
                    value={gridResult.area.toFixed(1)}
                    sub="sq metres"
                    colorClass="border-emerald-500/30 bg-emerald-950/20"
                    valueClass="text-emerald-400"
                  />
                  <SummaryCard
                    label="E Range"
                    value={`${(gridResult.boundingBox.maxE - gridResult.boundingBox.minE).toFixed(3)} m`}
                    sub={`min ${gridResult.boundingBox.minE.toFixed(2)}`}
                    colorClass="border-amber-500/30 bg-amber-950/20"
                    valueClass="text-amber-400"
                  />
                  <SummaryCard
                    label="N Range"
                    value={`${(gridResult.boundingBox.maxN - gridResult.boundingBox.minN).toFixed(3)} m`}
                    sub={`min ${gridResult.boundingBox.minN.toFixed(2)}`}
                    colorClass="border-amber-500/30 bg-amber-950/20"
                    valueClass="text-amber-400"
                  />
                </div>

                {/* ── SVG GRID VISUALISATION ──────────────────────────── */}
                <section className="bg-zinc-900 rounded-lg border border-zinc-700 p-6">
                  <h3 className="text-sm font-semibold text-white mb-4">Grid Layout</h3>
                  {svgContent}
                </section>

                {/* ── COORDINATE TABLE ───────────────────────────────── */}
                <section className="bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Pile Coordinates</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">{gridResult.piles.length} rows</span>
                      <button
                        onClick={handleExportCSV}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-700 hover:text-white transition-colors"
                      >
                        <DownloadIcon />
                        CSV
                      </button>
                      <button
                        onClick={handleExportDXF}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-700 hover:text-white transition-colors"
                      >
                        <DownloadIcon />
                        DXF
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-800/80 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Label</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Easting</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Northing</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Design RL</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Row Offset</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Col Offset</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60">
                        {gridResult.piles.map((p, i) => (
                          <tr key={p.label} className="hover:bg-zinc-800/40 transition-colors">
                            <td className="px-4 py-2 font-mono text-xs font-semibold text-blue-400">{p.label}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300">{p.easting.toFixed(4)}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300">{p.northing.toFixed(4)}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300">{p.designRL.toFixed(4)}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-zinc-400">{p.gridOffsetN.toFixed(4)}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs text-zinc-400">{p.gridOffsetE.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'settingout' && (
              <div className="space-y-6">
                {/* ── INSTRUMENT STATION INPUT ────────────────────────── */}
                <section className="bg-zinc-900 rounded-lg border border-zinc-700 p-6">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Instrument Station
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField label="Station Easting (m)">
                      <input
                        type="number"
                        step="0.001"
                        value={stationE}
                        onChange={(e) => setStationE(e.target.value)}
                        className={inputClass}
                        aria-label="Station easting (m)" placeholder="372450.000"
                      />
                    </FormField>
                    <FormField label="Station Northing (m)">
                      <input
                        type="number"
                        step="0.001"
                        value={stationN}
                        onChange={(e) => setStationN(e.target.value)}
                        className={inputClass}
                        aria-label="Station northing (m)" placeholder="9987648.000"
                      />
                    </FormField>
                    <FormField label="Station RL (m)">
                      <input
                        type="number"
                        step="0.001"
                        value={stationRL}
                        onChange={(e) => setStationRL(e.target.value)}
                        className={inputClass}
                        aria-label="Station RL (m)" placeholder="1154.200"
                      />
                    </FormField>
                    <FormField label="Height of Instrument (m)">
                      <input
                        type="number"
                        step="0.001"
                        value={stationHI}
                        onChange={(e) => setStationHI(e.target.value)}
                        className={inputClass}
                        aria-label="Height of instrument (m)" placeholder="1.550"
                      />
                    </FormField>
                  </div>
                  <button
                    onClick={handleComputeSettingOut}
                    className="mt-4 px-5 py-2.5 bg-amber-600 text-black rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20"
                  >
                    Compute Setting-Out Data
                  </button>
                </section>

                {/* ── SETTING-OUT TABLE ────────────────────────────────── */}
                {settingOutData.length > 0 && (
                  <section className="bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Setting-Out Data</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">{settingOutData.length} points</span>
                        <button
                          onClick={handleExportSettingOutCSV}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-lg text-xs font-medium hover:bg-zinc-700 hover:text-white transition-colors"
                        >
                          <DownloadIcon />
                          Export CSV
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-800/80 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Label</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Bearing</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Distance (m)</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Target Height (m)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60">
                          {settingOutData.map((d, i) => (
                            <tr key={`${d}-${i}`} className="hover:bg-zinc-800/40 transition-colors">
                              <td className="px-4 py-2 font-mono text-xs font-semibold text-amber-400">{d.pile.label}</td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300">{d.bearingDMS}</td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300">{d.horizontalDistance.toFixed(4)}</td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300">{d.targetHeight.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {settingOutData.length === 0 && (
                  <div className="bg-zinc-900 rounded-lg border border-zinc-700 p-10 text-center">
                    <svg className="w-12 h-12 mx-auto text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p className="text-sm text-zinc-400">
                      Enter instrument station coordinates and click <strong>Compute Setting-Out Data</strong> to generate bearing &amp; distance for each pile.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── EMPTY STATE ──────────────────────────────────────────────────── */}
        {!gridResult && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-700 p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-zinc-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <h3 className="text-lg font-medium text-zinc-300 mb-1">No Grid Generated</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              Define your pile grid parameters above and click <strong className="text-zinc-400">Generate Grid</strong>, or use <strong className="text-zinc-400">Load Demo Data</strong> to see an example.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-xs text-zinc-400 text-center">
            Pile Grid Setting Out &middot; Ref: Basak &sect;8.5, Ghilani &amp; Wolf &sect;24.1
          </p>
        </div>
      </footer>
    </div>
  )
}

// ─── SVG GRID VISUALISATION ────────────────────────────────────────────────────

function PileGridSVG({ result }: { result: PileGridResult }) {
  const { definition: def, piles, boundingBox } = result

  const width = 800
  const height = 600
  const padding = 60

  const plotW = width - padding * 2
  const plotH = height - padding * 2

  const rangeE = boundingBox.maxE - boundingBox.minE || 1
  const rangeN = boundingBox.maxN - boundingBox.minN || 1

  // Maintain aspect ratio
  const scaleX = plotW / rangeE
  const scaleY = plotH / rangeN
  const scale = Math.min(scaleX, scaleY) * 0.85

  const cx = (e: number) => padding + (e - boundingBox.minE) * scale + (plotW - rangeE * scale) / 2
  const cy = (n: number) => padding + (boundingBox.maxN - n) * scale + (plotH - rangeN * scale) / 2

  // Grid corners in world coordinates
  const theta = (def.rotation * Math.PI) / 180
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const totalW = Math.max(def.columns - 1, 0) * def.columnSpacing
  const totalH = Math.max(def.rows - 1, 0) * def.rowSpacing

  const rot = (le: number, ln: number) => ({
    e: le * cosT + ln * sinT + def.originEasting,
    n: -le * sinT + ln * cosT + def.originNorthing,
  })

  const corners = [rot(0, 0), rot(totalW, 0), rot(totalW, totalH), rot(0, totalH)]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-2xl mx-auto" style={{ background: '#0d0d1a' }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="#f8fafc" />
        </marker>
      </defs>

      {/* Grid lines (dashed gray) */}
      {Array.from({ length: def.rows }, (_, r) => {
        const localN = r * def.rowSpacing
        const p1 = rot(0, localN)
        const p2 = rot(totalW, localN)
        return (
          <line
            key={`row-${r}`}
            x1={cx(p1.e)} y1={cy(p1.n)} x2={cx(p2.e)} y2={cy(p2.n)}
            stroke="#3f3f5c" strokeWidth={0.8} strokeDasharray="6,4"
          />
        )
      })}
      {Array.from({ length: def.columns }, (_, c) => {
        const localE = c * def.columnSpacing
        const p1 = rot(localE, 0)
        const p2 = rot(localE, totalH)
        return (
          <line
            key={`col-${c}`}
            x1={cx(p1.e)} y1={cy(p1.n)} x2={cx(p2.e)} y2={cy(p2.n)}
            stroke="#3f3f5c" strokeWidth={0.8} strokeDasharray="6,4"
          />
        )
      })}

      {/* Grid border (blue rectangle) */}
      <polygon
        points={corners.map((c) => `${cx(c.e)},${cy(c.n)}`).join(' ')}
        fill="none"
        stroke="#60a5fa"
        strokeWidth={1.5}
      />

      {/* Pile positions (green circles, scaled by diameter) */}
      {piles.map((pile, i) => {
        const px = cx(pile.easting)
        const py = cy(pile.northing)
        const r = def.pileDiameter ? Math.max((def.pileDiameter / 2000) * scale * 0.5, 4) : 5
        return (
          <g key={pile.label}>
            <circle cx={px} cy={py} r={r} fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth={1.2} />
            <circle cx={px} cy={py} r={2} fill="#22c55e" />
            <text
              x={px} y={py - r - 3}
              textAnchor="middle"
              className="text-[8px] fill-blue-400 font-mono font-semibold"
            >
              {pile.label}
            </text>
          </g>
        )
      })}

      {/* North Arrow indicator */}
      <g transform={`translate(${width - 40}, 40)`}>
        <circle cx="0" cy="0" r="18" fill="none" stroke="#52526b" strokeWidth={1} />
        <line x1="0" y1="12" x2="0" y2="-12" stroke="#f8fafc" strokeWidth={1.5} markerEnd="url(#arrowhead)" />
        <text x="0" y="-22" textAnchor="middle" className="text-[9px] fill-zinc-300 font-bold">N</text>
      </g>

      {/* Rotation indicator */}
      {def.rotation !== 0 && (
        <text x={padding + 5} y={height - 10} className="text-[9px] fill-zinc-500 font-mono">
          Grid rotation: {def.rotation.toFixed(1)}&deg;
        </text>
      )}

      {/* Dimension annotations for spacing */}
      {def.columns > 1 && (
        <g>
          <line
            x1={cx(corners[0].e)} y1={cy(corners[0].n) + 20}
            x2={cx(corners[1].e)} y2={cy(corners[1].n) + 20}
            stroke="#a78bfa" strokeWidth={0.8}
          />
          <text
            x={(cx(corners[0].e) + cx(corners[1].e)) / 2}
            y={cy(corners[0].n) + 32}
            textAnchor="middle"
            className="text-[8px] fill-violet-400 font-mono"
          >
            {def.columnSpacing.toFixed(2)}m x {def.columns - 1} = {totalW.toFixed(2)}m
          </text>
        </g>
      )}
      {def.rows > 1 && (
        <g>
          <line
            x1={cx(corners[0].e) - 20}
            y1={cy(corners[0].n)}
            x2={cx(corners[3].e) - 20}
            y2={cy(corners[3].n)}
            stroke="#a78bfa" strokeWidth={0.8}
          />
          <text
            x={cx(corners[0].e) - 30}
            y={(cy(corners[0].n) + cy(corners[3].n)) / 2}
            textAnchor="middle"
            className="text-[8px] fill-violet-400 font-mono"
            transform={`rotate(-90, ${cx(corners[0].e) - 30}, ${(cy(corners[0].n) + cy(corners[3].n)) / 2})`}
          >
            {def.rowSpacing.toFixed(2)}m x {def.rows - 1} = {totalH.toFixed(2)}m
          </text>
        </g>
      )}

      {/* Corner coordinates */}
      {corners.map((c, i) => (
        <text
          key={`cl-${i}`}
          x={cx(c.e) + (i === 0 || i === 3 ? -8 : 8)}
          y={cy(c.n) + (i < 2 ? 14 : -6)}
          textAnchor={i === 0 || i === 3 ? 'end' : 'start'}
          className="text-[6px] fill-zinc-600 font-mono"
        >
          {c.e.toFixed(1)}, {c.n.toFixed(1)}
        </text>
      ))}
    </svg>
  )
}

// ─── SMALL UI COMPONENTS ───────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  colorClass,
  valueClass,
}: {
  label: string
  value: string
  sub: string
  colorClass: string
  valueClass: string
}) {
  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <div className="text-xs text-zinc-400 uppercase tracking-wider font-medium">{label}</div>
      <div className={`text-xl font-bold mt-1 ${valueClass}`}>{value}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

// ─── UTILITY ──────────────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
