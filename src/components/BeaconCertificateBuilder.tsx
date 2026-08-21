'use client';

import { useState, useCallback, useId } from 'react'
import { Download } from 'lucide-react'
import { printBeaconCertificate } from '@/lib/print/beaconCertificate'
import type { BeaconEntry, BeaconCondition, MonumentType } from '@/lib/print/beaconCertificate'
import { PrintMetaPanel, defaultPrintMeta } from '@/components/shared/PrintMetaPanel'
import type { PrintMeta } from '@/components/shared/PrintMetaPanel'
import { downloadCSV, toCSV } from '@/lib/export/helpers'

// ── Constants ──────────────────────────────────────────────────────────────

const MONUMENT_TYPES: MonumentType[] = [
  'Iron Pin',
  'Concrete Beacon',
  'Scribing on Rock',
  'Peg in Concrete',
  'Iron Post',
  'Trig Beacon',
  'Bench Mark',
  'GNSS Pillar',
  'Nail in Tree',
  'Nail in Road',
  'Other',
]

const CONDITIONS: { value: BeaconCondition; label: string; color: string }[] = [
  { value: 'SET',       label: 'SET',       color: 'text-emerald-400' },
  { value: 'FOUND',     label: 'FOUND',     color: 'text-blue-400'    },
  { value: 'DISTURBED', label: 'DISTURBED', color: 'text-amber-400'   },
  { value: 'DESTROYED', label: 'DESTROYED', color: 'text-red-400'     },
  { value: 'NOT_FOUND', label: 'NOT FOUND', color: 'text-gray-400'    },
]

const CONDITION_BADGE: Record<BeaconCondition, string> = {
  SET:       'bg-emerald-900/40 text-emerald-300 border-emerald-700',
  FOUND:     'bg-blue-900/40 text-blue-300 border-blue-700',
  DISTURBED: 'bg-amber-900/40 text-amber-300 border-amber-700',
  DESTROYED: 'bg-red-900/40 text-red-300 border-red-700',
  NOT_FOUND: 'bg-gray-800 text-gray-400 border-gray-600',
}

// ── Default beacon factory ─────────────────────────────────────────────────

