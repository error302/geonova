'use client'

import { useMemo, useState } from 'react'
import {
  buildCorridorBoQ,
  formatBoQText,
  formatBoQCSV,
  type CorridorSection,
  type CorridorBoQResult,
} from '@/lib/engineering/corridorBoQ'
import {
  renderCrossSectionPlot,
  renderCorridorSummary,
  type CrossSectionPlotData,
} from '@/lib/engineering/crossSectionRenderer'
import type { ProfilePoint } from '@/lib/engineering/crossSectionGeometry'

interface SectionEditorRow {
  id: number
  chainage: string
  carriagewayWidth: string
  shoulderWidth: string
  subgradeDepth: string
  /** Lines of "offset,groundLevel,formationLevel" */
  profileText: string
}

const EMPTY_ROW: SectionEditorRow = {
  id: 0,
  chainage: '',
  carriagewayWidth: '7',
  shoulderWidth: '1.5',
  subgradeDepth: '0.5',
  profileText: '',
}

function parseRow(row: SectionEditorRow): CorridorSection | null {
  const chainage = Number(row.chainage)
  const carriagewayWidth = Number(row.carriagewayWidth)
  const shoulderWidth = Number(row.shoulderWidth)
  const subgradeDepth = Number(row.subgradeDepth)
  if (!Number.isFinite(chainage)) return null

  const groundPoints: ProfilePoint[] = []
  const formationPoints: ProfilePoint[] = []
  for (const rawLine of row.profileText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const parts = line.split(',').map((s) => s.trim())
    if (parts.length < 3) return null
    const offset = Number(parts[0])
    const ground = Number(parts[1])
    const formation = Number(parts[2])
    if (![offset, ground, formation].every(Number.isFinite)) return null
    groundPoints.push({ offset, level: ground })
    formationPoints.push({ offset, level: formation })
  }
  if (groundPoints.length < 2 || formationPoints.length < 2) return null

  return { chainage, groundPoints, formationPoints, template: { carriagewayWidth, shoulderWidth, subgradeDepth } }
}

