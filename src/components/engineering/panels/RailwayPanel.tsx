'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react'
import { ENGINEERING_QA, type EngineeringSubtype, computeHorizontalCurve, computeVerticalCurve, crossSectionCutFill, prismoidalVolume } from '@/lib/engine/engineering';

interface EngineeringPanelProps {
  projectId: string;
  subtype: EngineeringSubtype;
}

export function RailwayPanel({ projectId, subtype }: EngineeringPanelProps) {
  const [activeTab, setActiveTab] = useState<'alignment' | 'horizontal' | 'vertical' | 'cross' | 'earthworks'>('alignment');
  const qa = ENGINEERING_QA.railway;

  const [alignment, setAlignment] = useState<Array<{ chainage: number; easting: number; northing: number; elevation?: number }>>([]);
  const [horizontalCurves, setHorizontalCurves] = useState<Array<{ radius: number; delta: number; piChainage: number }>>([]);
  const [verticalCurves, setVerticalCurves] = useState<Array<{ pvIChainage: number; pvIElevation: number; gradeIn: number; gradeOut: number; length: number }>>([]);
  const [crossSections, setCrossSections] = useState<Array<{ chainage: number; designLevel: number; levels: Array<{ offset: number; elevation: number }> }>>([]);
  const [trackGaugeMM, setTrackGaugeMM] = useState(1000);
  const [designSpeedKmh, setDesignSpeedKmh] = useState(80);
  const [maxGradientPercent, setMaxGradientPercent] = useState(2);

  const computedHorizontal = horizontalCurves.map(c => computeHorizontalCurve(c.radius, c.delta, c.piChainage));
  const computedVertical = verticalCurves.map(v => computeVerticalCurve(v.pvIChainage, v.pvIElevation, v.gradeIn, v.gradeOut, v.length));

  const minRadiusWarning = designSpeedKmh <= 60 && horizontalCurves.some(c => c.radius < 200);

  const gradientWarning = computedVertical.some(vc => Math.abs(vc.gradeIn) > maxGradientPercent || Math.abs(vc.gradeOut) > maxGradientPercent);

  const tabs = [
    { id: 'alignment', label: 'Alignment' },
    { id: 'horizontal', label: 'Horizontal Curves' },
    { id: 'vertical', label: 'Vertical Curves' },
    { id: 'cross', label: 'Cross Sections' },
    { id: 'earthworks', label: 'Earthworks' },
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

      <div className="flex overflow-x-auto border-b border-zinc-700 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm whitespace-nowrap ${activeTab === tab.id ? 'text-amber-500 border-b-2 border-amber-500' : 'text-zinc-400'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'alignment' && (
        <div>
          <div className="text-lg font-medium mb-3">Alignment Points</div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm text-zinc-400" htmlFor="track-gauge-mm">Track Gauge (mm)</label>
              <select id="track-gauge-mm"
                value={trackGaugeMM}
                onChange={(e) => setTrackGaugeMM(parseInt(e.target.value))}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              >
                <option value={1000}>1000 (Metre Gauge)</option>
                <option value={1435}>1435 (Standard)</option>
                <option value={1067}>1067 (Cape Gauge)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="design-speed-km-h">Design Speed (km/h)</label>
              <input id="design-speed-km-h" aria-label="Design Speed (km/h)"
                type="number"
                value={designSpeedKmh}
                onChange={(e) => setDesignSpeedKmh(parseInt(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="max-gradient">Max Gradient (%)</label>
              <input  id="max-gradient" aria-label="Max Gradient (%)"
                type="number"
                step={0.1}
                value={maxGradientPercent}
                onChange={(e) => setMaxGradientPercent(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Chainage</th>
                <th className="text-left py-2">Easting</th>
                <th className="text-left py-2">Northing</th>
                <th className="text-left py-2">Elevation</th>
              </tr>
            </thead>
            <tbody>
              {alignment.map((pt, i) => (
                <tr key={`${pt}-${i}`} className="border-b border-zinc-800">
                  <td className="py-2">{pt.chainage.toFixed(3)}</td>
                  <td className="py-2">{pt.easting.toFixed(3)}</td>
                  <td className="py-2">{pt.northing.toFixed(3)}</td>
                  <td className="py-2">{pt.elevation?.toFixed(3) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <button
            onClick={() => setAlignment([...alignment, { chainage: alignment.length > 0 ? alignment[alignment.length-1].chainage + 20 : 0, easting: 0, northing: 0 }])}
            className="mt-3 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded"
          >
            Add Point
          </button>
        </div>
      )}

      {activeTab === 'horizontal' && (
        <div>
          <div className="text-lg font-medium mb-3">Horizontal Curves</div>
          {computedHorizontal.map((curve, i) => (
            <div key={`${curve}-${i}`} className="mb-4 p-3 bg-zinc-800 rounded-lg">
              <div className="text-sm text-amber-500 mb-2">Curve {i + 1}</div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="text-zinc-400">Radius:</span> {horizontalCurves[i].radius}m</div>
                <div><span className="text-zinc-400">Δ:</span> {horizontalCurves[i].delta.toFixed(2)}°</div>
                <div><span className="text-zinc-400">T:</span> {curve.tangentLength.toFixed(3)}m</div>
              </div>
            </div>
          ))}
          {minRadiusWarning && (
            <div className="mt-2 p-2 bg-amber-900/50 border border-amber-700 rounded-lg text-sm text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Minimum curve radius R &lt; 200m for V ≤ 60km/h
            </div>
          )}
        </div>
      )}

      {activeTab === 'vertical' && (
        <div>
          <div className="text-lg font-medium mb-3">Vertical Curves</div>
          {computedVertical.map((vc, i) => (
            <div key={`${vc}-${i}`} className="mb-4 p-3 bg-zinc-800 rounded-lg">
              <div className="text-sm text-amber-500 mb-2">VC {i + 1}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-zinc-400">Grade In:</span> {verticalCurves[i].gradeIn.toFixed(2)}%</div>
                <div><span className="text-zinc-400">Grade Out:</span> {verticalCurves[i].gradeOut.toFixed(2)}%</div>
              </div>
            </div>
          ))}
          {gradientWarning && (
            <div className="mt-2 p-2 bg-amber-900/50 border border-amber-700 rounded-lg text-sm text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> Gradient exceeds maximum {maxGradientPercent}%
            </div>
          )}
        </div>
      )}

      {activeTab === 'cross' && (
        <div>
          <div className="text-lg font-medium mb-3">Cross Sections</div>
        </div>
      )}

      {activeTab === 'earthworks' && (
        <div>
          <div className="text-lg font-medium mb-3">Earthworks</div>
        </div>
      )}
    </div>
  );
}

export default RailwayPanel;