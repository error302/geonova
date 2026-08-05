'use client';

/**
 * FieldbookWorkspace
 * -------------------
 * Enhanced desktop split workspace layout: 3/6/3 grid.
 *
 *   Left (3 cols):   Project & settings sidebar
 *   Center (6 cols): Data entry table area
 *   Right (3 cols):  Live Computation Panel — real-time results
 *
 * The Live Computation Panel shows survey-type-specific computed results
 * as data is entered, giving instant feedback without needing to
 * click "Compute".
 */

import { useState, type ReactNode } from 'react';
import {
  MapPin,
  Ruler,
  Waves,
  Pickaxe,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Crosshair,
  BarChart3,
  Activity,
  Eye,
  EyeOff,
} from 'lucide-react';
import { bearingToString } from '@/lib/engine/angles';

// ─── Types ──────────────────────────────────────────────────────────────

export type FieldbookType = 'leveling' | 'traverse' | 'control' | 'hydrographic' | 'mining';

interface LiveReadingRow {
  station: string
  bs?: number | null
  is?: number | null
  fs?: number | null
  rise?: number | null
  fall?: number | null
  reducedLevel?: number | null
}
interface LiveLegRow {
  to: string
  from?: string
  easting?: number
  northing?: number
  adjEasting?: number
  adjNorthing?: number
  bearingDMS?: string
}
interface LiveComputedRow {
  pointId?: string
  soundingId?: string
  bearingNum?: number
  depth?: number
  corrected?: number
  computed?: { easting: number; northing: number; elevation?: number | null }
}
interface LiveComputed {
  ok: boolean
  errors?: string[]
  mode?: 'open' | 'closed'
  raw?: { legs: LiveLegRow[] }
  adjusted?: {
    legs: LiveLegRow[]
    linearError: number
    totalDistance: number
    closingErrorE: number
    closingErrorN: number
  }
  calc?: {
    readings: LiveReadingRow[]
    misclosure?: number
    allowableMisclosure?: number
    arithmeticCheck?: boolean
  }
  rows?: LiveComputedRow[]
}

interface LiveComputationPanelProps {
  surveyType: FieldbookType;
  computed: LiveComputed;
  rows: Array<{ id: string; [key: string]: string }>;
  stationInfo?: { name: string; e: string; n: string; z: string };
}

interface FieldbookWorkspaceProps {
  /** Content for the left sidebar */
  sidebar: ReactNode;

  /** Content for the center data entry area */
  dataEntry: ReactNode;

  /** Current survey type */
  surveyType: FieldbookType;

  /** Computed results from the page */
  computed: LiveComputed;

  /** Current rows */
  rows: Array<{ id: string; [key: string]: string }>;

  /** Station info (for control/mining) */
  stationInfo?: { name: string; e: string; n: string; z: string };
}

// ─── Helper: format number safely ───────────────────────────────────────

function fmt(val: number | undefined | null, decimals = 4): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  return val.toFixed(decimals);
}

// ─── Live Computation Panel Sections ────────────────────────────────────

