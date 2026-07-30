'use client';

/**
 * FieldbookQuickActions
 * ----------------------
 * A suite of innovative quick-action features for field book data entry:
 *
 *   - Quick Duplicate Detection: warns when a similar reading already exists
 *   - Smart Bearing Parser Badge: interprets DDD.MMSS, quadrant, or DMS input
 *   - Field Weather Note: tag weather conditions with timestamps
 *   - Instrument Check Reminder: periodic 30-min reminder for instrument checks
 *   - Computation Preview Card: shows computed result before user clicks compute
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  CloudSun,
  Copy,
  Eye,
  Sun,
  Cloud,
  CloudRain,
  Wind,
  CheckCircle2,
  ThermometerSun,
  Calculator,
  ArrowRight,
} from 'lucide-react';
import { parseFieldAngle, normalizeBearing, bearingToString, wcbToQuadrant } from '@/lib/engine/angles';

// ─── Types ──────────────────────────────────────────────────────────────

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'windy';

export interface WeatherNote {
  id: string;
  timestamp: string;
  condition: WeatherCondition;
}

export interface DuplicateWarning {
  isDuplicate: boolean;
  existingIndex: number | null;
  similarity: number;
}

export interface ComputationPreview {
  type: 'mean_angle' | 'radiation_coord' | 'running_rl' | 'tide_corrected' | null;
  label: string;
  value: string;
  detail?: string;
}

interface FieldbookQuickActionsProps {
  /** Current survey type */
  surveyType: 'leveling' | 'traverse' | 'control' | 'hydrographic' | 'mining';

  /** Current rows in the field book */
  rows: Array<{ id: string; [key: string]: string }>;

  /** New row being entered (partial) */
  currentEntry: Record<string, string>;

  /** Bearing text the user is currently typing */
  bearingInput?: string;

  /** Current computation result (from the page) */
  computed: any;

  /** Callback to save a weather note with the fieldbook data */
  onWeatherNote?: (note: WeatherNote) => void;

  /** Callback to dismiss the instrument check reminder */
  onDismissInstrumentCheck?: () => void;

  /** Whether the component is rendered on mobile */
  isMobile?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const WEATHER_CONFIG: Record<WeatherCondition, { icon: typeof Sun; label: string; color: string }> = {
  sunny: { icon: Sun, label: 'Sunny', color: 'text-amber-400' },
  cloudy: { icon: Cloud, label: 'Cloudy', color: 'text-slate-400' },
  rainy: { icon: CloudRain, label: 'Rainy', color: 'text-blue-400' },
  windy: { icon: Wind, label: 'Windy', color: 'text-teal-400' },
};

