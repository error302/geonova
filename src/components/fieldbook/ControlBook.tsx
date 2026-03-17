'use client'

import type { Dispatch, SetStateAction } from 'react'

type Translator = (key: string, values?: Record<string, string | number>) => string

export type ControlRow = {
  id: string
  pointId: string
  instrumentHeight: string
  targetHeight: string
  bearing: string
  verticalAngle: string
  slopeDistance: string
  remarks: string
}

export function ControlBook({
  t,
  station,
  setStation,
  rows,
  setRows,
  computed,
}: {
  t: Translator
  station: { name: string; e: string; n: string; z: string }
  setStation: Dispatch<SetStateAction<{ name: string; e: string; n: string; z: string }>>
  rows: ControlRow[]
  setRows: Dispatch<SetStateAction<ControlRow[]>>
  computed: { ok: true; rows: any[] } | { ok: false; errors: string[] }
}) {
  const outRows = computed.ok ? computed.rows : []

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between gap-3">
        <span className="label">{t('field.controlNotes')}</span>
        <button
          onClick={() =>
            setRows((p) => [
              ...p,
              { id: crypto.randomUUID(), pointId: `P${p.length + 1}`, instrumentHeight: '1.500', targetHeight: '1.500', bearing: '', verticalAngle: '0', slopeDistance: '', remarks: '' },
            ])
          }
          className="btn btn-secondary text-xs"
        >
          {t('common.addRow')}
        </button>
      </div>
      <div className="card-body space-y-4">
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="label">{t('common.station')}</label>
            <input className="input input-sm" value={station.name} onChange={(e) => setStation((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('common.easting')}</label>
            <input inputMode="decimal" className="input input-sm" value={station.e} onChange={(e) => setStation((p) => ({ ...p, e: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('common.northing')}</label>
            <input inputMode="decimal" className="input input-sm" value={station.n} onChange={(e) => setStation((p) => ({ ...p, n: e.target.value }))} />
          </div>
          <div>
            <label className="label">{t('common.elevation')}</label>
            <input inputMode="decimal" className="input input-sm" value={station.z} onChange={(e) => setStation((p) => ({ ...p, z: e.target.value }))} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table min-w-[1100px]">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="text-left">{t('common.pointId')}</th>
                <th>{t('field.instrumentHeight')}</th>
                <th>{t('field.targetHeight')}</th>
                <th className="text-left">{t('traverse.bearing')}</th>
                <th>{t('field.verticalAngle')}</th>
                <th>{t('field.slopeDistance')}</th>
                <th className="text-right">{t('common.easting')}</th>
                <th className="text-right">{t('common.northing')}</th>
                <th className="text-right">{t('common.elevation')}</th>
                <th className="text-left">{t('common.remarks')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const out = outRows[idx]
                return (
                  <tr key={r.id}>
                    <td className="text-left"><input className="input input-sm" value={r.pointId} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, pointId: e.target.value } : x)))} /></td>
                    <td><input inputMode="decimal" className="input input-sm" value={r.instrumentHeight} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, instrumentHeight: e.target.value } : x)))} /></td>
                    <td><input inputMode="decimal" className="input input-sm" value={r.targetHeight} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, targetHeight: e.target.value } : x)))} /></td>
                    <td className="text-left"><input className="input input-sm font-mono" value={r.bearing} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, bearing: e.target.value } : x)))} /></td>
                    <td><input inputMode="decimal" className="input input-sm font-mono" value={r.verticalAngle} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, verticalAngle: e.target.value } : x)))} /></td>
                    <td><input inputMode="decimal" className="input input-sm font-mono" value={r.slopeDistance} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, slopeDistance: e.target.value } : x)))} /></td>
                    <td className="font-mono text-right">{out?.computed ? Number(out.computed.easting).toFixed(4) : '—'}</td>
                    <td className="font-mono text-right">{out?.computed ? Number(out.computed.northing).toFixed(4) : '—'}</td>
                    <td className="font-mono text-right">{out?.computed ? Number(out.computed.elevation).toFixed(4) : '—'}</td>
                    <td className="text-left"><input className="input input-sm" value={r.remarks} onChange={(e) => setRows((p) => p.map((x) => (x.id === r.id ? { ...x, remarks: e.target.value } : x)))} /></td>
                    <td><button className="btn btn-secondary text-xs" onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))}>{t('common.remove')}</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <button
          onClick={() =>
            setRows((p) => [
              ...p,
              { id: crypto.randomUUID(), pointId: `P${p.length + 1}`, instrumentHeight: '1.500', targetHeight: '1.500', bearing: '', verticalAngle: '0', slopeDistance: '', remarks: '' },
            ])
          }
          className="btn btn-secondary"
        >
          {t('common.addRow')}
        </button>
      </div>
    </div>
  )
}
