// ──────────────────────────────────────────────────────────────────────────
// METARDU — Instant Closure Feedback
// ──────────────────────────────────────────────────────────────────────────
// Shows real-time traverse closure as the surveyor types observations.
// No button press needed — updates on every keystroke.
//
// This is the #1 feature that saves surveyors time:
//   - Surveyor enters FL/FR angles + slope distance
//   - Closure updates instantly
//   - If it doesn't close, they know BEFORE leaving the site
//   - Saves a 6-hour round trip back to the field
// ──────────────────────────────────────────────────────────────────────────

'use client';

import { useMemo } from 'react';
import { instantClosureCheck, type ClosureFeedback } from '@/lib/survey/field-to-finish';
import { CheckCircle2, XCircle, AlertTriangle, Gauge, Ruler, TrendingUp } from 'lucide-react';

interface InstantClosureFeedbackProps {
  /** Current traverse rows from the field book */
  rows: Array<{
    bearing: string;      // DMS string like "045°30'15.0" or decimal
    slopeDist: string;    // Distance in metres
  }>;
  /** Start station coordinates */
  startE: string;
  startN: string;
  /** Close station coordinates (for link traverse) */
  closeE?: string;
  closeN?: string;
  /** Traverse mode */
  mode: 'open' | 'closed' | 'link';
  /** Survey type for precision standard */
  surveyType?: string;
  /** Translator function */
  t?: (key: string) => string;
}

export function InstantClosureFeedback({
  rows,
  startE,
  startN,
  closeE,
  closeN,
  mode,
  surveyType = 'cadastral',
  t,
}: InstantClosureFeedbackProps) {
  const feedback = useMemo((): ClosureFeedback | null => {
    // Parse observations
    const observations: Array<{ bearing: number; slopeDistance: number }> = [];

    for (const row of rows) {
      const bearing = parseBearing(row.bearing);
      const distance = parseFloat(row.slopeDist);

      if (isNaN(bearing) || isNaN(distance) || distance <= 0) continue;

      observations.push({ bearing, slopeDistance: distance });
    }

    if (observations.length < 2) return null;

    const start = {
      easting: parseFloat(startE) || 0,
      northing: parseFloat(startN) || 0,
    };

    const close = (mode === 'link' && closeE && closeN)
      ? { easting: parseFloat(closeE) || 0, northing: parseFloat(closeN) || 0 }
      : undefined;

    return instantClosureCheck(observations, start, close);
  }, [rows, startE, startN, closeE, closeN, mode]);

  if (mode === 'open') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Open traverse — no closure check. Use closed or link mode for cadastral work.</span>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-muted-foreground text-sm">
        <Gauge className="w-4 h-4 shrink-0" />
        <span>Enter at least 2 observations to see closure feedback</span>
      </div>
    );
  }

  const gradeColors = {
    excellent: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2 },
    good: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', icon: CheckCircle2 },
    acceptable: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: AlertTriangle },
    poor: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', icon: AlertTriangle },
    unacceptable: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: XCircle },
  };

  const grade = gradeColors[feedback.grade] || gradeColors.unacceptable;
  const GradeIcon = grade.icon;

  return (
    <div className={`rounded-lg border ${grade.border} ${grade.bg} p-3 space-y-2`}>
      {/* Header: Grade + Ratio */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GradeIcon className={`w-5 h-5 ${grade.text}`} />
          <span className={`font-semibold text-sm ${grade.text}`}>
            {feedback.passes ? 'PASSES' : 'FAILS'} — {surveyType}
          </span>
        </div>
        <div className={`font-mono text-lg font-bold ${grade.text}`}>
          {feedback.precisionFormatted}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Ruler className="w-3 h-3 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Misclosure</div>
            <div className="font-mono font-medium">{feedback.linearMisclosure.toFixed(4)} m</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-muted-foreground" />
          <div>
            <div className="text-muted-foreground">Perimeter</div>
            <div className="font-mono font-medium">{feedback.perimeter.toFixed(1)} m</div>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">ΔE</div>
          <div className="font-mono font-medium">{feedback.closingErrorE.toFixed(4)} m</div>
        </div>
        <div>
          <div className="text-muted-foreground">ΔN</div>
          <div className="font-mono font-medium">{feedback.closingErrorN.toFixed(4)} m</div>
        </div>
      </div>

      {/* Message */}
      <div className={`text-xs ${grade.text} opacity-80`}>
        {feedback.message}
      </div>

      {/* Standard reference */}
      <div className="text-[10px] text-muted-foreground">
        Standard: {feedback.standard} · Kenya Survey Regulations 1994, Regulation 97
      </div>
    </div>
  );
}

// ─── Bearing Parser ──────────────────────────────────────────────────────

/**
 * Parse a bearing string that could be:
 *   - DMS: "045°30'15.0" or "045°30'15.0""
 *   - Decimal: "45.504"
 *   - With spaces: "45 30 15"
 */
function parseBearing(str: string): number {
  if (!str || str.trim() === '') return NaN;

  const cleaned = str.trim();

  // Try DMS format: 045°30'15.0"
  const dmsMatch = cleaned.match(/(\d+)[°\s]+(\d+)['\s]+([\d.]+)/);
  if (dmsMatch) {
    const d = parseInt(dmsMatch[1], 10);
    const m = parseInt(dmsMatch[2], 10);
    const s = parseFloat(dmsMatch[3]);
    return d + m / 60 + s / 3600;
  }

  // Try decimal
  const decimal = parseFloat(cleaned);
  if (!isNaN(decimal)) return decimal;

  return NaN;
}
