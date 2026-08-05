'use client';

import React, { useState, useMemo, useCallback } from 'react'
import { designPavement, computeLayerQuantities, classifySubgrade } from '@/lib/engineering/pavementDesign'
import type { TrafficData, SubgradeData, PavementDesignResult, PavementLayer } from '@/lib/engineering/pavementDesign'

interface PavementDesignPanelProps {
  roadClass?: string
  carriagewayWidth?: number
  roadLength?: number
  onLayersChange?: (layers: PavementLayer[]) => void
}

interface ValidationErrors {
  aadt?: string
  cbr?: string
  growthRate?: string
  designPeriod?: string
  heavyVehiclePercentage?: string
  roadLength?: string
}

function validate(data: { traffic: TrafficData; subgrade: SubgradeData; roadLength: number }): ValidationErrors {
  const errors: ValidationErrors = {}
  const { traffic, subgrade, roadLength } = data

  if (traffic.aadt <= 0) {
    errors.aadt = 'AADT must be greater than 0'
  }
  if (subgrade.cbr < 2 || subgrade.cbr > 100) {
    errors.cbr = 'CBR must be between 2 and 100'
  }
  if (traffic.growthRate < 0) {
    errors.growthRate = 'Growth rate must be >= 0'
  }
  if (traffic.designPeriod < 10 || traffic.designPeriod > 40) {
    errors.designPeriod = 'Design period must be between 10 and 40 years'
  }
  if (traffic.heavyVehiclePercentage < 0 || traffic.heavyVehiclePercentage > 100) {
    errors.heavyVehiclePercentage = 'Heavy vehicle % must be between 0 and 100'
  }
  if (roadLength <= 0) {
    errors.roadLength = 'Road length must be greater than 0'
  }

  return errors
}

const safeNum = (v: number, fallback: string = '—') =>
  Number.isFinite(v) && !Number.isNaN(v) ? v : fallback

