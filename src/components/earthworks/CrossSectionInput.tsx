'use client'

import { useState, useRef } from 'react'
import { computeCrossSection, computeEarthwork, parseEarthworkCSV, type CrossSectionInput, type CrossSectionComputed, type RoadTemplate, type EarthworkResult, type GroundShot } from '@/lib/computations/earthworksEngine'
import CrossSectionDrawing from './CrossSectionDrawing'
import EarthworkQuantitiesTable from './EarthworkQuantitiesTable'
import MassHaulDiagram from './MassHaulDiagram'

const DEFAULT_TEMPLATE: RoadTemplate = {
  carriagewayWidth: 7.0,
  shoulderWidth: 1.5,
  camber: 2.5,
  cutSlopeH: 1,
  fillSlopeH: 1.5,
}

interface SectionRow {
  id: string
  chainageKm: string
  chainageM: string
  clRL: string
  formRL: string
  leftShots: Array<{ off: string; rl: string }>
  rightShots: Array<{ off: string; rl: string }>
}

const EMPTY_ROW = (): SectionRow => ({
  id: crypto.randomUUID(),
  chainageKm: '0',
  chainageM: '0',
  clRL: '',
  formRL: '',
  leftShots: [{ off: '', rl: '' }, { off: '', rl: '' }],
  rightShots: [{ off: '', rl: '' }, { off: '', rl: '' }],
})

