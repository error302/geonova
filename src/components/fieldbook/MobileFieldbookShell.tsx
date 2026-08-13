'use client';

/**
 * MobileFieldbookShell
 * ---------------------
 * Renders the active survey type as a list of touch-friendly cards
 * instead of wide desktop tables.  Designed for the field — where
 * the surveyor's primary device is a phone.
 *
 * Includes:
 *   • Sticky top status bar (online/offline, sync, last saved)
 *   • Survey type selector as horizontally scrollable chips
 *   • Card list of readings with swipe-to-delete
 *   • Floating Action Button (FAB) for quick add
 *   • Pull-to-refresh-style sync affordance
 */

import { useState } from 'react'
import { Wifi, WifiOff, CloudUpload, Plus, Trash2, ChevronUp, ChevronDown, CheckCircle2, AlertTriangle, Clock, History, Settings, Calculator, Ruler, Compass, MapPin } from 'lucide-react'
import type { MobileSurveyType } from './UniversalMobileObservationForm'
import { UniversalMobileObservationForm } from './UniversalMobileObservationForm'
import type { CapturedBeaconPhoto } from './BeaconPhotoCapture'
import { StickySummary, OfflineCacheIndicator } from './MobileFieldUX'

export type Row = { id: string; [key: string]: string }

type ControlStation = { name: string; e: string; n: string; z: string }

export type ControlSetup = { id: string; station: ControlStation; rows: Row[] }

interface MobileComputed {
  ok: boolean
  errors?: string[]
  mode?: 'open' | 'closed' | 'link'
  calc?: {
    precisionRatio?: number
    arithmeticCheck?: boolean
    misclosure?: number
    misclosureDistance?: number
    allowableMisclosure?: number
    readings?: Array<{ reducedLevel?: number; station?: string }>
  }
  adjusted?: {
    linearError: number
    totalDistance: number
    closingErrorE: number
    closingErrorN: number
  }
  raw?: { legs?: Array<Record<string, unknown>> }
  rows?: Array<Record<string, unknown>>
}

interface MobileFieldbookShellProps {
  surveyType: MobileSurveyType
  onSurveyTypeChange: (t: MobileSurveyType) => void
  rows: Row[]
  onAddRow: (row: Record<string, string>, photos: CapturedBeaconPhoto[]) => void
  onRemoveRow: (id: string) => void
  online: boolean
  lastSaved?: string | null
  unsyncedCount?: number
  onSync?: () => void
  stationName?: string
  /** When provided, shows a "Pull from instrument" button in the add form. */
  onPullInstrumentReading?: () => Promise<Partial<Record<string, string>>>
  /** When provided, shows an audit-trail button in the status bar. */
  onViewAuditLog?: () => void

  // --- Computations ---
  computed: MobileComputed | null

  // --- Leveling setup props ---
  openingRL: string
  setOpeningRL: (val: string) => void
  closingRL: string
  setClosingRL: (val: string) => void
  distanceKm: string
  setDistanceKm: (val: string) => void
  levelMethod: 'rise_and_fall' | 'height_of_collimation'
  setLevelMethod: (val: 'rise_and_fall' | 'height_of_collimation') => void

  // --- Traverse setup props ---
  travMode: 'open' | 'closed' | 'link'
  setTravMode: (val: 'open' | 'closed' | 'link') => void
  startStation: string
  setStartStation: (val: string) => void
  startE: string
  setStartE: (val: string) => void
  startN: string
  setStartN: (val: string) => void
  closeE: string
  setCloseE: (val: string) => void
  closeN: string
  setCloseN: (val: string) => void

  // --- Control setups props ---
  controlSetups: ControlSetup[]
  setControlSetups: React.Dispatch<React.SetStateAction<ControlSetup[]>>
  activeControlSetupId: string
  setActiveControlSetupId: (id: string) => void
  controlStation: { name: string; e: string; n: string; z: string }
  setControlStation: (val: ControlStation | ((p: ControlStation) => ControlStation)) => void

  // --- Mining setup props removed in v1 scope narrowing (see metardu-industrial repo) ---
}

const TYPE_LABELS: Record<MobileSurveyType, { label: string; icon: typeof Ruler }> = {
  leveling:     { label: 'Leveling',     icon: Ruler },
  traverse:     { label: 'Traverse',     icon: Compass },
  control:      { label: 'Control',      icon: MapPin },
}