export default function PavementDesignPanel({
  roadClass,
  carriagewayWidth = 7.0,
  roadLength: roadLengthProp = 1000,
}: PavementDesignPanelProps) {
  const [traffic, setTraffic] = useState<TrafficData>({
    aadt: 5000, heavyVehiclePercentage: 15, growthRate: 4, designPeriod: 20,
    directionalSplit: 0.5, laneFactor: 0.85, numberOfLanes: 2, vehicleDamageFactor: 1.5,
  })
  const [subgrade, setSubgrade] = useState<SubgradeData>({ cbr: 8 })
  const [roadLength, setRoadLength] = useState(roadLengthProp)
  const [result, setResult] = useState<PavementDesignResult | null>(null)
  const [errors, setErrors] = useState<ValidationErrors>({})

  const quantities = useMemo(() => {
    if (!result) return []
    return computeLayerQuantities(result.layers, roadLength, carriagewayWidth)
  }, [result, roadLength, carriagewayWidth])

  const handleDesign = () => {
    const validationErrors = validate({ traffic, subgrade, roadLength })
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    const r = designPavement(traffic, subgrade)
    setResult(r)
  }

  const handleExportCSV = useCallback(() => {
    if (!result || quantities.length === 0) return

    const header = 'layer_name,thickness_mm,material,volume_m3,tonnage'
    const rows = quantities.map(q =>
      [
        `"${q.layer}"`,
        q.volumeM3 > 0
          ? result.layers.find(l => l.name === q.layer)?.thicknessMm ?? ''
          : '',
        `"${q.material}"`,
        safeNum(q.volumeM3, ''),
        safeNum(q.tonnage, ''),
      ].join(',')
    )

    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pavement_layer_report_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [result, quantities])

  const inputCls =
    'w-full border border-zinc-600 rounded-lg px-3 py-2 text-sm bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
  const labelCls = 'block text-xs text-zinc-400 mb-1'
  const errorCls = 'text-xs text-red-400 mt-1'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
        <h3 className="text-lg font-semibold text-white">Pavement Layer Design</h3>
        <p className="text-sm text-zinc-400 mt-1">KeNHA Pavement &amp; Materials Design Manual — CBR-based method</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Data */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
          <h4 className="font-medium text-white mb-4">Traffic Data</h4>
          <div className="space-y-3">
            {/* AADT */}
            <div>
              <label className={labelCls} htmlFor="aadt-veh-day">AADT (veh/day)</label>
              <input id="aadt-veh-day" aria-label="Aadt"
                type="number"
                step="any"
                className={`${inputCls}${errors.aadt ? ' border-red-500' : ''}`}
                value={traffic.aadt}
                onChange={e => setTraffic({ ...traffic, aadt: parseFloat(e.target.value) || 0 })}
              />
              {errors.aadt && <p className={errorCls}>{errors.aadt}</p>}
            </div>

            {/* Heavy Vehicle % */}
            <div>
              <label className={labelCls} htmlFor="heavy-vehicles">Heavy Vehicles (%)</label>
              <input id="heavy-vehicles" aria-label="Heavyvehiclepercentage"
                type="number"
                step="any"
                className={`${inputCls}${errors.heavyVehiclePercentage ? ' border-red-500' : ''}`}
                value={traffic.heavyVehiclePercentage}
                onChange={e => setTraffic({ ...traffic, heavyVehiclePercentage: parseFloat(e.target.value) || 0 })}
              />
              {errors.heavyVehiclePercentage && <p className={errorCls}>{errors.heavyVehiclePercentage}</p>}
            </div>

            {/* Growth Rate */}
            <div>
              <label className={labelCls} htmlFor="growth-rate-yr">Growth Rate (%/yr)</label>
              <input id="growth-rate-yr" aria-label="Growthrate"
                type="number"
                step="any"
                className={`${inputCls}${errors.growthRate ? ' border-red-500' : ''}`}
                value={traffic.growthRate}
                onChange={e => setTraffic({ ...traffic, growthRate: parseFloat(e.target.value) || 0 })}
              />
              {errors.growthRate && <p className={errorCls}>{errors.growthRate}</p>}
            </div>

            {/* Design Period */}
            <div>
              <label className={labelCls} htmlFor="design-period-years">Design Period (years)</label>
              <input id="design-period-years" aria-label="Designperiod"
                type="number"
                step="any"
                className={`${inputCls}${errors.designPeriod ? ' border-red-500' : ''}`}
                value={traffic.designPeriod}
                onChange={e => setTraffic({ ...traffic, designPeriod: parseFloat(e.target.value) || 0 })}
              />
              {errors.designPeriod && <p className={errorCls}>{errors.designPeriod}</p>}
            </div>

            {/* Directional Split */}
            <div>
              <label className={labelCls} htmlFor="directional-split">Directional Split</label>
              <input id="directional-split" aria-label="Directionalsplit"
                type="number"
                step="any"
                className={inputCls}
                value={traffic.directionalSplit}
                onChange={e => setTraffic({ ...traffic, directionalSplit: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Lane Factor */}
            <div>
              <label className={labelCls} htmlFor="lane-factor">Lane Factor</label>
              <input id="lane-factor" aria-label="Lanefactor"
                type="number"
                step="any"
                className={inputCls}
                value={traffic.laneFactor}
                onChange={e => setTraffic({ ...traffic, laneFactor: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Number of Lanes */}
            <div>
              <label className={labelCls} htmlFor="no-of-lanes">No. of Lanes</label>
              <input id="no-of-lanes" aria-label="Numberoflanes"
                type="number"
                step="any"
                className={inputCls}
                value={traffic.numberOfLanes}
                onChange={e => setTraffic({ ...traffic, numberOfLanes: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Vehicle Damage Factor */}
            <div>
              <label className={labelCls} htmlFor="vehicle-damage-factor">Vehicle Damage Factor</label>
              <input id="vehicle-damage-factor" aria-label="Vehicle Damage Factor"
                type="number"
                step="any"
                className={inputCls}
                value={traffic.vehicleDamageFactor ?? 1.0}
                onChange={e => setTraffic({ ...traffic, vehicleDamageFactor: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>

        {/* Subgrade Data */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
          <h4 className="font-medium text-white mb-4">Subgrade Data</h4>
          <div className="space-y-3">
            {/* CBR */}
            <div>
              <label className={labelCls}>CBR (%) — {classifySubgrade(subgrade.cbr)}</label>
              <input aria-label="Cbr"
                type="range"
                min={1}
                max={100}
                className="w-full"
                value={subgrade.cbr}
                onChange={e => setSubgrade({ ...subgrade, cbr: parseInt(e.target.value) })}
              />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>1% (SG4)</span>
                <span className="font-medium text-zinc-200">{subgrade.cbr}%</span>
                <span>100% (SG1)</span>
              </div>
              {errors.cbr && <p className={errorCls}>{errors.cbr}</p>}
            </div>

            {/* Soil Type */}
            <div>
              <label className={labelCls} htmlFor="soil-type">Soil Type</label>
              <select id="soil-type"
                className={`${inputCls}${errors.cbr ? ' border-red-500' : ''}`}
                value={subgrade.soilType || ''}
                onChange={e => setSubgrade({ ...subgrade, soilType: e.target.value })}
              >
                <option value="">Select...</option>
                <option value="granular">Granular</option>
                <option value="clay">Clay</option>
                <option value="silt">Silt</option>
                <option value="sand">Sand</option>
                <option value="rock">Rock</option>
              </select>
            </div>

            {/* Road Length — now editable */}
            <div>
              <label className={labelCls} htmlFor="road-length-m">Road Length (m)</label>
              <input  id="road-length-m" aria-label="Road Length (m)"
                type="number"
                className={`${inputCls}${errors.roadLength ? ' border-red-500' : ''}`}
                value={roadLength}
                onChange={e => setRoadLength(parseFloat(e.target.value) || 0)}
              />
              {errors.roadLength && <p className={errorCls}>{errors.roadLength}</p>}
            </div>
          </div>

          <button
            onClick={handleDesign}
            className="w-full mt-6 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Design Pavement
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-950/40 rounded-xl border border-blue-800 p-4">
              <div className="text-xs text-blue-400 uppercase tracking-wider">ESA</div>
              <div className="text-2xl font-bold text-blue-300">
                {safeNum(result.esaMillions, '—') !== '—'
                  ? `${result.esaMillions.toFixed(3)}M`
                  : '—'}
              </div>
            </div>
            <div className="bg-purple-950/40 rounded-xl border border-purple-800 p-4">
              <div className="text-xs text-purple-400 uppercase tracking-wider">Traffic Class</div>
              <div className="text-2xl font-bold text-purple-300">{result.trafficClass}</div>
            </div>
            <div className="bg-amber-950/40 rounded-xl border border-amber-800 p-4">
              <div className="text-xs text-amber-400 uppercase tracking-wider">Subgrade Class</div>
              <div className="text-2xl font-bold text-amber-300">{result.subgradeClass}</div>
            </div>
            <div className="bg-green-950/40 rounded-xl border border-green-800 p-4">
              <div className="text-xs text-green-400 uppercase tracking-wider">Total Thickness</div>
              <div className="text-2xl font-bold text-green-300">
                {safeNum(result.totalThickness, '—') !== '—'
                  ? `${result.totalThickness} mm`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Pavement Structure Diagram */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
            <h4 className="font-medium text-white mb-3">Pavement Structure</h4>
            <PavementStructureDiagram layers={result.layers} />
          </div>

          {/* Layer Table */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-700">
              <h4 className="font-medium text-white">Layer Schedule</h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-zinc-800">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Layer</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Material</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-zinc-400">Thickness</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Description</th>
                </tr>
              </thead>
              <tbody>
                {result.layers.map((layer, i) => (
                  <tr key={layer.name} className="border-t border-zinc-800">
                    <td className="px-4 py-2 font-medium text-white">
                      <span className="inline-block w-3 h-3 rounded-sm mr-2" style={{ backgroundColor: layer.color }} />
                      {layer.name}
                    </td>
                    <td className="px-4 py-2 text-zinc-300">{layer.material}</td>
                    <td className="px-4 py-2 text-right font-mono text-white">{layer.thicknessMm} mm</td>
                    <td className="px-4 py-2 text-zinc-400 text-xs">{layer.description}</td>
                  </tr>
                ))}
                <tr className="bg-zinc-800 font-semibold">
                  <td className="px-4 py-2 text-white" colSpan={2}>Total</td>
                  <td className="px-4 py-2 text-right font-mono text-white">
                    {safeNum(result.totalThickness, '—') !== '—'
                      ? `${result.totalThickness} mm`
                      : '—'}
                  </td>
                  <td className="px-4 py-2"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Material Quantities */}
          {quantities.length > 0 && (
            <div className="bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-700 flex items-center justify-between">
                <h4 className="font-medium text-white">
                  Material Quantities (L={roadLength}m &times; W={carriagewayWidth}m)
                </h4>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg font-medium hover:bg-emerald-700 transition-colors"
                >
                  Download Layer Report
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-zinc-400">Layer</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zinc-400">Volume (m&sup3;)</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zinc-400">Tonnage</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-zinc-400">Density (kg/m&sup3;)</th>
                  </tr>
                </thead>
                <tbody>
                  {quantities.map((q, i) => (
                    <tr key={`${q}-${i}`} className="border-t border-zinc-800">
                      <td className="px-4 py-2 font-medium text-white">{q.layer}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-300">
                        {safeNum(q.volumeM3, '—') !== '—' ? q.volumeM3.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-300">
                        {safeNum(q.tonnage, '—') !== '—' ? q.tonnage.toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-zinc-400">
                        {safeNum(q.density, '—') !== '—' ? q.density : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── PAVEMENT STRUCTURE SVG ───────────────────────────────────────────────────

function PavementStructureDiagram({ layers }: { layers: PavementLayer[] }) {
  const width = 400
  const layerHeight = 50
  const subgradeHeight = 60
  const height = layers.length * layerHeight + subgradeHeight + 60
  const padX = 80
  const padY = 30
  const layerWidth = width - padX * 2

  const totalThickness = layers.reduce((s, l) => s + l.thicknessMm, 0)

  let y = padY

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md mx-auto">
      {layers.map((layer, i) => {
        const currentY = y
        y += layerHeight
        return (
          <g key={layer.name}>
            <rect x={padX} y={currentY} width={layerWidth} height={layerHeight} fill={layer.color} rx={i === 0 ? 6 : 0} />
            {i > 0 && <line x1={padX} y1={currentY} x2={padX + layerWidth} y2={currentY} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />}
            <text x={padX + layerWidth / 2} y={currentY + layerHeight / 2 + 4} textAnchor="middle" fill="white" fontSize="11" fontWeight="500">
              {layer.name}
            </text>
            <text x={padX - 8} y={currentY + layerHeight / 2 + 4} textAnchor="end" fill="#d4d4d8" fontSize="10" fontWeight="500">
              {layer.thicknessMm}
            </text>
          </g>
        )
      })}
      {/* Subgrade */}
      <rect x={padX} y={y} width={layerWidth} height={subgradeHeight} fill="#52525b" rx={0} />
      <text x={padX + layerWidth / 2} y={y + subgradeHeight / 2 + 4} textAnchor="middle" fill="#d4d4d8" fontSize="11">Subgrade</text>
      {/* Total annotation */}
      <text x={padX - 8} y={padY - 10} textAnchor="end" fill="#d4d4d8" fontSize="12" fontWeight="600">
        {Number.isFinite(totalThickness) ? `${totalThickness} mm` : '—'}
      </text>
      <line x1={padX - 25} y1={padY} x2={padX - 25} y2={y} stroke="#d4d4d8" strokeWidth={1.5} />
      <line x1={padX - 30} y1={padY} x2={padX - 20} y2={padY} stroke="#d4d4d8" strokeWidth={1.5} />
      <line x1={padX - 30} y1={y} x2={padX - 20} y2={y} stroke="#d4d4d8" strokeWidth={1.5} />
    </svg>
  )
}
