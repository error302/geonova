'use client';

import { useState } from 'react';
import { cutFillVolumeFromSignedSections, volumeFromSections } from '@/lib/engine/volume';

interface InclinedLeg {
  id: number;
  fromStation: string;
  toStation: string;
  slopeDistance: string;
  verticalAngle: string;
  horizontalAngle: string;
}

interface VolumeSection {
  id: number;
  chainage: string;
  area: string;
}

interface SubsidencePoint {
  id: number;
  pointName: string;
  epoch1E: string;
  epoch1N: string;
  epoch1Z: string;
  epoch2E: string;
  epoch2N: string;
  epoch2Z: string;
}

interface BlastHole {
  row: number;
  hole: number;
  easting: number;
  northing: number;
}

function dmsToDecimal(dms: string): number {
  const match = dms.match(/^(\d+)[°d]\s*(\d+)?['m]?\s*(\d+(?:\.\d+)?)?["s]?$/i);
  if (!match) return parseFloat(dms) || 0;
  const deg = parseFloat(match[1]) || 0;
  const min = parseFloat(match[2]) || 0;
  const sec = parseFloat(match[3]) || 0;
  return deg + min / 60 + sec / 3600;
}

function decimalToDMS(decimal: number): string {
  const sign = decimal < 0 ? '-' : '';
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(3);
  return `${sign}${deg}°${min}'${sec}"`;
}

function formatNumber(n: number, decimals: number = 4): string {
  return n.toFixed(decimals);
}

export default function MiningSurveyPage() {
  const [activeTab, setActiveTab] = useState<'traverse' | 'volume' | 'subsidence' | 'blast'>('traverse');
  
  const [legs, setLegs] = useState<InclinedLeg[]>([
    { id: 1, fromStation: 'A', toStation: 'B', slopeDistance: '45.32', verticalAngle: '-15°30\'', horizontalAngle: '45°30\'' },
    { id: 2, fromStation: 'B', toStation: 'C', slopeDistance: '38.50', verticalAngle: '+8°45\'', horizontalAngle: '120°15\'' },
  ]);
  
  const [traverseResults, setTraverseResults] = useState<any>(null);
  
  const [volumeMethod, setVolumeMethod] = useState<'endArea' | 'prismoidal' | 'crossSection'>('endArea');
  const [volumeSections, setVolumeSections] = useState<VolumeSection[]>([
    { id: 1, chainage: '0', area: '25.5' },
    { id: 2, chainage: '50', area: '32.8' },
    { id: 3, chainage: '100', area: '28.4' },
  ]);
  const [volumeResult, setVolumeResult] = useState<any>(null);
  const [surfaceVolumeLoading, setSurfaceVolumeLoading] = useState(false);
  
  const [subsidencePoints, setSubsidencePoints] = useState<SubsidencePoint[]>([
    { id: 1, pointName: 'P1', epoch1E: '1000.000', epoch1N: '2000.000', epoch1Z: '50.000', epoch2E: '1000.003', epoch2N: '1999.998', epoch2Z: '49.991' },
  ]);
  const [subsidenceResults, setSubsidenceResults] = useState<any>(null);
  
  const [blastPattern, setBlastPattern] = useState({
    type: 'square',
    burden: '3.0',
    spacing: '3.5',
    startE: '5000.000',
    startN: '3000.000',
    rows: '4',
    holesPerRow: '5',
    bearing: '45°',
  });
  const [blastHoles, setBlastHoles] = useState<BlastHole[]>([]);

  const addLeg = () => {
    const lastLeg = legs[legs.length - 1];
    const nextChar = String.fromCharCode(lastLeg.toStation.charCodeAt(0) + 1);
    setLegs([...legs, { 
      id: Date.now(), 
      fromStation: lastLeg.toStation, 
      toStation: nextChar, 
      slopeDistance: '', 
      verticalAngle: '', 
      horizontalAngle: '' 
    }]);
  };

  const updateLeg = (id: number, field: keyof InclinedLeg, value: string) => {
    setLegs(legs.map((l: any) => l.id === id ? { ...l, [field]: value } : l));
  };

  const calculate3DTraverse = () => {
    const results = legs.map((leg, i) => {
      const SD = parseFloat(leg.slopeDistance);
      const VA = dmsToDecimal(leg.verticalAngle);
      const HA = dmsToDecimal(leg.horizontalAngle);
      
      if (isNaN(SD) || isNaN(VA) || isNaN(HA)) return null;
      
      const VA_rad = VA * Math.PI / 180;
      const HA_rad = HA * Math.PI / 180;
      
      const HD = SD * Math.cos(VA_rad);
      const VD = SD * Math.sin(VA_rad);
      
      const dE = HD * Math.sin(HA_rad);
      const dN = HD * Math.cos(HA_rad);
      const dZ = VD;
      
      return {
        leg: `${leg.fromStation}→${leg.toStation}`,
        SD,
        VA,
        HA,
        HD,
        VD,
        dE,
        dN,
        dZ,
      };
    }).filter(Boolean);

    const validResults = results.filter(Boolean);
    if (validResults.length < 2) return;

    const totalSD = validResults.reduce((sum: number, r: any) => sum + r.SD, 0);
    const closingE = validResults.reduce((sum: number, r: any) => sum + r.dE, 0);
    const closingN = validResults.reduce((sum: number, r: any) => sum + r.dN, 0);
    const closingZ = validResults.reduce((sum: number, r: any) => sum + r.dZ, 0);
    
    const linearMisclosure = Math.sqrt(closingE * closingE + closingN * closingN + closingZ * closingZ);
    const precisionRatio = totalSD / linearMisclosure;

    setTraverseResults({
      legs: validResults,
      totalSD,
      closingE,
      closingN,
      closingZ,
      linearMisclosure,
      precisionRatio,
    });
  };

  const addVolumeSection = () => {
    const last = volumeSections[volumeSections.length - 1];
    const nextChainage = parseFloat(last?.chainage || '0') + 50;
    setVolumeSections([...volumeSections, { id: Date.now(), chainage: String(nextChainage), area: '' }]);
  };

  const updateVolumeSection = (id: number, field: keyof VolumeSection, value: string) => {
    setVolumeSections(volumeSections.map((s: any) => s.id === id ? { ...s, [field]: value } : s));
  };

  const calculateVolume = () => {
    const sections = volumeSections
      .map((s: any) => ({ chainage: parseFloat(s.chainage), area: parseFloat(s.area) }))
      .filter((s: any) => !isNaN(s.chainage) && !isNaN(s.area))
      .sort((a: any, b: any) => a.chainage - b.chainage);

    if (sections.length < 2) return;

    if (volumeMethod === 'endArea') {
      const r = volumeFromSections(sections, 'end_area');
      setVolumeResult({ totalVolume: r.totalVolume, details: r.segments, method: volumeMethod });
      return;
    }

    if (volumeMethod === 'prismoidal') {
      const r = volumeFromSections(sections, 'prismoidal');
      setVolumeResult({ totalVolume: r.totalVolume, details: r.segments, method: volumeMethod });
      return;
    }

    const r = cutFillVolumeFromSignedSections(sections);
    setVolumeResult({ totalVolume: r.netVolume, cutVolume: r.cutVolume, fillVolume: r.fillVolume, details: r.segments, method: 'crossSection' });
  };

  const addSubsidencePoint = () => {
    const last = subsidencePoints[subsidencePoints.length - 1];
    const num = parseInt(last?.pointName?.replace(/\D/g, '') || '0') + 1;
    setSubsidencePoints([...subsidencePoints, { 
      id: Date.now(), 
      pointName: `P${num}`, 
      epoch1E: '', epoch1N: '', epoch1Z: '', 
      epoch2E: '', epoch2N: '', epoch2Z: '' 
    }]);
  };

  const updateSubsidencePoint = (id: number, field: keyof SubsidencePoint, value: string) => {
    setSubsidencePoints(subsidencePoints.map((p: any) => p.id === id ? { ...p, [field]: value } : p));
  };

  const calculateSubsidence = () => {
    const results = subsidencePoints.map((p: any) => {
      const e1 = parseFloat(p.epoch1E);
      const n1 = parseFloat(p.epoch1N);
      const z1 = parseFloat(p.epoch1Z);
      const e2 = parseFloat(p.epoch2E);
      const n2 = parseFloat(p.epoch2N);
      const z2 = parseFloat(p.epoch2Z);
      
      if (isNaN(e1) || isNaN(n1) || isNaN(z1) || isNaN(e2) || isNaN(n2) || isNaN(z2)) return null;
      
      const dE = e2 - e1;
      const dN = n2 - n1;
      const dZ = z2 - z1;
      const movement3D = Math.sqrt(dE * dE + dN * dN + dZ * dZ);
      
      return { pointName: p.pointName, e1, n1, z1, e2, n2, z2, dE, dN, dZ, movement3D };
    }).filter(Boolean);

    if (results.length === 0) return;

    const avgMovement = results.reduce((sum, r: any) => sum + r.movement3D, 0) / results.length;
    const maxMovement = Math.max(...results.map((r: any) => r.movement3D));

    setSubsidenceResults({ points: results, avgMovement, maxMovement });
  };

  const generateBlastPattern = () => {
    const burden = parseFloat(blastPattern.burden);
    const spacing = parseFloat(blastPattern.spacing);
    const startE = parseFloat(blastPattern.startE);
    const startN = parseFloat(blastPattern.startN);
    const rows = parseInt(blastPattern.rows);
    const holesPerRow = parseInt(blastPattern.holesPerRow);
    const bearing = dmsToDecimal(blastPattern.bearing);
    const bearingRad = bearing * Math.PI / 180;

    const cosB = Math.cos(bearingRad);
    const sinB = Math.sin(bearingRad);

    const holes: BlastHole[] = [];
    
    for (let r = 0; r < rows; r++) {
      const rowOffset = blastPattern.type === 'staggered' ? (r % 2) * (spacing / 2) : 0;
      for (let h = 0; h < holesPerRow; h++) {
        const e = startE + r * burden * cosB + (h * spacing + rowOffset) * sinB;
        const n = startN + r * burden * sinB - (h * spacing + rowOffset) * cosB;
        holes.push({ row: r + 1, hole: h + 1, easting: e, northing: n });
      }
    }

    setBlastHoles(holes);
  };

  const exportBlastCSV = () => {
    const csv = 'Row,Hole,Easting,Northing\n' + 
      blastHoles.map((h: any) => `${h.row},${h.hole},${h.easting.toFixed(4)},${h.northing.toFixed(4)}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blast_holes.csv';
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">⛏ Mining Survey Tools</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Underground survey, volume calculations, and blast hole layout</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'traverse', label: '3D Traverse' },
          { id: 'volume', label: 'Volume' },
          { id: 'subsidence', label: 'Subsidence' },
          { id: 'blast', label: 'Blast Holes' },
        ].map((tab: any) => (
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

      {activeTab === 'traverse' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">3D Inclined Traverse — Underground Survey</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              For underground surveys where legs are inclined. Enter slope distance, vertical angle, and horizontal angle.
            </p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Slope Dist (m)</th>
                    <th>Vert. Angle</th>
                    <th>Horiz. Angle</th>
                  </tr>
                </thead>
                <tbody>
                  {legs.map((leg: any) => (
                    <tr key={leg.id}>
                      <td><input className="input w-20" value={leg.fromStation} onChange={e => updateLeg(leg.id, 'fromStation', e.target.value)} /></td>
                      <td><input className="input w-20" value={leg.toStation} onChange={e => updateLeg(leg.id, 'toStation', e.target.value)} /></td>
                      <td><input className="input w-28" value={leg.slopeDistance} onChange={e => updateLeg(leg.id, 'slopeDistance', e.target.value)} placeholder="m" /></td>
                      <td><input className="input w-28" value={leg.verticalAngle} onChange={e => updateLeg(leg.id, 'verticalAngle', e.target.value)} placeholder="e.g. -15°30'" /></td>
                      <td><input className="input w-28" value={leg.horizontalAngle} onChange={e => updateLeg(leg.id, 'horizontalAngle', e.target.value)} placeholder="e.g. 45°30'" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex gap-4">
              <button onClick={addLeg} className="btn btn-secondary">+ Add Leg</button>
              <button onClick={calculate3DTraverse} className="btn btn-primary">Calculate 3D Traverse</button>
            </div>
          </div>

          {traverseResults && (
            <div className="card">
              <div className="card-header">
                <span className="label">Results</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Leg</th>
                      <th>SD (m)</th>
                      <th>Vert. Angle</th>
                      <th>HD (m)</th>
                      <th>VD (m)</th>
                      <th>ΔE (m)</th>
                      <th>ΔN (m)</th>
                      <th>ΔZ (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traverseResults.legs.map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="font-semibold">{r.leg}</td>
                        <td>{formatNumber(r.SD, 3)}</td>
                        <td>{decimalToDMS(r.VA)}</td>
                        <td>{formatNumber(r.HD, 3)}</td>
                        <td>{formatNumber(r.VD, 3)}</td>
                        <td>{formatNumber(r.dE, 3)}</td>
                        <td>{formatNumber(r.dN, 3)}</td>
                        <td>{formatNumber(r.dZ, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded">
                <h4 className="font-semibold mb-2">3D Misclosure</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)]">Total SD:</span>
                    <div className="font-mono">{formatNumber(traverseResults.totalSD, 3)} m</div>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">ΔE:</span>
                    <div className="font-mono">{formatNumber(traverseResults.closingE, 4)} m</div>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">ΔN:</span>
                    <div className="font-mono">{formatNumber(traverseResults.closingN, 4)} m</div>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">ΔZ:</span>
                    <div className="font-mono">{formatNumber(traverseResults.closingZ, 4)} m</div>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">3D Precision:</span>
                    <div className="font-mono">1 : {formatNumber(traverseResults.precisionRatio, 0)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'volume' && (
        <div className="space-y-6">
          <div className="flex gap-2 mb-4">
            {[
              { id: 'endArea', label: 'End Area' },
              { id: 'prismoidal', label: 'Prismoidal' },
              { id: 'crossSection', label: 'Cut/Fill' },
            ].map((m: any) => (
              <button
                key={m.id}
                onClick={() => { setVolumeMethod(m.id as any); setVolumeResult(null); }}
                className={`px-4 py-2 rounded text-sm ${
                  volumeMethod === m.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card-bg)]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="label">
                {volumeMethod === 'endArea' && 'End Area Method: V = L/2 × (A₁ + A₂)'}
                {volumeMethod === 'prismoidal' && 'Prismoidal Formula: V = L/6 × (A₁ + 4Am + A₂)'}
                {volumeMethod === 'crossSection' && 'Cross Section Method (Cut/Fill)'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Chainage (m)</th>
                    <th>Area (m²)</th>
                  </tr>
                </thead>
                <tbody>
                  {volumeSections.map((s: any) => (
                    <tr key={s.id}>
                      <td><input className="input w-32" value={s.chainage} onChange={e => updateVolumeSection(s.id, 'chainage', e.target.value)} /></td>
                      <td><input className="input w-32" value={s.area} onChange={e => updateVolumeSection(s.id, 'area', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex gap-4">
              <button onClick={addVolumeSection} className="btn btn-secondary">+ Add Section</button>
              <button onClick={calculateVolume} className="btn btn-primary">Calculate Volume</button>
            </div>
          </div>

          {volumeResult && (
            <div className="card">
              <div className="card-header">
                <span className="label">Volume Results</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>From (m)</th>
                      <th>To (m)</th>
                      <th>A₁ (m²)</th>
                      {volumeMethod === 'prismoidal' && <th>Am (m²)</th>}
                      <th>A₂ (m²)</th>
                      <th>Length (m)</th>
                      <th>Volume (m³)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volumeResult.details.map((d: any, i: number) => (
                      <tr key={i}>
                        <td>{d.from}</td>
                        <td>{d.to}</td>
                        <td>{formatNumber(d.A1, 2)}</td>
                        {volumeMethod === 'prismoidal' && <td>{formatNumber(d.Am, 2)}</td>}
                        <td>{formatNumber(d.A2, 2)}</td>
                        <td>{formatNumber(d.L, 2)}</td>
                        <td>{formatNumber(d.volume, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded">
                {volumeResult.method === 'crossSection' ? (
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--text-secondary)]">Cut Volume:</span>
                      <div className="font-mono text-green-400">{formatNumber(volumeResult.cutVolume, 2)} m³</div>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Fill Volume:</span>
                      <div className="font-mono text-red-400">{formatNumber(volumeResult.fillVolume, 2)} m³</div>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)]">Net Volume:</span>
                      <div className="font-mono">{formatNumber(volumeResult.totalVolume, 2)} m³</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-[var(--text-secondary)]">Total Volume:</span>
                    <div className="font-mono text-xl">{formatNumber(volumeResult.totalVolume, 2)} m³</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'volume' && volumeResult?.pythonSurface && (
        <div className="card mb-6">
          <div className="card-header flex items-center justify-between">
            <span className="label">Surface Cut/Fill (Python Engine)</span>
            <span className="text-xs text-green-400 border border-green-500/20 bg-green-500/10 px-2 py-0.5 rounded">Python engine</span>
          </div>
          <div className="card-body grid grid-cols-3 gap-4">
            <div className="metric">
              <div className="metric-label">Cut volume</div>
              <div className="metric-value">{volumeResult.cutVolume?.toFixed(2)} m³</div>
            </div>
            <div className="metric">
              <div className="metric-label">Fill volume</div>
              <div className="metric-value">{volumeResult.fillVolume?.toFixed(2)} m³</div>
            </div>
            <div className="metric">
              <div className="metric-label">Net volume</div>
              <div className={`metric-value ${volumeResult.netVolume > 0 ? 'result-accent' : 'result-negative'}`}>
                {volumeResult.netVolume?.toFixed(2)} m³
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subsidence' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">Subsidence Monitoring — Movement Between Epochs</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Track point movement over time for subsidence monitoring. Enter coordinates from two survey epochs.
            </p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Point</th>
                    <th colSpan={3}>Epoch 1</th>
                    <th colSpan={3}>Epoch 2</th>
                  </tr>
                  <tr>
                    <th>Name</th>
                    <th>E (m)</th>
                    <th>N (m)</th>
                    <th>Z (m)</th>
                    <th>E (m)</th>
                    <th>N (m)</th>
                    <th>Z (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {subsidencePoints.map((p: any) => (
                    <tr key={p.id}>
                      <td><input className="input w-16" value={p.pointName} onChange={e => updateSubsidencePoint(p.id, 'pointName', e.target.value)} /></td>
                      <td><input className="input w-24" value={p.epoch1E} onChange={e => updateSubsidencePoint(p.id, 'epoch1E', e.target.value)} /></td>
                      <td><input className="input w-24" value={p.epoch1N} onChange={e => updateSubsidencePoint(p.id, 'epoch1N', e.target.value)} /></td>
                      <td><input className="input w-24" value={p.epoch1Z} onChange={e => updateSubsidencePoint(p.id, 'epoch1Z', e.target.value)} /></td>
                      <td><input className="input w-24" value={p.epoch2E} onChange={e => updateSubsidencePoint(p.id, 'epoch2E', e.target.value)} /></td>
                      <td><input className="input w-24" value={p.epoch2N} onChange={e => updateSubsidencePoint(p.id, 'epoch2N', e.target.value)} /></td>
                      <td><input className="input w-24" value={p.epoch2Z} onChange={e => updateSubsidencePoint(p.id, 'epoch2Z', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex gap-4">
              <button onClick={addSubsidencePoint} className="btn btn-secondary">+ Add Point</button>
              <button onClick={calculateSubsidence} className="btn btn-primary">Calculate Movement</button>
            </div>
          </div>

          {subsidenceResults && (
            <div className="card">
              <div className="card-header">
                <span className="label">Movement Results</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Point</th>
                      <th>Epoch 1 E</th>
                      <th>Epoch 1 N</th>
                      <th>Epoch 1 Z</th>
                      <th>Epoch 2 E</th>
                      <th>Epoch 2 N</th>
                      <th>Epoch 2 Z</th>
                      <th>ΔE (m)</th>
                      <th>ΔN (m)</th>
                      <th>ΔZ (m)</th>
                      <th>3D Movement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subsidenceResults.points.map((p: any, i: number) => (
                      <tr key={i}>
                        <td className="font-semibold">{p.pointName}</td>
                        <td>{formatNumber(p.e1, 4)}</td>
                        <td>{formatNumber(p.n1, 4)}</td>
                        <td>{formatNumber(p.z1, 4)}</td>
                        <td>{formatNumber(p.e2, 4)}</td>
                        <td>{formatNumber(p.n2, 4)}</td>
                        <td>{formatNumber(p.z2, 4)}</td>
                        <td className={p.dE > 0 ? 'text-green-400' : p.dE < 0 ? 'text-red-400' : ''}>{formatNumber(p.dE, 4)}</td>
                        <td className={p.dN > 0 ? 'text-green-400' : p.dN < 0 ? 'text-red-400' : ''}>{formatNumber(p.dN, 4)}</td>
                        <td className={p.dZ > 0 ? 'text-green-400' : p.dZ < 0 ? 'text-red-400' : ''}>{formatNumber(p.dZ, 4)}</td>
                        <td className="font-mono font-semibold">{formatNumber(p.movement3D, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-secondary)]">Average Movement:</span>
                    <div className="font-mono">{formatNumber(subsidenceResults.avgMovement, 4)} m</div>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)]">Maximum Movement:</span>
                    <div className="font-mono">{formatNumber(subsidenceResults.maxMovement, 4)} m</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'blast' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">Blast Hole Pattern Generator</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Pattern Type</label>
                <select 
                  className="input"
                  value={blastPattern.type}
                  onChange={e => setBlastPattern({...blastPattern, type: e.target.value})}
                >
                  <option value="square">Square</option>
                  <option value="staggered">Staggered</option>
                  <option value="triangular">Triangular</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Burden (m)</label>
                <input 
                  className="input" 
                  type="number" 
                  value={blastPattern.burden}
                  onChange={e => setBlastPattern({...blastPattern, burden: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Spacing (m)</label>
                <input 
                  className="input" 
                  type="number" 
                  value={blastPattern.spacing}
                  onChange={e => setBlastPattern({...blastPattern, spacing: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Pattern Bearing</label>
                <input 
                  className="input" 
                  value={blastPattern.bearing}
                  onChange={e => setBlastPattern({...blastPattern, bearing: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Start Easting</label>
                <input 
                  className="input" 
                  type="number"
                  value={blastPattern.startE}
                  onChange={e => setBlastPattern({...blastPattern, startE: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Start Northing</label>
                <input 
                  className="input" 
                  type="number"
                  value={blastPattern.startN}
                  onChange={e => setBlastPattern({...blastPattern, startN: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Number of Rows</label>
                <input 
                  className="input" 
                  type="number"
                  value={blastPattern.rows}
                  onChange={e => setBlastPattern({...blastPattern, rows: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Holes per Row</label>
                <input 
                  className="input" 
                  type="number"
                  value={blastPattern.holesPerRow}
                  onChange={e => setBlastPattern({...blastPattern, holesPerRow: e.target.value})}
                />
              </div>
            </div>
            <button onClick={generateBlastPattern} className="btn btn-primary">Generate Pattern</button>
          </div>

          {blastHoles.length > 0 && (
            <div className="card">
              <div className="card-header flex justify-between items-center">
                <span className="label">Blast Hole Coordinates ({blastHoles.length} holes)</span>
                <button onClick={exportBlastCSV} className="btn btn-secondary text-sm">Export CSV</button>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Hole</th>
                      <th>Easting (m)</th>
                      <th>Northing (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blastHoles.map((h, i) => (
                      <tr key={i}>
                        <td>{h.row}</td>
                        <td>{h.hole}</td>
                        <td className="font-mono">{formatNumber(h.easting, 4)}</td>
                        <td className="font-mono">{formatNumber(h.northing, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
