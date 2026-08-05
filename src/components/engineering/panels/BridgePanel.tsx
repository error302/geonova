'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react'
import { ENGINEERING_QA, type EngineeringSubtype } from '@/lib/engine/engineering';

interface EngineeringPanelProps {
  projectId: string;
  subtype: EngineeringSubtype;
}

export function BridgePanel({ projectId, subtype }: EngineeringPanelProps) {
  const [activeTab, setActiveTab] = useState<'control' | 'spans' | 'structure' | 'settingout'>('control');
  const qa = ENGINEERING_QA.bridge;

  const [centreLine, setCentreLine] = useState<Array<{ easting: number; northing: number; elevation?: number }>>([]);
  const [spanCount, setSpanCount] = useState(1);
  const [spanLengths, setSpanLengths] = useState<number[]>([30]);
  const [widthM, setWidthM] = useState(10);
  const [approachLength, setApproachLength] = useState(30);
  const [waterLevel, setWaterLevel] = useState<number | undefined>();
  const [bedLevel, setBedLevel] = useState<number | undefined>();
  const [clearanceM, setClearanceM] = useState<number | undefined>();
  const [skewAngle, setSkewAngle] = useState(0);

  const totalLength = spanLengths.reduce((a, b) => a + b, 0);

  const clearanceWarning = clearanceM !== undefined && clearanceM < 1.5;

  // ── Setting-out helpers ──────────────────────────────────────────
  function computeBearing(from: { easting: number; northing: number }, to: { easting: number; northing: number }): number {
    const dE = to.easting - from.easting;
    const dN = to.northing - from.northing;
    return (Math.atan2(dE, dN) * 180 / Math.PI + 360) % 360;
  }

  function computeDistance(from: { easting: number; northing: number }, to: { easting: number; northing: number }): number {
    return Math.sqrt((to.easting - from.easting) ** 2 + (to.northing - from.northing) ** 2);
  }

  function formatDMS(bearingDeg: number): string {
    const d = Math.floor(bearingDeg);
    const mFull = (bearingDeg - d) * 60;
    const m = Math.floor(mFull);
    const s = ((mFull - m) * 60).toFixed(1);
    return `${d}\u00B0${String(m).padStart(2, '0')}'${s.padStart(4, '0')}"`;
  }

  function pointFromBearingAndDist(
    origin: { easting: number; northing: number },
    bearingDeg: number,
    dist: number,
  ): { easting: number; northing: number } {
    const rad = (bearingDeg * Math.PI) / 180;
    return {
      easting: origin.easting + dist * Math.sin(rad),
      northing: origin.northing + dist * Math.cos(rad),
    };
  }

  function nearestControlPoint(
    pt: { easting: number; northing: number },
  ): { label: string; bearing: number; distance: number } | null {
    if (centreLine.length === 0) return null;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < centreLine.length; i++) {
      const d = computeDistance(pt, centreLine[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return {
      label: `CP${best + 1}`,
      bearing: computeBearing(centreLine[best], pt),
      distance: bestD,
    };
  }

  // ── Derived setting-out data ─────────────────────────────────────
  const alignmentBearing = centreLine.length >= 2
    ? computeBearing(centreLine[0], centreLine[1])
    : 0;

  const skewAdjustedBearing = (alignmentBearing + skewAngle + 360) % 360;
  const perpBearing = (skewAdjustedBearing + 90) % 360;
  const halfWidth = widthM / 2;

  interface SettingOutRow {
    id: string;
    label: string;
    fromCP: string;
    bearing: number;
    distance: number;
    easting: number;
    northing: number;
  }

  const settingOutRows: SettingOutRow[] = [];

  if (centreLine.length >= 2) {
    const startPt = centreLine[0];

    const addRow = (label: string, pt: { easting: number; northing: number }) => {
      const info = nearestControlPoint(pt);
      if (info) {
        settingOutRows.push({
          id: `${label}-${pt.easting.toFixed(2)}-${pt.northing.toFixed(2)}`,
          label,
          fromCP: info.label,
          bearing: info.bearing,
          distance: info.distance,
          easting: pt.easting,
          northing: pt.northing,
        });
      }
    };

    // Abutment 1 – Left & Right corners
    const a1Left = pointFromBearingAndDist(startPt, perpBearing, halfWidth);
    const a1Right = pointFromBearingAndDist(startPt, (perpBearing + 180) % 360, halfWidth);
    addRow('Abut 1 Left', a1Left);
    addRow('Abut 1 Right', a1Right);

    // Pier positions at span boundaries
    let cumDist = 0;
    for (let i = 0; i < spanLengths.length; i++) {
      cumDist += spanLengths[i];
      if (i < spanLengths.length - 1) {
        const pierCenter = pointFromBearingAndDist(startPt, skewAdjustedBearing, cumDist);
        addRow(`Pier ${i + 1}`, pierCenter);
      }
    }

    // Abutment 2 – Left & Right corners at end of bridge
    const endPt = pointFromBearingAndDist(startPt, skewAdjustedBearing, totalLength);
    const a2Left = pointFromBearingAndDist(endPt, perpBearing, halfWidth);
    const a2Right = pointFromBearingAndDist(endPt, (perpBearing + 180) % 360, halfWidth);
    addRow('Abut 2 Left', a2Left);
    addRow('Abut 2 Right', a2Right);
  }

  const tabs = [
    { id: 'control', label: 'Control Survey' },
    { id: 'spans', label: 'Span Layout' },
    { id: 'structure', label: 'Structure Data' },
    { id: 'settingout', label: 'Setting Out' },
  ] as const;

  return (
    <div className="p-4">
      <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
        <div className="text-sm text-zinc-400">QA Standards</div>
        <div className="flex gap-4 mt-1 text-xs">
          <span>Traverse: 1:{qa.traversePrecision}</span>
          <span>Levelling: {qa.levellingClosureMM}</span>
          <span>Angular: {qa.angularClosureSec}</span>
          <span>Horizontal: ±{qa.horizontalClosureMM}mm/km</span>
        </div>
      </div>

      <div className="flex border-b border-zinc-700 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm ${activeTab === tab.id ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-400'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'control' && (
        <div>
          <div className="text-lg font-medium mb-3">Control Points (min 4 required)</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Point</th>
                <th className="text-left py-2">Easting</th>
                <th className="text-left py-2">Northing</th>
                <th className="text-left py-2">Elevation</th>
              </tr>
            </thead>
            <tbody>
              {centreLine.map((pt, i) => (
                <tr key={`${pt}-${i}`} className="border-b border-zinc-800">
                  <td className="py-2">CP{i + 1}</td>
                  <td className="py-2">{pt.easting.toFixed(3)}</td>
                  <td className="py-2">{pt.northing.toFixed(3)}</td>
                  <td className="py-2">{pt.elevation?.toFixed(3) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => setCentreLine([...centreLine, { easting: 0, northing: 0 }])}
            className="mt-3 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded"
          >
            Add Control Point
          </button>
        </div>
      )}

      {activeTab === 'spans' && (
        <div>
          <div className="text-lg font-medium mb-3">Span Layout</div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm text-zinc-400" htmlFor="number-of-spans">Number of Spans</label>
              <input id="number-of-spans" aria-label="Number of Spans"
                type="number"
                min={1}
                value={spanCount}
                onChange={(e) => {
                  const n = parseInt(e.target.value) || 1;
                  setSpanCount(n);
                  while (spanLengths.length < n) setSpanLengths([...spanLengths, 30]);
                  while (spanLengths.length > n) spanLengths.pop();
                }}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <div className="text-sm text-zinc-400">Total Bridge Length</div>
              <div className="mt-1 text-lg text-amber-500">{totalLength.toFixed(3)} m</div>
            </div>
          </div>
          <div className="space-y-2">
            {spanLengths.map((len, i) => (
              <div key={`${len}-${i}`} className="flex gap-2">
                <span className="text-sm text-zinc-400 w-20">Span {i + 1}:</span>
                <input aria-label="Total Bridge Length"
                  type="number"
                  value={len}
                  onChange={(e) => {
                    const newLengths = [...spanLengths];
                    newLengths[i] = parseFloat(e.target.value) || 0;
                    setSpanLengths(newLengths);
                  }}
                  className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
                />
                <span className="text-sm text-zinc-400">m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'structure' && (
        <div>
          <div className="text-lg font-medium mb-3">Structure Data</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400" htmlFor="bridge-width-m">Bridge Width (m)</label>
              <input id="bridge-width-m" aria-label="Bridge Width (m)"
                type="number"
                value={widthM}
                onChange={(e) => setWidthM(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="approach-length-m-each">Approach Length (m each)</label>
              <input id="approach-length-m-each" aria-label="Approach Length (m each)"
                type="number"
                value={approachLength}
                onChange={(e) => setApproachLength(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="skew-angle">Skew Angle (°)</label>
              <input id="skew-angle" aria-label="Skew Angle (°)"
                type="number"
                value={skewAngle}
                onChange={(e) => setSkewAngle(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="water-level-m">Water Level (m)</label>
              <input id="water-level-m" aria-label="Water Level (m)"
                type="number"
                value={waterLevel || ''}
                onChange={(e) => setWaterLevel(parseFloat(e.target.value) || undefined)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="bed-level-m">Bed Level (m)</label>
              <input id="bed-level-m" aria-label="Bed Level (m)"
                type="number"
                value={bedLevel || ''}
                onChange={(e) => setBedLevel(parseFloat(e.target.value) || undefined)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="vertical-clearance-m">Vertical Clearance (m)</label>
              <input  id="vertical-clearance-m" aria-label="Vertical Clearance (m)"
                type="number"
                value={clearanceM || ''}
                onChange={(e) => setClearanceM(parseFloat(e.target.value) || undefined)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
          </div>
          {clearanceWarning && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
              <span className="text-red-400 text-sm"><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Clearance below 1.5m minimum — review design</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settingout' && (
        <div>
          <div className="text-lg font-medium mb-3">Setting Out Schedule</div>

          {centreLine.length < 2 ? (
            <div className="p-4 bg-zinc-800 rounded-lg text-sm text-zinc-400">
              Add at least 2 control points on the Control Survey tab to compute setting-out data.
            </div>
          ) : (
            <>
              {/* Alignment summary cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-zinc-800 rounded-lg">
                  <div className="text-xs text-zinc-400">Alignment Bearing</div>
                  <div className="text-amber-500 font-mono">{formatDMS(alignmentBearing)}</div>
                </div>
                <div className="p-3 bg-zinc-800 rounded-lg">
                  <div className="text-xs text-zinc-400">Skew Adjusted</div>
                  <div className="text-amber-500 font-mono">{formatDMS(skewAdjustedBearing)}</div>
                </div>
                <div className="p-3 bg-zinc-800 rounded-lg">
                  <div className="text-xs text-zinc-400">Perpendicular</div>
                  <div className="text-amber-500 font-mono">{formatDMS(perpBearing)}</div>
                </div>
              </div>

              {/* Setting-out table */}
              <div className="p-4 bg-zinc-800 rounded-lg text-sm">
                <div className="text-zinc-400 mb-2">
                  Computed from {centreLine.length} control point{centreLine.length > 1 ? 's' : ''}
                  {' '}— half-width offset {halfWidth.toFixed(2)} m
                </div>
                <table className="w-full mt-2">
                  <thead>
                    <tr className="text-zinc-400 border-b border-zinc-700">
                      <th className="text-left py-2">Point</th>
                      <th className="text-left py-2">From</th>
                      <th className="text-left py-2">Bearing</th>
                      <th className="text-right py-2">Distance (m)</th>
                      <th className="text-right py-2">Easting</th>
                      <th className="text-right py-2">Northing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settingOutRows.map((row) => (
                      <tr key={row.id} className="border-b border-zinc-800">
                        <td className="py-2 font-medium">{row.label}</td>
                        <td className="py-2">{row.fromCP}</td>
                        <td className="py-2 text-amber-500 font-mono">{formatDMS(row.bearing)}</td>
                        <td className="py-2 text-right font-mono">{row.distance.toFixed(3)}</td>
                        <td className="py-2 text-right font-mono">{row.easting.toFixed(3)}</td>
                        <td className="py-2 text-right font-mono">{row.northing.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default BridgePanel;