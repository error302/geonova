'use client'

/**
 * SectionalPlanEditor — 3D Cadastre for Sectional Properties Act
 *
 * Features:
 * - Add/manage units with floor number, type, area
 * - Auto-calculate unit factors (10,000 total, proportional to area)
 * - Mark areas as: Unit, Exclusive Use, or Common Property
 * - Real-time validation
 * - Export Form SP-1 data
 *
 * Per Sectional Properties Act (2012):
 *   Unit Factor = (Unit Area / Total Unit Area) × 10,000
 */

import { useState, useCallback, useMemo } from 'react'
import {
  Building2, Plus, Trash2, Calculator, CheckCircle2, AlertTriangle,
  Download, Layers, Home, Car, Briefcase, Factory,
} from 'lucide-react'
import {
  computeSectionalPlan,
  validateSectionalPlan,
  generateFormSP1Data,
  type SectionalUnit,
  type UnitType,
  type AreaCategory,
} from '@/lib/survey/sectionalProperties'

const UNIT_TYPE_ICONS: Record<UnitType, typeof Home> = {
  residential: Home,
  commercial: Briefcase,
  office: Briefcase,
  industrial: Factory,
  parking: Car,
  storage: Briefcase,
}

const AREA_CATEGORY_COLORS: Record<AreaCategory, string> = {
  unit: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  exclusive_use: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  common_property: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
}

