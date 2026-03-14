'use client'

import type { Dispatch, SetStateAction } from 'react'

type Translator = (key: string, values?: Record<string, string | number>) => string

export type TravRow = { id: string; station: string; bearing: string; distance: string; remarks: string }

export function TraverseBook({
  t,
  travMode,
  setTravMode,
  startStation,
  startE,
  startN,
  closeE,
  closeN,
  setStartStation,
  setStartE,
  setStartN,
  setCloseE,
  setCloseN,
  travRows,
  setTravRows,
  computed,
}: {
  t: Translator
  travMode: 'open' | 'closed' | 'link'
  setTravMode: Dispatch<SetStateAction<'open' | 'closed' | 'link'>>
  startStation: string
  startE: string
  startN: string
  closeE: string
  closeN: string
  setStartStation: Dispatch<SetStateAction<string>>
  setStartE: Dispatch<SetStateAction<string>>
  setStartN: Dispatch<SetStateAction<string>>
  setCloseE: Dispatch<SetStateAction<string>>
  setCloseN: Dispatch<SetStateAction<string>>
  travRows: TravRow[]
  setTravRows: Dispatch<SetStateAction<TravRow[]>>
  computed:
    | { ok: false; errors: string[] }
    | { ok: true; mode: 'open'; raw: any }
    | { ok: true; mode: 'closed' | 'link'; adjusted: any }
}) {
  return (
    <div className="card">
      <div className="card-header flex flex-wrap gap-4 items-center justify-between">
        <span className="label">{t('field.traverseBook')}</span>
        <div className="flex gap-2">
          <button onClick={() => setTravMode('open')} className={`btn text-xs ${travMode === 'open' ? 'btn-primary' : 'btn-secondary'}`}>
            {t('traverse.open')}
          </button>
          <button onClick={() => setTravMode('closed')} className={`btn text-xs ${travMode === 'closed' ? 'btn-primary' : 'btn-secondary'}`}>
            {t('traverse.closed')}
          </button>
          <button onClick={() => setTravMode('link')} className={`btn text-xs ${travMode === 'link' ? 'btn-primary' : 'btn-secondary'}`}>
            {t('traverse.link')}
          </button>
        </div>
      </div>

      <div className="card-body space-y-4">
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="label">{t('common.startStation')}</label>
            <input className="input" value={startStation} onChange={(e) => setStartStation(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('common.startEasting')}</label>
            <input inputMode="decimal" className="input" value={startE} onChange={(e) => setStartE(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('common.startNorthing')}</label>
            <input inputMode="decimal" className="input" value={startN} onChange={(e) => setStartN(e.target.value)} />
          </div>
          {travMode === 'link' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">{t('traverse.closeE')}</label>
                <input inputMode="decimal" className="input" value={closeE} onChange={(e) => setCloseE(e.target.value)} />
              </div>
              <div>
                <label className="label">{t('traverse.closeN')}</label>
                <input inputMode="decimal" className="input" value={closeN} onChange={(e) => setCloseN(e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-gray-950/40 border border-gray-800 rounded text-xs text-[var(--text-muted)] flex items-center">
              {travMode === 'closed' ? t('traverse.closedHint') : t('traverse.openHint')}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="table min-w-[1000px]">
            <thead>
              <tr>
                <th className="text-left">{t('common.station')}</th>
                <th className="text-left">{t('traverse.bearing')}</th>
                <th className="text-left">{t('traverse.distance')}</th>
                <th className="text-right">{t('traverse.latitude')}</th>
                <th className="text-right">{t('traverse.departure')}</th>
                <th className="text-right">{t('common.easting')}</th>
                <th className="text-right">{t('common.northing')}</th>
                <th className="text-left">{t('common.remarks')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {travRows.map((r, idx) => {
                const out = computed.ok ? (computed.mode === 'open' ? computed.raw.legs[idx] : computed.adjusted.legs[idx]) : null
                const lat = out ? (computed.ok && computed.mode === 'open' ? (out as any).deltaN : (out as any).adjDeltaN) : null
                const dep = out ? (computed.ok && computed.mode === 'open' ? (out as any).deltaE : (out as any).adjDeltaE) : null
                const ee = out ? (computed.ok && computed.mode === 'open' ? (out as any).easting : (out as any).adjEasting) : null
                const nn = out ? (computed.ok && computed.mode === 'open' ? (out as any).northing : (out as any).adjNorthing) : null

                return (
                  <tr key={r.id}>
                    <td className="text-left"><input className="input" value={r.station} onChange={(e) => setTravRows((p) => p.map((x) => (x.id === r.id ? { ...x, station: e.target.value } : x)))} /></td>
                    <td className="text-left"><input className="input font-mono" value={r.bearing} onChange={(e) => setTravRows((p) => p.map((x) => (x.id === r.id ? { ...x, bearing: e.target.value } : x)))} placeholder={`082° 12' 00"`} /></td>
                    <td className="text-left"><input inputMode="decimal" className="input font-mono" value={r.distance} onChange={(e) => setTravRows((p) => p.map((x) => (x.id === r.id ? { ...x, distance: e.target.value } : x)))} placeholder="100.000" /></td>
                    <td className="font-mono text-right">{lat !== null ? Number(lat).toFixed(4) : '—'}</td>
                    <td className="font-mono text-right">{dep !== null ? Number(dep).toFixed(4) : '—'}</td>
                    <td className="font-mono text-right">{ee !== null ? Number(ee).toFixed(4) : '—'}</td>
                    <td className="font-mono text-right">{nn !== null ? Number(nn).toFixed(4) : '—'}</td>
                    <td className="text-left"><input className="input" value={r.remarks} onChange={(e) => setTravRows((p) => p.map((x) => (x.id === r.id ? { ...x, remarks: e.target.value } : x)))} /></td>
                    <td><button className="btn btn-secondary text-xs" onClick={() => setTravRows((p) => p.filter((x) => x.id !== r.id))}>{t('common.remove')}</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <button onClick={() => setTravRows((p) => [...p, { id: crypto.randomUUID(), station: `P${p.length + 2}`, bearing: '', distance: '', remarks: '' }])} className="btn btn-secondary">
          {t('common.addRow')}
        </button>

        {computed.ok && computed.mode !== 'open' && (
          <div className="grid md:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-950/40 border border-gray-800 rounded">
              <div className="text-xs text-[var(--text-muted)]">{t('traverse.closingErrorE')}</div>
              <div className="font-mono">{Number(computed.adjusted.closingErrorE).toFixed(4)} m</div>
            </div>
            <div className="p-3 bg-gray-950/40 border border-gray-800 rounded">
              <div className="text-xs text-[var(--text-muted)]">{t('traverse.closingErrorN')}</div>
              <div className="font-mono">{Number(computed.adjusted.closingErrorN).toFixed(4)} m</div>
            </div>
            <div className="p-3 bg-gray-950/40 border border-gray-800 rounded">
              <div className="text-xs text-[var(--text-muted)]">{t('traverse.linearError')}</div>
              <div className="font-mono">{Number(computed.adjusted.linearError).toFixed(4)} m</div>
            </div>
            <div className="p-3 bg-gray-950/40 border border-gray-800 rounded">
              <div className="text-xs text-[var(--text-muted)]">{t('traverse.precision')}</div>
              <div className="font-mono">
                1 : {Math.max(1, Math.round(Number(computed.adjusted.totalDistance) / Math.max(1e-12, Number(computed.adjusted.linearError)))).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

