'use client';

import { useState } from 'react';
import { ENGINEERING_QA, type EngineeringSubtype } from '@/lib/engine/engineering';

interface EngineeringPanelProps {
  projectId: string;
  subtype: EngineeringSubtype;
}

export function PipelinePanel({ projectId, subtype }: EngineeringPanelProps) {
  const [activeTab, setActiveTab] = useState<'route' | 'data' | 'profile' | 'settingout'>('route');
  const qa = ENGINEERING_QA.pipeline;

  const [routePoints, setRoutePoints] = useState<Array<{ chainage: number; easting: number; northing: number; elevation?: number }>>([]);
  const [pipelineDiameterMM, setPipelineDiameterMM] = useState(150);
  const [designPressureKPa, setDesignPressureKPa] = useState(800);
  const [depthOfCoverM, setDepthOfCoverM] = useState(1.0);
  const [material, setMaterial] = useState('HDPE');

  const tabs = [
    { id: 'route', label: 'Route Survey' },
    { id: 'data', label: 'Pipeline Data' },
    { id: 'profile', label: 'Profile' },
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

      {activeTab === 'route' && (
        <div>
          <div className="text-lg font-medium mb-3">Alignment Points</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Chainage</th>
                <th className="text-left py-2">Easting</th>
                <th className="text-left py-2">Northing</th>
                <th className="text-left py-2">Elevation</th>
              </tr>
            </thead>
            <tbody>
              {routePoints.map((pt, i) => (
                <tr key={`${pt}-${i}`} className="border-b border-zinc-800">
                  <td className="py-2">{pt.chainage.toFixed(3)}</td>
                  <td className="py-2">{pt.easting.toFixed(3)}</td>
                  <td className="py-2">{pt.northing.toFixed(3)}</td>
                  <td className="py-2">{pt.elevation?.toFixed(3) || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => setRoutePoints([...routePoints, { chainage: routePoints.length > 0 ? routePoints[routePoints.length-1].chainage + 20 : 0, easting: 0, northing: 0 }])}
            className="mt-3 px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 rounded"
          >
            Add Point
          </button>
        </div>
      )}

      {activeTab === 'data' && (
        <div>
          <div className="text-lg font-medium mb-3">Pipeline Data</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400" htmlFor="diameter-mm">Diameter (mm)</label>
              <input id="diameter-mm" aria-label="Diameter (mm)"
                type="number"
                value={pipelineDiameterMM}
                onChange={(e) => setPipelineDiameterMM(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="design-pressure-kpa">Design Pressure (kPa)</label>
              <input id="design-pressure-kpa" aria-label="Design Pressure (kPa)"
                type="number"
                value={designPressureKPa}
                onChange={(e) => setDesignPressureKPa(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="min-depth-of-cover-m">Min Depth of Cover (m)</label>
              <input id="min-depth-of-cover-m" aria-label="Min Depth of Cover (m)"
                type="number"
                step={0.1}
                value={depthOfCoverM}
                onChange={(e) => setDepthOfCoverM(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="material">Material</label>
              <select
                 id="material" value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm"
              >
                <option value="HDPE">HDPE</option>
                <option value="Steel">Steel</option>
                <option value="DI">Ductile Iron</option>
                <option value="uPVC">uPVC</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'profile' && (
        <div>
          <div className="text-lg font-medium mb-3">Profile</div>
          <div className="text-sm text-zinc-400">Chainage, ground elevation, pipe invert, cover depth</div>
          <table className="w-full mt-3 text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Chainage</th>
                <th className="text-left py-2">Ground (m)</th>
                <th className="text-left py-2">Invert (m)</th>
                <th className="text-left py-2">Cover (m)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800"><td className="py-2">0+000</td><td className="py-2">—</td><td className="py-2">—</td><td className="py-2">—</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'settingout' && (
        <div>
          <div className="text-lg font-medium mb-3">Setting Out</div>
          <div className="p-4 bg-zinc-800 rounded-lg text-sm">
            <div className="text-zinc-400">Stake out points at intervals</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PipelinePanel;