/** Per-survey-type primary fields to display on each card (in order). */
const CARD_FIELDS: Record<MobileSurveyType, { key: string; label: string; mono?: boolean }[]> = {
  leveling: [
    { key: 'station', label: 'Station' },
    { key: 'bs', label: 'BS', mono: true },
    { key: 'is', label: 'IS', mono: true },
    { key: 'fs', label: 'FS', mono: true },
  ],
  traverse: [
    { key: 'station', label: 'Station' },
    { key: 'bearing', label: 'Bearing', mono: true },
    { key: 'slopeDist', label: 'Dist', mono: true },
    { key: 'vaDeg', label: 'VA', mono: true },
  ],
  control: [
    { key: 'pointId', label: 'Point' },
    { key: 'bearing', label: 'Bearing', mono: true },
    { key: 'slopeDistance', label: 'Dist', mono: true },
    { key: 'verticalAngle', label: 'VA', mono: true },
  ],
}

export function MobileFieldbookShell({
  surveyType,
  onSurveyTypeChange,
  rows,
  onAddRow,
  onRemoveRow,
  online,
  lastSaved,
  unsyncedCount = 0,
  onSync,
  stationName,
  onPullInstrumentReading,
  onViewAuditLog,
  computed,
  openingRL,
  setOpeningRL,
  closingRL,
  setClosingRL,
  distanceKm,
  setDistanceKm,
  levelMethod,
  setLevelMethod,
  travMode,
  setTravMode,
  startStation,
  setStartStation,
  startE,
  setStartE,
  startN,
  setStartN,
  closeE,
  setCloseE,
  closeN,
  setCloseN,
  controlSetups,
  setControlSetups,
  activeControlSetupId,
  setActiveControlSetupId,
  controlStation,
  setControlStation,
}: MobileFieldbookShellProps) {
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(true)

  const lastStation = rows.length > 0
    ? (rows[rows.length - 1].station || rows[rows.length - 1].pointId || '')
    : ''

  const cardFields = CARD_FIELDS[surveyType]

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-[var(--bg-primary)]">
      {/* ─── Sticky status bar ─── */}
      <div className="sticky top-0 z-30 bg-[var(--bg-secondary)]/90 backdrop-blur-md border-b border-[var(--border-color)] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={[
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
            online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
          ].join(' ')}>
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{online ? 'Online' : 'Offline'}</span>
          </div>
          {unsyncedCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              {unsyncedCount} pending
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-[10px] text-[var(--text-muted)] hidden xs:inline">
              <Clock className="w-3 h-3 inline mr-0.5" />
              {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {onViewAuditLog && (
            <button
              onClick={onViewAuditLog}
              className="grid place-items-center w-7 h-7 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              aria-label="View audit log"
              title="Audit trail"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onSync}
            disabled={!online || !onSync || unsyncedCount === 0}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition',
              online && onSync && unsyncedCount > 0
                ? 'bg-[var(--accent)] text-black active:scale-95'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed',
            ].join(' ')}
          >
            <CloudUpload className="w-3.5 h-3.5" />
            Sync
          </button>
        </div>
      </div>

      {/* ─── Survey type chips ─── */}
      <div className="sticky top-[44px] z-20 bg-[var(--bg-primary)]/95 backdrop-blur-sm border-b border-[var(--border-color)] px-4 py-2.5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {(Object.keys(TYPE_LABELS) as MobileSurveyType[]).map((t) => {
            const meta = TYPE_LABELS[t]
            const active = t === surveyType
            return (
              <button
                key={t}
                onClick={() => onSurveyTypeChange(t)}
                className={[
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all active:scale-95',
                  active
                    ? 'bg-[var(--accent)] text-black shadow-md shadow-[var(--accent)]/25'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:border-[var(--accent)]/40',
                ].join(' ')}
              >
                <meta.icon className="w-3.5 h-3.5" />
                <span>{meta.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── AUDIT FIX: Sticky QC Summary + Offline Cache (mobile UX upgrade) ─── */}
      {computed?.ok && (
        <StickySummary
          primary={
            surveyType === 'traverse'
              ? `1:${computed.calc?.precisionRatio?.toLocaleString() ?? '—'}`
              : surveyType === 'leveling'
                ? computed.calc?.arithmeticCheck ? 'PASS' : 'FAIL'
                : `${rows.length} pts`
          }
          primaryLabel={
            surveyType === 'traverse' ? 'Precision'
            : surveyType === 'leveling' ? 'Arith Check'
            : 'Readings'
          }
          primaryGood={
            surveyType === 'traverse'
              ? (computed.calc?.precisionRatio ?? 0) >= 5000
              : surveyType === 'leveling'
                ? (computed.calc?.arithmeticCheck ?? false)
                : true
          }
          secondary={
            surveyType === 'traverse'
              ? `${computed.calc?.misclosureDistance?.toFixed(3) ?? '—'}m`
              : surveyType === 'leveling'
                ? `${Number(computed.calc?.misclosure ?? 0).toFixed(4)}m`
                : undefined
          }
          secondaryLabel={
            surveyType === 'traverse' ? 'Misclosure'
            : surveyType === 'leveling' ? 'Misclosure'
            : undefined
          }
          readingCount={rows.length}
        />
      )}
      <OfflineCacheIndicator
        online={online}
        cachedReadings={rows.length}
        pendingSync={unsyncedCount}
        lastSync={lastSaved}
      />

      {/* ─── Card list ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-44">
        
        {/* Setup & Coordinates Panel */}
        <div className="mb-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          <button
            onClick={() => setSetupOpen(!setupOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)]/50 text-sm font-semibold text-[var(--text-primary)]"
          >
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[var(--accent)]" />
              Setup & Coordinates
            </span>
            {setupOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>

          {setupOpen && (
            <div className="p-4 border-t border-[var(--border-color)] space-y-3 bg-[var(--bg-secondary)]/25">
              {surveyType === 'leveling' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 flex gap-2">
                    <button
                      onClick={() => setLevelMethod('rise_and_fall')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition ${
                        levelMethod === 'rise_and_fall' ? 'bg-[var(--accent)] text-black border-transparent font-bold' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'
                      }`}
                    >
                      Rise & Fall
                    </button>
                    <button
                      onClick={() => setLevelMethod('height_of_collimation')}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition ${
                        levelMethod === 'height_of_collimation' ? 'bg-[var(--accent)] text-black border-transparent font-bold' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'
                      }`}
                    >
                      HOC (Collimation)
                    </button>
                  </div>
                  <div>
                    <label htmlFor="mfs-opening-rl" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Opening RL (m)</label>
                    <input id="mfs-opening-rl"
                      type="number"
                      inputMode="decimal"
                      className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      value={openingRL}
                      onChange={(e) => setOpeningRL(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="mfs-closing-rl" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Closing RL (m)</label>
                    <input
                      id="mfs-closing-rl"
                      type="number"
                      inputMode="decimal"
                      className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      value={closingRL}
                      placeholder="Optional"
                      onChange={(e) => setClosingRL(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label htmlFor="mfs-distance-km" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Distance (km)</label>
                    <input id="mfs-distance-km"
                      type="number"
                      inputMode="decimal"
                      className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {surveyType === 'traverse' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(['open', 'closed', 'link'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setTravMode(m)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg border capitalize transition ${
                          travMode === m ? 'bg-[var(--accent)] text-black border-transparent font-bold' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="mfs-start-stn" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Start Stn</label>
                      <input id="mfs-start-stn"
                        type="text"
                        className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] uppercase focus:outline-none focus:border-[var(--accent)]"
                        value={startStation}
                        onChange={(e) => setStartStation(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label htmlFor="mfs-start-e" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Start E (m)</label>
                      <input id="mfs-start-e"
                        type="number"
                        inputMode="decimal"
                        className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        value={startE}
                        onChange={(e) => setStartE(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="mfs-start-n" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Start N (m)</label>
                      <input id="mfs-start-n"
                        type="number"
                        inputMode="decimal"
                        className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        value={startN}
                        onChange={(e) => setStartN(e.target.value)}
                      />
                    </div>
                  </div>
                  {travMode === 'link' && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-color)]/50">
                      <div>
                        <label htmlFor="mfs-close-e" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Close E (m) *</label>
                        <input id="mfs-close-e"
                          type="number"
                          inputMode="decimal"
                          className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                          value={closeE}
                          onChange={(e) => setCloseE(e.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor="mfs-close-n" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Close N (m) *</label>
                        <input id="mfs-close-n"
                          type="number"
                          inputMode="decimal"
                          className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                          value={closeN}
                          onChange={(e) => setCloseN(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {surveyType === 'control' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {controlSetups.map((s, idx) => {
                      const label = s.station.name?.trim() ? s.station.name.trim() : `Setup ${idx + 1}`
                      const active = s.id === activeControlSetupId
                      return (
                        <button
                          key={s.id}
                          onClick={() => setActiveControlSetupId(s.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs border whitespace-nowrap transition-colors ${
                            active ? 'bg-[var(--accent)] text-black border-transparent font-semibold shadow-sm' : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => {
                        const id = crypto.randomUUID()
                        const suffix = controlSetups.length + 1
                        const template = controlStation
                        setControlSetups((prev) => [
                          ...prev,
                          {
                            id,
                            station: { ...template, name: template.name ? `${template.name}_${suffix}` : `STN${suffix}` },
                            rows: [{ id: crypto.randomUUID(), pointId: `P1`, instrumentHeight: '1.500', targetHeight: '1.500', bearing: '', verticalAngle: '0', slopeDistance: '', remarks: '' }],
                          },
                        ])
                        setActiveControlSetupId(id)
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 text-[var(--accent)] font-semibold whitespace-nowrap"
                    >
                      + Setup
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-color)]/50">
                    <div className="col-span-2">
                      <label htmlFor="mfs-station-name" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Station Name</label>
                      <input id="mfs-station-name"
                        type="text"
                        className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] uppercase focus:outline-none focus:border-[var(--accent)]"
                        value={controlStation.name}
                        onChange={(e) => setControlStation((p: ControlStation) => ({ ...p, name: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="mfs-station-e" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Station E (m)</label>
                      <input id="mfs-station-e"
                        type="number"
                        inputMode="decimal"
                        className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        value={controlStation.e}
                        onChange={(e) => setControlStation((p: ControlStation) => ({ ...p, e: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label htmlFor="mfs-station-n" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Station N (m)</label>
                      <input id="mfs-station-n"
                        type="number"
                        inputMode="decimal"
                        className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        value={controlStation.n}
                        onChange={(e) => setControlStation((p: ControlStation) => ({ ...p, n: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <label htmlFor="mfs-station-z" className="text-[10px] uppercase font-semibold text-[var(--text-muted)]">Elevation Z (m)</label>
                      <input id="mfs-station-z"
                        type="number"
                        inputMode="decimal"
                        className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        value={controlStation.z}
                        onChange={(e) => setControlStation((p: ControlStation) => ({ ...p, z: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        const src = controlSetups.find((s) => s.id === activeControlSetupId)
                        if (!src) return
                        const id = crypto.randomUUID()
                        const suffix = controlSetups.length + 1
                        setControlSetups((prev) => [
                          ...prev,
                          {
                            id,
                            station: { ...src.station, name: src.station.name ? `${src.station.name}_copy${suffix}` : `STN_copy${suffix}` },
                            rows: src.rows.map((r: Row) => ({ ...r, id: crypto.randomUUID() })),
                          },
                        ])
                        setActiveControlSetupId(id)
                      }}
                      className="flex-1 py-2 text-xs font-semibold bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg"
                    >
                      Duplicate Setup
                    </button>
                    <button
                      disabled={controlSetups.length <= 1}
                      onClick={() => {
                        if (controlSetups.length <= 1) return
                        if (!confirm('Remove this setup?')) return
                        const next = controlSetups.filter((s) => s.id !== activeControlSetupId)
                        const nextActive = next[0]?.id ?? controlSetups[0]?.id
                        setControlSetups(next)
                        if (nextActive) setActiveControlSetupId(nextActive)
                      }}
                      className="flex-1 py-2 text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg disabled:opacity-50"
                    >
                      Delete Setup
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="grid place-items-center w-16 h-16 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] mb-4">
              <Plus className="w-7 h-7 text-[var(--text-muted)]" />
            </div>
            <p className="text-base font-medium text-[var(--text-secondary)] mb-1">No readings yet</p>
            <p className="text-sm text-[var(--text-muted)] max-w-xs">
              Tap the <span className="text-[var(--accent)] font-semibold">+</span> button below to record your first {TYPE_LABELS[surveyType].label.toLowerCase()} observation.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Summary line at top */}
            <div className="flex items-center justify-between px-1 pb-1 text-xs text-[var(--text-muted)]">
              <span>{rows.length} reading{rows.length !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Auto-saved locally
              </span>
            </div>

            {rows.map((row, idx) => {
              const isDeleting = confirmDelete === row.id
              return (
                <div
                  key={row.id}
                  className={[
                    'relative bg-[var(--bg-card)] rounded-xl border transition-all overflow-hidden',
                    isDeleting
                      ? 'border-red-500/50 ring-2 ring-red-500/30'
                      : 'border-[var(--border-color)] hover:border-[var(--accent)]/30',
                  ].join(' ')}
                >
                  <div className="flex items-stretch">
                    {/* Card body */}
                    <div className="flex-1 p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {row._timestamp ? new Date(row._timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        {cardFields.map((f) => {
                          const val = row[f.key]
                          return (
                            <div key={f.key} className="min-w-0">
                              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] truncate">{f.label}</div>
                              <div className={[
                                'text-sm truncate',
                                f.mono ? 'font-mono text-[var(--text-primary)]' : 'font-semibold text-[var(--accent)]',
                              ].join(' ')}>
                                {val || '—'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {row.remarks && (
                        <p className="mt-2 text-xs text-[var(--text-secondary)] italic line-clamp-2">
                          “{row.remarks}”
                        </p>
                      )}
                    </div>

                    {/* Delete button column */}
                    <button
                      onClick={() => {
                        if (isDeleting) {
                          onRemoveRow(row.id)
                          setConfirmDelete(null)
                        } else {
                          setConfirmDelete(row.id)
                          setTimeout(() => setConfirmDelete(null), 3000)
                        }
                      }}
                      className={[
                        'flex flex-col items-center justify-center w-14 transition-colors',
                        isDeleting
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-[var(--bg-secondary)]/30 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-400',
                      ].join(' ')}
                      aria-label="Delete reading"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-[9px] mt-0.5 uppercase tracking-wider">
                        {isDeleting ? 'Tap again' : 'Delete'}
                      </span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Calculations & Precision Panel */}
        {computed && (
          <div className="mt-4 mb-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden shadow-sm">
            <button
              onClick={() => setResultsOpen(!resultsOpen)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)]/50 text-sm font-semibold text-[var(--text-primary)]"
            >
              <span className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[var(--accent)]" />
                Precision & Closure Checks
              </span>
              {resultsOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
            </button>

            {resultsOpen && (
              <div className="p-4 border-t border-[var(--border-color)] space-y-3 bg-[var(--bg-secondary)]/25">
                {!computed.ok ? (
                  <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-xs text-red-300 space-y-1">
                    <div className="font-semibold text-red-400"><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Calculation Errors:</div>
                    {(computed.errors ?? []).map((e: string, i: number) => (
                      <div key={`item-${i}`} className="list-item ml-3">{e}</div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {surveyType === 'leveling' && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="col-span-2 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                          <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Arithmetic Check</div>
                          <div className={`font-mono text-sm font-bold ${(computed.calc?.arithmeticCheck ?? false) ? 'text-green-400' : 'text-red-400'}`}>
                            {(computed.calc?.arithmeticCheck ?? false) ? 'PASS' : 'FAIL'}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                          <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Misclosure</div>
                          <div className="font-mono text-sm text-[var(--text-primary)]">{Number(computed.calc?.misclosure ?? 0).toFixed(4)} m</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                          <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Allowable</div>
                          <div className="font-mono text-sm text-[var(--text-primary)]">±{Number(computed.calc?.allowableMisclosure ?? 0).toFixed(4)} m</div>
                        </div>
                      </div>
                    )}

                    {surveyType === 'traverse' && (
                      <>
                        {computed.mode === 'open' ? (
                          <div className="p-3 bg-yellow-950/20 border border-yellow-500/30 rounded-lg text-xs text-yellow-350">
                            <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Open Traverse: No closing coordinate check. Prohibited for legal land boundary surveys under Reg 67.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                              <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Linear Error</div>
                              <div className="font-mono text-sm text-[var(--text-primary)]">{Number(computed.adjusted?.linearError ?? 0).toFixed(4)} m</div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                              <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Precision Ratio</div>
                              <div className="font-mono text-sm text-[var(--accent)] font-bold">
                                1 : {Math.max(1, Math.round(Number(computed.adjusted?.totalDistance ?? 0) / Math.max(1e-12, Number(computed.adjusted?.linearError ?? 0)))).toLocaleString()}
                              </div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                              <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Closing Error E</div>
                              <div className="font-mono text-xs text-[var(--text-primary)]">{Number(computed.adjusted?.closingErrorE ?? 0).toFixed(4)} m</div>
                            </div>
                            <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                              <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Closing Error N</div>
                              <div className="font-mono text-xs text-[var(--text-primary)]">{Number(computed.adjusted?.closingErrorN ?? 0).toFixed(4)} m</div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {(surveyType === 'control') && (
                      <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
                         All {rows.length} points calculated successfully via 3D polar computations.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Floating Action Button (above measurement capture bar) ─── */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-24 right-5 z-40 grid place-items-center w-14 h-14 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dim)] text-black shadow-2xl shadow-[var(--accent)]/40 active:scale-95 transition-all"
        aria-label={`Add ${TYPE_LABELS[surveyType].label} reading`}
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
        <span className="sr-only">Add reading</span>
      </button>

      {showForm && (
        <UniversalMobileObservationForm
          surveyType={surveyType}
          stationName={stationName}
          lastStation={lastStation}
          onPullInstrumentReading={onPullInstrumentReading}
          onAdd={async (row, photos) => {
            onAddRow({ ...row, _timestamp: new Date().toISOString() }, photos)
            setShowForm(false)
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