function LevelingLivePanel({ computed }: { computed: LiveComputed }) {
  if (!computed?.ok) {
    return (
      <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-400">
        <div className="flex items-center gap-1.5 font-semibold mb-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Calculation Errors
        </div>
        {computed?.errors?.map((e: string, i: number) => (
          <div key={i} className="ml-4 list-item text-red-400/80">{e}</div>
        )) ?? <div className="text-[var(--text-muted)]">Enter data to see results</div>}
      </div>
    );
  }

  const calc = computed.calc;
  const lastReading = calc?.readings?.[calc.readings.length - 1];
  const setups = calc?.readings?.filter((r: LiveReadingRow) => r.station !== 'BM').length ?? 0;

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-400">Valid computation</span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 gap-2">
        <MetricCard
          icon={<TrendingUp className="w-3.5 h-3.5 text-[var(--accent)]" />}
          label="Current RL"
          value={fmt(lastReading?.reducedLevel)}
          unit="m"
        />
        <MetricCard
          icon={<Ruler className="w-3.5 h-3.5 text-[var(--accent)]" />}
          label="Misclosure"
          value={fmt(calc?.misclosure)}
          unit="m"
          status={Math.abs(calc?.misclosure ?? 0) <= (calc?.allowableMisclosure ?? 0) ? 'pass' : 'fail'}
        />
        <MetricCard
          icon={<BarChart3 className="w-3.5 h-3.5 text-[var(--accent)]" />}
          label="Allowable"
          value={`\u00B1${fmt(calc?.allowableMisclosure)}`}
          unit="m"
        />
        <MetricCard
          icon={<Activity className="w-3.5 h-3.5 text-[var(--accent)]" />}
          label="Setups"
          value={String(setups)}
          unit="stations"
        />
      </div>

      {/* Arithmetic check */}
      <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
          Arithmetic Check
        </div>
        <div className={`font-mono text-sm font-bold ${calc?.arithmeticCheck ? 'text-emerald-400' : 'text-red-400'}`}>
          {calc?.arithmeticCheck ? 'PASS' : 'FAIL'}
        </div>
      </div>

      {/* RL History Mini-Chart */}
      {calc && calc.readings.length > 1 && (
        <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
            RL Profile
          </div>
          <div className="flex items-end gap-0.5 h-16">
            {calc.readings
              .filter((r: LiveReadingRow) => r.station !== 'BM')
              .map((r: LiveReadingRow, i: number) => {
                const rl = r.reducedLevel ?? 0;
                const allRLs = calc.readings
                  .filter((rr: LiveReadingRow) => rr.station !== 'BM')
                  .map((rr: LiveReadingRow) => rr.reducedLevel ?? 0);
                const min = Math.min(...allRLs);
                const max = Math.max(...allRLs);
                const range = max - min || 1;
                const height = ((rl - min) / range) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-[var(--accent)]/60 rounded-t-sm min-w-[4px] transition-all"
                    style={{ height: `${Math.max(4, height)}%` }}
                    title={`${r.station}: ${fmt(rl)} m`}
                  />
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function TraverseLivePanel({ computed }: { computed: LiveComputed }) {
  if (!computed?.ok) {
    return (
      <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-400">
        <div className="flex items-center gap-1.5 font-semibold mb-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Calculation Errors
        </div>
        {computed?.errors?.map((e: string, i: number) => (
          <div key={i} className="ml-4 list-item text-red-400/80">{e}</div>
        )) ?? <div className="text-[var(--text-muted)]">Enter data to see results</div>}
      </div>
    );
  }

  const isOpen = computed.mode === 'open';
  const legs = isOpen ? computed.raw?.legs : computed.adjusted?.legs;
  const lastLeg = legs?.[legs.length - 1];

  return (
    <div className="space-y-3">
      {isOpen && (
        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-400">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            Open Traverse
          </div>
          <p className="mt-1 text-amber-400/70">No closing check. Not recommended for legal surveys (Reg 67).</p>
        </div>
      )}

      {!isOpen && computed.adjusted && (
        <>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Adjusted</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <MetricCard
              icon={<Ruler className="w-3.5 h-3.5 text-[var(--accent)]" />}
              label="Linear Error"
              value={fmt(computed.adjusted.linearError)}
              unit="m"
            />
            <MetricCard
              icon={<Crosshair className="w-3.5 h-3.5 text-[var(--accent)]" />}
              label="Precision Ratio"
              value={`1 : ${Math.max(1, Math.round(Number(computed.adjusted.totalDistance) / Math.max(1e-12, Number(computed.adjusted.linearError)))).toLocaleString()}`}
              status={Number(computed.adjusted.linearError) / Math.max(1, Number(computed.adjusted.totalDistance)) < 1 / 5000 ? 'pass' : 'fail'}
            />
            <MetricCard
              icon={<MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />}
              label="Closing Error E"
              value={fmt(computed.adjusted.closingErrorE)}
              unit="m"
            />
            <MetricCard
              icon={<MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />}
              label="Closing Error N"
              value={fmt(computed.adjusted.closingErrorN)}
              unit="m"
            />
          </div>
        </>
      )}

      {/* Last point coordinates */}
      {lastLeg && (
        <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
            Latest Coordinates
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Station</span>
              <span className="font-mono text-[var(--text-primary)]">{lastLeg.to || '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Easting</span>
              <span className="font-mono text-[var(--accent)]">{fmt(lastLeg.easting ?? lastLeg.adjEasting)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Northing</span>
              <span className="font-mono text-[var(--accent)]">{fmt(lastLeg.northing ?? lastLeg.adjNorthing)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Bearing</span>
              <span className="font-mono text-[var(--text-secondary)]">{lastLeg.bearingDMS || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Coordinate table */}
      {legs && legs.length > 0 && (
        <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
            All Points
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
            {legs.map((leg: LiveLegRow, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[10px] py-1 border-b border-[var(--border-color)]/50 last:border-0">
                <span className="w-16 text-[var(--text-primary)] font-semibold truncate">{leg.to || '—'}</span>
                <span className="flex-1 font-mono text-[var(--accent)]">{fmt(leg.easting ?? leg.adjEasting)}</span>
                <span className="flex-1 font-mono text-[var(--accent)]">{fmt(leg.northing ?? leg.adjNorthing)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ControlLivePanel({ computed, stationInfo }: { computed: LiveComputed; stationInfo?: { name: string; e: string; n: string; z: string } }) {
  if (!computed?.ok) {
    return (
      <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-400">
        <div className="flex items-center gap-1.5 font-semibold mb-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Calculation Errors
        </div>
        {computed?.errors?.map((e: string, i: number) => (
          <div key={i} className="ml-4 list-item text-red-400/80">{e}</div>
        )) ?? <div className="text-[var(--text-muted)]">Enter station & data to compute</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-400">All points computed</span>
      </div>

      {/* Station info */}
      {stationInfo && (
        <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
            Instrument Station
          </div>
          <div className="text-sm font-semibold text-[var(--accent)]">{stationInfo.name || '—'}</div>
          <div className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
            E: {stationInfo.e || '—'}  N: {stationInfo.n || '—'}  RL: {stationInfo.z || '—'}
          </div>
        </div>
      )}

      {/* Computed coordinates for each radiation */}
      <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
          Radiated Points
        </div>
        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
          {computed.rows?.map((row: LiveComputedRow, i: number) => (
            <div
              key={i}
              className="p-2 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-color)]/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--accent)]">{row.pointId || `P${i + 1}`}</span>
                {row.bearingNum != null && (
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {bearingToString(row.bearingNum)}
                  </span>
                )}
              </div>
              {row.computed ? (
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <div>
                    <div className="text-[8px] text-[var(--text-muted)] uppercase">E</div>
                    <div className="text-[10px] font-mono text-[var(--text-primary)]">{fmt(row.computed.easting)}</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-[var(--text-muted)] uppercase">N</div>
                    <div className="text-[10px] font-mono text-[var(--text-primary)]">{fmt(row.computed.northing)}</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-[var(--text-muted)] uppercase">RL</div>
                    <div className="text-[10px] font-mono text-[var(--text-primary)]">{fmt(row.computed.elevation)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-[var(--text-muted)] mt-1">Incomplete data</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HydroLivePanel({ computed }: { computed: LiveComputed }) {
  if (!computed?.ok) {
    return (
      <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-400">
        <div className="flex items-center gap-1.5 font-semibold mb-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Calculation Errors
        </div>
        {computed?.errors?.map((e: string, i: number) => (
          <div key={i} className="ml-4 list-item text-red-400/80">{e}</div>
        )) ?? <div className="text-[var(--text-muted)]">Enter sounding data</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-400">All soundings processed</span>
      </div>

      <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
          Reduced Depths (Tide Corrected)
        </div>
        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
          {computed.rows?.map((row: LiveComputedRow, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border-color)]/50 last:border-0">
              <span className="text-[var(--text-primary)] font-semibold">{row.soundingId || `S${i + 1}`}</span>
              <div className="flex items-center gap-3">
                <span className="text-[var(--text-muted)]">Raw: <span className="font-mono">{row.depth}</span></span>
                <span className="text-[var(--accent)] font-mono font-semibold">
                  {row.corrected != null ? fmt(row.corrected) : '—'} m
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiningLivePanel({ computed, stationInfo }: { computed: LiveComputed; stationInfo?: { name: string; e: string; n: string; z: string } }) {
  if (!computed?.ok) {
    return (
      <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-400">
        <div className="flex items-center gap-1.5 font-semibold mb-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Calculation Errors
        </div>
        {computed?.errors?.map((e: string, i: number) => (
          <div key={i} className="ml-4 list-item text-red-400/80">{e}</div>
        )) ?? <div className="text-[var(--text-muted)]">Enter station & data to compute</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-400">All points computed</span>
      </div>

      {stationInfo && (
        <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
            Mining Station
          </div>
          <div className="text-sm font-semibold text-[var(--accent)]">{stationInfo.name || '—'}</div>
          <div className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">
            E: {stationInfo.e || '—'}  N: {stationInfo.n || '—'}  RL: {stationInfo.z || '—'}
          </div>
        </div>
      )}

      <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
          Computed Points
        </div>
        <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
          {computed.rows?.map((row: LiveComputedRow, i: number) => (
            <div
              key={i}
              className="p-2 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-color)]/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--accent)]">{row.pointId || `P${i + 1}`}</span>
                {row.bearingNum != null && (
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    {bearingToString(row.bearingNum)}
                  </span>
                )}
              </div>
              {row.computed ? (
                <div className="grid grid-cols-3 gap-1 mt-1">
                  <div>
                    <div className="text-[8px] text-[var(--text-muted)] uppercase">E</div>
                    <div className="text-[10px] font-mono text-[var(--text-primary)]">{fmt(row.computed.easting)}</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-[var(--text-muted)] uppercase">N</div>
                    <div className="text-[10px] font-mono text-[var(--text-primary)]">{fmt(row.computed.northing)}</div>
                  </div>
                  <div>
                    <div className="text-[8px] text-[var(--text-muted)] uppercase">RL</div>
                    <div className="text-[10px] font-mono text-[var(--text-primary)]">{fmt(row.computed.elevation)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-[var(--text-muted)] mt-1">Incomplete data</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  unit,
  status,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  status?: 'pass' | 'fail';
}) {
  return (
    <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={[
          'font-mono text-sm font-bold',
          status === 'pass' ? 'text-emerald-400' : status === 'fail' ? 'text-red-400' : 'text-[var(--text-primary)]',
        ].join(' ')}>
          {value}
        </span>
        {unit && <span className="text-[10px] text-[var(--text-muted)]">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Live Computation Panel (router) ────────────────────────────────────

function LiveComputationPanel({ surveyType, computed, rows, stationInfo }: LiveComputationPanelProps) {
  const surveyIcon = {
    leveling: <Ruler className="w-4 h-4" />,
    traverse: <Crosshair className="w-4 h-4" />,
    control: <MapPin className="w-4 h-4" />,
    hydrographic: <Waves className="w-4 h-4" />,
    mining: <Pickaxe className="w-4 h-4" />,
  }[surveyType];

  const surveyLabel = {
    leveling: 'Leveling',
    traverse: 'Traverse',
    control: 'Control',
    hydrographic: 'Hydrographic',
    mining: 'Mining',
  }[surveyType];

  return (
    <div className="space-y-3">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-1">
        <div className="text-[var(--accent)]">{surveyIcon}</div>
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Live Computation</h3>
          <p className="text-[10px] text-[var(--text-muted)]">{surveyLabel} results</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>

      {/* Data count */}
      <div className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs">
        <span className="text-[var(--text-muted)]">Readings: </span>
        <span className="font-mono font-semibold text-[var(--text-primary)]">{rows.length}</span>
      </div>

      {/* Type-specific panels */}
      {surveyType === 'leveling' && <LevelingLivePanel computed={computed} />}
      {surveyType === 'traverse' && <TraverseLivePanel computed={computed} />}
      {surveyType === 'control' && <ControlLivePanel computed={computed} stationInfo={stationInfo} />}
      {surveyType === 'hydrographic' && <HydroLivePanel computed={computed} />}
      {surveyType === 'mining' && <MiningLivePanel computed={computed} stationInfo={stationInfo} />}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function FieldbookWorkspace({
  sidebar,
  dataEntry,
  surveyType,
  computed,
  rows,
  stationInfo,
}: FieldbookWorkspaceProps) {
  const [panelVisible, setPanelVisible] = useState(true);

  return (
    <div className="grid lg:grid-cols-12 gap-4 lg:gap-6">
      {/* Left sidebar — Project & settings (3 cols) */}
      <div className="lg:col-span-3 space-y-4">
        {sidebar}
      </div>

      {/* Center — Data entry table (6 cols) */}
      <div className={[
        'transition-all duration-300',
        panelVisible ? 'lg:col-span-6' : 'lg:col-span-9',
      ].join(' ')}>
        {dataEntry}
      </div>

      {/* Right — Live Computation Panel (3 cols) */}
      {panelVisible && (
        <div className="lg:col-span-3 hidden lg:block">
          <div className="sticky top-4">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
              <LiveComputationPanel
                surveyType={surveyType}
                computed={computed}
                rows={rows}
                stationInfo={stationInfo}
              />
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setPanelVisible(!panelVisible)}
        className={[
          'hidden lg:flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium',
          'fixed right-4 top-20 z-30',
          'bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm',
          'hover:border-[var(--accent)]/40 transition-colors',
        ].join(' ')}
        title={panelVisible ? 'Hide computation panel' : 'Show computation panel'}
      >
        {panelVisible ? (
          <>
            <EyeOff className="w-3.5 h-3.5" />
            <span>Hide Panel</span>
          </>
        ) : (
          <>
            <Eye className="w-3.5 h-3.5" />
            <span>Show Panel</span>
          </>
        )}
      </button>
    </div>
  );
}

// Re-export the Live Computation Panel for standalone usage
export { LiveComputationPanel };