let _nextId = 1
function makeBeacon(): BeaconEntry {
  return {
    id:               String(_nextId++),
    name:             '',
    monumentType:     'Iron Pin',
    condition:        'SET',
    easting:          '',
    northing:         '',
    elevation:        '',
    description:      '',
    adjacentFeatures: '',
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function BeaconCertificateBuilder() {
  const uid = useId()
  const [beacons, setBeacons]       = useState<BeaconEntry[]>([makeBeacon(), makeBeacon(), makeBeacon()])
  const [expandedId, setExpandedId] = useState<string | null>(beacons[0]?.id ?? null)
  const [printMeta, setPrintMeta]   = useState<PrintMeta>(defaultPrintMeta)
  const [location, setLocation]     = useState({
    parcelRef:   '',
    county:      '',
    subCounty:   '',
    location:    '',
    subLocation: '',
    surveyJobNo: '',
  })

  // ── Beacon CRUD ────────────────────────────────────────────────────────

  const addBeacon = () => {
    const b = makeBeacon()
    setBeacons(prev => [...prev, b])
    setExpandedId(b.id)
  }

  const removeBeacon = (id: string) => {
    setBeacons(prev => prev.filter(b => b.id !== id))
    setExpandedId(prev => prev === id ? null : prev)
  }

  const updateBeacon = useCallback(<K extends keyof BeaconEntry>(id: string, field: K, value: BeaconEntry[K]) => {
    setBeacons(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }, [])

  const setLoc = (k: keyof typeof location, v: string) => setLocation(prev => ({ ...prev, [k]: v }))

  // ── Print ──────────────────────────────────────────────────────────────

  const handlePrint = () => {
    printBeaconCertificate({ meta: printMeta, location, beacons })
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  const stats = {
    set:       beacons.filter(b => b.condition === 'SET').length,
    found:     beacons.filter(b => b.condition === 'FOUND').length,
    disturbed: beacons.filter(b => b.condition === 'DISTURBED').length,
    destroyed: beacons.filter(b => b.condition === 'DESTROYED').length,
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── LOCATION PARTICULARS ──────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="label">Location Particulars</span>
          <span className="text-xs text-[var(--text-muted)] ml-2">Survey Regulations 1994, Reg. 20</span>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {([
            ['parcelRef',   'Parcel Reference',  'e.g. LR/NYERI/MWEIGA/105'],
            ['surveyJobNo', 'Survey Job No.',    'DoLS job number'],
            ['county',      'County',            'e.g. Nyeri'],
            ['subCounty',   'Sub-County',        'e.g. Tetu'],
            ['location',    'Location',          'e.g. Mweiga'],
            ['subLocation', 'Sub-Location',      'e.g. Mweiga East'],
          ] as [keyof typeof location, string, string][]).map(([key, label, ph]) => (
            <div key={key}>
              <label htmlFor={`${uid}-loc-${key}`} className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
              <input id={`${uid}-loc-${key}`}
                className="input w-full"
                value={location[key]}
                placeholder={ph}
                onChange={e => setLoc(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── BEACON SUMMARY BAR ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Set',       count: stats.set,       cls: 'text-emerald-400' },
          { label: 'Found',     count: stats.found,     cls: 'text-blue-400'    },
          { label: 'Disturbed', count: stats.disturbed, cls: 'text-amber-400'   },
          { label: 'Destroyed', count: stats.destroyed, cls: 'text-red-400'     },
        ].map(({ label, count, cls }) => (
          <div key={label} className="card p-4 text-center">
            <div className={`text-2xl font-bold font-mono ${cls}`}>{count}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── BEACON LIST ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        {beacons.map((beacon, idx) => {
          const isOpen = expandedId === beacon.id
          const condBadge = CONDITION_BADGE[beacon.condition]

          return (
            <div key={beacon.id} className="card overflow-hidden">
              {/* Beacon header row — always visible */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[color-mix(in_srgb,var(--bg-secondary)_50%,transparent)] transition-colors"
                onClick={() => setExpandedId(isOpen ? null : beacon.id)}
              >
                {/* Number */}
                <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs font-mono flex items-center justify-center">
                  {idx + 1}
                </span>

                {/* Name */}
                <span className="font-mono font-semibold text-[var(--text-primary)] w-20 shrink-0">
                  {beacon.name || <span className="text-[var(--text-muted)] font-normal italic">unnamed</span>}
                </span>

                {/* Monument type */}
                <span className="text-sm text-[var(--text-secondary)] flex-1 text-left hidden sm:block">
                  {beacon.monumentType}
                </span>

                {/* Condition badge */}
                <span className={`shrink-0 text-xs font-mono px-2 py-0.5 rounded border ${condBadge}`}>
                  {beacon.condition}
                </span>

                {/* Coordinates preview */}
                {beacon.easting && beacon.northing && (
                  <span className="shrink-0 text-xs font-mono text-[var(--text-muted)] hidden md:block">
                    E {parseFloat(beacon.easting).toFixed(3)} / N {parseFloat(beacon.northing).toFixed(3)}
                  </span>
                )}

                {/* Chevron */}
                <span className="shrink-0 text-[var(--text-muted)] text-xs ml-2">
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Expanded edit panel */}
              {isOpen && (
                <div className="border-t border-[var(--border-color)] p-4 space-y-4">

                  {/* Row 1 — ID, type, condition */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="beacon-id-name">Beacon ID / Name <span className="text-red-400">*</span></label>
                      <input id="beacon-id-name"
                        className="input w-full font-mono"
                        value={beacon.name}
                        placeholder="e.g. P1 / A / BM1"
                        onChange={e => updateBeacon(beacon.id, 'name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="monument-type">Monument Type</label>
                      <select id="monument-type"
                        className="input w-full"
                        value={beacon.monumentType}
                        onChange={e => updateBeacon(beacon.id, 'monumentType', e.target.value as MonumentType)}
                      >
                        {MONUMENT_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="block text-xs text-[var(--text-muted)] mb-1">Condition</div>
                      <div className="flex flex-wrap gap-1.5">
                        {CONDITIONS.map(c => (
                          <button
                            key={c.value}
                            onClick={() => updateBeacon(beacon.id, 'condition', c.value)}
                            className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                              beacon.condition === c.value
                                ? CONDITION_BADGE[c.value]
                                : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)]'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Row 2 — Coordinates */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="easting-m">Easting (m)</label>
                      <input id="easting-m"
                        className="input w-full font-mono"
                        type="number"
                        step="0.001"
                        value={beacon.easting}
                        placeholder="e.g. 250000.000"
                        onChange={e => updateBeacon(beacon.id, 'easting', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="northing-m">Northing (m)</label>
                      <input id="northing-m"
                        className="input w-full font-mono"
                        type="number"
                        step="0.001"
                        value={beacon.northing}
                        placeholder="e.g. 9945000.000"
                        onChange={e => updateBeacon(beacon.id, 'northing', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="reduced-level-rl-m">Reduced Level / RL (m)</label>
                      <input id="reduced-level-rl-m"
                        className="input w-full font-mono"
                        type="number"
                        step="0.001"
                        value={beacon.elevation}
                        placeholder="Optional"
                        onChange={e => updateBeacon(beacon.id, 'elevation', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Row 3 — Description */}
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="beacon-description-type-size-finish-setting">
                      Beacon Description <span className="text-[var(--text-muted)] font-normal">(type, size, finish, setting)</span>
                    </label>
                    <textarea id="beacon-description-type-size-finish-setting"
                      className="input w-full resize-none"
                      rows={2}
                      value={beacon.description}
                      placeholder={`e.g. Iron pin 15mm dia × 300mm long set in concrete 400×400×200mm, top flush with ground surface. Concrete shows exposed, good condition.`}
                      onChange={e => updateBeacon(beacon.id, 'description', e.target.value)}
                    />
                  </div>

                  {/* Row 4 — Adjacent features */}
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="adjacent-features-for-identification-on-site">
                      Adjacent Features <span className="text-[var(--text-muted)] font-normal">(for identification on site)</span>
                    </label>
                    <textarea
                       id="adjacent-features-for-identification-on-site" className="input w-full resize-none"
                      rows={2}
                      value={beacon.adjacentFeatures}
                      placeholder={`e.g. 0.45m west of existing concrete fence post. 1.2m south of gate post on northern boundary.`}
                      onChange={e => updateBeacon(beacon.id, 'adjacentFeatures', e.target.value)}
                    />
                  </div>

                  {/* Quick-fill description buttons */}
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1.5">Quick-fill descriptions:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Iron pin 15mm × 300mm set in concrete 400×400×200mm, flush with ground.',
                        'Concrete beacon 150×150×600mm, top 50mm above ground. Good condition.',
                        'Scribing on exposed rock surface. Cross chiselled 100×100mm.',
                        'Iron pin found, leaning 5°. Concrete surround cracked but beacon in original position.',
                        'Beacon destroyed — concrete fragments only. Position marked for re-establishment.',
                      ].map(txt => (
                        <button
                          key={txt.slice(0, 20)}
                          onClick={() => updateBeacon(beacon.id, 'description', txt)}
                          className="text-xs px-2 py-1 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] border border-[var(--border-color)] rounded text-[var(--text-muted)] text-left"
                        >
                          {txt.slice(0, 40)}…
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delete */}
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => removeBeacon(beacon.id)}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-800/50 hover:border-red-600 px-3 py-1.5 rounded transition-colors"
                    >
                      Remove beacon
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── ADD BEACON ────────────────────────────────────────────────── */}
      <button
        onClick={addBeacon}
        className="w-full py-3 border-2 border-dashed border-[var(--border-color)] hover:border-[var(--accent)] text-[var(--text-muted)] hover:text-[var(--accent)] rounded-lg text-sm font-medium transition-colors"
      >
        + Add Beacon
      </button>

      {/* ── PRINT SECTION ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="label">Print Certificate</span>
        </div>
        <div className="p-4 space-y-4">
          <PrintMetaPanel meta={printMeta} onChange={setPrintMeta} />

          {/* Preview of what's included */}
          <div className="p-4 bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)] rounded border border-[var(--border-color)] text-xs space-y-1.5">
            <p className="font-semibold text-[var(--text-primary)] mb-2">The certificate will include:</p>
            <div className="text-[var(--text-muted)] space-y-1">
              <p> Standard document header (project · client · date · surveyor · reg no · instrument)</p>
              <p> Location particulars (parcel ref · county · sub-county · location · sub-location · job no.)</p>
              <p> Beacon summary (set / found / disturbed / destroyed counts)</p>
              <p> Full beacon description table — coordinates to 3dp, monument type, condition</p>
              <p> Description and adjacent features for each beacon</p>
              <p> 6 standard notes (coordinate system, datum, definitions)</p>
              <p> Surveyor&apos;s Certificate — Survey Regulations 1994, Regulation 3(2)</p>
            </div>
            <p className="text-[var(--text-muted)] font-mono mt-2">
              Coordinate system: UTM Arc 1960 / Zone 37S (SRID 21037)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={beacons.length === 0}
              className="flex-1 py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold rounded text-sm transition-colors"
            >
              Print Beacon Certificate — {beacons.length} beacon{beacons.length !== 1 ? 's' : ''}
            </button>
            <button
              onClick={() => {
                if (beacons.length === 0) return
                const csv = toCSV(
                  ['No', 'Beacon ID', 'Monument Type', 'Condition', 'Easting (m)', 'Northing (m)', 'RL (m)', 'Description', 'Adjacent Features'],
                  beacons.map((b, i) => [
                    String(i + 1), b.name, b.monumentType, b.condition,
                    b.easting, b.northing, b.elevation,
                    b.description, b.adjacentFeatures,
                  ]),
                )
                downloadCSV(csv, 'beacon-certificate-data')
              }}
              disabled={beacons.length === 0}
              className="py-3 px-4 border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-primary)] rounded text-sm transition-colors inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
