'use client';

import { useState } from 'react';
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

function formatBearingDDMSS(bearing: number): string {
  const deg = Math.floor(bearing);
  const minFloat = (bearing - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  return `${deg}°${String(min).padStart(2, '0')}'${sec}"`;
}

export function TunnelPanel({ projectId, subtype }: EngineeringPanelProps) {
  const [activeTab, setActiveTab] = useState<'control' | 'geometry' | 'profile' | 'convergence'>('control');
  const qa = ENGINEERING_QA.tunnel;

  const [portalPoints, setPortalPoints] = useState<Array<{ easting: number; northing: number; elevation: number }>>([]);
  const [excavatedWidthM, setExcavatedWidthM] = useState(10);
  const [excavatedHeightM, setExcavatedHeightM] = useState(8);
  const [gradientPercent, setGradientPercent] = useState(0.5);
  const [convergencePoints, setConvergencePoints] = useState<Array<{ chainage: number; label: string }>>([]);

  const totalLengthM = portalPoints.length >= 2
    ? Math.sqrt(
        Math.pow(portalPoints[1].easting - portalPoints[0].easting, 2) +
        Math.pow(portalPoints[1].northing - portalPoints[0].northing, 2)
      )
    : 0;

  const crossSectionArea = excavatedWidthM * excavatedHeightM + (Math.PI * Math.pow(excavatedWidthM / 2, 2) / 2);

  const tabs = [
    { id: 'control', label: 'Control Survey' },
    { id: 'geometry', label: 'Tunnel Geometry' },
    { id: 'profile', label: 'Profile' },
    { id: 'convergence', label: 'Convergence Monitoring' },
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
          <div className="text-lg font-medium mb-3">Portal Coordinates</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Portal</th>
                <th className="text-left py-2">Easting</th>
                <th className="text-left py-2">Northing</th>
                <th className="text-left py-2">Elevation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800">
                <td className="py-2">Portal 1 (Inlet)</td>
                <td className="py-2">{portalPoints[0]?.easting.toFixed(3) || '—'}</td>
                <td className="py-2">{portalPoints[0]?.northing.toFixed(3) || '—'}</td>
                <td className="py-2">{portalPoints[0]?.elevation.toFixed(3) || '—'}</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2">Portal 2 (Outlet)</td>
                <td className="py-2">{portalPoints[1]?.easting.toFixed(3) || '—'}</td>
                <td className="py-2">{portalPoints[1]?.northing.toFixed(3) || '—'}</td>
                <td className="py-2">{portalPoints[1]?.elevation.toFixed(3) || '—'}</td>
              </tr>
            </tbody>
          </table>
          <button
            onClick={() => setPortalPoints([{ easting: 0, northing: 0, elevation: 0 }, { easting: 0, northing: 0, elevation: 0 }])}
            className="mt-3 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded"
          >
            Add Portals
          </button>
          {portalPoints.length >= 2 && (
            <div className="mt-4 p-3 bg-zinc-800 rounded-lg">
              <div className="text-sm text-zinc-400">Tunnel Bearing</div>
              <div className="text-lg text-amber-500">{formatBearingDDMSS(computeBearing(portalPoints[0], portalPoints[1]))}</div>
              <div className="text-sm text-zinc-400 mt-2">True Length</div>
              <div className="text-lg">{totalLengthM.toFixed(3)} m</div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'geometry' && (
        <div>
          <div className="text-lg font-medium mb-3">Tunnel Geometry</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400" htmlFor="excavated-width-m">Excavated Width (m)</label>
              <input id="excavated-width-m" aria-label="Excavated Width (m)"
                type="number"
                value={excavatedWidthM}
                onChange={(e) => setExcavatedWidthM(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="excavated-height-m">Excavated Height (m)</label>
              <input id="excavated-height-m" aria-label="Excavated Height (m)"
                type="number"
                value={excavatedHeightM}
                onChange={(e) => setExcavatedHeightM(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="gradient">Gradient (%)</label>
              <input  id="gradient" aria-label="Gradient (%)"
                type="number"
                step={0.1}
                value={gradientPercent}
                onChange={(e) => setGradientPercent(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="text-sm text-zinc-400">Cross-Section Area</div>
              <div className="text-lg text-amber-500">{crossSectionArea.toFixed(2)} m²</div>
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg col-span-2">
              <div className="text-sm text-zinc-400">Excavated Volume</div>
              <div className="text-lg">{(crossSectionArea * totalLengthM / 1000).toFixed(2)} m³</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div>
          <div className="text-lg font-medium mb-3">Profile</div>
          {portalPoints.length >= 2 && totalLengthM > 0 ? (() => {
            const inletElev = portalPoints[0].elevation;
            const outletElev = inletElev - (totalLengthM * gradientPercent / 100);
            const interval = 50;
            const profileRows: Array<{ chainage: number; elevation: number }> = [];
            for (let ch = 0; ch <= totalLengthM + 0.001; ch += interval) {
              const clampedCh = Math.min(ch, totalLengthM);
              profileRows.push({
                chainage: clampedCh,
                elevation: inletElev - (clampedCh * gradientPercent / 100),
              });
            }
            if (profileRows[profileRows.length - 1].chainage < totalLengthM) {
              profileRows.push({ chainage: totalLengthM, elevation: outletElev });
            }
            const minElev = Math.min(inletElev, outletElev);
            const maxElev = Math.max(inletElev, outletElev);
            const elevRange = maxElev - minElev || 1;
            const svgW = 480;
            const svgH = 160;
            const padX = 50;
            const padY = 20;
            const plotW = svgW - padX - 20;
            const plotH = svgH - padY * 2;
            const xScale = (ch: number) => padX + (ch / totalLengthM) * plotW;
            const yScale = (e: number) => padY + plotH - ((e - minElev) / elevRange) * plotH;

            return (
              <>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-zinc-800 rounded-lg">
                    <div className="text-xs text-zinc-400">Inlet Elevation</div>
                    <div className="text-sm font-medium text-amber-500">{inletElev.toFixed(3)} m</div>
                  </div>
                  <div className="p-3 bg-zinc-800 rounded-lg">
                    <div className="text-xs text-zinc-400">Outlet Elevation</div>
                    <div className="text-sm font-medium text-amber-500">{outletElev.toFixed(3)} m</div>
                  </div>
                  <div className="p-3 bg-zinc-800 rounded-lg">
                    <div className="text-xs text-zinc-400">Total Length</div>
                    <div className="text-sm font-medium">{totalLengthM.toFixed(2)} m</div>
                  </div>
                  <div className="p-3 bg-zinc-800 rounded-lg">
                    <div className="text-xs text-zinc-400">Gradient</div>
                    <div className="text-sm font-medium">{gradientPercent}%</div>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-zinc-800 rounded-lg overflow-x-auto">
                  <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-40" preserveAspectRatio="xMidYMid meet">
                    <rect x={padX} y={padY} width={plotW} height={plotH} fill="none" stroke="#3f3f46" strokeWidth={0.5} />
                    {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                      const y = padY + plotH * (1 - frac);
                      const elev = minElev + elevRange * frac;
                      return (
                        <g key={frac}>
                          <line x1={padX} y1={y} x2={padX + plotW} y2={y} stroke="#3f3f46" strokeWidth={0.5} strokeDasharray={frac === 0 || frac === 1 ? 'none' : '3,3'} />
                          <text x={padX - 4} y={y + 3} textAnchor="end" fill="#a1a1aa" fontSize={8}>{elev.toFixed(1)}</text>
                        </g>
                      );
                    })}
                    {profileRows.map((_, i) => {
                      const frac = i / (profileRows.length - 1);
                      const x = padX + plotW * frac;
                      return (
                        <text key={`xl${i}`} x={x} y={svgH - 2} textAnchor="middle" fill="#a1a1aa" fontSize={7}>{profileRows[i].chainage.toFixed(0)}</text>
                      );
                    })}
                    <polyline
                      points={profileRows.map((r) => `${xScale(r.chainage).toFixed(1)},${yScale(r.elevation).toFixed(1)}`).join(' ')}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth={2}
                    />
                    {profileRows.map((r, i) => (
                      <circle key={`${r}-${i}`} cx={xScale(r.chainage)} cy={yScale(r.elevation)} r={3} fill="#f59e0b" stroke="#18181b" strokeWidth={1} />
                    ))}
                    <text x={padX + plotW / 2} y={12} textAnchor="middle" fill="#a1a1aa" fontSize={9}>Design Profile</text>
                    <text x={svgW / 2} y={svgH - 0} textAnchor="middle" fill="#71717a" fontSize={8}>Chainage (m)</text>
                  </svg>
                </div>

                <div className="text-sm text-zinc-400 mb-2">Chainage Elevations (every {interval}m)</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-zinc-400 border-b border-zinc-700">
                      <th className="text-left py-2">Chainage (m)</th>
                      <th className="text-left py-2">Design Elevation (m)</th>
                      <th className="text-left py-2">Distance from Inlet (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileRows.map((row, i) => (
                      <tr key={`${row}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                        <td className="py-1.5">{row.chainage.toFixed(1)}</td>
                        <td className="py-1.5">{row.elevation.toFixed(3)}</td>
                        <td className="py-1.5">{row.chainage.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            );
          })() : (
            <div className="text-sm text-zinc-400">Add portal points in the Control Survey tab to view the tunnel profile.</div>
          )}
        </div>
      )}

      {activeTab === 'convergence' && (
        <div>
          <div className="text-lg font-medium mb-3">Convergence Monitoring Points</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Chainage</th>
                <th className="text-left py-2">Label</th>
              </tr>
            </thead>
            <tbody>
              {convergencePoints.map((pt, i) => (
                <tr key={pt.label} className="border-b border-zinc-800">
                  <td className="py-2">{pt.chainage.toFixed(3)}</td>
                  <td className="py-2">{pt.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => setConvergencePoints([...convergencePoints, { chainage: convergencePoints.length * 50, label: `C${convergencePoints.length + 1}` }])}
            className="mt-3 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded"
          >
            Add Point
          </button>
        </div>
      )}
    </div>
  );
}

export default TunnelPanel;