export function SectionalPlanEditor() {
  const [buildingName, setBuildingName] = useState('')
  const [parentParcel, setParentParcel] = useState('')
  const [parentTitle] = useState('')
  const [parentArea, setParentArea] = useState('')
  const [totalFloors, setTotalFloors] = useState('1')
  const [surveyorName] = useState('')
  const [surveyorLicense] = useState('')
  const [units, setUnits] = useState<SectionalUnit[]>([
    {
      id: crypto.randomUUID(),
      unitNumber: 'A-101',
      unitType: 'residential',
      floorNumber: 0,
      floorAreaSqM: 120,
      areaCategory: 'unit',
    },
    {
      id: crypto.randomUUID(),
      unitNumber: 'A-102',
      unitType: 'residential',
      floorNumber: 0,
      floorAreaSqM: 80,
      areaCategory: 'unit',
    },
  ])

  // Compute the sectional plan
  const plan = useMemo(() => {
    const area = parseFloat(parentArea) || 0
    return computeSectionalPlan({
      id: crypto.randomUUID(),
      parentParcelNumber: parentParcel,
      parentTitleDeed: parentTitle,
      parentAreaHectares: area,
      buildingName,
      totalFloors: parseInt(totalFloors) || 1,
      units,
      preparedDate: new Date().toISOString().split('T')[0],
      surveyorName,
      surveyorLicense,
    })
  }, [parentParcel, parentTitle, parentArea, buildingName, totalFloors, units, surveyorName, surveyorLicense])

  const validation = useMemo(() => validateSectionalPlan(plan), [plan])

  const addUnit = useCallback(() => {
    setUnits(prev => [...prev, {
      id: crypto.randomUUID(),
      unitNumber: `A-${prev.length + 101}`,
      unitType: 'residential',
      floorNumber: 0,
      floorAreaSqM: 100,
      areaCategory: 'unit',
    }])
  }, [])

  const updateUnit = useCallback((id: string, updates: Partial<SectionalUnit>) => {
    setUnits(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u))
  }, [])

  const removeUnit = useCallback((id: string) => {
    setUnits(prev => prev.filter(u => u.id !== id))
  }, [])

  const handleExport = useCallback(() => {
    const sp1Data = generateFormSP1Data(plan)
    const json = JSON.stringify(sp1Data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `form-sp1-${plan.id.substring(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [plan])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Sectional Plan Editor</h2>
              <p className="text-[10px] text-gray-500">Sectional Properties Act 2012 — Unit Factor Distribution</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={!validation.isValid}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-[var(--accent)] text-xs font-medium hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            Export Form SP-1
          </button>
        </div>

        {/* Property details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="building-name">Building Name</label>
            <input id="building-name" type="text" value={buildingName} onChange={e => setBuildingName(e.target.value)} placeholder="Sunset Apartments" className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none" />
          </div>
          <div>
            <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="parent-parcel-no">Parent Parcel No.</label>
            <input id="parent-parcel-no" type="text" value={parentParcel} onChange={e => setParentParcel(e.target.value)} placeholder="LR 12345/678" className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono placeholder-gray-600 focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none" />
          </div>
          <div>
            <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="parent-area-ha">Parent Area (ha)</label>
            <input id="parent-area-ha" type="number" step="0.0001" value={parentArea} onChange={e => setParentArea(e.target.value)} placeholder="0.0500" className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono placeholder-gray-600 focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none" />
          </div>
          <div>
            <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="total-floors">Total Floors</label>
            <input  id="total-floors" aria-label="Total Floors" type="number" min="1" value={totalFloors} onChange={e => setTotalFloors(e.target.value)} className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total Units" value={plan.units.filter(u => u.areaCategory === 'unit').length} icon={Home} color="text-blue-400" />
        <SummaryCard label="Unit Area (m²)" value={plan.totalUnitAreaSqM.toFixed(2)} icon={Calculator} color="text-[var(--accent)]" />
        <SummaryCard label="Exclusive Use" value={plan.totalExclusiveUseAreaSqM.toFixed(2) + ' m²'} icon={Car} color="text-amber-400" />
        <SummaryCard label="Common Property" value={plan.totalCommonPropertyAreaSqM.toFixed(2) + ' m²'} icon={Layers} color="text-purple-400" />
        <SummaryCard label="Unit Factors" value={`${plan.totalUnitFactors} / 10000`} icon={CheckCircle2} color={plan.totalUnitFactors === 10000 ? 'text-emerald-400' : 'text-red-400'} />
      </div>

      {/* Validation */}
      {!validation.isValid && (
        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-medium text-red-400">Validation Errors</span>
          </div>
          <ul className="text-[11px] text-red-400/80 list-disc list-inside">
            {validation.errors.map((e, i) => <li key={`${e}-${i}`}>{e}</li>)}
          </ul>
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">Warnings</span>
          </div>
          <ul className="text-[11px] text-amber-400/80 list-disc list-inside">
            {validation.warnings.map((w, i) => <li key={`${w}-${i}`}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Units table */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Units & Areas</span>
          <button
            onClick={addUnit}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] text-[var(--accent)] text-xs font-medium hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Unit
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="px-2 py-2 text-left text-[9px] text-gray-500 uppercase tracking-wider">Unit No.</th>
                <th className="px-2 py-2 text-left text-[9px] text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-2 py-2 text-center text-[9px] text-gray-500 uppercase tracking-wider">Floor</th>
                <th className="px-2 py-2 text-right text-[9px] text-gray-500 uppercase tracking-wider">Area (m²)</th>
                <th className="px-2 py-2 text-center text-[9px] text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-2 py-2 text-right text-[9px] text-gray-500 uppercase tracking-wider">Unit Factor</th>
                <th className="px-2 py-2 text-right text-[9px] text-gray-500 uppercase tracking-wider">%</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {units.map(unit => {
                const TypeIcon = UNIT_TYPE_ICONS[unit.unitType]
                const catColor = AREA_CATEGORY_COLORS[unit.areaCategory]
                return (
                  <tr key={unit.id} className="border-b border-[color-mix(in_srgb,var(--border-color)_50%,transparent)] hover:bg-white/[0.02]">
                    <td className="px-2 py-2">
                      <input aria-label="Unitnumber"
                        type="text"
                        value={unit.unitNumber}
                        onChange={e => updateUnit(unit.id, { unitNumber: e.target.value })}
                        className="w-20 h-7 px-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)] font-mono focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <TypeIcon className="w-3 h-3 text-gray-400" />
                        <select
                          value={unit.unitType}
                          onChange={e => updateUnit(unit.id, { unitType: e.target.value as UnitType })}
                          className="h-7 px-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[10px] text-[var(--text-primary)]"
                        >
                          <option value="residential">Residential</option>
                          <option value="commercial">Commercial</option>
                          <option value="office">Office</option>
                          <option value="industrial">Industrial</option>
                          <option value="parking">Parking</option>
                          <option value="storage">Storage</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input aria-label="Floornumber"
                        type="number"
                        value={unit.floorNumber}
                        onChange={e => updateUnit(unit.id, { floorNumber: parseInt(e.target.value) || 0 })}
                        className="w-12 h-7 px-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)] text-center font-mono focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input aria-label="Floorareasqm"
                        type="number"
                        step="0.01"
                        value={unit.floorAreaSqM}
                        onChange={e => updateUnit(unit.id, { floorAreaSqM: parseFloat(e.target.value) || 0 })}
                        className="w-20 h-7 px-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)] text-right font-mono focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <select
                        value={unit.areaCategory}
                        onChange={e => updateUnit(unit.id, { areaCategory: e.target.value as AreaCategory })}
                        className={`h-7 px-1.5 rounded border text-[9px] font-medium ${catColor}`}
                      >
                        <option value="unit">Unit</option>
                        <option value="exclusive_use">Exclusive</option>
                        <option value="common_property">Common</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {unit.areaCategory === 'unit' ? (
                        <span className="text-xs font-mono font-bold text-[var(--accent)]">
                          {unit.unitFactor || 0}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {unit.areaCategory === 'unit' ? (
                        <span className="text-[10px] text-gray-400 font-mono">
                          {(unit.percentage || 0).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => removeUnit(unit.id)}
                        className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border-color)]">
                <td colSpan={3} className="px-2 py-2 text-right text-[10px] text-gray-500 uppercase tracking-wider">Totals:</td>
                <td className="px-2 py-2 text-right text-xs font-mono font-bold text-[var(--text-primary)]">
                  {plan.totalUnitAreaSqM.toFixed(2)}
                </td>
                <td colSpan={2} className="px-2 py-2 text-right text-xs font-mono font-bold text-[var(--accent)]">
                  {plan.totalUnitFactors} / 10000
                </td>
                <td className="px-2 py-2 text-right text-[10px] text-gray-400 font-mono">
                  100.00%
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
        <Calculator className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-blue-400/70 leading-relaxed">
          Per the Sectional Properties Act (2012), exactly 10,000 unit factors are distributed across all units proportional to floor area.
          Formula: Unit Factor = (Unit Area ÷ Total Unit Area) × 10,000.
          Exclusive Use and Common Property areas are excluded from unit factor calculation.
        </p>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof Home; color: string }) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-base font-bold ${color}`}>{value}</div>
    </div>
  )
}
