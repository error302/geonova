'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getMissions, saveMission, updateMission, deleteMission, daysUntil,
  getStandard, DEFAULT_EQUIPMENT, PRE_CHECKLIST,
  FieldMission, SurveyType, Country, MissionStatus,
} from '@/lib/fieldplan'

// ── helpers ─────────────────────────────────────────────────────────────────

const SURVEY_TYPES: { id: SurveyType; label: string }[] = [
  { id: 'traverse',      label: 'Traverse' },
  { id: 'leveling',      label: 'Leveling' },
  { id: 'boundary',      label: 'Boundary Survey' },
  { id: 'topographic',   label: 'Topographic' },
  { id: 'engineering',   label: 'Engineering Setout' },
  { id: 'stakeout',      label: 'Stakeout / Setting Out' },
  { id: 'gnss_baseline', label: 'GNSS Baseline' },
  { id: 'tacheometric',  label: 'Tacheometric' },
  { id: 'mining',        label: 'Mine Survey' },
  { id: 'hydrographic',  label: 'Hydrographic' },
]

const COUNTRIES: { id: Country; label: string }[] = [
  { id: 'kenya',        label: 'Kenya' },
  { id: 'uganda',       label: 'Uganda' },
  { id: 'tanzania',     label: 'Tanzania' },
  { id: 'nigeria',      label: 'Nigeria' },
  { id: 'ghana',        label: 'Ghana' },
  { id: 'south_africa', label: 'South Africa' },
  { id: 'other',        label: 'Other' },
]

const DATUMS: Record<Country, string> = {
  kenya: 'Arc 1960', uganda: 'Arc 1960', tanzania: 'Arc 1960',
  nigeria: 'Minna Datum', ghana: 'Accra Datum',
  south_africa: 'Hartebeesthoek94 (WGS84)', other: 'WGS84',
}

const DEFAULT_ZONE: Record<Country, string> = {
  kenya: '37S', uganda: '36N', tanzania: '37S',
  nigeria: '32N', ghana: '30N', south_africa: '35S', other: '',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function countdown(days: number) {
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: 'text-red-400' }
  if (days === 0) return { label: 'Today', cls: 'text-[var(--accent)]' }
  if (days === 1) return { label: 'Tomorrow', cls: 'text-amber-400' }
  if (days <= 7) return { label: `${days} days`, cls: 'text-amber-400' }
  return { label: `${days} days`, cls: 'text-green-400' }
}

function statusBadge(s: MissionStatus) {
  const map: Record<MissionStatus, string> = {
    planned:     'bg-blue-900/40 text-blue-300 border-blue-700/40',
    ready:       'bg-green-900/40 text-green-300 border-green-700/40',
    in_progress: 'bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/30',
    completed:   'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)]',
    postponed:   'bg-red-900/30 text-red-400 border-red-700/30',
  }
  return map[s]
}

// ── blank mission template ───────────────────────────────────────────────────

function blankMission(type: SurveyType = 'traverse', country: Country = 'kenya'): Omit<FieldMission, 'id' | 'createdAt' | 'updatedAt'> {
  const std = getStandard(country, type)
  return {
    projectName: '',
    client: '',
    surveyType: type,
    country,
    location: '',
    fieldDate: '',
    reportDeadline: '',
    surveyorName: '',
    licenseNumber: '',
    teamSize: 2,
    status: 'planned',
    utmZone: DEFAULT_ZONE[country],
    datum: DATUMS[country],
    requiredPrecision: std.minPrecision,
    closureLimit: std.closureLimit,
    controlPoints: [],
    equipment: DEFAULT_EQUIPMENT[type].map(item => ({ item, quantity: 1, checked: false })),
    preChecklist: PRE_CHECKLIST[type].map(item => ({ item, done: false })),
    objectives: '',
    hazards: '',
    accessNotes: '',
  }
}

// ── MissionCard ──────────────────────────────────────────────────────────────

