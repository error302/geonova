'use client';

/**
 * Vertical Curve Designer — Tier 2 engineering tool.
 *
 * Roadmap reference: docs/ROADMAP.md → Tier 2 → "Parabolic vertical curve
 * profile designer". Implements AASHTO Green Book (2018) crest/sag K-factor
 * compliance with stopping sight distance (SSD) checks.
 *
 * Workflow:
 *   1. Surveyor enters VIPs (chainage + reduced level + optional K or L override)
 *   2. Picks design speed (20–130 km/h)
 *   3. Engine chains VIPs into an alignment, computes a parabolic curve at
 *      each interior VIP, and checks K-factor / SSD compliance
 *   4. UI shows: SVG profile diagram, compliance table, station table, warnings
 *   5. CSV export of station table + compliance summary
 */

import { useMemo, useState, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Mountain,
  TrendingUp,
  Gauge,
} from 'lucide-react';
import { downloadCSV } from '@/lib/export/helpers';
import {
  computeVerticalAlignment,
  stationAlignment,
  alignmentToCSV,
  complianceToCSV,
  DESIGN_SPEED_TABLE,
  DEFAULT_STATION_INTERVAL,
  type VIPInput,
  type VerticalAlignmentResult,
  type AlignmentCurve,
} from '@/lib/survey/curves/verticalCurveDesigner';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_VIPS: VIPInput[] = [
  { id: 'VIP1', chainage: 0, reducedLevel: 1500.000 },
  { id: 'VIP2', chainage: 500, reducedLevel: 1512.500, kOverride: 55 },
  { id: 'VIP3', chainage: 1100, reducedLevel: 1505.000, kOverride: 30 },
  { id: 'VIP4', chainage: 1700, reducedLevel: 1520.000, kOverride: 40 },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function VerticalCurveDesignerPage() {
  const [vips, setVips] = useState<VIPInput[]>(DEFAULT_VIPS);
  const [designSpeed, setDesignSpeed] = useState(80);
  const [showStations, setShowStations] = useState(true);
  const [stationInterval, setStationInterval] = useState(DEFAULT_STATION_INTERVAL);

  const alignment: VerticalAlignmentResult | null = useMemo(() => {
    if (vips.length < 2) return null;
    return computeVerticalAlignment(vips, designSpeed);
  }, [vips, designSpeed]);

  const stations = useMemo(() => {
    if (!alignment) return [];
    return stationAlignment(alignment, stationInterval);
  }, [alignment, stationInterval]);

  // ── VIP editing handlers ──────────────────────────────────────────────────

  const updateVip = useCallback(
    (index: number, patch: Partial<VIPInput>) => {
      setVips(prev => {
        const next = [...prev];
        next[index] = { ...next[index], ...patch };
        return next;
      });
    },
    []
  );

  const addVip = useCallback(() => {
    setVips(prev => {
      const lastCh = prev[prev.length - 1]?.chainage ?? 0;
      const lastRl = prev[prev.length - 1]?.reducedLevel ?? 0;
      return [
        ...prev,
        {
          id: `VIP${prev.length + 1}`,
          chainage: lastCh + 500,
          reducedLevel: lastRl,
        },
      ];
    });
  }, []);

  const removeVip = useCallback((index: number) => {
    setVips(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ── Export ────────────────────────────────────────────────────────────────

  const exportStations = () => {
    if (!alignment || stations.length === 0) return;
    downloadCSV(alignmentToCSV(stations), `vertical-alignment-stations-${Date.now()}.csv`);
  };

  const exportCompliance = () => {
    if (!alignment) return;
    downloadCSV(complianceToCSV(alignment), `vertical-curve-compliance-${Date.now()}.csv`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-page)] px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Vertical Curve Designer"
          subtitle="Multi-VIP parabolic alignment with AASHTO K-factor and stopping-sight-distance compliance checking."
          reference="AASHTO Green Book (2018) Ch. 3 & 9 · KeNHA Road Design Manual Part 5 · Schofield Engineering Surveying Ch. 13"
          badge="Tier 2 · Engineering"
        />

        {/* ─── Input Panel ─────────────────────────────────────────────────── */}
        <section className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mountain className="w-4 h-4 text-[var(--accent)]" />
                <h2 className="font-display text-lg text-[var(--text-primary)]">
                  Vertical Intersection Points
                </h2>
              </div>
              <Button variant="outline" size="sm" onClick={addVip}>
                <Plus className="w-3 h-3 mr-1" /> Add VIP
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--text-muted)] text-xs uppercase tracking-wide border-b border-[var(--border-color)]">
                    <th className="text-left py-2 pr-3 font-medium">ID</th>
                    <th className="text-right py-2 px-3 font-medium">Chainage (m)</th>
                    <th className="text-right py-2 px-3 font-medium">RL (m)</th>
                    <th className="text-right py-2 px-3 font-medium">K override</th>
                    <th className="text-right py-2 px-3 font-medium">L override (m)</th>
                    <th className="py-2 pl-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {vips.map((vip, i) => (
                    <tr
                      key={vip.id + i}
                      className="border-b border-[var(--border-color)] last:border-b-0"
                    >
                      <td className="py-2 pr-3">
                        <Input
                          value={vip.id}
                          onChange={e => updateVip(i, { id: e.target.value })}
                          className="font-mono text-xs h-8 w-24 bg-[var(--bg-secondary)] border-[var(--border-color)]"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.001"
                          value={vip.chainage}
                          onChange={e => updateVip(i, { chainage: Number(e.target.value) })}
                          className="font-mono text-xs h-8 w-32 text-right bg-[var(--bg-secondary)] border-[var(--border-color)]"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.001"
                          value={vip.reducedLevel}
                          onChange={e =>
                            updateVip(i, { reducedLevel: Number(e.target.value) })
                          }
                          className="font-mono text-xs h-8 w-28 text-right bg-[var(--bg-secondary)] border-[var(--border-color)]"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.1"
                          value={vip.kOverride ?? ''}
                          placeholder="auto"
                          onChange={e =>
                            updateVip(i, {
                              kOverride: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="font-mono text-xs h-8 w-24 text-right bg-[var(--bg-secondary)] border-[var(--border-color)]"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.1"
                          value={vip.lengthOverride ?? ''}
                          placeholder="auto"
                          onChange={e =>
                            updateVip(i, {
                              lengthOverride: e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            })
                          }
                          className="font-mono text-xs h-8 w-28 text-right bg-[var(--bg-secondary)] border-[var(--border-color)]"
                        />
                      </td>
                      <td className="py-2 pl-3 text-right">
                        <button
                          onClick={() => removeVip(i)}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Remove VIP"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">
              Leave K and L overrides blank to auto-size each curve from the design-speed
              minimum K with a 1.4× comfort factor. Provide K to size by rate-of-change,
              or L to set out a pre-designed curve length.
            </p>
          </div>

          {/* Design speed + status */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="font-display text-lg text-[var(--text-primary)]">
                Design Speed
              </h2>
            </div>

            <Label className="text-xs text-[var(--text-muted)]">Speed (km/h)</Label>
            <Select
              value={String(designSpeed)}
              onValueChange={v => setDesignSpeed(Number(v))}
            >
              <SelectTrigger className="mt-1 w-full bg-[var(--bg-secondary)] border-[var(--border-color)]">
                <SelectValue placeholder="Pick speed" />
              </SelectTrigger>
              <SelectContent>
                {DESIGN_SPEED_TABLE.map(d => (
                  <SelectItem key={d.speed} value={String(d.speed)}>
                    {d.speed} km/h · SSD {d.ssd} m · K crest {d.kCrestMin} · K sag{' '}
                    {d.kSagMin}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {alignment && (
              <div className="mt-5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Curves computed</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {alignment.curves.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Start chainage</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {alignment.startChainage.toFixed(3)} m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">End chainage</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {alignment.endChainage.toFixed(3)} m
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Elevation range</span>
                  <span className="font-mono text-[var(--text-primary)]">
                    {alignment.minElevation.toFixed(3)} – {alignment.maxElevation.toFixed(3)} m
                  </span>
                </div>
                <div
                  className={`mt-3 p-3 rounded border ${
                    alignment.allPass
                      ? 'border-green-700 bg-green-950/30 text-green-300'
                      : 'border-red-700 bg-red-950/30 text-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {alignment.allPass ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {alignment.allPass
                      ? 'All curves pass AASHTO K-factor'
                      : 'One or more curves fail compliance'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── Warnings ────────────────────────────────────────────────────── */}
        {alignment && alignment.warnings.length > 0 && (
          <section className="mb-6 bg-amber-950/20 border border-amber-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="font-display text-sm text-amber-200">
                Alignment Warnings ({alignment.warnings.length})
              </h3>
            </div>
            <ul className="space-y-1 text-xs text-amber-100/80">
              {alignment.warnings.map((w, i) => (
                <li key={i} className="font-mono leading-relaxed">
                  · {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ─── Profile Diagram ─────────────────────────────────────────────── */}
        {alignment && alignment.curves.length > 0 && (
          <section className="mb-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
                <h2 className="font-display text-lg text-[var(--text-primary)]">
                  Profile Diagram
                </h2>
              </div>
              <div className="flex gap-2 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 bg-[var(--accent)]" /> Curve
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5 bg-zinc-500" /> Tangent
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> VIP
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" /> Turning
                </span>
              </div>
            </div>
            <ProfileDiagram alignment={alignment} />
          </section>
        )}

        {/* ─── Compliance Table ────────────────────────────────────────────── */}
        {alignment && alignment.curves.length > 0 && (
          <section className="mb-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg text-[var(--text-primary)]">
                Curve Compliance
              </h2>
              <Button variant="outline" size="sm" onClick={exportCompliance}>
                <Download className="w-3 h-3 mr-1" /> Compliance CSV
              </Button>
            </div>
            <ComplianceTable curves={alignment.curves} vips={alignment.vips} />
          </section>
        )}

        {/* ─── Station Table ───────────────────────────────────────────────── */}
        {alignment && (
          <section className="mb-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg text-[var(--text-primary)]">
                  Station Table
                </h2>
                <Label className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                  Interval (m)
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={stationInterval}
                    onChange={e => setStationInterval(Math.max(1, Number(e.target.value)))}
                    className="font-mono text-xs h-7 w-20 bg-[var(--bg-secondary)] border-[var(--border-color)]"
                  />
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowStations(s => !s)}
                  className="text-xs"
                >
                  {showStations ? 'Hide' : 'Show'}
                </Button>
              </div>
              <Button variant="outline" size="sm" onClick={exportStations}>
                <Download className="w-3 h-3 mr-1" /> Stations CSV
              </Button>
            </div>
            {showStations && <StationTable stations={stations} />}
          </section>
        )}

        {!alignment && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-10 text-center text-[var(--text-muted)]">
            Add at least 2 VIPs to define an alignment.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProfileDiagram ──────────────────────────────────────────────────────────

function ProfileDiagram({ alignment }: { alignment: VerticalAlignmentResult }) {
  const WIDTH = 1000;
  const HEIGHT = 320;
  const PAD_L = 60;
  const PAD_R = 30;
  const PAD_T = 20;
  const PAD_B = 50;

  const { curves, vips, startChainage, endChainage, minElevation, maxElevation } = alignment;

  const chRange = Math.max(endChainage - startChainage, 1);
  const elevRange = Math.max(maxElevation - minElevation, 0.001);
  // Add 5% padding top and bottom
  const elevMin = minElevation - elevRange * 0.05;
  const elevMax = maxElevation + elevRange * 0.05;
  const elevRangePadded = elevMax - elevMin;

  const xScale = (ch: number) =>
    PAD_L + ((ch - startChainage) / chRange) * (WIDTH - PAD_L - PAD_R);
  const yScale = (elev: number) =>
    HEIGHT - PAD_B - ((elev - elevMin) / elevRangePadded) * (HEIGHT - PAD_T - PAD_B);

  // Build the alignment path: tangents + curves
  const pathPoints: Array<{ x: number; y: number; ch: number }> = [];
  // Sample finely along the alignment
  const N = 400;
  for (let i = 0; i <= N; i++) {
    const ch = startChainage + (i / N) * chRange;
    // Find which segment
    let elev: number | null = null;
    for (const c of curves) {
      const { curve } = c;
      if (ch >= curve.pvcChainage && ch <= curve.pvtChainage) {
        const x = ch - curve.pvcChainage;
        elev =
          curve.pvcElevation +
          (curve.g1 / 100) * x +
          (curve.A / (200 * curve.length)) * x * x;
        break;
      }
    }
    if (elev === null) {
      // Tangent interpolation between adjacent VIPs
      for (let i2 = 0; i2 < vips.length - 1; i2++) {
        const a = vips[i2];
        const b = vips[i2 + 1];
        if (ch >= a.chainage && ch <= b.chainage) {
          const t = (ch - a.chainage) / (b.chainage - a.chainage || 1);
          elev = a.reducedLevel + t * (b.reducedLevel - a.reducedLevel);
          break;
        }
      }
    }
    if (elev !== null) {
      pathPoints.push({ x: xScale(ch), y: yScale(elev), ch });
    }
  }

  const pathD = pathPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  // Tangent lines (drawn lighter, behind)
  const tangentLines = vips.map((v, i) => {
    if (i === 0) return null;
    const prev = vips[i - 1];
    return {
      x1: xScale(prev.chainage),
      y1: yScale(prev.reducedLevel),
      x2: xScale(v.chainage),
      y2: yScale(v.reducedLevel),
    };
  });

  // Y-axis ticks (5 divisions)
  const yTicks = Array.from({ length: 6 }, (_, i) => elevMin + (i / 5) * elevRangePadded);
  // X-axis ticks (10 divisions)
  const xTicks = Array.from({ length: 11 }, (_, i) => startChainage + (i / 10) * chRange);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        style={{ minWidth: 700 }}
      >
        {/* Grid */}
        {yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line
              x1={PAD_L}
              x2={WIDTH - PAD_R}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="var(--border-color)"
              strokeWidth="0.5"
              strokeDasharray="2,3"
            />
            <text
              x={PAD_L - 5}
              y={yScale(t) + 3}
              textAnchor="end"
              fontSize="10"
              fill="var(--text-muted)"
              fontFamily="monospace"
            >
              {t.toFixed(2)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <g key={`x${i}`}>
            <line
              x1={xScale(t)}
              x2={xScale(t)}
              y1={HEIGHT - PAD_B}
              y2={HEIGHT - PAD_B + 4}
              stroke="var(--text-muted)"
              strokeWidth="0.5"
            />
            <text
              x={xScale(t)}
              y={HEIGHT - PAD_B + 16}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-muted)"
              fontFamily="monospace"
            >
              {t.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text
          x={(WIDTH + PAD_L - PAD_R) / 2}
          y={HEIGHT - 5}
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-secondary)"
        >
          Chainage (m)
        </text>
        <text
          x={15}
          y={HEIGHT / 2}
          textAnchor="middle"
          fontSize="11"
          fill="var(--text-secondary)"
          transform={`rotate(-90 15 ${HEIGHT / 2})`}
        >
          Elevation (m)
        </text>

        {/* Tangent lines (light) */}
        {tangentLines.map((l, i) =>
          l ? (
            <line
              key={`t${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="#71717a"
              strokeWidth="1"
              strokeDasharray="4,2"
              opacity="0.5"
            />
          ) : null
        )}

        {/* Alignment curve */}
        <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2" />

        {/* VIP markers */}
        {vips.map((v, i) => (
          <g key={`v${i}`}>
            <circle
              cx={xScale(v.chainage)}
              cy={yScale(v.reducedLevel)}
              r="5"
              fill="#fbbf24"
              stroke="#1A1816"
              strokeWidth="1"
            />
            <text
              x={xScale(v.chainage)}
              y={yScale(v.reducedLevel) - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#fbbf24"
              fontFamily="monospace"
            >
              {v.id}
            </text>
          </g>
        ))}

        {/* Curve PVC/PVT markers + turning points */}
        {curves.map((c, i) => {
          const { curve } = c;
          const pvcX = xScale(curve.pvcChainage);
          const pvcY = yScale(curve.pvcElevation);
          const pvtX = xScale(curve.pvtChainage);
          const pvtY = yScale(
            curve.pvcElevation +
              (curve.g1 / 100) * curve.length +
              (curve.A / (200 * curve.length)) * curve.length * curve.length
          );
          const tpX = xScale(curve.turningPointChainage);
          const tpY = yScale(curve.turningPointElevation);
          const color = c.compliance.severity === 'ok'
            ? '#22c55e'
            : c.compliance.severity === 'warn'
              ? '#fbbf24'
              : '#ef4444';
          return (
            <g key={`c${i}`}>
              <circle cx={pvcX} cy={pvcY} r="3" fill={color} />
              <circle cx={pvtX} cy={pvtY} r="3" fill={color} />
              {curve.turningPointDistance > 0.1 &&
                curve.turningPointDistance < curve.length - 0.1 && (
                  <g>
                    <circle cx={tpX} cy={tpY} r="4" fill="#22d3ee" stroke="#1A1816" strokeWidth="0.5" />
                    <text
                      x={tpX}
                      y={tpY - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#22d3ee"
                      fontFamily="monospace"
                    >
                      {c.curveType === 'crest' ? 'HP' : 'LP'}
                    </text>
                  </g>
                )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── ComplianceTable ─────────────────────────────────────────────────────────

function ComplianceTable({
  curves,
  vips,
}: {
  curves: AlignmentCurve[];
  vips: VIPInput[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[var(--text-muted)] uppercase tracking-wide border-b border-[var(--border-color)]">
            <th className="text-left py-2 pr-3 font-medium">VIP</th>
            <th className="text-left py-2 px-3 font-medium">Type</th>
            <th className="text-right py-2 px-3 font-medium">g1 %</th>
            <th className="text-right py-2 px-3 font-medium">g2 %</th>
            <th className="text-right py-2 px-3 font-medium">A %</th>
            <th className="text-right py-2 px-3 font-medium">L (m)</th>
            <th className="text-right py-2 px-3 font-medium">K act</th>
            <th className="text-right py-2 px-3 font-medium">K req</th>
            <th className="text-right py-2 px-3 font-medium">SSD (m)</th>
            <th className="text-right py-2 px-3 font-medium">Avail. (m)</th>
            <th className="text-center py-2 px-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {curves.map((c, i) => {
            const vip = vips[c.vipIndex];
            const color =
              c.compliance.severity === 'ok'
                ? 'text-green-400'
                : c.compliance.severity === 'warn'
                  ? 'text-amber-400'
                  : 'text-red-400';
            return (
              <tr
                key={i}
                className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-secondary)]"
              >
                <td className="py-2 pr-3 font-mono">{vip.id}</td>
                <td className="py-2 px-3">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                      c.curveType === 'crest'
                        ? 'bg-orange-950/40 text-orange-300'
                        : 'bg-blue-950/40 text-blue-300'
                    }`}
                  >
                    {c.curveType}
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono">{c.g1.toFixed(3)}</td>
                <td className="py-2 px-3 text-right font-mono">{c.g2.toFixed(3)}</td>
                <td className="py-2 px-3 text-right font-mono">{c.A.toFixed(3)}</td>
                <td className="py-2 px-3 text-right font-mono">{c.length.toFixed(2)}</td>
                <td className={`py-2 px-3 text-right font-mono ${color}`}>
                  {c.compliance.kActual.toFixed(1)}
                </td>
                <td className="py-2 px-3 text-right font-mono">
                  {c.compliance.kRequired}
                </td>
                <td className="py-2 px-3 text-right font-mono">{c.compliance.ssd}</td>
                <td className="py-2 px-3 text-right font-mono">
                  {c.compliance.availableSightDistance}
                </td>
                <td className="py-2 px-3 text-center">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wide ${color}`}
                  >
                    {c.compliance.severity === 'ok' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : c.compliance.severity === 'warn' ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {c.compliance.severity}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
        {curves.map((c, i) => (
          <div key={i} className="font-mono leading-relaxed">
            <span className="text-[var(--text-secondary)]">
              {vips[c.vipIndex].id}:
            </span>{' '}
            {c.compliance.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── StationTable ────────────────────────────────────────────────────────────

function StationTable({
  stations,
}: {
  stations: ReturnType<typeof stationAlignment>;
}) {
  if (stations.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)] py-4">
        No stations — check VIP chainages are increasing.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto max-h-96 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[var(--bg-card)]">
          <tr className="text-[var(--text-muted)] uppercase tracking-wide border-b border-[var(--border-color)]">
            <th className="text-right py-2 pr-3 font-medium">Chainage (m)</th>
            <th className="text-right py-2 px-3 font-medium">Elevation (m)</th>
            <th className="text-right py-2 px-3 font-medium">Grade %</th>
            <th className="text-right py-2 px-3 font-medium">Tangent offset (m)</th>
            <th className="text-left py-2 px-3 font-medium">Segment</th>
            <th className="text-left py-2 pl-3 font-medium">VIP</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((s, i) => (
            <tr
              key={i}
              className={`border-b border-[var(--border-color)] last:border-b-0 ${
                s.segment === 'curve' ? 'bg-[var(--bg-secondary)]' : ''
              }`}
            >
              <td className="py-1.5 pr-3 text-right font-mono">{s.chainage.toFixed(3)}</td>
              <td className="py-1.5 px-3 text-right font-mono">{s.elevation.toFixed(3)}</td>
              <td className="py-1.5 px-3 text-right font-mono">{s.grade.toFixed(4)}</td>
              <td className="py-1.5 px-3 text-right font-mono">{s.tangentOffset.toFixed(3)}</td>
              <td className="py-1.5 px-3">
                <span
                  className={`text-[10px] uppercase tracking-wide ${
                    s.segment === 'curve' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {s.segment}
                </span>
              </td>
              <td className="py-1.5 pl-3 font-mono text-[var(--text-muted)]">
                {s.vipIndex >= 0 ? vips_label(s.vipIndex) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  function vips_label(idx: number) {
    return `#${idx}`;
  }
}
