'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react'
import { z } from 'zod';
import { horizontalCurve, logEngineeringCompute } from '@/lib/engineering/compute';
import { initialiseDXFLayers, DXF_LAYERS } from '@/lib/drawing/dxfLayers';
import { getMinRadius, getMinSSD, getMinSuperelevation } from '@/lib/standards/engineering';

const HorizontalCurveInputSchema = z.object({
  R: z.number().positive().min(30).max(2000),
  deltaDeg: z.number().positive().min(1).max(180),
  chainageStart: z.number().min(0).default(0),
  designSpeed: z.number().min(20).max(120).default(60),
});

interface HorizontalCurvePanelProps {
  projectId?: string;
  projectData?: {
    lr_number?: string;
    county?: string;
    district?: string;
    locality?: string;
  };
  surveyorProfile?: {
    fullName: string;
    registrationNumber: string;
    firmName: string;
  } | null;
  standard?: 'KRDM2017' | 'KeRRA';
  designSpeed?: number;
}

export function HorizontalCurvePanel({ projectId, projectData: _projectData, surveyorProfile: _surveyorProfile, standard = 'KRDM2017', designSpeed = 60 }: HorizontalCurvePanelProps) {
  const [R, setR] = useState(200);
  const [deltaDeg, setDeltaDeg] = useState(35);
  const [chainageStart, setChainageStart] = useState(1000);
  const [error, setError] = useState<string | null>(null);

  const minRadius = getMinRadius(standard, designSpeed);
  const minSSD = getMinSSD(standard, designSpeed);
  const minE = getMinSuperelevation(designSpeed, R);

  const validations = useMemo(() => {
    const issues: string[] = [];
    const passes: string[] = [];

    if (R < minRadius) {
      issues.push(`Radius ${R}m < minimum ${minRadius}m for ${designSpeed}km/h (RDM 1.1)`);
    } else {
      passes.push(`Radius ${R}m ≥ minimum ${minRadius}m `);
    }

    const ssdCheck = R >= minSSD * 0.5;
    if (!ssdCheck) {
      issues.push(`Insufficient sight distance for ${designSpeed}km/h (min SSD: ${minSSD}m)`);
    } else {
      passes.push(`Sight distance adequate (min SSD: ${minSSD}m) `);
    }

    if (minE > 7) {
      issues.push(`Required superelevation ${minE.toFixed(1)}% exceeds 7% max — consider larger radius`);
    } else {
      passes.push(`Superelevation ${minE.toFixed(1)}% within 7% limit `);
    }

    return { issues, passes };
  }, [R, designSpeed, minRadius, minSSD, minE]);

  const result = useMemo(() => {
    try {
      const input = HorizontalCurveInputSchema.parse({ R, deltaDeg, chainageStart, designSpeed });
      setError(null);
      const res = horizontalCurve(input);
      logEngineeringCompute('horizontal_curve', input, {
        T: res.T, L: res.L, LC: res.LC, M: res.M
      }, { projectId });
      return res;
    } catch (e) {
      if (e instanceof z.ZodError) {
        setError(e.errors[0]?.message);
      }
      return null;
    }
  }, [R, deltaDeg, chainageStart, projectId, designSpeed]);

  const exportDXF = async () => {
    if (!result) return;

    const { default: Drawing } = await import('dxf-writer');
    const drawing = new Drawing();
    initialiseDXFLayers(drawing);
    drawing.setActiveLayer(DXF_LAYERS.CENTRELINE.name);
    
    const centerY = 100;
    const scale = 0.5;

    drawing.drawLine(
      50, centerY - result.T * scale,
      50 + result.L * scale, centerY
    );

    drawing.setActiveLayer(DXF_LAYERS.CHAIN.name);
    drawing.drawText(50, centerY + 20, 0.2, 0, `TC @ ${result.chainage_TC.toFixed(3)}m`);
    drawing.drawText(50 + result.L * scale, centerY + 20, 0.2, 0, `CT @ ${result.chainage_CT.toFixed(3)}m`);
    drawing.drawText(50 + result.T * scale, centerY + 40, 0.2, 0, `IP @ ${chainageStart.toFixed(3)}m`);
    drawing.drawText(50, centerY - 30, 0.25, 0, `R=${R}m Δ=${deltaDeg}°`);
    drawing.drawText(50, centerY - 20, 0.2, 0, `T=${result.T.toFixed(3)}m L=${result.L.toFixed(3)}m`);

    const dxfString = drawing.toDxfString();
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `horizontal_curve_R${R}_Delta${deltaDeg}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Horizontal Curve Calculator</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Per RDM 1.1 Volume 2, Chapter 3 — Circular Curves
          </p>
        </div>
        {result && (
          <button
            onClick={exportDXF}
            className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export DXF
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {validations.issues.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm font-semibold mb-1">Standards Violations</p>
          <ul className="text-red-400 text-xs space-y-0.5">
            {validations.issues.map((issue, i) => (
              <li key={`${issue}-${i}`}><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> {issue}</li>
            ))}
          </ul>
        </div>
      )}

      {validations.passes.length > 0 && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <ul className="text-green-400 text-xs space-y-0.5">
            {validations.passes.map((pass, i) => (
              <li key={`${pass}-${i}`}> {pass}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="radius-r-m">Radius R (m)</label>
          <input id="radius-r-m" aria-label="Radius R (m)"
            type="number"
            min={30}
            max={2000}
            value={R}
            onChange={(e) => setR(Number(e.target.value) || 50)}
            className={`w-full bg-[var(--bg-secondary)] border rounded px-3 py-2 text-sm font-mono ${R < minRadius ? 'border-red-500 text-red-400' : 'border-[var(--border-color)]'}`}
          />
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Min: {minRadius}m for {designSpeed}km/h</p>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="deflection-angle">Deflection Angle Δ (°)</label>
          <input id="deflection-angle" aria-label="Deflection Angle Δ (°)"
            type="number"
            min={1}
            max={180}
            value={deltaDeg}
            onChange={(e) => setDeltaDeg(Number(e.target.value) || 35)}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="chainage-at-ip-m">Chainage at IP (m)</label>
          <input  id="chainage-at-ip-m" aria-label="Chainage at IP (m)"
            type="number"
            min={0}
            value={chainageStart}
            onChange={(e) => setChainageStart(Number(e.target.value) || 0)}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm font-mono"
          />
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">Tangent Length (T)</p>
              <p className="font-mono font-semibold text-orange-400">{result.T.toFixed(3)} m</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">Curve Length (L)</p>
              <p className="font-mono font-semibold">{result.L.toFixed(3)} m</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">Long Chord (LC)</p>
              <p className="font-mono font-semibold">{result.LC.toFixed(3)} m</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">Mid-Ordinate (M)</p>
              <p className="font-mono font-semibold">{result.M.toFixed(3)} m</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">Chainage TC</p>
              <p className="font-mono font-semibold">{result.chainage_TC.toFixed(3)} m</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">Chainage CT</p>
              <p className="font-mono font-semibold">{result.chainage_CT.toFixed(3)} m</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">External (E)</p>
              <p className="font-mono font-semibold">{result.E?.toFixed(3) ?? '-'} m</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg">
            <div className="bg-[var(--bg-secondary)] px-4 py-2 border-b border-[var(--border-color)]">
              <h4 className="font-semibold text-sm">Setting Out Table (20m intervals)</h4>
            </div>
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] text-xs">
                  <th className="text-left py-2 px-4">Chainage</th>
                  <th className="text-right py-2 px-4">Deflection (°)</th>
                  <th className="text-right py-2 px-4">Chord (m)</th>
                  <th className="text-right py-2 px-4">Increment (m)</th>
                </tr>
              </thead>
              <tbody>
                {result.settingOutTable.slice(0, 15).map((row, i) => (
                  <tr key={`${row}-${i}`} className="border-b border-[var(--border-color)]/30">
                    <td className="py-1.5 px-4">{row.chainage.toFixed(3)}</td>
                    <td className="py-1.5 px-4 text-right">{row.deflectionFromTC.toFixed(4)}°</td>
                    <td className="py-1.5 px-4 text-right">{row.chordFromTC.toFixed(4)}</td>
                    <td className="py-1.5 px-4 text-right">{row.chordIncrement.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.settingOutTable.length > 15 && (
              <div className="px-4 py-2 text-xs text-[var(--text-muted)] text-center">
                ... and {result.settingOutTable.length - 15} more points
              </div>
            )}
          </div>
        </>
      )}

      <div className="text-xs text-[var(--text-muted)]">
        <p><strong>Reference:</strong> RDM 1.1 Equation 3.1 — T = R × tan(Δ/2)</p>
      </div>
    </div>
  );
}