function MissionCard({ mission, onOpen, onDelete }: {
  mission: FieldMission
  onOpen: () => void
  onDelete: () => void
}) {
  const days = daysUntil(mission.fieldDate)
  const cd = countdown(days)
  const done = mission.preChecklist.filter(c => c.done).length
  const total = mission.preChecklist.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const typeLabel = SURVEY_TYPES.find(t => t.id === mission.surveyType)?.label ?? mission.surveyType

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4 hover:border-[var(--accent)]/30 transition-colors cursor-pointer group"
      onClick={onOpen}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] truncate">{mission.projectName || 'Untitled mission'}</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{typeLabel} · {mission.location || 'Location not set'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge(mission.status)}`}>
            {mission.status.replace('_', ' ')}
          </span>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-red-400 p-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Field date</p>
          <p className="text-[var(--text-secondary)]">{mission.fieldDate ? fmtDate(mission.fieldDate) : '—'}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Countdown</p>
          <p className={`font-semibold tabular-nums ${cd.cls}`}>{mission.fieldDate ? cd.label : '—'}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Checklist</p>
          <p className="text-[var(--text-secondary)] font-medium">{done}/{total}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-amber-400' : 'bg-[var(--accent)]'}`}
          style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-1">{pct}% pre-field checklist complete</p>
    </div>
  )
}

// ── MissionEditor ────────────────────────────────────────────────────────────