function parseBearingForBadge(input: string): { display: string; decimal: number | null; format: string } {
  if (!input || !input.trim()) return { display: '', decimal: null, format: '' };

  const trimmed = input.trim().toUpperCase();

  // Quadrant bearing: NE, NW, SE, SW (maps to 45, 315, 135, 225)
  const quadrantMap: Record<string, number> = {
    'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5,
    'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5,
    'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5,
    'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5,
  };

  if (quadrantMap[trimmed] !== undefined) {
    const deg = quadrantMap[trimmed];
    return {
      display: `${deg.toFixed(0)}\u00B000'00" (${trimmed} quadrant)`,
      decimal: deg,
      format: 'Quadrant',
    };
  }

  // Try parseFieldAngle which handles DDD.MMSS and DMS
  const parsed = parseFieldAngle(trimmed);
  if (parsed !== null) {
    const normalized = normalizeBearing(parsed);
    const dmsDisplay = bearingToString(normalized);
    const quadrant = wcbToQuadrant(normalized);

    // Detect format
    let format = 'DDD.MMSS';
    if (/[°'"]/.test(trimmed)) format = 'DMS';
    else if (/^\d+\.?\d*$/.test(trimmed) && !trimmed.includes('.')) format = 'Decimal';

    return {
      display: `${dmsDisplay} (${quadrant})`,
      decimal: normalized,
      format,
    };
  }

  return { display: 'Invalid bearing', decimal: null, format: '' };
}

function checkDuplicate(
  currentEntry: Record<string, string>,
  rows: Array<{ id: string; [key: string]: string }>,
  _surveyType: string
): DuplicateWarning {
  const station = (currentEntry.station || currentEntry.pointId || '').trim().toUpperCase();
  if (!station) return { isDuplicate: false, existingIndex: null, similarity: 0 };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowStation = (row.station || row.pointId || '').trim().toUpperCase();

    if (rowStation === station) {
      // Check if bearing and distance are also similar
      const currentBearing = currentEntry.bearing || '';
      const rowBearing = row.bearing || '';
      const currentDist = currentEntry.slopeDist || currentEntry.slopeDistance || '';
      const rowDist = row.slopeDist || row.slopeDistance || '';

      if (currentBearing && rowBearing && currentDist && rowDist) {
        const bearingSimilar = Math.abs(parseFloat(currentBearing) - parseFloat(rowBearing)) < 0.01;
        const distSimilar = Math.abs(parseFloat(currentDist) - parseFloat(rowDist)) < 0.01;
        if (bearingSimilar && distSimilar) {
          return { isDuplicate: true, existingIndex: i, similarity: 1.0 };
        }
      }

      return { isDuplicate: true, existingIndex: i, similarity: 0.6 };
    }
  }

  return { isDuplicate: false, existingIndex: null, similarity: 0 };
}

function buildComputationPreview(
  surveyType: string,
  rows: Array<{ id: string; [key: string]: string }>,
  currentEntry: Record<string, string>,
  computed: any
): ComputationPreview | null {
  if (!rows.length && !Object.keys(currentEntry).length) return null;

  try {
    if (surveyType === 'leveling' && computed?.ok) {
      const lastReading = computed.calc?.readings?.[computed.calc.readings.length - 1];
      if (lastReading) {
        return {
          type: 'running_rl',
          label: 'Running RL',
          value: `${(lastReading.reducedLevel ?? 0).toFixed(4)} m`,
          detail: `Station: ${lastReading.station || '—'}`,
        };
      }
    }

    if (surveyType === 'traverse' && computed?.ok) {
      const legs = computed.mode === 'open' ? computed.raw?.legs : computed.adjusted?.legs;
      if (legs?.length) {
        const lastLeg = legs[legs.length - 1];
        return {
          type: 'mean_angle',
          label: 'Last Point Coords',
          value: `E: ${(lastLeg.easting ?? lastLeg.adjEasting ?? 0).toFixed(4)}  N: ${(lastLeg.northing ?? lastLeg.adjNorthing ?? 0).toFixed(4)}`,
          detail: `Bearing: ${lastLeg.bearingDMS || '—'}`,
        };
      }
    }

    if ((surveyType === 'control' || surveyType === 'mining') && computed?.ok && computed.rows?.length) {
      const lastRow = computed.rows[computed.rows.length - 1];
      if (lastRow?.computed) {
        return {
          type: 'radiation_coord',
          label: 'Computed Point',
          value: `E: ${lastRow.computed.easting.toFixed(4)}  N: ${lastRow.computed.northing.toFixed(4)}`,
          detail: `RL: ${lastRow.computed.elevation.toFixed(4)} m`,
        };
      }
    }

    if (surveyType === 'hydrographic' && computed?.ok && computed.rows?.length) {
      const lastRow = computed.rows[computed.rows.length - 1];
      if (lastRow?.corrected !== null && lastRow?.corrected !== undefined) {
        return {
          type: 'tide_corrected',
          label: 'Corrected Depth',
          value: `${lastRow.corrected.toFixed(4)} m`,
          detail: `Sounding: ${lastRow.soundingId || '—'}`,
        };
      }
    }
  } catch {
    // Silently fail — preview is best-effort
  }

  return null;
}

// ─── Sub-components ─────────────────────────────────────────────────────

/** Smart Bearing Parser Badge — interprets what the user is typing */
function BearingParserBadge({ bearingInput }: { bearingInput: string }) {
  const parsed = useMemo(() => parseBearingForBadge(bearingInput), [bearingInput]);

  if (!bearingInput?.trim()) return null;

  return (
    <div
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
        parsed.decimal !== null
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-red-500/15 text-red-400 border border-red-500/30',
      ].join(' ')}
    >
      {parsed.decimal !== null ? (
        <Eye className="w-3 h-3" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      <span className="font-mono">{parsed.display}</span>
      {parsed.format && (
        <span className="opacity-60 ml-0.5">[{parsed.format}]</span>
      )}
    </div>
  );
}

/** Duplicate Detection Warning */
function DuplicateWarningBanner({ warning }: { warning: DuplicateWarning }) {
  if (!warning.isDuplicate) return null;

  return (
    <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs">
      <Copy className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold text-amber-300">
          Possible duplicate entry
        </p>
        <p className="text-amber-400/80 mt-0.5">
          {warning.similarity >= 1.0
            ? `Row #${(warning.existingIndex ?? 0) + 1} has the same station, bearing, and distance.`
            : `Row #${(warning.existingIndex ?? 0) + 1} has the same station name.`}
        </p>
      </div>
    </div>
  );
}

/** Field Weather Note — tag weather conditions */
function WeatherNoteButton({ onWeatherNote }: { onWeatherNote?: (note: WeatherNote) => void }) {
  const [open, setOpen] = useState(false);
  const [savedNotes, setSavedNotes] = useState<WeatherNote[]>([]);

  const handleSelect = useCallback(
    (condition: WeatherCondition) => {
      const note: WeatherNote = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        condition,
      };
      setSavedNotes((prev) => [...prev, note]);
      onWeatherNote?.(note);
      setOpen(false);
    },
    [onWeatherNote]
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 transition-colors"
        title="Tag weather conditions"
      >
        <CloudSun className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span className="text-[var(--text-secondary)]">Weather</span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xl p-2 min-w-[160px]">
          {(['sunny', 'cloudy', 'rainy', 'windy'] as WeatherCondition[]).map((c) => {
            const cfg = WEATHER_CONFIG[c];
            const Icon = cfg.icon;
            return (
              <button
                key={c}
                onClick={() => handleSelect(c)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <Icon className={`w-4 h-4 ${cfg.color}`} />
                <span className="text-[var(--text-primary)]">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Saved weather tags */}
      {savedNotes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {savedNotes.slice(-3).map((note) => {
            const cfg = WEATHER_CONFIG[note.condition];
            const Icon = cfg.icon;
            return (
              <span
                key={note.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)]"
              >
                <Icon className={`w-2.5 h-2.5 ${cfg.color}`} />
                {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Instrument Check Reminder — 30-minute interval */
function InstrumentCheckReminder({
  onDismiss,
  isMobile,
}: {
  onDismiss?: () => void;
  isMobile?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!dismissed) {
        setVisible(true);
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [dismissed]);

  const handleYes = useCallback(() => {
    setLastChecked(new Date());
    setVisible(false);
    setDismissed(true);
    onDismiss?.();
    // Re-enable after another 30 min
    setTimeout(() => setDismissed(false), 30 * 60 * 1000);
  }, [onDismiss]);

  const handleLater = useCallback(() => {
    setVisible(false);
    // Remind again in 10 minutes
    setTimeout(() => setVisible(true), 10 * 60 * 1000);
  }, []);

  if (!visible) {
    return lastChecked ? (
      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        Instrument checked: {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    ) : null;
  }

  return (
    <div
      className={[
        'flex items-center gap-3 p-3 rounded-xl border transition-all animate-in fade-in',
        'bg-amber-500/8 border-amber-500/30',
        isMobile ? 'mx-0' : '',
      ].join(' ')}
    >
      <div className="grid place-items-center w-9 h-9 rounded-full bg-amber-500/15 shrink-0">
        <ThermometerSun className="w-4.5 h-4.5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-300">
          Instrument Check
        </p>
        <p className="text-xs text-amber-400/70">
          Have you checked your level/total station?
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={handleYes}
          className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/30 transition"
        >
          Yes
        </button>
        <button
          onClick={handleLater}
          className="px-3 py-1.5 text-xs font-semibold bg-[var(--bg-secondary)] text-[var(--text-muted)] rounded-lg border border-[var(--border-color)] hover:border-amber-500/30 transition"
        >
          Later
        </button>
      </div>
    </div>
  );
}

/** Computation Preview Card — shows computed result before clicking compute */
function ComputationPreviewCard({ preview }: { preview: ComputationPreview | null }) {
  if (!preview) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)]/50 border-b border-[var(--border-color)]">
        <Calculator className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span className="text-xs font-semibold text-[var(--text-primary)]">
          Live Preview
        </span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Auto
        </span>
      </div>
      <div className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
          {preview.label}
        </div>
        <div className="font-mono text-sm text-[var(--accent)] font-bold break-all">
          {preview.value}
        </div>
        {preview.detail && (
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            {preview.detail}
          </div>
        )}
        <div className="flex items-center gap-1 mt-2 text-[10px] text-[var(--text-muted)]">
          <ArrowRight className="w-3 h-3" />
          Click &ldquo;Compute&rdquo; for full results
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function FieldbookQuickActions({
  surveyType,
  rows,
  currentEntry,
  bearingInput = '',
  computed,
  onWeatherNote,
  onDismissInstrumentCheck,
  isMobile = false,
}: FieldbookQuickActionsProps) {
  // Duplicate detection
  const duplicateWarning = useMemo(
    () => checkDuplicate(currentEntry, rows, surveyType),
    [currentEntry, rows, surveyType]
  );

  // Computation preview
  const computationPreview = useMemo(
    () => buildComputationPreview(surveyType, rows, currentEntry, computed),
    [surveyType, rows, currentEntry, computed]
  );

  return (
    <div className={['space-y-3', isMobile ? 'px-0' : ''].join(' ')}>
      {/* Smart Bearing Parser Badge */}
      {bearingInput && (
        <div>
          <BearingParserBadge bearingInput={bearingInput} />
        </div>
      )}

      {/* Duplicate Detection */}
      <DuplicateWarningBanner warning={duplicateWarning} />

      {/* Weather Note + Instrument Check Row */}
      <div className="flex items-start gap-3 flex-wrap">
        <WeatherNoteButton onWeatherNote={onWeatherNote} />
        <InstrumentCheckReminder
          onDismiss={onDismissInstrumentCheck}
          isMobile={isMobile}
        />
      </div>

      {/* Computation Preview */}
      <ComputationPreviewCard preview={computationPreview} />
    </div>
  );
}

// ─── Re-exported for direct usage ──────────────────────────────────────

export { BearingParserBadge, DuplicateWarningBanner, ComputationPreviewCard };