export default function EarthworksCalculator() {
  const [sections, setSections] = useState<SectionRow[]>([EMPTY_ROW()])
  const [template, setTemplate] = useState<RoadTemplate>(DEFAULT_TEMPLATE)
  const [shrinkage, setShrinkage] = useState('0.85')
  const [computedSections, setComputedSections] = useState<CrossSectionComputed[]>([])
  const [earthworkResult, setEarthworkResult] = useState<EarthworkResult | null>(null)
  const [activeSection, setActiveSection] = useState(0)
  const [csvError, setCsvError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function chainageToNum(row: SectionRow): number {
    return (parseFloat(row.chainageKm) || 0) * 1000 + (parseFloat(row.chainageM) || 0)
  }

  function toInput(row: SectionRow): CrossSectionInput {
    return {
      chainage: chainageToNum(row),
      centrelineRL: parseFloat(row.clRL) || 0,
      formationRL: parseFloat(row.formRL) || 0,
      leftShots: row.leftShots
        .filter((s: any) => s.off && s.rl)
        .map((s: any) => ({ offset: -(parseFloat(s.off) || 0), rl: parseFloat(s.rl) || 0 }))
        .sort((a: any, b: any) => a.offset - b.offset),
      rightShots: row.rightShots
        .filter((s: any) => s.off && s.rl)
        .map((s: any) => ({ offset: parseFloat(s.off) || 0, rl: parseFloat(s.rl) || 0 }))
        .sort((a: any, b: any) => a.offset - b.offset),
    }
  }

  function compute() {
    const inputs = sections.map(toInput).sort((a: any, b: any) => a.chainage - b.chainage)
    const computed = inputs.map((s: any) => computeCrossSection(s, template))
    const ew = computeEarthwork(computed, parseFloat(shrinkage) || 0.85)
    setComputedSections(computed)
    setEarthworkResult(ew)
  }

  function addRow() {
    setSections(prev => [...prev, EMPTY_ROW()])
  }

  function removeRow(id: string) {
    setSections(prev => prev.filter((r: any) => r.id !== id))
  }

  function updateRow(id: string, field: keyof SectionRow, value: unknown) {
    setSections(prev => prev.map((r: any) => r.id === id ? { ...r, [field]: value } : r))
  }

  function updateShot(id: string, side: 'left' | 'right', idx: number, field: 'off' | 'rl', value: string) {
    setSections(prev => prev.map((r: any) => {
      if (r.id !== id) return r
      const shots = [...r[(side + 'Shots') as 'leftShots' | 'rightShots']]
      shots[idx] = { ...shots[idx], [field]: value }
      return { ...r, [side + 'Shots']: shots }
    }))
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError('')
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string
        const parsed = parseEarthworkCSV(text)
        if (parsed.length === 0) { setCsvError('No valid sections found in CSV'); return }
          const rows: SectionRow[] = parsed.map((s: any) => {
            const km = Math.floor(s.chainage / 1000)
            const m = s.chainage % 1000
            return {
              id: crypto.randomUUID(),
              chainageKm: String(km),
              chainageM: m.toFixed(3),
              clRL: s.centrelineRL.toFixed(3),
              formRL: s.formationRL.toFixed(3),
              leftShots: s.leftShots.map((sh: any) => ({ off: Math.abs(sh.offset).toFixed(3), rl: sh.rl.toFixed(3) })),
              rightShots: s.rightShots.map((sh: any) => ({ off: sh.offset.toFixed(3), rl: sh.rl.toFixed(3) })),
            }
          })
        setSections(rows)
      } catch {
        setCsvError('Failed to parse CSV. Check format.')
      }
    }
    reader.readAsText(file)
  }

  function fmtCh(ch: number) {
    const km = Math.floor(ch / 1000)
    const m = ch % 1000
    return km > 0 ? `${km}+${m.toFixed(3)}` : `${m.toFixed(3)}`
  }

  return (
    <div className="space-y-8">
      {/* Template Settings */}
      <div className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Road Template Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Carriageway Width (m)', key: 'carriagewayWidth' as keyof RoadTemplate },
            { label: 'Shoulder Width (m)', key: 'shoulderWidth' as keyof RoadTemplate },
            { label: 'Camber (%)', key: 'camber' as keyof RoadTemplate },
            { label: 'Cut Slope H:V', key: 'cutSlopeH' as keyof RoadTemplate },
            { label: 'Fill Slope H:V', key: 'fillSlopeH' as keyof RoadTemplate },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
              <input
                type="number"
                step="0.01"
                value={template[key] as number}
                onChange={e => setTemplate(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Shrinkage Factor</label>
            <input type="number" step="0.01" value={shrinkage} onChange={e => setShrinkage(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
          </div>
        </div>
      </div>

      {/* Data Entry Table */}
      <div className="overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Cross Section Data</h3>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs border border-[var(--border-color)] rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
              Import CSV
            </button>
            <button onClick={addRow} className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:opacity-90">
              + Add Section
            </button>
            <button onClick={compute} className="px-4 py-1.5 text-xs bg-[var(--accent)] text-white rounded font-medium hover:opacity-90">
              Compute All
            </button>
          </div>
        </div>
        {csvError && <p className="text-xs text-red-400 mb-2">{csvError}</p>}
        <p className="text-xs text-[var(--text-muted)] mb-2">
          Format: Chainage (km), Chainage (m), CL RL, Form RL, then L4_off, L4_rl, L3_off, L3_rl, L2_off, L2_rl, L1_off, L1_rl, R1_off, R1_rl, R2_off, R2_rl, R3_off, R3_rl, R4_off, R4_rl
        </p>
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-[var(--bg-tertiary)]">
              <th className="px-2 py-2 text-left border border-[var(--border-color)] text-[var(--text-muted)] font-medium">Ch km</th>
              <th className="px-2 py-2 text-left border border-[var(--border-color)] text-[var(--text-muted)] font-medium">Ch m</th>
              <th className="px-2 py-2 text-left border border-[var(--border-color)] text-[var(--text-muted)] font-medium">CL RL</th>
              <th className="px-2 py-2 text-left border border-[var(--border-color)] text-[var(--text-muted)] font-medium">Form RL</th>
              <th className="px-2 py-2 text-left border border-[var(--border-color)] text-[var(--text-muted)] font-medium" colSpan={4}>Left Shots (outer→CL)</th>
              <th className="px-2 py-2 text-left border border-[var(--border-color)] text-[var(--text-muted)] font-medium" colSpan={4}>Right Shots (CL→outer)</th>
              <th className="px-2 py-2 border border-[var(--border-color)]"></th>
            </tr>
            <tr className="bg-[var(--bg-tertiary)]/50">
              <th className="border border-[var(--border-color)]"></th>
              <th className="border border-[var(--border-color)]"></th>
              <th className="border border-[var(--border-color)]"></th>
              <th className="border border-[var(--border-color)]"></th>
              {['Off', 'RL', 'Off', 'RL', 'Off', 'RL', 'Off', 'RL'].map((h, i) => (
                <th key={i} className="px-2 py-1 border border-[var(--border-color)] text-[var(--text-muted)] font-medium text-[10px]">{h}</th>
              ))}
              <th className="border border-[var(--border-color)]"></th>
            </tr>
          </thead>
          <tbody>
            {sections.map((row: any) => (
              <tr key={row.id} className="hover:bg-[var(--bg-tertiary)]/30">
                <td className="px-1 py-1 border border-[var(--border-color)]/50"><input value={row.chainageKm} onChange={e => updateRow(row.id, 'chainageKm', e.target.value)} type="number" min="0" className="w-full px-1 py-1 bg-transparent text-[var(--text-primary)]" /></td>
                <td className="px-1 py-1 border border-[var(--border-color)]/50"><input value={row.chainageM} onChange={e => updateRow(row.id, 'chainageM', e.target.value)} type="number" min="0" className="w-full px-1 py-1 bg-transparent text-[var(--text-primary)]" /></td>
                <td className="px-1 py-1 border border-[var(--border-color)]/50"><input value={row.clRL} onChange={e => updateRow(row.id, 'clRL', e.target.value)} type="number" step="0.001" className="w-full px-1 py-1 bg-transparent text-[var(--text-primary)]" /></td>
                <td className="px-1 py-1 border border-[var(--border-color)]/50"><input value={row.formRL} onChange={e => updateRow(row.id, 'formRL', e.target.value)} type="number" step="0.001" className="w-full px-1 py-1 bg-transparent text-[var(--text-primary)]" /></td>
                {[0, 1, 2, 3].map((i: any) => (
                  <td key={'lo' + i} className="px-1 py-1 border border-[var(--border-color)]/50"><input value={row.leftShots[i]?.off || ''} onChange={e => updateShot(row.id, 'left', i, 'off', e.target.value)} type="number" step="0.001" className="w-14 px-1 py-1 bg-transparent text-[var(--text-primary)]" /></td>
                ))}
                {[0, 1, 2, 3].map((i: any) => (
                  <td key={'ri' + i} className="px-1 py-1 border border-[var(--border-color)]/50"><input value={row.rightShots[i]?.off || ''} onChange={e => updateShot(row.id, 'right', i, 'off', e.target.value)} type="number" step="0.001" className="w-14 px-1 py-1 bg-transparent text-[var(--text-primary)]" /></td>
                ))}
                {[0, 1, 2, 3].map((i: any) => (
                  <td key={'rl' + i} className="px-1 py-1 border border-[var(--border-color)]/50"><input value={row.rightShots[i]?.rl || ''} onChange={e => updateShot(row.id, 'right', i, 'rl', e.target.value)} type="number" step="0.001" className="w-14 px-1 py-1 bg-transparent text-[var(--text-primary)]" /></td>
                ))}
                <td className="px-1 py-1 border border-[var(--border-color)]/50">
                  <button onClick={() => removeRow(row.id)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Results */}
      {computedSections.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ['Total Sections', String(computedSections.length)],
              ['Total Cut (Prismoidal)', `${earthworkResult?.totalCutPrismoidal.toFixed(2) || 0} m³`],
              ['Total Fill (Prismoidal)', `${earthworkResult?.totalFillPrismoidal.toFixed(2) || 0} m³`],
              ['Adjusted Cut (× Shrinkage)', `${earthworkResult?.adjustedCut.toFixed(2) || 0} m³`],
              ['Net Balance', `${((earthworkResult?.adjustedCut || 0) - (earthworkResult?.totalFillPrismoidal || 0)).toFixed(2)} m³`],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-3">
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
                <p className="text-base font-mono text-[var(--text-primary)]">{value}</p>
              </div>
            ))}
          </div>

          {/* Section drawings + quantities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {computedSections.map((s, i) => (
                  <button key={i} onClick={() => setActiveSection(i)}
                    className={`px-3 py-1.5 text-xs rounded whitespace-nowrap ${i === activeSection ? 'bg-[var(--accent)] text-white' : 'border border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                    {fmtCh(s.chainage)}
                  </button>
                ))}
              </div>
              {computedSections[activeSection] && (
                <CrossSectionDrawing section={computedSections[activeSection]} template={template} />
              )}
            </div>

            <div>
              <EarthworkQuantitiesTable result={earthworkResult} sections={computedSections} />
            </div>
          </div>

          {/* Mass Haul Diagram */}
          {earthworkResult && earthworkResult.massOrdinates.length > 1 && (
            <MassHaulDiagram result={earthworkResult} />
          )}
        </>
      )}
    </div>
  )
}
