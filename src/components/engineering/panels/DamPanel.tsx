'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react'
import { ENGINEERING_QA, type EngineeringSubtype } from '@/lib/engine/engineering';

interface EngineeringPanelProps {
  projectId: string;
  subtype: EngineeringSubtype;
}

function computeBearing(from: { easting: number; northing: number }, to: { easting: number; northing: number }): number {
  const dE = to.easting - from.easting;
  const dN = to.northing - from.northing;
  return (Math.atan2(dE, dN) * 180 / Math.PI + 360) % 360;
}

function computeDistance(from: { easting: number; northing: number }, to: { easting: number; northing: number }): number {
  return Math.sqrt(Math.pow(to.easting - from.easting, 2) + Math.pow(to.northing - from.northing, 2));
}

function formatChainage(meters: number): string {
  const km = Math.floor(meters / 1000);
  const m = Math.round(meters % 1000);
  return `${km}+${String(m).padStart(3, '0')}`;
}

interface StationPoint {
  chainage: number;
  label: string;
  easting: number;
  northing: number;
  elevation: number;
}

interface ToePosition {
  chainage: number;
  stationLabel: string;
  label: string;
  easting: number;
  northing: number;
}

interface SettingOutData {
  bearing: number | null;
  stations: StationPoint[];
  upstreamToe: ToePosition[];
  downstreamToe: ToePosition[];
  heightDiff: number;
  upstreamOffset: number;
  downstreamOffset: number;
}

function computeSettingOut(
  controlPoints: Array<{ easting: number; northing: number; elevation: number }>,
  crestLength: number,
  crestElevation: number,
  foundationLevel: number,
  upstreamSlopeH: number,
  downstreamSlopeH: number
): SettingOutData {
  const empty: SettingOutData = {
    bearing: null,
    stations: [],
    upstreamToe: [],
    downstreamToe: [],
    heightDiff: 0,
    upstreamOffset: 0,
    downstreamOffset: 0,
  };

  if (controlPoints.length < 2) return empty;

  const bm1 = controlPoints[0];
  const bm2 = controlPoints[1];
  const bearing = computeBearing(bm1, bm2);
  const heightDiff = crestElevation - foundationLevel;
  if (heightDiff <= 0) return empty;

  const upstreamOffset = upstreamSlopeH * heightDiff;
  const downstreamOffset = downstreamSlopeH * heightDiff;

  const interval = crestLength <= 100 ? 10 : 20;
  const stations: StationPoint[] = [];

  for (let d = 0; d <= crestLength; d += interval) {
    const bearingRad = (bearing * Math.PI) / 180;
    const easting = bm1.easting + d * Math.sin(bearingRad);
    const northing = bm1.northing + d * Math.cos(bearingRad);
    stations.push({
      chainage: d,
      label: formatChainage(d),
      easting,
      northing,
      elevation: crestElevation,
    });
  }

  // Ensure the final station is exactly at crestLength
  const lastStation = stations[stations.length - 1];
  if (!lastStation || lastStation.chainage !== crestLength) {
    const bearingRad = (bearing * Math.PI) / 180;
    stations.push({
      chainage: crestLength,
      label: formatChainage(crestLength),
      easting: bm1.easting + crestLength * Math.sin(bearingRad),
      northing: bm1.northing + crestLength * Math.cos(bearingRad),
      elevation: crestElevation,
    });
  }

  const upstreamToe: ToePosition[] = [];
  const downstreamToe: ToePosition[] = [];

  const perpUpRad = ((bearing - 90) * Math.PI) / 180;
  const perpDownRad = ((bearing + 90) * Math.PI) / 180;

  for (const st of stations) {
    upstreamToe.push({
      chainage: st.chainage,
      stationLabel: st.label,
      label: `US ${st.label}`,
      easting: st.easting + upstreamOffset * Math.sin(perpUpRad),
      northing: st.northing + upstreamOffset * Math.cos(perpUpRad),
    });
    downstreamToe.push({
      chainage: st.chainage,
      stationLabel: st.label,
      label: `DS ${st.label}`,
      easting: st.easting + downstreamOffset * Math.sin(perpDownRad),
      northing: st.northing + downstreamOffset * Math.cos(perpDownRad),
    });
  }

  return { bearing, stations, upstreamToe, downstreamToe, heightDiff, upstreamOffset, downstreamOffset };
}

