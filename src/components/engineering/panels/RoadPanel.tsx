'use client';

import { useState, useMemo } from 'react';
import { ENGINEERING_QA, type EngineeringSubtype, computeHorizontalCurve, computeVerticalCurve, crossSectionCutFill, prismoidalVolume } from '@/lib/engine/engineering';

interface EngineeringPanelProps {
  projectId: string;
  subtype: EngineeringSubtype;
}

export function RoadPanel({ projectId: _projectId, subtype: _subtype }: EngineeringPanelProps) {
  const [activeTab, setActiveTab] = useState<'alignment' | 'horizontal' | 'vertical' | 'cross' | 'earthworks' | 'settingout'>('alignment');
  const qa = ENGINEERING_QA.road;

  const [alignment, setAlignment] = useState<Array<{ chainage: number; easting: number; northing: number; elevation?: number; label: string }>>([]);
  const [horizontalCurves, setHorizontalCurves] = useState<Array<{ radius: number; delta: number; piChainage: number }>>([]);
  const [verticalCurves, setVerticalCurves] = useState<Array<{ pvIChainage: number; pvIElevation: number; gradeIn: number; gradeOut: number; length: number }>>([]);
  const [crossSections] = useState<Array<{ chainage: number; designLevel: number; levels: Array<{ offset: number; elevation: number }> }>>([]);

  const computedHorizontal = useMemo(() => {
    return horizontalCurves.map(c => computeHorizontalCurve(c.radius, c.delta, c.piChainage));
  }, [horizontalCurves]);

  const computedVertical = useMemo(() => {
    return verticalCurves.map(v => computeVerticalCurve(v.pvIChainage, v.pvIElevation, v.gradeIn, v.gradeOut, v.length));
  }, [verticalCurves]);

  const earthworks = useMemo(() => {
    let totalCut = 0;
    let totalFill = 0;
    crossSections.forEach((cs, i) => {
      if (i > 0) {
        const prev = crossSections[i - 1];
        const { cutArea, fillArea } = crossSectionCutFill(cs.designLevel, cs.levels);
        const dist = cs.chainage - prev.chainage;
        totalCut += prismoidalVolume(cutArea, crossSectionCutFill(prev.designLevel, prev.levels).cutArea, dist);
        totalFill += prismoidalVolume(fillArea, crossSectionCutFill(prev.designLevel, prev.levels).fillArea, dist);
      }
    });
    return { totalCut, totalFill, net: totalCut - totalFill };
  }, [crossSections]);

  const tabs = [
    { id: 'alignment', label: 'Alignment' },
    { id: 'horizontal', label: 'Horizontal Curves' },
    { id: 'vertical', label: 'Vertical Curves' },
    { id: 'cross', label: 'Cross Sections' },
    { id: 'earthworks', label: 'Earthworks' },
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

      {activeTab === 'alignment' && (
        <div>
          <div className="text-lg font-medium mb-3">Alignment Points</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Chainage</th>
                <th className="text-left py-2">Easting</th>
                <th className="text-left py-2">Northing</th>
                <th className="text-left py-2">Elevation</th>
                <th className="text-left py-2">Label</th>
              </tr>
            </thead>
            <tbody>
              {alignment.map((pt) => (
                <tr key={pt.label} className="border-b border-zinc-800">
                  <td className="py-2">{pt.chainage.toFixed(3)}</td>
                  <td className="py-2">{pt.easting.toFixed(3)}</td>
                  <td className="py-2">{pt.northing.toFixed(3)}</td>
                  <td className="py-2">{pt.elevation?.toFixed(3) || '-'}</td>
                  <td className="py-2">{pt.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => setAlignment([...alignment, { chainage: alignment.length > 0 ? alignment[alignment.length - 1].chainage + 20 : 0, easting: 0, northing: 0, label: `P${alignment.length + 1}` }])}
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
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-zinc-400">Radius:</span> {horizontalCurves[i].radius}m</div>
                <div><span className="text-zinc-400">Δ:</span> {horizontalCurves[i].delta.toFixed(2)}°</div>
                <div><span className="text-zinc-400">T (Tangent):</span> {curve.tangentLength.toFixed(3)}m</div>
                <div><span className="text-zinc-400">L (Curve):</span> {curve.curveLength.toFixed(3)}m</div>
                <div><span className="text-zinc-400">E (External):</span> {curve.externalDistance.toFixed(3)}m</div>
                <div><span className="text-zinc-400">M (Mid-ord):</span> {curve.midOrdinate.toFixed(3)}m</div>
                <div><span className="text-zinc-400">LC (Long Chord):</span> {curve.longChord.toFixed(3)}m</div>
                <div><span className="text-zinc-400">PC:</span> {curve.pcChainage.toFixed(3)}m</div>
                <div><span className="text-zinc-400">PT:</span> {curve.ptChainage.toFixed(3)}m</div>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <input
              type="number"
              aria-label="Radius (m)" placeholder="e.g. 250"
              value={horizontalCurves[horizontalCurves.length - 1]?.radius || ''}
              onChange={(e) => {
                const newCurves = [...horizontalCurves];
                if (!newCurves[newCurves.length - 1]) newCurves[newCurves.length - 1] = { radius: 0, delta: 0, piChainage: 0 };
                newCurves[newCurves.length - 1].radius = parseFloat(e.target.value) || 0;
                setHorizontalCurves(newCurves);
              }}
              className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm w-32"
            />
            <input
              type="number"
              aria-label="Delta (°)" placeholder="e.g. 12.5"
              value={horizontalCurves[horizontalCurves.length - 1]?.delta || ''}
              onChange={(e) => {
                const newCurves = [...horizontalCurves];
                if (!newCurves[newCurves.length - 1]) newCurves[newCurves.length - 1] = { radius: 0, delta: 0, piChainage: 0 };
                newCurves[newCurves.length - 1].delta = parseFloat(e.target.value) || 0;
                setHorizontalCurves(newCurves);
              }}
              className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm w-32"
            />
            <input
              type="number"
              aria-label="PI Chainage" placeholder="e.g. 1+250"
              value={horizontalCurves[horizontalCurves.length - 1]?.piChainage || ''}
              onChange={(e) => {
                const newCurves = [...horizontalCurves];
                if (!newCurves[newCurves.length - 1]) newCurves[newCurves.length - 1] = { radius: 0, delta: 0, piChainage: 0 };
                newCurves[newCurves.length - 1].piChainage = parseFloat(e.target.value) || 0;
                setHorizontalCurves(newCurves);
              }}
              className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm w-32"
            />
            <button
              onClick={() => setHorizontalCurves([...horizontalCurves, { radius: 200, delta: 20, piChainage: 500 }])}
              className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded"
            >
              Add Curve
            </button>
          </div>
        </div>
      )}

      {activeTab === 'vertical' && (
        <div>
          <div className="text-lg font-medium mb-3">Vertical Curves</div>
          {computedVertical.map((vc, i) => (
            <div key={`${vc}-${i}`} className="mb-4 p-3 bg-zinc-800 rounded-lg">
              <div className="text-sm text-amber-500 mb-2">Vertical Curve {i + 1}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-zinc-400">PVI Chainage:</span> {verticalCurves[i].pvIChainage.toFixed(3)}m</div>
                <div><span className="text-zinc-400">PVI Elevation:</span> {verticalCurves[i].pvIElevation.toFixed(3)}m</div>
                <div><span className="text-zinc-400">Grade In:</span> {verticalCurves[i].gradeIn.toFixed(2)}%</div>
                <div><span className="text-zinc-400">Grade Out:</span> {verticalCurves[i].gradeOut.toFixed(2)}%</div>
                <div><span className="text-zinc-400">Length:</span> {verticalCurves[i].length.toFixed(3)}m</div>
                {vc.highLowPoint && (
                  <>
                    <div><span className="text-zinc-400">HL Chainage:</span> {vc.highLowPoint.chainage.toFixed(3)}m</div>
                    <div><span className="text-zinc-400">HL Elevation:</span> {vc.highLowPoint.elevation.toFixed(3)}m</div>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <input
              type="number"
              aria-label="PVI Chainage" placeholder="e.g. 1+250"
              className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm w-32"
            />
            <input
              type="number"
              aria-label="PVI Elev" placeholder="e.g. 1580.00"
              className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm w-32"
            />
            <input
              type="number"
              aria-label="Grade In %" placeholder="e.g. -3.5"
              className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm w-24"
            />
            <input
              type="number"
              aria-label="Grade Out %" placeholder="e.g. 2.5"
              className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm w-24"
            />
            <input
              type="number"
              aria-label="Length" placeholder="e.g. 120"
              className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm w-24"
            />
            <button
              onClick={() => setVerticalCurves([...verticalCurves, { pvIChainage: 1000, pvIElevation: 1500, gradeIn: 3, gradeOut: -2, length: 200 }])}
              className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {activeTab === 'cross' && (
        <div>
          <div className="text-lg font-medium mb-3">Cross Sections</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Chainage</th>
                <th className="text-left py-2">Design Level</th>
                <th className="text-left py-2">Cut (m²)</th>
                <th className="text-left py-2">Fill (m²)</th>
              </tr>
            </thead>
            <tbody>
              {crossSections.map((cs, i) => {
                const { cutArea, fillArea } = crossSectionCutFill(cs.designLevel, cs.levels);
                return (
                  <tr key={`${cs}-${i}`} className="border-b border-zinc-800">
                    <td className="py-2">{cs.chainage.toFixed(3)}</td>
                    <td className="py-2">{cs.designLevel.toFixed(3)}</td>
                    <td className="py-2">{cutArea.toFixed(3)}</td>
                    <td className="py-2">{fillArea.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'earthworks' && (
        <div>
          <div className="text-lg font-medium mb-3">Earthworks Summary</div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="text-sm text-zinc-400">Total Cut</div>
              <div className="text-xl text-red-400">{earthworks.totalCut.toFixed(2)} m³</div>
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="text-sm text-zinc-400">Total Fill</div>
              <div className="text-xl text-blue-400">{earthworks.totalFill.toFixed(2)} m³</div>
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg">
              <div className="text-sm text-zinc-400">Net</div>
              <div className={`text-xl ${earthworks.net >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {earthworks.net.toFixed(2)} m³
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settingout' && (
        <div>
          <div className="text-lg font-medium mb-3">Setting Out</div>
          <div className="p-4 bg-zinc-800 rounded-lg text-sm">
            <div className="text-zinc-400 mb-2">Stakeout Point Calculator</div>
            <div className="flex gap-2">
              <input
                type="number"
                aria-label="PC Easting" placeholder="e.g. 500000"
                className="px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm w-28"
              />
              <input
                type="number"
                aria-label="PC Northing" placeholder="e.g. 9900000"
                className="px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm w-28"
              />
              <input
                type="number"
                aria-label="Initial Bearing" placeholder="e.g. 45°"
                className="px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm w-28"
              />
              <input
                type="number"
                aria-label="Radius" placeholder="e.g. 250"
                className="px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm w-24"
              />
              <input
                type="number"
                aria-label="Chainage" placeholder="e.g. 1+250"
                className="px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm w-24"
              />
              <select className="px-2 py-1.5 bg-zinc-700 border border-zinc-600 rounded text-sm">
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoadPanel;