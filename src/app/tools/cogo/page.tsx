'use client';

import { useState } from 'react';
import { radiation, bearingIntersection, tienstraResection } from '@/lib/engine/cogo';
import { distanceBearing } from '@/lib/engine/distance';
import { dmsToDecimal, decimalToDMS } from '@/lib/engine/angles';

type COGOMode = 'radiation' | 'forward-intersection' | 'backward-intersection' | 'missing-line' | 'side-shot';

interface DMSInput {
  d: string;
  m: string;
  s: string;
}

export default function COGOCalculator() {
  const [mode, setMode] = useState<COGOMode>('radiation');
  const [input, setInput] = useState({
    // Radiation
    radStationN: '500000.0000',
    radStationE: '300000.0000',
    radBearing: { d: '45', m: '30', s: '0' } as DMSInput,
    radDistance: '150.000',
    radPointName: 'P1',
    
    // Forward Intersection
    fwdAN: '500000.0000',
    fwdAE: '300000.0000',
    fwdBearingA: { d: '30', m: '0', s: '0' } as DMSInput,
    fwdBN: '500100.0000',
    fwdBE: '300100.0000',
    fwdBearingB: { d: '120', m: '0', s: '0' } as DMSInput,
    fwdPointName: 'P',
    
    // Backward Intersection
    bwdP1N: '500000.0000',
    bwdP1E: '300000.0000',
    bwdP2N: '500100.0000',
    bwdP2E: '300000.0000',
    bwdP3N: '500050.0000',
    bwdP3E: '300100.0000',
    bwdAngle1: { d: '45', m: '0', s: '0' } as DMSInput,
    bwdAngle2: { d: '60', m: '0', s: '0' } as DMSInput,
    bwdPointName: 'STN1',
    
    // Missing Line
    missAN: '500000.0000',
    missAE: '300000.0000',
    missBN: '500100.0000',
    missBE: '300100.0000',

    // Side Shot
    ssAN: '500000.0000',
    ssAE: '300000.0000',
    ssBN: '500100.0000',
    ssBE: '300100.0000',
    ssChainage: '50.000',
    ssOffset: '25.000',
    ssDirection: 'Left'
  });
  const [result, setResult] = useState<any>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const dmsToDecimalDeg = (dms: DMSInput): number => {
    const d = parseFloat(dms.d) || 0;
    const m = parseFloat(dms.m) || 0;
    const s = parseFloat(dms.s) || 0;
    return dmsToDecimal({ degrees: d, minutes: m, seconds: s, direction: 'N' });
  };

  const calculate = () => {
    setWarnings([]);
    try {
      if (mode === 'radiation') {
        const from = { northing: parseFloat(input.radStationN), easting: parseFloat(input.radStationE) };
        const bearing = dmsToDecimalDeg(input.radBearing);
        const dist = parseFloat(input.radDistance);
        if (isNaN(from.northing) || isNaN(bearing) || isNaN(dist)) return;
        
        const r = radiation(from, bearing, dist);
        setResult({
          type: 'radiation',
          pointName: input.radPointName,
          point: r.point,
          distance: dist,
          bearing: bearing,
          bearingDMS: decimalToDMS(bearing, false)
        });
        
      } else if (mode === 'forward-intersection') {
        const stA = { northing: parseFloat(input.fwdAN), easting: parseFloat(input.fwdAE) };
        const stB = { northing: parseFloat(input.fwdBN), easting: parseFloat(input.fwdBE) };
        const bearA = dmsToDecimalDeg(input.fwdBearingA);
        const bearB = dmsToDecimalDeg(input.fwdBearingB);
        
        if (isNaN(stA.northing) || isNaN(stB.northing) || isNaN(bearA) || isNaN(bearB)) return;
        
        const r = bearingIntersection(stA, bearA, stB, bearB);
        if (r) {
          const distA = r.distanceFromA;
          const distB = r.distanceFromB;
          
          // Check for weak triangle
          const newWarnings: string[] = [];
          const angleA = Math.abs(180 - Math.abs(bearB - bearA));
          if (angleA < 15 || angleA > 165) {
            newWarnings.push(`⚠ Weak triangle: intersection angle is ${angleA.toFixed(1)}° (should be >15° and <165°)`);
          }
          if (Math.abs(distA - distB) < 0.01) {
            newWarnings.push('⚠ Warning: Point P is approximately equidistant from A and B');
          }
          setWarnings(newWarnings);
          
          // Calculate angles at A and B
          const db = distanceBearing(stA, stB);
          const angleAPB = Math.acos((distA * distA + db.distance * db.distance - distB * distB) / (2 * distA * db.distance)) * 180 / Math.PI;
          const angleBPA = Math.acos((distB * distB + db.distance * db.distance - distA * distA) / (2 * distB * db.distance)) * 180 / Math.PI;
          
          setResult({
            type: 'forward-intersection',
            pointName: input.fwdPointName,
            point: r.point,
            distA,
            distB,
            angleA: angleAPB,
            angleB: angleBPA,
            formula: `E_P = E_A + AP × sin(θ_A), N_P = N_A + AP × cos(θ_A)`
          });
        }
        
      } else if (mode === 'backward-intersection') {
        const p1 = { northing: parseFloat(input.bwdP1N), easting: parseFloat(input.bwdP1E) };
        const p2 = { northing: parseFloat(input.bwdP2N), easting: parseFloat(input.bwdP2E) };
        const p3 = { northing: parseFloat(input.bwdP3N), easting: parseFloat(input.bwdP3E) };
        const ang1 = dmsToDecimalDeg(input.bwdAngle1);
        const ang2 = dmsToDecimalDeg(input.bwdAngle2);
        
        if (isNaN(p1.northing) || isNaN(ang1) || isNaN(ang2)) return;
        
        const r = tienstraResection(p1, p2, p3, ang1, ang2);
        if (r) {
          // Check danger circle
          const newWarnings: string[] = [];
          const d12 = distanceBearing(p1, p2).distance;
          const d13 = distanceBearing(p1, p3).distance;
          const d23 = distanceBearing(p2, p3).distance;
          const circumRadius = (d12 * d13 * d23) / (4 * 0.5 * Math.abs((p2.easting - p1.easting) * (p3.northing - p1.northing) - (p3.easting - p1.easting) * (p2.northing - p1.northing)));
          const distToCenter = Math.sqrt((r.point.easting - (p1.easting + p2.easting + p3.easting) / 3) ** 2 + (r.point.northing - (p1.northing + p2.northing + p3.northing) / 3) ** 2);
          
          if (circumRadius > 0 && distToCenter > circumRadius * 0.9) {
            newWarnings.push('⚠ DANGER: Point P is near the danger circle (circumcircle of triangle)');
          }
          if (ang1 + ang2 > 180) {
            newWarnings.push('⚠ Warning: Sum of angles exceeds 180° - check measurement');
          }
          setWarnings(newWarnings);
          
          // Calculate bearings to control points
          const bearingToP1 = distanceBearing(r.point, p1);
          const bearingToP2 = distanceBearing(r.point, p2);
          const bearingToP3 = distanceBearing(r.point, p3);
          
          setResult({
            type: 'backward-intersection',
            pointName: input.bwdPointName,
            point: r.point,
            d1: r.distanceToP1,
            d2: r.distanceToP2,
            d3: r.distanceToP3,
            bearingToP1: bearingToP1.bearingDMS,
            bearingToP2: bearingToP2.bearingDMS,
            bearingToP3: bearingToP3.bearingDMS
          });
        }
        
      } else if (mode === 'missing-line') {
        const ptA = { northing: parseFloat(input.missAN), easting: parseFloat(input.missAE) };
        const ptB = { northing: parseFloat(input.missBN), easting: parseFloat(input.missBE) };
        if (isNaN(ptA.northing) || isNaN(ptB.northing)) return;
        
        const r = distanceBearing(ptA, ptB);
        setResult({ 
          type: 'missing-line', 
          distance: r.distance, 
          bearing: r.bearing,
          bearingDMS: r.bearingDMS,
          backBearing: r.backBearing,
          backBearingDMS: r.backBearingDMS,
          deltaE: r.deltaE,
          deltaN: r.deltaN
        });

      } else if (mode === 'side-shot') {
        const A = { northing: parseFloat(input.ssAN), easting: parseFloat(input.ssAE) };
        const B = { northing: parseFloat(input.ssBN), easting: parseFloat(input.ssBE) };
        const chainage = parseFloat(input.ssChainage);
        const offset = parseFloat(input.ssOffset);
        const direction = input.ssDirection as 'Left' | 'Right';
        
        if (isNaN(A.northing) || isNaN(B.northing) || isNaN(chainage) || isNaN(offset)) return;
        
        const lineAB = distanceBearing(A, B);
        const bearingAB = lineAB.bearing * Math.PI / 180;
        
        const chainagePoint = {
          easting: A.easting + chainage * Math.sin(bearingAB),
          northing: A.northing + chainage * Math.cos(bearingAB)
        };
        
        const perpBearing = direction === 'Left' ? bearingAB - Math.PI / 2 : bearingAB + Math.PI / 2;
        
        const offsetPoint = {
          easting: chainagePoint.easting + offset * Math.sin(perpBearing),
          northing: chainagePoint.northing + offset * Math.cos(perpBearing)
        };
        
        const offsetBearing = distanceBearing(chainagePoint, offsetPoint);
        
        setResult({
          type: 'side-shot',
          point: offsetPoint,
          chainage: chainage,
          offset: offset,
          offsetDirection: direction,
          bearingAB: lineAB.bearingDMS,
          bearingABDeg: lineAB.bearing,
          offsetBearing: offsetBearing.bearingDMS,
          chainagePoint: chainagePoint,
          formula: 'P = A + chainage×sin(θ_AB), Offset = ±90° from AB'
        });
      }
    } catch (e) {
      setResult({ error: 'Calculation error - check inputs' });
    }
  };

  const renderDMSInput = (value: DMSInput, onChange: (v: DMSInput) => void, label: string) => (
    <div>
      <label className="label">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        <input className="input" value={value.d} onChange={e => onChange({...value, d: e.target.value})} placeholder="000" />
        <input className="input" value={value.m} onChange={e => onChange({...value, m: e.target.value})} placeholder="00" />
        <input className="input" value={value.s} onChange={e => onChange({...value, s: e.target.value})} placeholder="00.000" />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-[var(--text-muted)] mt-1">
        <span className="text-center">DEG</span>
        <span className="text-center">MIN</span>
        <span className="text-center">SEC</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">COGO Tools</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Coordinate Geometry calculations</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => { setMode('radiation'); setResult(null); setWarnings([]); }} className={`px-4 py-2 rounded-lg font-medium ${mode === 'radiation' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Radiation</button>
        <button onClick={() => { setMode('forward-intersection'); setResult(null); setWarnings([]); }} className={`px-4 py-2 rounded-lg font-medium ${mode === 'forward-intersection' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Forward Intersection</button>
        <button onClick={() => { setMode('backward-intersection'); setResult(null); setWarnings([]); }} className={`px-4 py-2 rounded-lg font-medium ${mode === 'backward-intersection' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Backward Intersection</button>
        <button onClick={() => { setMode('missing-line'); setResult(null); setWarnings([]); }} className={`px-4 py-2 rounded-lg font-medium ${mode === 'missing-line' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Missing Line</button>
        <button onClick={() => { setMode('side-shot'); setResult(null); setWarnings([]); }} className={`px-4 py-2 rounded-lg font-medium ${mode === 'side-shot' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Side Shot</button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-6">
            <div className="mb-4">
              <span className="font-semibold text-[var(--text-primary)]">
                {mode === 'radiation' ? 'Instrument Station → New Point' : 
                 mode === 'forward-intersection' ? 'Two Known Points + Bearings → Unknown Point' :
                 mode === 'backward-intersection' ? 'Unknown Station → Three Known Points' :
                 mode === 'missing-line' ? 'Missing Line' :
                 'Side Shot / Offset'}
              </span>
            </div>
            <div className="space-y-4">
              {mode === 'radiation' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">Station Northing</label><input className="input" value={input.radStationN} onChange={e => setInput({...input, radStationN: e.target.value})} /></div>
                    <div><label className="label">Station Easting</label><input className="input" value={input.radStationE} onChange={e => setInput({...input, radStationE: e.target.value})} /></div>
                  </div>
                  {renderDMSInput(input.radBearing, v => setInput({...input, radBearing: v}), 'Bearing to Point')}
                  <div><label className="label">Distance (m)</label><input className="input" value={input.radDistance} onChange={e => setInput({...input, radDistance: e.target.value})} /></div>
                  <div><label className="label">Point Name</label><input className="input" value={input.radPointName} onChange={e => setInput({...input, radPointName: e.target.value})} /></div>
                </>
              )}
              
              {mode === 'forward-intersection' && (
                <>
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Point A (known)</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">A Northing</label><input className="input" value={input.fwdAN} onChange={e => setInput({...input, fwdAN: e.target.value})} /></div>
                    <div><label className="label">A Easting</label><input className="input" value={input.fwdAE} onChange={e => setInput({...input, fwdAE: e.target.value})} /></div>
                  </div>
                  {renderDMSInput(input.fwdBearingA, v => setInput({...input, fwdBearingA: v}), 'Bearing A → P')}
                  
                  <div className="text-sm text-[var(--text-secondary)] mb-2 mt-4">Point B (known)</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">B Northing</label><input className="input" value={input.fwdBN} onChange={e => setInput({...input, fwdBN: e.target.value})} /></div>
                    <div><label className="label">B Easting</label><input className="input" value={input.fwdBE} onChange={e => setInput({...input, fwdBE: e.target.value})} /></div>
                  </div>
                  {renderDMSInput(input.fwdBearingB, v => setInput({...input, fwdBearingB: v}), 'Bearing B → P')}
                  
                  <div><label className="label">Unknown Point Name</label><input className="input" value={input.fwdPointName} onChange={e => setInput({...input, fwdPointName: e.target.value})} /></div>
                </>
              )}
              
              {mode === 'backward-intersection' && (
                <>
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Control Point A</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">A Northing</label><input className="input" value={input.bwdP1N} onChange={e => setInput({...input, bwdP1N: e.target.value})} /></div>
                    <div><label className="label">A Easting</label><input className="input" value={input.bwdP1E} onChange={e => setInput({...input, bwdP1E: e.target.value})} /></div>
                  </div>
                  
                  <div className="text-sm text-[var(--text-secondary)] mb-2 mt-4">Control Point B</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">B Northing</label><input className="input" value={input.bwdP2N} onChange={e => setInput({...input, bwdP2N: e.target.value})} /></div>
                    <div><label className="label">B Easting</label><input className="input" value={input.bwdP2E} onChange={e => setInput({...input, bwdP2E: e.target.value})} /></div>
                  </div>
                  
                  <div className="text-sm text-[var(--text-secondary)] mb-2 mt-4">Control Point C</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">C Northing</label><input className="input" value={input.bwdP3N} onChange={e => setInput({...input, bwdP3N: e.target.value})} /></div>
                    <div><label className="label">C Easting</label><input className="input" value={input.bwdP3E} onChange={e => setInput({...input, bwdP3E: e.target.value})} /></div>
                  </div>
                  
                  <div className="text-sm text-[var(--text-secondary)] mb-2 mt-4">Measured Angles</div>
                  {renderDMSInput(input.bwdAngle1, v => setInput({...input, bwdAngle1: v}), 'Angle APB')}
                  {renderDMSInput(input.bwdAngle2, v => setInput({...input, bwdAngle2: v}), 'Angle BPC')}
                  
                  <div><label className="label">Unknown Station Name</label><input className="input" value={input.bwdPointName} onChange={e => setInput({...input, bwdPointName: e.target.value})} /></div>
                </>
              )}
              
              {mode === 'missing-line' && (
                <>
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Point A → Point B</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">A Northing</label><input className="input" value={input.missAN} onChange={e => setInput({...input, missAN: e.target.value})} placeholder="500000.0000" /></div>
                    <div><label className="label">A Easting</label><input className="input" value={input.missAE} onChange={e => setInput({...input, missAE: e.target.value})} placeholder="300000.0000" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">B Northing</label><input className="input" value={input.missBN} onChange={e => setInput({...input, missBN: e.target.value})} placeholder="500100.0000" /></div>
                    <div><label className="label">B Easting</label><input className="input" value={input.missBE} onChange={e => setInput({...input, missBE: e.target.value})} placeholder="300100.0000" /></div>
                  </div>
                </>
              )}

              {mode === 'side-shot' && (
                <>
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Line Start A</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">A Northing</label><input className="input" value={input.ssAN} onChange={e => setInput({...input, ssAN: e.target.value})} placeholder="500000.0000" /></div>
                    <div><label className="label">A Easting</label><input className="input" value={input.ssAE} onChange={e => setInput({...input, ssAE: e.target.value})} placeholder="300000.0000" /></div>
                  </div>
                  
                  <div className="text-sm text-[var(--text-secondary)] mb-2 mt-4">Line End B</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="label">B Northing</label><input className="input" value={input.ssBN} onChange={e => setInput({...input, ssBN: e.target.value})} placeholder="500100.0000" /></div>
                    <div><label className="label">B Easting</label><input className="input" value={input.ssBE} onChange={e => setInput({...input, ssBE: e.target.value})} placeholder="300100.0000" /></div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div><label className="label">Chainage along AB (m)</label><input className="input" value={input.ssChainage} onChange={e => setInput({...input, ssChainage: e.target.value})} placeholder="50.000" /></div>
                    <div><label className="label">Offset Distance (m)</label><input className="input" value={input.ssOffset} onChange={e => setInput({...input, ssOffset: e.target.value})} placeholder="25.000" /></div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="label">Offset Direction</label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="ssDirection" checked={input.ssDirection === 'Left'} onChange={() => setInput({...input, ssDirection: 'Left'})} className="w-4 h-4 accent-[#E8841A]" />
                        <span className="text-[var(--text-primary)]">Left</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="ssDirection" checked={input.ssDirection === 'Right'} onChange={() => setInput({...input, ssDirection: 'Right'})} className="w-4 h-4 accent-[#E8841A]" />
                        <span className="text-[var(--text-primary)]">Right</span>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <button onClick={calculate} className="w-full px-6 py-4 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-bold rounded-lg">Calculate</button>
        </div>

        {result && !result.error && (
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-6">
            <div className="mb-4"><span className="font-semibold text-[var(--text-primary)]">Results</span></div>
            <div className="space-y-3">
              {result.type === 'radiation' && (
                <>
                  <ResultRow label="Point Name" value={result.pointName} />
                  <ResultRow label="Easting" value={`${result.point.easting.toFixed(4)} m`} />
                  <ResultRow label="Northing" value={`${result.point.northing.toFixed(4)} m`} />
                  <div className="border-t border-[var(--border-color)] my-3"></div>
                  <div className="text-xs text-[var(--text-muted)] font-mono">
                    Formula: E₂ = E₁ + d×sin(θ), N₂ = N₁ + d×cos(θ)<br/>
                    E = {parseFloat(input.radStationE).toFixed(4)} + {result.distance}×sin({result.bearing.toFixed(4)}°)<br/>
                    N = {parseFloat(input.radStationN).toFixed(4)} + {result.distance}×cos({result.bearing.toFixed(4)}°)
                  </div>
                </>
              )}
              
              {result.type === 'forward-intersection' && (
                <>
                  <ResultRow label="Unknown Point" value={result.pointName} />
                  <ResultRow label="Easting" value={`${result.point.easting.toFixed(4)} m`} />
                  <ResultRow label="Northing" value={`${result.point.northing.toFixed(4)} m`} />
                  <div className="border-t border-[var(--border-color)] my-3"></div>
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Check Distances:</div>
                  <ResultRow label="AP" value={`${result.distA.toFixed(4)} m`} />
                  <ResultRow label="BP" value={`${result.distB.toFixed(4)} m`} />
                  <div className="border-t border-[var(--border-color)] my-3"></div>
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Angles:</div>
                  <ResultRow label="∠APB" value={result.angleA.toFixed(3) + '°'} />
                  <ResultRow label="∠BPA" value={result.angleB.toFixed(3) + '°'} />
                  <div className="border-t border-[var(--border-color)] my-3"></div>
                  <div className="text-xs text-[var(--text-muted)] font-mono">
                    Formula: {result.formula}
                  </div>
                </>
              )}
              
              {result.type === 'backward-intersection' && (
                <>
                  <ResultRow label="Unknown Station" value={result.pointName} />
                  <ResultRow label="Easting" value={`${result.point.easting.toFixed(4)} m`} />
                  <ResultRow label="Northing" value={`${result.point.northing.toFixed(4)} m`} />
                  <div className="border-t border-[var(--border-color)] my-3"></div>
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Check Distances:</div>
                  <ResultRow label="P to A" value={`${result.d1.toFixed(4)} m`} />
                  <ResultRow label="P to B" value={`${result.d2.toFixed(4)} m`} />
                  <ResultRow label="P to C" value={`${result.d3.toFixed(4)} m`} />
                  <div className="border-t border-[var(--border-color)] my-3"></div>
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Check Bearings:</div>
                  <ResultRow label="P → A" value={result.bearingToP1} />
                  <ResultRow label="P → B" value={result.bearingToP2} />
                  <ResultRow label="P → C" value={result.bearingToP3} />
                </>
              )}
              
              {result.type === 'missing-line' && (
                <>
                  <ResultRow label="Distance A → B" value={`${result.distance.toFixed(4)} m`} />
                  <ResultRow label="Bearing A → B" value={result.bearingDMS} />
                  <ResultRow label="Back Bearing B → A" value={result.backBearingDMS} />
                  <div className="border-t border-[var(--border-color)] my-3"></div>
                  <ResultRow label="ΔEasting" value={`${result.deltaE >= 0 ? '+' : ''}${result.deltaE.toFixed(4)} m`} />
                  <ResultRow label="ΔNorthing" value={`${result.deltaN >= 0 ? '+' : ''}${result.deltaN.toFixed(4)} m`} />
                </>
              )}

              {result.type === 'side-shot' && (
                <>
                  <ResultRow label="Offset Point P" value="" />
                  <ResultRow label="Easting" value={`${result.point.easting.toFixed(4)} m`} />
                  <ResultRow label="Northing" value={`${result.point.northing.toFixed(4)} m`} />
                  <div className="border-t border-[var(--border-color)] my-3"></div>
                  <ResultRow label="Chainage" value={`${result.chainage.toFixed(3)} m`} />
                  <ResultRow label="Offset" value={`${result.offset.toFixed(3)} m ${result.offsetDirection}`} />
                  <div className="border-t border-[var(--border-color)] my-3"></div>
                  <ResultRow label="Bearing AB" value={result.bearingAB} />
                  <ResultRow label="Bearing to P" value={result.offsetBearing} />
                  <div className="border-t border-[var(--border-color)] my-3"></div>
                  <div className="text-xs text-[var(--text-muted)] font-mono">
                    Formula: Bearing_AB = atan2(ΔE_AB, ΔN_AB)<br/>
                    P = A + chainage×sin(θ_AB) + offset×sin(θ_AB±90°)
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        {warnings.length > 0 && (
          <div className="md:col-span-2 bg-yellow-900/20 border border-yellow-700 rounded-xl p-4">
            {warnings.map((w, i) => (
              <p key={i} className="text-yellow-400 text-sm">{w}</p>
            ))}
          </div>
        )}
        
        {result?.error && (
          <div className="md:col-span-2 bg-red-900/20 border border-red-700 rounded-xl p-4">
            <p className="text-red-400">{result.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="font-mono text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