function parseRows(rows: SectionEditorRow[]): { sections: CorridorSection[]; invalid: string[] } {
  const sections: CorridorSection[] = []
  const invalid: string[] = []
  rows.forEach((row) => {
    if (!row.chainage.trim() && !row.profileText.trim()) return
    const parsed = parseRow(row)
    if (parsed) sections.push(parsed)
    else invalid.push(row.chainage.trim() || `row ${row.id + 1}`)
  })
  sections.sort((a, b) => a.chainage - b.chainage)
  return { sections, invalid }
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function printText(title: string, text: string) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:'Courier New',monospace;padding:24px;white-space:pre;font-size:12px}</style></head><body>${text.replace(/</g, '&lt;')}</body></html>`)
  win.document.close()
  setTimeout(() => { win.focus(); win.print() }, 400)
}

export default function CorridorEarthworks() {
  const [rows, setRows] = useState<SectionEditorRow[]>([{ ...EMPTY_ROW, id: 1 }])
  const [computed, setComputed] = useState<{ boq: CorridorBoQResult; plots: CrossSectionPlotData[] } | null>(null)

  const updateRow = (id: number, patch: Partial<SectionEditorRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows((prev) => [...prev, { ...EMPTY_ROW, id: Math.max(0, ...prev.map((r) => r.id)) + 1 }])
  }

  const removeRow = (id: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
  }

  const runComputation = () => {
    const { sections, invalid } = parseRows(rows)
    if (invalid.length > 0) {
      alert(`Could not parse these cross-sections: ${invalid.join(', ')}.\nEach profile line must be "offset,groundLevel,formationLevel" (e.g. -12,100.5,101.2).`)
      return
    }
    if (sections.length < 2) {
      alert('Enter at least 2 cross-sections to compute end-area volumes.')
      return
    }
    const boq = buildCorridorBoQ(sections)
    const plots: CrossSectionPlotData[] = sections.map((s) => ({
      chainage: s.chainage,
      groundPoints: s.groundPoints,
      formationPoints: s.formationPoints,
      cutArea: 0,
      fillArea: 0,
      sectionType: 'cut',
    }))
    setComputed({ boq, plots })
  }

  const plotSvgs = useMemo<{ sections: string[]; summary: string }>(() => {
    if (!computed) return { sections: [], summary: '' }
    const { sections } = parseRows(rows)
    const data: CrossSectionPlotData[] = sections.map((s) => {
      let cutArea = 0
      let fillArea = 0
      const row = computed.boq.rows.find((r) => r.fromChainage <= s.chainage && s.chainage <= r.toChainage)
      if (row) {
        cutArea = row.cutAreaTo
        fillArea = row.fillAreaTo
      }
      return {
        chainage: s.chainage,
        groundPoints: s.groundPoints,
        formationPoints: s.formationPoints,
        cutArea,
        fillArea,
        sectionType: cutArea > 0 ? 'cut' : 'fill',
      }
    })
    const volumes = computed.boq.rows.map((r) => ({
      chainage: (r.fromChainage + r.toChainage) / 2,
      cutVolume: r.cutVolume,
      fillVolume: r.fillVolume,
    }))
    return {
      sections: data.map((d) => renderCrossSectionPlot(d)),
      summary: renderCorridorSummary(data, volumes),
    }
  }, [computed, rows])

  return (
    <div className="space-y-4">
      <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-4 text-sm">
        <p className="text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">Corridor Earthworks Deliverables</strong> — end-area cut/fill volumes,
          a priced BoQ, and cross-section plots generated from your alignment data (Kenya RDM 1.1, §8).
        </p>
        <p className="text-[var(--text-muted)] mt-1 text-xs">
          Enter at least two cross-sections. Each profile line: <span className="font-mono">offset,groundLevel,formationLevel</span> (e.g. <span className="font-mono">-12,100.5,101.2</span>).
        </p>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Cross-Sections</h3>
          <div className="flex gap-2">
            <button onClick={addRow} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent)]">+ Add section</button>
            <button onClick={runComputation} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)]">Compute BoQ</button>
          </div>
        </div>

        <div className="divide-y divide-[var(--border-color)]">
          {rows.map((row) => (
            <div key={row.id} className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)] font-semibold w-4">#{row.id}</span>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">Chainage (m)</label>
                    <input value={row.chainage} onChange={(e) => updateRow(row.id, { chainage: e.target.value })} placeholder="e.g. 0" className="input w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">Carriageway (m)</label>
                    <input value={row.carriagewayWidth} onChange={(e) => updateRow(row.id, { carriagewayWidth: e.target.value })} className="input w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">Shoulder (m)</label>
                    <input value={row.shoulderWidth} onChange={(e) => updateRow(row.id, { shoulderWidth: e.target.value })} className="input w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1">Subgrade (m)</label>
                    <input value={row.subgradeDepth} onChange={(e) => updateRow(row.id, { subgradeDepth: e.target.value })} className="input w-full text-sm" />
                  </div>
                </div>
                <button onClick={() => removeRow(row.id)} title="Remove section" className="text-[var(--text-muted)] hover:text-red-400 flex-shrink-0">✕</button>
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] block mb-1">Profile (one point per line: <span className="font-mono">offset,ground,formation</span>)</label>
                <textarea
                  value={row.profileText}
                  onChange={(e) => updateRow(row.id, { profileText: e.target.value })}
                  rows={4}
                  className="input w-full resize-none text-sm font-mono"
                  placeholder={['-12,100.5,101.2', '-6,100.2,100.9', '0,99.8,100.8', '6,100.1,100.9', '12,100.4,101.2'].join('\n')}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {computed && (
        <div className="space-y-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Volume Summary</h3>
              <div className="flex gap-2">
                <button onClick={() => downloadText('corridor-boq.csv', formatBoQCSV(computed.boq), 'text/csv')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent)]">Download CSV</button>
                <button onClick={() => downloadText('corridor-boq.txt', formatBoQText(computed.boq), 'text/plain')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--accent)]">Download TXT</button>
                <button onClick={() => printText('Corridor BoQ', formatBoQText(computed.boq))} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)]">Print BoQ</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total distance', value: `${computed.boq.summary.totalDistance.toFixed(2)} m` },
                { label: 'Cut volume', value: `${computed.boq.totalCutVolume.toFixed(1)} m³` },
                { label: 'Fill volume', value: `${computed.boq.totalFillVolume.toFixed(1)} m³` },
                { label: 'Net volume', value: `${computed.boq.netVolume.toFixed(1)} m³ (${computed.boq.netVolume > 0 ? 'surplus' : 'deficit'})` },
              ].map((s) => (
                <div key={s.label} className="bg-[var(--bg-tertiary)] rounded-lg px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">{s.label}</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)] mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    <th className="text-left py-2">From</th>
                    <th className="text-left py-2">To</th>
                    <th className="text-right py-2">Dist (m)</th>
                    <th className="text-right py-2">Cut A₁</th>
                    <th className="text-right py-2">Cut A₂</th>
                    <th className="text-right py-2">Fill A₁</th>
                    <th className="text-right py-2">Fill A₂</th>
                    <th className="text-right py-2">Cut Vol (m³)</th>
                    <th className="text-right py-2">Fill Vol (m³)</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.boq.rows.map((r, i) => (
                    <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
                      <td className="py-2 font-mono">{r.fromChainage.toFixed(2)}</td>
                      <td className="py-2 font-mono">{r.toChainage.toFixed(2)}</td>
                      <td className="py-2 text-right">{r.distance.toFixed(2)}</td>
                      <td className="py-2 text-right">{r.cutAreaFrom.toFixed(2)}</td>
                      <td className="py-2 text-right">{r.cutAreaTo.toFixed(2)}</td>
                      <td className="py-2 text-right">{r.fillAreaFrom.toFixed(2)}</td>
                      <td className="py-2 text-right">{r.fillAreaTo.toFixed(2)}</td>
                      <td className="py-2 text-right font-semibold text-red-400">{r.cutVolume.toFixed(1)}</td>
                      <td className="py-2 text-right font-semibold text-blue-400">{r.fillVolume.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {computed.boq.boqItems.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Priced BoQ Items</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="border-b border-[var(--border-color)]">
                        <th className="text-left py-2">Item</th>
                        <th className="text-left py-2">Description</th>
                        <th className="text-left py-2">Unit</th>
                        <th className="text-right py-2">Qty</th>
                        <th className="text-right py-2">Rate (KES)</th>
                        <th className="text-right py-2">Amount (KES)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computed.boq.boqItems.map((item, i) => (
                        <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
                          <td className="py-2 font-mono">{item.itemNo}</td>
                          <td className="py-2">{item.description}</td>
                          <td className="py-2">{item.unit}</td>
                          <td className="py-2 text-right">{item.quantity.toFixed(2)}</td>
                          <td className="py-2 text-right">{item.rate.toLocaleString()}</td>
                          <td className="py-2 text-right font-semibold">{item.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Corridor Summary</h3>
            <div className="bg-white rounded-lg p-3" dangerouslySetInnerHTML={{ __html: plotSvgs.summary }} />
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Cross-Section Plots</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {plotSvgs.sections.map((svg, i) => (
                <div key={i} className="bg-white rounded-lg p-2" dangerouslySetInnerHTML={{ __html: svg }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}