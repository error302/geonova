'use client';

import { useState } from 'react';
import { 
  geodeticToECEF, 
  ecefToGeodetic, 
  ecefToENU, 
  computeBaseline, 
  processGNSSNetwork,
  utmToGeodetic
} from '@/lib/engine/gnss';

interface Observation {
  id: number;
  name: string;
  lat: string;
  lon: string;
  h: string;
  sigma: string;
}

export default function GNSSProcessor() {
  const [baseStation, setBaseStation] = useState({
    name: 'BASE01',
    lat: '-1.2921',
    lon: '36.8219',
    h: '1798.5'
  });
  
  const [origin, setOrigin] = useState({
    lat: '-1.2921',
    lon: '36.8219'
  });
  
  const [observations, setObservations] = useState<Observation[]>([
    { id: 1, name: 'ROVER1', lat: '-1.2915', lon: '36.8225', h: '1800.2', sigma: '0.015' },
    { id: 2, name: 'ROVER2', lat: '-1.2930', lon: '36.8210', h: '1795.8', sigma: '0.018' },
  ]);
  
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<'baseline' | 'network'>('baseline');

  const addObservation = () => {
    setObservations([
      ...observations,
      { id: Date.now(), name: `POINT${observations.length + 1}`, lat: '', lon: '', h: '', sigma: '0.015' }
    ]);
  };

  const updateObservation = (id: number, field: keyof Observation, value: string) => {
    setObservations(observations.map((o: any) => o.id === id ? { ...o, [field]: value } : o));
  };

  const removeObservation = (id: number) => {
    setObservations(observations.filter((o: any) => o.id !== id));
  };

  const calculate = () => {
    try {
      const baseECEF = geodeticToECEF(
        parseFloat(baseStation.lat),
        parseFloat(baseStation.lon),
        parseFloat(baseStation.h)
      );
      baseECEF.name = baseStation.name;

      if (mode === 'baseline') {
        // Single baseline calculation
        const obs = observations[0];
        if (!obs.lat || !obs.lon) return;

        const obsECEF = geodeticToECEF(
          parseFloat(obs.lat),
          parseFloat(obs.lon),
          parseFloat(obs.h) || 0
        );
        obsECEF.name = obs.name;

        const baseline = computeBaseline(
          { pointName: baseStation.name, ...baseECEF },
          { pointName: obs.name, x: obsECEF.x, y: obsECEF.y, z: obsECEF.z, sigmaX: parseFloat(obs.sigma) }
        );

        const enu = ecefToENU(obsECEF.x, obsECEF.y, obsECEF.z, parseFloat(origin.lat), parseFloat(origin.lon), 0);

        setResult({
          baseline,
          enu,
          baseECEF,
          obsECEF
        });
      } else {
        // Network processing
        const obsData = observations.map((o: any) => ({
          pointName: o.name,
          x: 0, y: 0, z: 0,
          sigmaX: parseFloat(o.sigma)
        })).map((o, i) => {
          const ecef = geodeticToECEF(
            parseFloat(observations[i].lat),
            parseFloat(observations[i].lon),
            parseFloat(observations[i].h) || 0
          );
          return { ...o, x: ecef.x, y: ecef.y, z: ecef.z };
        });

        const network = processGNSSNetwork(
          baseECEF as any,
          obsData,
          parseFloat(origin.lat),
          parseFloat(origin.lon),
          0
        );

        setResult(network);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">GNSS Baseline Processing</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Process GPS/GNSS observations, compute baselines, and convert coordinates</p>

      <div className="flex gap-4 mb-6">
        <button onClick={() => { setMode('baseline'); setResult(null); }} className={`btn ${mode === 'baseline' ? 'btn-primary' : 'btn-secondary'}`}>
          Single Baseline
        </button>
        <button onClick={() => { setMode('network'); setResult(null); }} className={`btn ${mode === 'network' ? 'btn-primary' : 'btn-secondary'}`}>
          Network Adjustment
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Base Station */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <h3 className="font-semibold mb-4">Base Station</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input type="text" value={baseStation.name} onChange={e => setBaseStation({...baseStation, name: e.target.value})} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm mb-1">Height (m)</label>
                <input type="text" value={baseStation.h} onChange={e => setBaseStation({...baseStation, h: e.target.value})} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm mb-1">Latitude</label>
                <input type="text" value={baseStation.lat} onChange={e => setBaseStation({...baseStation, lat: e.target.value})} className="input w-full" placeholder="-1.2921" />
              </div>
              <div>
                <label className="block text-sm mb-1">Longitude</label>
                <input type="text" value={baseStation.lon} onChange={e => setBaseStation({...baseStation, lon: e.target.value})} className="input w-full" placeholder="36.8219" />
              </div>
            </div>
          </div>

          {/* Origin for ENU */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <h3 className="font-semibold mb-4">Local Origin (for ENU)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Latitude</label>
                <input type="text" value={origin.lat} onChange={e => setOrigin({...origin, lat: e.target.value})} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm mb-1">Longitude</label>
                <input type="text" value={origin.lon} onChange={e => setOrigin({...origin, lon: e.target.value})} className="input w-full" />
              </div>
            </div>
          </div>

          {/* Observations */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Rover Observations</h3>
              <button onClick={addObservation} className="btn btn-secondary text-sm">+ Add Point</button>
            </div>
            <div className="space-y-3">
              {observations.map((obs: any) => (
                <div key={obs.id} className="grid grid-cols-6 gap-2 items-end">
                  <div className="col-span-1">
                    <label className="block text-xs mb-1">Name</label>
                    <input type="text" value={obs.name} onChange={e => updateObservation(obs.id, 'name', e.target.value)} className="input w-full text-sm" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs mb-1">Latitude</label>
                    <input type="text" value={obs.lat} onChange={e => updateObservation(obs.id, 'lat', e.target.value)} className="input w-full text-sm" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs mb-1">Longitude</label>
                    <input type="text" value={obs.lon} onChange={e => updateObservation(obs.id, 'lon', e.target.value)} className="input w-full text-sm" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs mb-1">Height</label>
                    <input type="text" value={obs.h} onChange={e => updateObservation(obs.id, 'h', e.target.value)} className="input w-full text-sm" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs mb-1">Sigma (m)</label>
                    <input type="text" value={obs.sigma} onChange={e => updateObservation(obs.id, 'sigma', e.target.value)} className="input w-full text-sm" />
                  </div>
                  <button onClick={() => removeObservation(obs.id)} className="text-red-500 text-sm mb-1">✕</button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={calculate} className="btn btn-primary w-full">
            Calculate {mode === 'baseline' ? 'Baseline' : 'Network'}
          </button>
        </div>

        {/* Results */}
        <div>
          {result && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <h3 className="font-semibold mb-4">Results</h3>
              
              {mode === 'baseline' && result.baseline && (
                <div className="space-y-4">
                  <div className="bg-[var(--bg)] p-3 rounded">
                    <h4 className="text-sm font-medium mb-2">Baseline Vector</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-[var(--text-secondary)]">From:</span> {result.baseline.from}</div>
                      <div><span className="text-[var(--text-secondary)]">To:</span> {result.baseline.to}</div>
                      <div><span className="text-[var(--text-secondary)]">ΔX:</span> {result.baseline.deltaX.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">ΔY:</span> {result.baseline.deltaY.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">ΔZ:</span> {result.baseline.deltaZ.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">Distance 3D:</span> {result.baseline.distance3D.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">Distance 2D:</span> {result.baseline.distance2D.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">Azimuth:</span> {result.baseline.azimuth.toFixed(4)}°</div>
                      <div><span className="text-[var(--text-secondary)]">Elev. Angle:</span> {result.baseline.elevationAngle.toFixed(4)}°</div>
                      <div><span className="text-[var(--text-secondary)]">Sigma:</span> ±{result.baseline.sigma.toFixed(4)} m</div>
                    </div>
                  </div>

                  <div className="bg-[var(--bg)] p-3 rounded">
                    <h4 className="text-sm font-medium mb-2">Local ENU Coordinates</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-[var(--text-secondary)]">Easting:</span> {result.enu.easting.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">Northing:</span> {result.enu.northing.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">Up:</span> {result.enu.up.toFixed(4)} m</div>
                    </div>
                  </div>

                  <div className="bg-[var(--bg)] p-3 rounded">
                    <h4 className="text-sm font-medium mb-2">ECEF Coordinates</h4>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><span className="text-[var(--text-secondary)]">X:</span> {result.obsECEF.x.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">Y:</span> {result.obsECEF.y.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">Z:</span> {result.obsECEF.z.toFixed(4)} m</div>
                    </div>
                  </div>
                </div>
              )}

              {mode === 'network' && result.points && (
                <div className="space-y-4">
                  <div className="bg-[var(--bg)] p-3 rounded">
                    <h4 className="text-sm font-medium mb-2">Adjusted Points</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[var(--text-secondary)]">
                          <th className="pb-2">Name</th>
                          <th className="pb-2">Easting</th>
                          <th className="pb-2">Northing</th>
                          <th className="pb-2">Elev</th>
                          <th className="pb-2">σ (m)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.points.map((p: any, i: number) => (
                          <tr key={i} className="border-t border-[var(--border)]">
                            <td className="py-2">{p.name}</td>
                            <td>{p.easting.toFixed(4)}</td>
                            <td>{p.northing.toFixed(4)}</td>
                            <td>{p.elevation.toFixed(4)}</td>
                            <td>±{p.sigmaEasting.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-[var(--bg)] p-3 rounded">
                    <h4 className="text-sm font-medium mb-2">Adjustment Statistics</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-[var(--text-secondary)]">RMS:</span> {result.adjustmentStats.rms.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">Max Residual:</span> {result.adjustmentStats.maxResidual.toFixed(4)} m</div>
                      <div><span className="text-[var(--text-secondary)]">DoF:</span> {result.adjustmentStats.degreesOfFreedom}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