export function DamPanel({ projectId, subtype }: EngineeringPanelProps) {
  const [activeTab, setActiveTab] = useState<'control' | 'geometry' | 'reservoir' | 'settingout'>('control');
  const qa = ENGINEERING_QA.dam;

  const [controlPoints, setControlPoints] = useState<Array<{ easting: number; northing: number; elevation: number }>>([]);
  const [crestLength, setCrestLength] = useState(100);
  const [crestElevation, setCrestElevation] = useState(1500);
  const [crestWidthM, setCrestWidthM] = useState(8);
  const [fullSupplyLevel, setFullSupplyLevel] = useState(1495);
  const [deadStorageLevel, setDeadStorageLevel] = useState(1450);
  const [catchmentAreaKm2, setCatchmentAreaKm2] = useState(50);
  const [upstreamSlopeH, setUpstreamSlopeH] = useState(3);
  const [downstreamSlopeH, setDownstreamSlopeH] = useState(2.5);
  const [foundationLevel, setFoundationLevel] = useState(1400);

  const freeboard = crestElevation - fullSupplyLevel;
  const freeboardWarning = freeboard < 0.5;

  const tabs = [
    { id: 'control', label: 'Control Survey' },
    { id: 'geometry', label: 'Dam Geometry' },
    { id: 'reservoir', label: 'Reservoir' },
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
          <div className="text-lg font-medium mb-3">Control Points (Benchmark required)</div>
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
              {controlPoints.map((pt, i) => (
                <tr key={`${pt}-${i}`} className="border-b border-zinc-800">
                  <td className="py-2">BM{i + 1}</td>
                  <td className="py-2">{pt.easting.toFixed(3)}</td>
                  <td className="py-2">{pt.northing.toFixed(3)}</td>
                  <td className="py-2">{pt.elevation.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => setControlPoints([...controlPoints, { easting: 0, northing: 0, elevation: 0 }])}
            className="mt-3 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded"
          >
            Add Benchmark
          </button>
        </div>
      )}

      {activeTab === 'geometry' && (
        <div>
          <div className="text-lg font-medium mb-3">Dam Geometry</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400" htmlFor="crest-length-m">Crest Length (m)</label>
              <input id="crest-length-m" aria-label="Crest Length (m)"
                type="number"
                value={crestLength}
                onChange={(e) => setCrestLength(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="crest-elevation-m">Crest Elevation (m)</label>
              <input id="crest-elevation-m" aria-label="Crest Elevation (m)"
                type="number"
                value={crestElevation}
                onChange={(e) => setCrestElevation(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="crest-width-m">Crest Width (m)</label>
              <input id="crest-width-m" aria-label="Crest Width (m)"
                type="number"
                value={crestWidthM}
                onChange={(e) => setCrestWidthM(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="foundation-level-m">Foundation Level (m)</label>
              <input id="foundation-level-m" aria-label="Foundation Level (m)"
                type="number"
                value={foundationLevel}
                onChange={(e) => setFoundationLevel(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="upstream-slope-h-1v">Upstream Slope (H:1V)</label>
              <input id="upstream-slope-h-1v" aria-label="Upstream Slope (H:1V)"
                type="number"
                step={0.1}
                value={upstreamSlopeH}
                onChange={(e) => setUpstreamSlopeH(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="downstream-slope-h-1v">Downstream Slope (H:1V)</label>
              <input id="downstream-slope-h-1v" aria-label="Downstream Slope (H:1V)"
                type="number"
                step={0.1}
                value={downstreamSlopeH}
                onChange={(e) => setDownstreamSlopeH(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reservoir' && (
        <div>
          <div className="text-lg font-medium mb-3">Reservoir Data</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400" htmlFor="full-supply-level-m">Full Supply Level (m)</label>
              <input id="full-supply-level-m" aria-label="Full Supply Level (m)"
                type="number"
                value={fullSupplyLevel}
                onChange={(e) => setFullSupplyLevel(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="dead-storage-level-m">Dead Storage Level (m)</label>
              <input id="dead-storage-level-m" aria-label="Dead Storage Level (m)"
                type="number"
                value={deadStorageLevel}
                onChange={(e) => setDeadStorageLevel(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="catchment-area-km">Catchment Area (km²)</label>
              <input aria-label="Catchment Area (km²)"
                type="number"
                value={catchmentAreaKm2}
                onChange={(e) => setCatchmentAreaKm2(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="text-sm text-zinc-400">Freeboard</div>
              <div className={`text-lg ${freeboardWarning ? 'text-red-400' : 'text-green-400'}`}>
                {freeboard.toFixed(2)} m
              </div>
            </div>
          </div>
          {freeboardWarning && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
              <span className="text-red-400 text-sm"><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Freeboard below 0.5m minimum — review dam height</span>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settingout' && (() => {
        const settingOut = computeSettingOut(controlPoints, crestLength, crestElevation, foundationLevel, upstreamSlopeH, downstreamSlopeH);
        const hasEnoughCP = controlPoints.length >= 2;

        return (
          <div>
            <div className="text-lg font-medium mb-3">Setting Out Points</div>

            {!hasEnoughCP && (
              <div className="p-4 bg-amber-900/30 border border-amber-700 rounded-lg text-sm text-amber-400">
                Add at least 2 control points (benchmarks) in the Control Survey tab to compute setting out coordinates.
              </div>
            )}

            {hasEnoughCP && settingOut.bearing !== null && (
              <div className="p-3 bg-zinc-800 rounded-lg text-sm mb-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-zinc-400">Dam Axis Bearing</span>
                    <div className="text-lg font-mono">{settingOut.bearing.toFixed(4)}°</div>
                  </div>
                  <div>
                    <span className="text-zinc-400">BM1→BM2 Distance</span>
                    <div className="text-lg font-mono">{computeDistance(controlPoints[0], controlPoints[1]).toFixed(3)} m</div>
                  </div>
                  <div>
                    <span className="text-zinc-400">Height (Crest − Foundation)</span>
                    <div className="text-lg font-mono">{settingOut.heightDiff.toFixed(1)} m</div>
                  </div>
                </div>
              </div>
            )}

            {settingOut.stations.length > 0 && (
              <div className="p-4 bg-zinc-800 rounded-lg text-sm">
                <div className="text-zinc-400 mb-3">Dam Crest Stations (interval: {crestLength <= 100 ? '10' : '20'} m)</div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-zinc-400 border-b border-zinc-700">
                        <th className="text-left py-2 pr-4">Station</th>
                        <th className="text-right py-2 pr-4">Easting</th>
                        <th className="text-right py-2 pr-4">Northing</th>
                        <th className="text-right py-2">Elevation (m)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settingOut.stations.map((st, i) => (
                        <tr key={st.label} className={i % 2 === 0 ? 'border-b border-zinc-800' : 'border-b border-zinc-800 bg-zinc-800/40'}>
                          <td className="py-1.5 pr-4 font-mono font-medium">{st.label}</td>
                          <td className="py-1.5 pr-4 text-right font-mono">{st.easting.toFixed(3)}</td>
                          <td className="py-1.5 pr-4 text-right font-mono">{st.northing.toFixed(3)}</td>
                          <td className="py-1.5 text-right font-mono">{st.elevation.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {settingOut.upstreamToe.length > 0 && (
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-800 rounded-lg text-sm">
                  <div className="text-zinc-400 mb-1">Upstream Toe Positions</div>
                  <div className="text-xs text-zinc-500 mb-3">Offset: {settingOut.upstreamOffset.toFixed(1)} m perpendicular to alignment ({upstreamSlopeH}:1 × {settingOut.heightDiff.toFixed(1)} m)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-zinc-400 border-b border-zinc-700">
                          <th className="text-left py-1.5 pr-3">Station</th>
                          <th className="text-right py-1.5 pr-3">Easting</th>
                          <th className="text-right py-1.5">Northing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settingOut.upstreamToe.map((pt, i) => (
                          <tr key={pt.label} className="border-b border-zinc-800">
                            <td className="py-1 pr-3 font-mono text-xs">{pt.label}</td>
                            <td className="py-1 pr-3 text-right font-mono text-xs">{pt.easting.toFixed(3)}</td>
                            <td className="py-1 text-right font-mono text-xs">{pt.northing.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-4 bg-zinc-800 rounded-lg text-sm">
                  <div className="text-zinc-400 mb-1">Downstream Toe Positions</div>
                  <div className="text-xs text-zinc-500 mb-3">Offset: {settingOut.downstreamOffset.toFixed(1)} m perpendicular to alignment ({downstreamSlopeH}:1 × {settingOut.heightDiff.toFixed(1)} m)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-zinc-400 border-b border-zinc-700">
                          <th className="text-left py-1.5 pr-3">Station</th>
                          <th className="text-right py-1.5 pr-3">Easting</th>
                          <th className="text-right py-1.5">Northing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settingOut.downstreamToe.map((pt, i) => (
                          <tr key={pt.label} className="border-b border-zinc-800">
                            <td className="py-1 pr-3 font-mono text-xs">{pt.label}</td>
                            <td className="py-1 pr-3 text-right font-mono text-xs">{pt.easting.toFixed(3)}</td>
                            <td className="py-1 text-right font-mono text-xs">{pt.northing.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default DamPanel;