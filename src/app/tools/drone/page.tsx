'use client';

import { useState } from 'react';

interface GCPPoint {
  id: number;
  name: string;
  easting: string;
  northing: string;
  elevation: string;
  status: 'planned' | 'placed' | 'measured';
}

interface AccuracyPoint {
  id: number;
  name: string;
  surveyE: string;
  surveyN: string;
  surveyZ: string;
  droneE: string;
  droneN: string;
  droneZ: string;
}

interface AccuracyClass {
  name: string;
  horizontal: number;
  vertical: number;
  scale: string;
}

const accuracyClasses: AccuracyClass[] = [
  { name: 'Class I', horizontal: 0.075, vertical: 0.15, scale: '1:500' },
  { name: 'Class II', horizontal: 0.150, vertical: 0.30, scale: '1:1000' },
  { name: 'Class III', horizontal: 0.375, vertical: 0.75, scale: '1:2500' },
];

function formatNumber(n: number, decimals: number = 4): string {
  return n.toFixed(decimals);
}

function calculateRMSE(errors: number[]): number {
  if (errors.length === 0) return 0;
  const sumSquared = errors.reduce((sum, e) => sum + e * e, 0);
  return Math.sqrt(sumSquared / errors.length);
}

export default function DroneSurveyPage() {
  const [activeTab, setActiveTab] = useState<'planning' | 'settingout' | 'accuracy' | 'report'>('planning');

  const [surveyArea, setSurveyArea] = useState({
    minE: '484500',
    maxE: '485000',
    minN: '9863000',
    maxN: '9863500',
  });

  const [gcpCount, setGcpCount] = useState('9');
  const [gcps, setGcps] = useState<GCPPoint[]>([]);

  const [accuracyPoints, setAccuracyPoints] = useState<AccuracyPoint[]>([
    { id: 1, name: 'CP1', surveyE: '484500.0000', surveyN: '9863100.0000', surveyZ: '120.5000', droneE: '484500.0125', droneN: '9863100.0080', droneZ: '120.4850' },
    { id: 2, name: 'CP2', surveyE: '484750.0000', surveyN: '9863250.0000', surveyZ: '118.2500', droneE: '484750.0180', droneN: '9863249.9950', droneZ: '118.2350' },
  ]);

  const [accuracyResults, setAccuracyResults] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<AccuracyClass>(accuracyClasses[0]);

  const generateGCPs = () => {
    const count = parseInt(gcpCount);
    if (isNaN(count) || count < 3) return;

    const minE = parseFloat(surveyArea.minE);
    const maxE = parseFloat(surveyArea.maxE);
    const minN = parseFloat(surveyArea.minN);
    const maxN = parseFloat(surveyArea.maxN);

    const cols = Math.ceil(Math.sqrt(count * (maxE - minE) / (maxN - minN)));
    const rows = Math.ceil(count / cols);

    const gcps: GCPPoint[] = [];
    let idx = 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (idx > count) break;
        
        const marginE = (maxE - minE) * 0.1;
        const marginN = (maxN - minN) * 0.1;
        
        const e = minE + marginE + (c / (cols - 1 || 1)) * (maxE - minE - 2 * marginE);
        const n = minN + marginN + (r / (rows - 1 || 1)) * (maxN - minN - 2 * marginN);
        
        gcps.push({
          id: idx,
          name: `GCP-${String(idx).padStart(2, '0')}`,
          easting: formatNumber(e, 4),
          northing: formatNumber(n, 4),
          elevation: '',
          status: 'planned',
        });
        idx++;
      }
    }

    setGcps(gcps);
  };

  const updateGCP = (id: number, field: keyof GCPPoint, value: string) => {
    setGcps(gcps.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const exportGCPCSV = () => {
    const csv = 'Name,Easting,Northing,Elevation,Status\n' + 
      gcps.map(g => `${g.name},${g.easting},${g.northing},${g.elevation},${g.status}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gcp_coordinates.csv';
    a.click();
  };

  const addAccuracyPoint = () => {
    const last = accuracyPoints[accuracyPoints.length - 1];
    const num = parseInt(last?.name?.replace(/\D/g, '') || '0') + 1;
    setAccuracyPoints([...accuracyPoints, { 
      id: Date.now(), 
      name: `CP${num}`, 
      surveyE: '', surveyN: '', surveyZ: '', 
      droneE: '', droneN: '', droneZ: '' 
    }]);
  };

  const updateAccuracyPoint = (id: number, field: keyof AccuracyPoint, value: string) => {
    setAccuracyPoints(accuracyPoints.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const calculateAccuracy = () => {
    const results = accuracyPoints.map(p => {
      const se = parseFloat(p.surveyE);
      const sn = parseFloat(p.surveyN);
      const sz = parseFloat(p.surveyZ);
      const de = parseFloat(p.droneE);
      const dn = parseFloat(p.droneN);
      const dz = parseFloat(p.droneZ);

      if (isNaN(se) || isNaN(sn) || isNaN(sz) || isNaN(de) || isNaN(dn) || isNaN(dz)) return null;

      const dE = de - se;
      const dN = dn - sn;
      const dZ = dz - sz;
      const horizontalError = Math.sqrt(dE * dE + dN * dN);
      const error3D = Math.sqrt(dE * dE + dN * dN + dZ * dZ);

      return { name: p.name, se, sn, sz, de, dn, dz, dE, dN, dZ, horizontalError, error3D };
    }).filter(Boolean);

    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);

    if (validResults.length === 0) return;

    const horizontalErrors = validResults.map(r => r.horizontalError);
    const verticalErrors = validResults.map(r => Math.abs(r.dZ));
    const errors3D = validResults.map(r => r.error3D);

    const hRMSE = calculateRMSE(horizontalErrors);
    const vRMSE = calculateRMSE(verticalErrors);
    const maxHorizontal = Math.max(...horizontalErrors);
    const maxVertical = Math.max(...verticalErrors);
    const max3D = Math.max(...errors3D);

    const horizontalPass = hRMSE <= selectedClass.horizontal;
    const verticalPass = vRMSE <= selectedClass.vertical;

    setAccuracyResults({
      points: validResults,
      hRMSE,
      vRMSE,
      maxHorizontal,
      maxVertical,
      max3D,
      horizontalPass,
      verticalPass,
      pass: horizontalPass && verticalPass,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">🚁 Drone/UAV Survey Tools</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">GCP planning, accuracy verification, and survey reports</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'planning', label: 'GCP Planning' },
          { id: 'settingout', label: 'Setting Out' },
          { id: 'accuracy', label: 'Accuracy Check' },
          { id: 'report', label: 'Report' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === tab.id 
                ? 'bg-[var(--accent)] text-white' 
                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--accent)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'planning' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">Survey Area Boundary</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Enter the survey area boundaries. METARDU will suggest optimal GCP distribution.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Min Easting</label>
                <input 
                  className="input" 
                  type="number"
                  value={surveyArea.minE}
                  onChange={e => setSurveyArea({...surveyArea, minE: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Max Easting</label>
                <input 
                  className="input" 
                  type="number"
                  value={surveyArea.maxE}
                  onChange={e => setSurveyArea({...surveyArea, maxE: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Min Northing</label>
                <input 
                  className="input" 
                  type="number"
                  value={surveyArea.minN}
                  onChange={e => setSurveyArea({...surveyArea, minN: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Max Northing</label>
                <input 
                  className="input" 
                  type="number"
                  value={surveyArea.maxN}
                  onChange={e => setSurveyArea({...surveyArea, maxN: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="label">GCP Configuration</span>
            </div>
            <div className="flex gap-4 items-end mb-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Number of GCPs (min 5)</label>
                <input 
                  className="input w-32" 
                  type="number"
                  min="5"
                  value={gcpCount}
                  onChange={e => setGcpCount(e.target.value)}
                />
              </div>
              <button onClick={generateGCPs} className="btn btn-primary">Generate GCP Positions</button>
            </div>
          </div>

          {gcps.length > 0 && (
            <div className="card">
              <div className="card-header flex justify-between items-center">
                <span className="label">Planned GCP Positions ({gcps.length} points)</span>
                <button onClick={exportGCPCSV} className="btn btn-secondary text-sm">Export CSV</button>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Easting (m)</th>
                      <th>Northing (m)</th>
                      <th>Elevation (m)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gcps.map(g => (
                      <tr key={g.id}>
                        <td className="font-semibold">{g.name}</td>
                        <td><input className="input w-32 font-mono" value={g.easting} onChange={e => updateGCP(g.id, 'easting', e.target.value)} /></td>
                        <td><input className="input w-32 font-mono" value={g.northing} onChange={e => updateGCP(g.id, 'northing', e.target.value)} /></td>
                        <td><input className="input w-24 font-mono" value={g.elevation} onChange={e => updateGCP(g.id, 'elevation', e.target.value)} placeholder="RL" /></td>
                        <td>
                          <select 
                            className="input w-28" 
                            value={g.status}
                            onChange={e => updateGCP(g.id, 'status', e.target.value)}
                          >
                            <option value="planned">Planned</option>
                            <option value="placed">Placed</option>
                            <option value="measured">Measured</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded">
                <h4 className="font-semibold mb-2">GCP Distribution Map</h4>
                <svg viewBox="0 0 400 250" className="w-full h-48 bg-[var(--bg-secondary)] rounded">
                  <rect x="20" y="20" width="360" height="210" fill="none" stroke="#444" strokeWidth="2" />
                  {gcps.map(g => {
                    const minE = parseFloat(surveyArea.minE);
                    const maxE = parseFloat(surveyArea.maxE);
                    const minN = parseFloat(surveyArea.minN);
                    const maxN = parseFloat(surveyArea.maxN);
                    const x = 20 + ((parseFloat(g.easting) - minE) / (maxE - minE)) * 360;
                    const y = 230 - ((parseFloat(g.northing) - minN) / (maxN - minN)) * 210;
                    return (
                      <g key={g.id}>
                        <circle cx={x} cy={y} r="8" fill={g.status === 'measured' ? '#22c55e' : g.status === 'placed' ? '#eab308' : '#E8841A'} />
                        <text x={x} y={y - 12} textAnchor="middle" fill="#fff" fontSize="8">{g.name}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settingout' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">GCP Setting Out</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Navigate to each GCP position and mark the physical target on the ground.
            </p>

            {gcps.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <p>No GCPs planned yet.</p>
                <p className="text-sm">Go to GCP Planning to generate points.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {gcps.filter(g => g.status !== 'measured').map((g, idx) => (
                  <div key={g.id} className="p-4 bg-[var(--bg-tertiary)] rounded flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-lg">{g.name}</div>
                      <div className="font-mono text-sm text-[var(--text-secondary)]">
                        E: {g.easting} m | N: {g.northing} m
                      </div>
                    </div>
                    <button 
                      onClick={() => updateGCP(g.id, 'status', 'measured')}
                      className="btn btn-secondary"
                    >
                      Navigate & Mark →
                    </button>
                  </div>
                ))}

                <div className="p-4 bg-green-900/30 border border-green-600 rounded">
                  <span className="text-green-400 font-semibold">
                    {gcps.filter(g => g.status === 'measured').length} / {gcps.length} GCPs measured
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'accuracy' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">Accuracy Check Points</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Enter independently surveyed coordinates and drone-computed coordinates to compare.
            </p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Point</th>
                    <th colSpan={3}>Survey (Ground Truth)</th>
                    <th colSpan={3}>Drone Computed</th>
                  </tr>
                  <tr>
                    <th>E (m)</th>
                    <th>N (m)</th>
                    <th>Z (m)</th>
                    <th>E (m)</th>
                    <th>N (m)</th>
                    <th>Z (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {accuracyPoints.map(p => (
                    <tr key={p.id}>
                      <td><input className="input w-16" value={p.name} onChange={e => updateAccuracyPoint(p.id, 'name', e.target.value)} /></td>
                      <td><input className="input w-28" value={p.surveyE} onChange={e => updateAccuracyPoint(p.id, 'surveyE', e.target.value)} /></td>
                      <td><input className="input w-28" value={p.surveyN} onChange={e => updateAccuracyPoint(p.id, 'surveyN', e.target.value)} /></td>
                      <td><input className="input w-24" value={p.surveyZ} onChange={e => updateAccuracyPoint(p.id, 'surveyZ', e.target.value)} /></td>
                      <td><input className="input w-28" value={p.droneE} onChange={e => updateAccuracyPoint(p.id, 'droneE', e.target.value)} /></td>
                      <td><input className="input w-28" value={p.droneN} onChange={e => updateAccuracyPoint(p.id, 'droneN', e.target.value)} /></td>
                      <td><input className="input w-24" value={p.droneZ} onChange={e => updateAccuracyPoint(p.id, 'droneZ', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex gap-4">
              <button onClick={addAccuracyPoint} className="btn btn-secondary">+ Add Point</button>
              <button onClick={calculateAccuracy} className="btn btn-primary">Calculate Accuracy</button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="label">Accuracy Standard</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {accuracyClasses.map(c => (
                <button
                  key={c.name}
                  onClick={() => { setSelectedClass(c); setAccuracyResults(null); }}
                  className={`px-4 py-2 rounded text-sm ${
                    selectedClass.name === c.name 
                      ? 'bg-[var(--accent)] text-white' 
                      : 'bg-[var(--bg-tertiary)]'
                  }`}
                >
                  {c.name} ({c.scale})
                </button>
              ))}
            </div>
            <div className="mt-4 text-sm text-[var(--text-secondary)]">
              <div>Horizontal limit: ≤ {selectedClass.horizontal} m</div>
              <div>Vertical limit: ≤ {selectedClass.vertical} m</div>
            </div>
          </div>

          {accuracyResults && (
            <div className="card">
              <div className="card-header">
                <span className="label">Accuracy Results</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Point</th>
                      <th>Survey E</th>
                      <th>Drone E</th>
                      <th>ΔE (m)</th>
                      <th>Survey N</th>
                      <th>Drone N</th>
                      <th>ΔN (m)</th>
                      <th>ΔZ (m)</th>
                      <th>Horiz. Error</th>
                      <th>3D Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accuracyResults.points.map((p: any, i: number) => (
                      <tr key={i}>
                        <td className="font-semibold">{p.name}</td>
                        <td className="font-mono">{formatNumber(p.se, 4)}</td>
                        <td className="font-mono">{formatNumber(p.de, 4)}</td>
                        <td className={Math.abs(p.dE) > selectedClass.horizontal ? 'text-red-400' : 'text-green-400'}>{formatNumber(p.dE, 4)}</td>
                        <td className="font-mono">{formatNumber(p.sn, 4)}</td>
                        <td className="font-mono">{formatNumber(p.dn, 4)}</td>
                        <td className={Math.abs(p.dN) > selectedClass.horizontal ? 'text-red-400' : 'text-green-400'}>{formatNumber(p.dN, 4)}</td>
                        <td className={Math.abs(p.dZ) > selectedClass.vertical ? 'text-red-400' : 'text-green-400'}>{formatNumber(p.dZ, 4)}</td>
                        <td className={p.horizontalError > selectedClass.horizontal ? 'text-red-400 font-semibold' : ''}>{formatNumber(p.horizontalError, 4)}</td>
                        <td className="font-mono">{formatNumber(p.error3D, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--bg-tertiary)] rounded">
                <div>
                  <span className="text-[var(--text-secondary)] text-sm">Horizontal RMSE</span>
                  <div className={`font-mono text-xl ${accuracyResults.horizontalPass ? 'text-green-400' : 'text-red-400'}`}>
                    {formatNumber(accuracyResults.hRMSE, 4)} m
                  </div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] text-sm">Vertical RMSE</span>
                  <div className={`font-mono text-xl ${accuracyResults.verticalPass ? 'text-green-400' : 'text-red-400'}`}>
                    {formatNumber(accuracyResults.vRMSE, 4)} m
                  </div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] text-sm">Max Horizontal</span>
                  <div className="font-mono text-xl">{formatNumber(accuracyResults.maxHorizontal, 4)} m</div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)] text-sm">Max 3D Error</span>
                  <div className="font-mono text-xl">{formatNumber(accuracyResults.max3D, 4)} m</div>
                </div>
              </div>

              <div className={`mt-4 p-4 rounded text-center text-lg font-semibold ${
                accuracyResults.pass ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
              }`}>
                {accuracyResults.pass ? '✓ PASS' : '✗ FAIL'} — {selectedClass.name} ({selectedClass.scale})
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'report' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">Drone Survey Report</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Generate a professional drone survey report with GCP list, accuracy check, and statistics.
            </p>

            <div className="space-y-4">
              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <h4 className="font-semibold mb-2">1. GCP Summary</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)]">Total GCPs:</span>
                    <span className="ml-2">{gcps.length || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Measured:</span>
                    <span className="ml-2">{gcps.filter(g => g.status === 'measured').length}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Planned:</span>
                    <span className="ml-2">{gcps.filter(g => g.status === 'planned').length}</span>
                  </div>
                </div>
              </div>

              {accuracyResults && (
                <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                  <h4 className="font-semibold mb-2">2. Accuracy Assessment</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-[var(--text-secondary)]">Accuracy Class:</span>
                      <span className="ml-2">{selectedClass.name} ({selectedClass.scale})</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Result:</span>
                      <span className={`ml-2 font-semibold ${accuracyResults.pass ? 'text-green-400' : 'text-red-400'}`}>
                        {accuracyResults.pass ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Horizontal RMSE:</span>
                      <span className="ml-2">{formatNumber(accuracyResults.hRMSE, 4)} m</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Vertical RMSE:</span>
                      <span className="ml-2">{formatNumber(accuracyResults.vRMSE, 4)} m</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-[var(--bg-tertiary)] rounded">
                <h4 className="font-semibold mb-2">3. Flight Parameters</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Flying Height (m)</label>
                    <input className="input" type="number" placeholder="120" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">GSD (cm/px)</label>
                    <input className="input" type="number" placeholder="3.0" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Overlap Front (%)</label>
                    <input className="input" type="number" placeholder="80" />
                  </div>
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1">Overlap Side (%)</label>
                    <input className="input" type="number" placeholder="70" />
                  </div>
                </div>
              </div>

              <button className="btn btn-primary w-full">Generate PDF Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
