'use client';

import { useState } from 'react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { compoundCurveSolved, reverseCurveSolved, simpleCurveSolved } from '@/lib/engine/solution/wrappers/curves'

type CurveType = 'simple' | 'compound' | 'reverse' | 'vertical';

export default function CurvesCalculator() {
  const [curveType, setCurveType] = useState<CurveType>('simple');
  const [input, setInput] = useState({
    radius: '300',
    defDeg: '20',
    defMin: '00',
    defSec: '00',
    piChain: '2500.00',
    interval: '20',
    r1: '200',
    r2: '400',
    delta1: '15',
    delta2: '15',
    commonChainage: '1000',
    r1_rev: '250',
    r2_rev: '300',
    abDistance: '150'
  });
  const [result, setResult] = useState<null | { type: CurveType; title?: string; steps: SolutionStep[]; stakePoints?: any[] }>(null);
  const [rdmValidation, setRdmValidation] = useState<any>(null);

  const [vInput, setVInput] = useState({
    g1: '-4.0',
    g2: '2.5',
    vpiChainageKm: '2',
    vpiChainageM: '500',
    vpiRL: '1890.00',
    kValue: '40',
    useLength: false,
    length: '200',
  });
  const [vResult, setVResult] = useState<any>(null);
  const [vError, setVError] = useState('');

  const MIN_K: Record<number, number> = {
    120: 160, 110: 130, 100: 100, 90: 80, 80: 50,
    70: 35, 65: 25, 60: 20, 50: 15, 40: 9, 30: 5,
  };
  const designSpeedOptions = [30, 40, 50, 60, 65, 70, 80, 90, 100, 110, 120];
  const [designSpeed, setDesignSpeed] = useState(80);

  const calcVertical = () => {
    setVError('');
    const G1 = parseFloat(vInput.g1);
    const G2 = parseFloat(vInput.g2);
    const vpiKm = parseInt(vInput.vpiChainageKm) || 0;
    const vpiM = parseFloat(vInput.vpiChainageM) || 0;
    const vpiChainage = vpiKm * 1000 + vpiM;
    const vpiRL = parseFloat(vInput.vpiRL);
    const K = parseFloat(vInput.kValue);
    const L = parseFloat(vInput.length);

    if (isNaN(G1) || isNaN(G2) || isNaN(vpiChainage) || isNaN(vpiRL)) {
      setVError('Enter all numeric values.'); return;
    }
    if (G1 === G2) { setVError('G1 and G2 cannot be equal.'); return; }

    const A = G2 - G1;
    const curveLen = vInput.useLength && !isNaN(L) ? L : K * Math.abs(A);
    if (curveLen <= 0) { setVError('Curve length must be positive.'); return; }

    const BVC_chainage = vpiChainage - curveLen / 2;
    const EVC_chainage = vpiChainage + curveLen / 2;
    const BVC_RL = vpiRL - G1 * (curveLen / 2) / 100;
    const EVC_RL = vpiRL + G2 * (curveLen / 2) / 100;

    const rlAtEVC = BVC_RL + (G1 / 100) * curveLen + (A / (200 * curveLen)) * curveLen * curveLen;
    const arithmeticCheck = Math.abs(rlAtEVC - EVC_RL);
    const arithPass = arithmeticCheck < 0.001;

    const isCrest = A < 0;
    let peakPoint: { chainage: number; RL: number } | null = null;
    if (isCrest) {
      const xPeak = -G1 * curveLen / A;
      if (xPeak > 0 && xPeak < curveLen) {
        const RL_peak = BVC_RL + (G1 / 100) * xPeak + (A / (200 * curveLen)) * xPeak * xPeak;
        peakPoint = { chainage: BVC_chainage + xPeak, RL: RL_peak };
      }
    }

    const interval = 20;
    const tableRows: Array<{ chainage: number; x: number; RL: number; grade: number }> = [];
    for (let x = 0; x <= curveLen; x += interval) {
      const ch = BVC_chainage + x;
      const RL = BVC_RL + (G1 / 100) * x + (A / (200 * curveLen)) * x * x;
      const grade = G1 + (A / curveLen) * x;
      tableRows.push({ chainage: ch, x, RL, grade });
    }
    if (tableRows.length > 0 && tableRows[tableRows.length - 1].x !== curveLen) {
      const x = curveLen;
      const ch = BVC_chainage + x;
      const RL = BVC_RL + (G1 / 100) * x + (A / (200 * curveLen)) * x * x;
      const grade = G2;
      tableRows.push({ chainage: ch, x, RL, grade });
    }

    const minK = MIN_K[designSpeed] ?? 40;
    const kPass = curveLen / Math.abs(A) >= minK;

    const steps: SolutionStep[] = [
      { label: 'Algebraic grade difference', formula: 'A = G2 - G1', computation: `${A.toFixed(4)} %` },
      { label: 'Curve length', formula: vInput.useLength ? 'L given directly' : 'L = K × |A|', computation: `${curveLen.toFixed(4)} m` },
      { label: 'BVC chainage', formula: 'VPI - L/2', computation: `${BVC_chainage.toFixed(3)} m` },
      { label: 'EVC chainage', formula: 'VPI + L/2', computation: `${EVC_chainage.toFixed(3)} m` },
      { label: 'BVC reduced level', formula: 'VPI RL - G1×(L/2)/100', computation: `${BVC_RL.toFixed(4)} m` },
      { label: 'EVC reduced level (grade)', formula: 'VPI RL + G2×(L/2)/100', computation: `${EVC_RL.toFixed(4)} m` },
      { label: 'EVC RL from parabola', formula: 'y = BVC_RL + G1×x/100 + A×x²/(200L)', computation: `${rlAtEVC.toFixed(4)} m` },
      { label: 'Arithmetic check', formula: '|EVC_grade - EVC_formula| < 0.001 m', result: `${arithmeticCheck.toFixed(6)} m — ${arithPass ? 'PASS' : 'FAIL'}` },
      { label: 'K-value', formula: 'L / |A|', result: `${(curveLen / Math.abs(A)).toFixed(2)} m/%` },
      { label: `RDM 1.3 min K @ ${designSpeed} km/h`, formula: 'RDM 1.3 Table 3-1', result: `min K = ${minK} — ${kPass ? 'PASS' : 'FAIL'}` },
    ];

    setVResult({
      steps,
      A, curveLen, BVC_chainage, EVC_chainage, BVC_RL, EVC_RL,
      arithmeticCheck, arithPass, peakPoint, tableRows, minK, kPass,
      K_computed: curveLen / Math.abs(A),
      isCrest,
      designSpeed,
    });
  };

  const calculate = async () => {
    if (curveType === 'simple') {
      const R = parseFloat(input.radius);
      const piChainage = parseFloat(input.piChain);
      const interval = parseFloat(input.interval);
      const deflectionDec = (parseFloat(input.defDeg) || 0) + (parseFloat(input.defMin) || 0) / 60 + (parseFloat(input.defSec) || 0) / 3600
      if (isNaN(R) || isNaN(deflectionDec) || isNaN(piChainage) || isNaN(interval)) return;
      const s = simpleCurveSolved({ radius: R, deflectionDeg: deflectionDec, piChainage, interval });
      setResult({ type: 'simple', title: s.solution.title, steps: s.steps, stakePoints: s.result.points });
    } else if (curveType === 'compound') {
      const R1 = parseFloat(input.r1);
      const R2 = parseFloat(input.r2);
      const delta1 = parseFloat(input.delta1);
      const delta2 = parseFloat(input.delta2);
      const commonChainage = parseFloat(input.commonChainage);
      if ([R1, R2, delta1, delta2, commonChainage].some(n => isNaN(n))) return;
      const s = compoundCurveSolved({ R1, R2, delta1Deg: delta1, delta2Deg: delta2, junctionChainage: commonChainage });
      setResult({ type: 'compound', title: s.solution.title, steps: s.steps });
    } else if (curveType === 'reverse') {
      const R1 = parseFloat(input.r1_rev);
      const R2 = parseFloat(input.r2_rev);
      const AB = parseFloat(input.abDistance);
      if (isNaN(R1) || isNaN(R2) || isNaN(AB)) return;
      const s = reverseCurveSolved({ R1, R2, AB });
      setResult({ type: 'reverse', title: s.solution.title, steps: s.steps });
    }

    try {
      const radius = curveType === 'simple'
        ? parseFloat(input.radius || '0')
        : curveType === 'compound'
        ? Math.min(parseFloat(input.r1 || '0'), parseFloat(input.r2 || '0'))
        : Math.min(parseFloat(input.r1_rev || '0'), parseFloat(input.r2_rev || '0'))
      const rdmRes = await fetch('/api/validate-geometry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ radius, designSpeed: 80, terrain: 'rolling', gradient: 0 })
      });
      const rdmData = await rdmRes.json();
      setRdmValidation(rdmData);
    } catch {}
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Curve Calculator</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Horizontal and vertical curve calculations</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => { setCurveType('simple'); setResult(null); setVResult(null); }} className={`px-4 py-2 rounded-lg font-medium ${curveType === 'simple' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Simple Curve</button>
        <button onClick={() => { setCurveType('compound'); setResult(null); setVResult(null); }} className={`px-4 py-2 rounded-lg font-medium ${curveType === 'compound' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Compound Curve</button>
        <button onClick={() => { setCurveType('reverse'); setResult(null); setVResult(null); }} className={`px-4 py-2 rounded-lg font-medium ${curveType === 'reverse' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Reverse Curve</button>
        <button onClick={() => { setCurveType('vertical'); setResult(null); setVResult(null); }} className={`px-4 py-2 rounded-lg font-medium ${curveType === 'vertical' ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'}`}>Vertical Curve</button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-6">
            {curveType === 'simple' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Radius (m)</label><input className="input" value={input.radius} onChange={e => setInput({...input, radius: e.target.value})} /></div>
                  <div><label className="label">Deflection (DMS)</label>
                    <div className="grid grid-cols-3 gap-1">
                      <input className="input" value={input.defDeg} onChange={e => setInput({...input, defDeg: e.target.value})} />
                      <input className="input" value={input.defMin} onChange={e => setInput({...input, defMin: e.target.value})} />
                      <input className="input" value={input.defSec} onChange={e => setInput({...input, defSec: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="label">PI Chainage (m)</label><input className="input" value={input.piChain} onChange={e => setInput({...input, piChain: e.target.value})} /></div>
                  <div><label className="label">Interval (m)</label><input className="input" value={input.interval} onChange={e => setInput({...input, interval: e.target.value})} /></div>
                </div>
              </>
            )}
            {curveType === 'compound' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Radius R1 (m)</label><input className="input" value={input.r1} onChange={e => setInput({...input, r1: e.target.value})} /></div>
                  <div><label className="label">Radius R2 (m)</label><input className="input" value={input.r2} onChange={e => setInput({...input, r2: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className="label">Δ1 (degrees)</label><input className="input" value={input.delta1} onChange={e => setInput({...input, delta1: e.target.value})} /></div>
                  <div><label className="label">Δ2 (degrees)</label><input className="input" value={input.delta2} onChange={e => setInput({...input, delta2: e.target.value})} /></div>
                </div>
                <div className="mt-4"><label className="label">Junction Chainage (m)</label><input className="input" value={input.commonChainage} onChange={e => setInput({...input, commonChainage: e.target.value})} /></div>
              </>
            )}
            {curveType === 'reverse' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Radius R1 (m)</label><input className="input" value={input.r1_rev} onChange={e => setInput({...input, r1_rev: e.target.value})} /></div>
                  <div><label className="label">Radius R2 (m)</label><input className="input" value={input.r2_rev} onChange={e => setInput({...input, r2_rev: e.target.value})} /></div>
                </div>
                <div className="mt-4"><label className="label">Distance AB (m)</label><input className="input" value={input.abDistance} onChange={e => setInput({...input, abDistance: e.target.value})} /></div>
              </>
            )}
            {curveType === 'vertical' && (
              <>
                <p className="text-xs text-[var(--text-muted)] mb-3">Source: RDM 1.3 Kenya August 2023, Section 5.4 | Ghilani &amp; Wolf, Elementary Surveying 16th Ed., Chapter 25</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">G1 — Entry Grade (%)</label><input className="input" value={vInput.g1} onChange={e => setVInput({...vInput, g1: e.target.value})} /></div>
                  <div><label className="label">G2 — Exit Grade (%)</label><input className="input" value={vInput.g2} onChange={e => setVInput({...vInput, g2: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div><label className="label">VPI km</label><input className="input" value={vInput.vpiChainageKm} onChange={e => setVInput({...vInput, vpiChainageKm: e.target.value})} /></div>
                  <div><label className="label">VPI m</label><input className="input" value={vInput.vpiChainageM} onChange={e => setVInput({...vInput, vpiChainageM: e.target.value})} /></div>
                  <div><label className="label">VPI RL (m)</label><input className="input" value={vInput.vpiRL} onChange={e => setVInput({...vInput, vpiRL: e.target.value})} /></div>
                </div>
                <div className="mt-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={vInput.useLength} onChange={e => setVInput({...vInput, useLength: e.target.checked})} className="accent-[var(--accent)]" />
                    <span>Enter curve length directly</span>
                  </label>
                </div>
                {vInput.useLength ? (
                  <div className="mt-2"><label className="label">Curve Length L (m)</label><input className="input" value={vInput.length} onChange={e => setVInput({...vInput, length: e.target.value})} /></div>
                ) : (
                  <div className="mt-2"><label className="label">K-value (m/%)</label><input className="input" value={vInput.kValue} onChange={e => setVInput({...vInput, kValue: e.target.value})} /></div>
                )}
                <div className="mt-4">
                  <label className="label">Design Speed (km/h) — for K compliance</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {designSpeedOptions.map(s => (
                      <button key={s} onClick={() => setDesignSpeed(s)}
                        className={`px-2 py-1 text-xs rounded border ${designSpeed === s ? 'bg-[var(--accent)] text-black border-[var(--accent)]' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            onClick={curveType === 'vertical' ? calcVertical : calculate}
            className="w-full px-6 py-4 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-bold rounded-lg">
            {curveType === 'vertical' ? 'Calculate Vertical Curve' : 'Calculate'}
          </button>
        </div>

        {vError && <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">{vError}</div>}

        {result && curveType !== 'vertical' && (
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-6">
            <SolutionStepsRenderer title={result.title} steps={result.steps} />
            {result.type === 'simple' && result.stakePoints && result.stakePoints.length > 0 ? (
              <div className="mt-6">
                <h3 className="font-semibold text-[var(--text-primary)] mb-3">Stakeout Table</h3>
                <div className="max-h-56 overflow-y-auto text-sm border border-[var(--border-color)] rounded">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-950/40">
                        <th className="text-left px-3 py-2">Chainage</th>
                        <th className="text-right px-3 py-2">Chord (m)</th>
                        <th className="text-right px-3 py-2">Deflection</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.stakePoints.map((p: any, i: number) => (
                        <tr key={i} className="border-t border-[var(--border-color)]">
                          <td className="px-3 py-2 font-mono">{p.chainage.toFixed(3)}</td>
                          <td className="px-3 py-2 text-right font-mono">{p.chordLength?.toFixed?.(3) ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{p.totalDeflection ?? p.deflectionAngle ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {rdmValidation && (
              <div className="mt-6 p-4 border rounded-lg" style={{ backgroundColor: rdmValidation.status === 'GREEN' ? '#10b98120' : rdmValidation.status === 'YELLOW' ? '#f59e0b20' : '#ef444420' }}>
                <h4 className="font-bold mb-2">RDM 1.3 Compliance: <span style={{ color: rdmValidation.status === 'GREEN' ? '#10b981' : rdmValidation.status === 'YELLOW' ? '#f59e0b' : '#ef4444' }}>{rdmValidation.status}</span></h4>
                {rdmValidation.flags.map((flag: string, i: number) => (
                  <p key={i} className="text-sm mb-1">{flag}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {vResult && curveType === 'vertical' && (
          <div className="space-y-4">
            <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-6">
              <SolutionStepsRenderer title="Vertical Curve Computation" steps={vResult.steps} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Curve Type', vResult.isCrest ? 'Crest' : 'Sag'],
                ['Length L', `${vResult.curveLen.toFixed(3)} m`],
                ['Algebraic A', `${vResult.A.toFixed(4)} %`],
                ['K-value', `${vResult.K_computed.toFixed(2)} m/%`],
                ['BVC Ch', `${vResult.BVC_chainage.toFixed(3)} m`],
                ['EVC Ch', `${vResult.EVC_chainage.toFixed(3)} m`],
                ['BVC RL', `${vResult.BVC_RL.toFixed(4)} m`],
                ['EVC RL', `${vResult.EVC_RL.toFixed(4)} m`],
              ].map(([label, value]) => (
                <div key={label} className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded p-3">
                  <p className="text-xs text-[var(--text-muted)]">{label}</p>
                  <p className="text-sm font-mono text-[var(--text-primary)]">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="px-3 py-2 rounded border font-medium text-sm" style={{ backgroundColor: vResult.arithPass ? '#10b98120' : '#ef444420', borderColor: vResult.arithPass ? '#10b981' : '#ef4444', color: vResult.arithPass ? '#10b981' : '#ef4444' }}>
                Arithmetic Check {vResult.arithPass ? 'PASS' : 'FAIL'} ({vResult.arithmeticCheck.toFixed(6)} m)
              </div>
              <div className="px-3 py-2 rounded border font-medium text-sm" style={{ backgroundColor: vResult.kPass ? '#10b98120' : '#ef444420', borderColor: vResult.kPass ? '#10b981' : '#ef4444', color: vResult.kPass ? '#10b981' : '#ef4444' }}>
                K-Compliance @ {vResult.designSpeed} km/h {vResult.kPass ? 'PASS' : 'FAIL'} (min K = {vResult.minK})
              </div>
            </div>

            {vResult.peakPoint && (
              <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
                <h4 className="font-semibold text-sm mb-2">{vResult.isCrest ? 'Crest Peak' : 'Sag Low Point'}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-[var(--text-muted)]">Chainage</p><p className="font-mono text-sm">{vResult.peakPoint.chainage.toFixed(3)} m</p></div>
                  <div><p className="text-xs text-[var(--text-muted)]">Reduced Level</p><p className="font-mono text-sm">{vResult.peakPoint.RL.toFixed(4)} m</p></div>
                </div>
              </div>
            )}

            <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-color)]">
                <h4 className="font-semibold text-sm">RL Table — 20m Intervals</h4>
              </div>
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="bg-[var(--bg-tertiary)]">
                      <th className="px-3 py-2 text-left text-[var(--text-secondary)]">Chainage (m)</th>
                      <th className="px-3 py-2 text-left text-[var(--text-secondary)]">x from BVC (m)</th>
                      <th className="px-3 py-2 text-right text-[var(--text-secondary)]">RL (m)</th>
                      <th className="px-3 py-2 text-right text-[var(--text-secondary)]">Grade (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vResult.tableRows.map((r: any, i: number) => {
                      const isBVC = i === 0;
                      const isEVC = i === vResult.tableRows.length - 1;
                      const isPeak = !!(vResult.peakPoint && Math.abs(r.chainage - vResult.peakPoint.chainage) < 1);
                      return (
                        <tr key={i} className={`border-t border-[var(--border-color)]/30 ${isPeak ? 'bg-[var(--accent)]/10' : ''}`}>
                          <td className="px-3 py-1">{r.chainage.toFixed(3)}</td>
                          <td className="px-3 py-1">{r.x.toFixed(3)}</td>
                          <td className={`px-3 py-1 text-right font-semibold ${isBVC || isEVC || isPeak ? 'text-[var(--accent)]' : ''}`}>{r.RL.toFixed(4)}</td>
                          <td className="px-3 py-1 text-right">{r.grade.toFixed(4)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