function MissionEditor({ mission: initial, onSave, onClose }: {
  mission: Omit<FieldMission, 'id' | 'createdAt' | 'updatedAt'>
  onSave: (m: Omit<FieldMission, 'id' | 'createdAt' | 'updatedAt'>) => void
  onClose: () => void
}) {
  const [m, setM] = useState(initial)
  const [tab, setTab] = useState<'details' | 'standards' | 'equipment' | 'checklist' | 'notes'>('details')

  const std = getStandard(m.country, m.surveyType)

  // When type or country changes, refresh defaults
  const changeType = (type: SurveyType) => {
    const newStd = getStandard(m.country, type)
    setM(p => ({
      ...p,
      surveyType: type,
      requiredPrecision: newStd.minPrecision,
      closureLimit: newStd.closureLimit,
      equipment: DEFAULT_EQUIPMENT[type].map(item => ({ item, quantity: 1, checked: false })),
      preChecklist: PRE_CHECKLIST[type].map(item => ({ item, done: false })),
    }))
  }

  const changeCountry = (country: Country) => {
    const newStd = getStandard(country, m.surveyType)
    setM(p => ({
      ...p,
      country,
      datum: DATUMS[country],
      utmZone: DEFAULT_ZONE[country],
      requiredPrecision: newStd.minPrecision,
      closureLimit: newStd.closureLimit,
    }))
  }

  const f = (k: keyof typeof m, v: any) => setM(p => ({ ...p, [k]: v }))

  const TODAY = new Date().toISOString().split('T')[0]

  const TABS: { id: typeof tab; label: string }[] = [
    { id: 'details', label: 'Mission details' },
    { id: 'standards', label: 'Standards' },
    { id: 'equipment', label: `Equipment (${m.equipment.length})` },
    { id: 'checklist', label: `Pre-field (${m.preChecklist.filter(c=>c.done).length}/${m.preChecklist.length})` },
    { id: 'notes', label: 'Notes' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">
              {m.projectName || 'New survey mission'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {SURVEY_TYPES.find(t => t.id === m.surveyType)?.label} · {COUNTRIES.find(c => c.id === m.country)?.label}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl leading-none p-1">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-color)] overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── DETAILS ── */}
          {tab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Project / survey name *</label>
                  <input value={m.projectName} onChange={e => f('projectName', e.target.value)}
                    placeholder="e.g. Karen Estate Boundary Survey" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Client name</label>
                  <input value={m.client} onChange={e => f('client', e.target.value)}
                    placeholder="ABC Properties Ltd" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Location / site</label>
                  <input value={m.location} onChange={e => f('location', e.target.value)}
                    placeholder="Karen, Nairobi" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Survey type *</label>
                  <select value={m.surveyType} onChange={e => changeType(e.target.value as SurveyType)} className="input w-full">
                    {SURVEY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Country *</label>
                  <select value={m.country} onChange={e => changeCountry(e.target.value as Country)} className="input w-full">
                    {COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Field date *</label>
                  <input type="date" min={TODAY} value={m.fieldDate} onChange={e => f('fieldDate', e.target.value)} className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Report deadline</label>
                  <input type="date" min={m.fieldDate || TODAY} value={m.reportDeadline} onChange={e => f('reportDeadline', e.target.value)} className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Surveyor name</label>
                  <input value={m.surveyorName} onChange={e => f('surveyorName', e.target.value)}
                    placeholder="Your full name" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Licence / registration no.</label>
                  <input value={m.licenseNumber} onChange={e => f('licenseNumber', e.target.value)}
                    placeholder="e.g. LSK/2456" className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Team size</label>
                  <input type="number" min={1} max={20} value={m.teamSize} onChange={e => f('teamSize', Number(e.target.value))} className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Status</label>
                  <select value={m.status} onChange={e => f('status', e.target.value as MissionStatus)} className="input w-full">
                    <option value="planned">Planned</option>
                    <option value="ready">Ready — all prep done</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="postponed">Postponed</option>
                  </select>
                </div>
              </div>

              {/* Control points */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[var(--text-muted)]">Control points to visit</label>
                  <button onClick={() => f('controlPoints', [...m.controlPoints, { name: '', beaconNo: '', location: '', confirmed: false }])}
                    className="text-xs text-[var(--accent)] hover:text-[var(--accent-dim)]">+ Add</button>
                </div>
                {m.controlPoints.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] italic">No control points added. National standard requires {std.minControlPoints} minimum.</p>
                )}
                <div className="space-y-2">
                  {m.controlPoints.map((cp, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={cp.name} onChange={e => {
                        const cp2 = [...m.controlPoints]; cp2[i] = { ...cp2[i], name: e.target.value }; f('controlPoints', cp2)
                      }} placeholder="Name/ID" className="input flex-1 text-sm py-1.5" />
                      <input value={cp.beaconNo} onChange={e => {
                        const cp2 = [...m.controlPoints]; cp2[i] = { ...cp2[i], beaconNo: e.target.value }; f('controlPoints', cp2)
                      }} placeholder="Beacon no." className="input flex-1 text-sm py-1.5" />
                      <input value={cp.location} onChange={e => {
                        const cp2 = [...m.controlPoints]; cp2[i] = { ...cp2[i], location: e.target.value }; f('controlPoints', cp2)
                      }} placeholder="Location" className="input flex-1 text-sm py-1.5" />
                      <label className="flex items-center gap-1 text-xs text-[var(--text-muted)] flex-shrink-0">
                        <input type="checkbox" checked={cp.confirmed} onChange={e => {
                          const cp2 = [...m.controlPoints]; cp2[i] = { ...cp2[i], confirmed: e.target.checked }; f('controlPoints', cp2)
                        }} className="rounded" />
                        OK
                      </label>
                      <button onClick={() => f('controlPoints', m.controlPoints.filter((_, j) => j !== i))}
                        className="text-[var(--text-muted)] hover:text-red-400">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STANDARDS ── */}
          {tab === 'standards' && (
            <div className="space-y-5">
              <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                  {COUNTRIES.find(c => c.id === m.country)?.label} — {SURVEY_TYPES.find(t => t.id === m.surveyType)?.label}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Minimum precision', std.minPrecision],
                    ['Closure limit', std.closureLimit],
                    ['Min. control points', String(std.minControlPoints)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{k}</p>
                      <p className="text-[var(--text-primary)] font-mono font-semibold mt-0.5">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-4 leading-relaxed border-t border-[var(--border-color)] pt-3">
                  {std.notes}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Required documents for submission</p>
                <ul className="space-y-1.5">
                  {std.requiredDocs.map((doc, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-[var(--border-color)] pt-4">
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">Your project parameters</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">UTM zone</label>
                    <input value={m.utmZone} onChange={e => f('utmZone', e.target.value)} placeholder="e.g. 37S" className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Datum</label>
                    <input value={m.datum} onChange={e => f('datum', e.target.value)} placeholder="e.g. Arc 1960" className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Target precision</label>
                    <input value={m.requiredPrecision} onChange={e => f('requiredPrecision', e.target.value)} placeholder="1:5000" className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Closure limit</label>
                    <input value={m.closureLimit} onChange={e => f('closureLimit', e.target.value)} placeholder="12√K mm" className="input w-full" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── EQUIPMENT ── */}
          {tab === 'equipment' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[var(--text-muted)]">Tick items as you load the vehicle</p>
                <button onClick={() => f('equipment', [...m.equipment, { item: '', quantity: 1, checked: false }])}
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-dim)]">+ Add item</button>
              </div>
              <div className="space-y-2">
                {m.equipment.map((eq, i) => (
                  <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${eq.checked ? 'bg-green-900/10 border-green-700/20' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
                    <input type="checkbox" checked={eq.checked} onChange={e => {
                      const eq2 = [...m.equipment]; eq2[i] = { ...eq2[i], checked: e.target.checked }; f('equipment', eq2)
                    }} className="rounded flex-shrink-0" />
                    <input value={eq.item} onChange={e => {
                      const eq2 = [...m.equipment]; eq2[i] = { ...eq2[i], item: e.target.value }; f('equipment', eq2)
                    }} className={`flex-1 bg-transparent text-sm outline-none ${eq.checked ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`} />
                    <input type="number" min={1} max={99} value={eq.quantity} onChange={e => {
                      const eq2 = [...m.equipment]; eq2[i] = { ...eq2[i], quantity: Number(e.target.value) }; f('equipment', eq2)
                    }} className="w-12 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded px-2 py-1 text-xs text-center text-[var(--text-primary)]" />
                    <button onClick={() => f('equipment', m.equipment.filter((_, j) => j !== i))}
                      className="text-[var(--text-muted)] hover:text-red-400 text-xs">×</button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-3">
                {m.equipment.filter(e => e.checked).length}/{m.equipment.length} items loaded
              </p>
            </div>
          )}

          {/* ── PRE-FIELD CHECKLIST ── */}
          {tab === 'checklist' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[var(--text-muted)]">Complete before leaving for site</p>
                <button onClick={() => f('preChecklist', [...m.preChecklist, { item: '', done: false }])}
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-dim)]">+ Add item</button>
              </div>
              <div className="space-y-2">
                {m.preChecklist.map((c, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${c.done ? 'bg-green-900/10 border-green-700/20' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
                    <input type="checkbox" checked={c.done} onChange={e => {
                      const cl = [...m.preChecklist]; cl[i] = { ...cl[i], done: e.target.checked }; f('preChecklist', cl)
                    }} className="rounded flex-shrink-0" />
                    <input value={c.item} onChange={e => {
                      const cl = [...m.preChecklist]; cl[i] = { ...cl[i], item: e.target.value }; f('preChecklist', cl)
                    }} className={`flex-1 bg-transparent text-sm outline-none ${c.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`} />
                    <button onClick={() => f('preChecklist', m.preChecklist.filter((_, j) => j !== i))}
                      className="text-[var(--text-muted)] hover:text-red-400 text-xs flex-shrink-0">×</button>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${m.preChecklist.length ? Math.round(m.preChecklist.filter(c=>c.done).length/m.preChecklist.length*100) : 0}%` }} />
              </div>
            </div>
          )}

          {/* ── NOTES ── */}
          {tab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Survey objectives</label>
                <textarea value={m.objectives} onChange={e => f('objectives', e.target.value)} rows={3}
                  placeholder="What needs to be achieved on this field day? e.g. Set 5 boundary beacons, compute traverse, verify closing BM..." className="input w-full resize-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Hazards / safety notes</label>
                <textarea value={m.hazards} onChange={e => f('hazards', e.target.value)} rows={2}
                  placeholder="e.g. Heavy traffic on Ngong Road, site has loose dogs, inform security guard at gate..." className="input w-full resize-none" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Access / contact notes</label>
                <textarea value={m.accessNotes} onChange={e => f('accessNotes', e.target.value)} rows={2}
                  placeholder="e.g. Gate code: 1234, site caretaker John +254712..., park outside blue gate..." className="input w-full resize-none" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5 pt-3 border-t border-[var(--border-color)]">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={() => {
            if (!m.projectName || !m.fieldDate) return
            onSave(m)
          }} className="btn btn-primary flex-1">
            Save mission
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function FieldPlannerPage() {
  const [missions, setMissions] = useState<FieldMission[]>([])
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'ready' | 'completed'>('upcoming')

  const reload = useCallback(() => setMissions(getMissions()), [])
  useEffect(() => { reload() }, [reload])

  const today = new Date().toISOString().split('T')[0]
  const upcoming = missions.filter(m => m.fieldDate && m.fieldDate >= today && m.status !== 'completed')
  const overdue  = missions.filter(m => m.fieldDate && m.fieldDate < today && m.status !== 'completed')

  const shown = (() => {
    if (filter === 'upcoming') return missions.filter(m => m.status !== 'completed')
    if (filter === 'ready')    return missions.filter(m => m.status === 'ready')
    if (filter === 'completed')return missions.filter(m => m.status === 'completed')
    return missions
  })()

  const editMission = missions.find(m => m.id === editId)

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Field day planner</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Plan survey missions, track preparation, and carry the right equipment and standards to the field.
            </p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn btn-primary flex-shrink-0">
            + New mission
          </button>
        </div>

        {/* Reminder banners */}
        {overdue.length > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-red-900/20 border border-red-700/40 text-sm">
            <p className="text-red-300 font-semibold mb-1">
              {overdue.length} field day{overdue.length > 1 ? 's' : ''} past due
            </p>
            <p className="text-red-400 text-xs">
              {overdue.map(m => m.projectName).join(' · ')}
            </p>
          </div>
        )}

        {upcoming.length > 0 && upcoming.some(m => daysUntil(m.fieldDate) <= 3) && (
          <div className="mb-4 p-4 rounded-xl bg-amber-900/20 border border-amber-700/40 text-sm">
            <p className="text-amber-300 font-semibold mb-1">Coming up in the next 3 days:</p>
            <div className="space-y-1">
              {upcoming.filter(m => daysUntil(m.fieldDate) <= 3).map(m => {
                const done = m.preChecklist.filter(c => c.done).length
                const total = m.preChecklist.length
                return (
                  <p key={m.id} className="text-amber-400 text-xs">
                    {m.projectName} — {fmtDate(m.fieldDate)} — checklist {done}/{total} done
                  </p>
                )
              })}
            </div>
          </div>
        )}

        {/* Summary bar */}
        {missions.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { key: 'all', label: 'All', count: missions.length, color: 'text-[var(--text-primary)]' },
              { key: 'upcoming', label: 'Active', count: upcoming.length, color: 'text-blue-400' },
              { key: 'ready', label: 'Ready', count: missions.filter(m=>m.status==='ready').length, color: 'text-green-400' },
              { key: 'completed', label: 'Done', count: missions.filter(m=>m.status==='completed').length, color: 'text-[var(--text-muted)]' },
            ].map(({ key, label, count, color }) => (
              <button key={key} onClick={() => setFilter(key as any)}
                className={`p-3 rounded-xl border text-left transition-all ${filter === key ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5' : 'border-[var(--border-color)] bg-[var(--bg-card)]'}`}>
                <p className={`text-xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {missions.length === 0 && (
          <div className="text-center py-24 border border-dashed border-[var(--border-color)] rounded-2xl">
            <div className="w-14 h-14 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No missions planned yet</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
              Create a survey mission to plan your field day — equipment checklist, national standards, control points, and reminders all in one place.
            </p>
            <button onClick={() => setShowNew(true)} className="btn btn-primary">
              Plan your first field day
            </button>
          </div>
        )}

        {/* Mission grid */}
        {shown.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            {shown.map(m => (
              <MissionCard key={m.id} mission={m}
                onOpen={() => setEditId(m.id)}
                onDelete={() => { deleteMission(m.id); reload() }}
              />
            ))}
          </div>
        )}

        {shown.length === 0 && missions.length > 0 && (
          <div className="text-center py-12 text-sm text-[var(--text-muted)]">
            No missions match this filter
          </div>
        )}
      </div>

      {/* New mission modal */}
      {showNew && (
        <MissionEditor
          mission={blankMission()}
          onSave={m => { saveMission(m); reload(); setShowNew(false) }}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* Edit modal */}
      {editMission && (
        <MissionEditor
          mission={editMission}
          onSave={m => { updateMission(editMission.id, m); reload(); setEditId(null) }}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  )
}
