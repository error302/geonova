'use client'

import type { Dispatch, SetStateAction } from 'react'

type Translator = (key: string, values?: Record<string, string | number>) => string

export type HydroRow = { id: string; soundingId: string; easting: string; northing: string; depth: string; tide: string; remarks: string }

export function HydroBook({
  t,
  rows,
  setRows,
  computed,
}: {
  t: Translator
  rows: HydroRow[]
  setRows: Dispatch<SetStateAction<HydroRow[]>>
  computed: { ok: true; rows: any[] } | { ok: false; errors: string[] }
}) {
  const outRows = computed.ok ? computed.rows : []

  return (
    <div className="card">
      <div className="card-header">
        <span className="label">{t('field.hydroNotes')}</span>
      </div>
      <div className="card-body space-y-4">
        <div className="overflow-x-auto">
          <table className="table min-w-[980px]">
            <thead>
              <tr>
                <th className="text-left">{t('field.soundingId')}</th>
                <th className="text-right">{t('common.easting')}</th>
                <th className="text-right">{t('common.northing')}</th>
                <th className="text-right">{t('field.depth')}</th>
                <th className="text-right">{t('field.tide')}</th>
                <th className="text-right">{t('field.correctedDepth')}</th>
                <th className="text-left">{t('common.remarks')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const out = outRows[idx]
                return (
                  <tr key={r.id}>
                    <td className="text-left"><input className="input" value={r.soundingId} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, soundingId: e.target.value } : x)))} /></td>
                    <td><input inputMode="decimal" className="input font-mono" value={r.easting} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, easting: e.target.value } : x)))} /></td>
                    <td><input inputMode="decimal" className="input font-mono" value={r.northing} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, northing: e.target.value } : x)))} /></td>
                    <td><input inputMode="decimal" className="input font-mono" value={r.depth} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, depth: e.target.value } : x)))} /></td>
                    <td><input inputMode="decimal" className="input font-mono" value={r.tide} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, tide: e.target.value } : x)))} /></td>
                    <td className="font-mono text-right">{out?.corrected !== null && out?.corrected !== undefined ? Number(out.corrected).toFixed(3) : '—'}</td>
                    <td className="text-left"><input className="input" value={r.remarks} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, remarks: e.target.value } : x)))} /></td>
                    <td><button className="btn btn-secondary text-xs" onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))}>{t('common.remove')}</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button onClick={() => setRows((p) => [...p, { id: crypto.randomUUID(), soundingId: `S${p.length + 1}`, easting: '', northing: '', depth: '', tide: '0', remarks: '' }])} className="btn btn-secondary">
          {t('common.addRow')}
        </button>
      </div>
    </div>
  )
}

