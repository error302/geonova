'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react'
import { superelevationCalc, type SuperelevationResult, logEngineeringCompute } from '@/lib/engineering/compute';
import { z } from 'zod';
import { initialiseDXFLayers, DXF_LAYERS } from '@/lib/drawing/dxfLayers';

const SuperelevationInputSchema = z.object({
  R: z.number().positive().min(50).max(2000),
  V: z.number().positive().min(20).max(120),
  eMax: z.number().positive().max(0.12).default(0.07),
});

interface SuperelevationPanelProps {
  initialRadius?: number;
  initialSpeed?: number;
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
}

export default function SuperelevationPanel({ 
  initialRadius = 200, 
  initialSpeed = 80,
  projectId,
  projectData: _projectData,
  surveyorProfile: _surveyorProfile,
  standard = 'KRDM2017'
}: SuperelevationPanelProps) {
  const [R, setR] = useState(initialRadius);
  const [V, setV] = useState(initialSpeed);
  const [eMax, setEmax] = useState(0.07);
  const [error, setError] = useState<string | null>(null);

  const eRequired = (V * V) / (225 * R);
  const ePercent = eRequired * 100;
  const minTransition = Math.max(0.6 * (V * V) / R, 30);

  const validations = useMemo(() => {
    const issues: string[] = [];
    const passes: string[] = [];

    if (ePercent > 12) {
      issues.push(`Required e ${ePercent.toFixed(1)}% exceeds absolute max 12%`);
    } else if (ePercent > 7) {
      issues.push(`Required e ${ePercent.toFixed(1)}% exceeds KeRRA rural max 7%`);
    } else {
      passes.push(`e ${ePercent.toFixed(1)}% within 7% limit `);
    }

    if (minTransition < 30) {
      issues.push(`Transition length ${minTransition.toFixed(1)}m < absolute minimum 30m`);
    } else {
      passes.push(`Transition length ${minTransition.toFixed(1)}m ≥ 30m minimum `);
    }

    if (standard === 'KeRRA' && ePercent > 7) {
      issues.push(`KeRRA rural roads: max e = 7%. Consider larger radius or lower speed.`);
    }

    return { issues, passes };
  }, [ePercent, minTransition, standard]);

  const result: SuperelevationResult | null = useMemo(() => {
    try {
      const input = SuperelevationInputSchema.parse({ R, V, eMax });
      setError(null);
      const res = superelevationCalc(input);
      
      logEngineeringCompute('superelevation', input, res, { projectId });
      
      return res;
    } catch (e) {
      if (e instanceof z.ZodError) {
        setError(e.errors[0]?.message || 'Invalid input');
      }
      return null;
    }
  }, [R, V, eMax, projectId]);

  const exportToDXF = async () => {
    if (!result) return;
    
    const { default: Drawing } = await import('dxf-writer');
    const drawing = new Drawing();
    initialiseDXFLayers(drawing);
    
    drawing.setActiveLayer(DXF_LAYERS.PROFILE.name);
    
    const width = 30;
    const e = result.eDesign / 100;
    const angleRad = Math.atan(e);
    const rise = width * Math.tan(angleRad);
    
    drawing.drawLine(0, 0, width, rise);
    drawing.drawLine(0, 0, width, 0);
    drawing.drawLine(width, rise, width, rise + 0.3);
    
    drawing.setActiveLayer(DXF_LAYERS.CHAIN.name);
    drawing.drawText(1, 0.5, 0.15, 0, `R=${R}m V=${V}km/h e=${result.eDesign.toFixed(1)}%`);
    drawing.drawText(1, 1.5, 0.15, 0, `Transition: ${result.transitionLength.toFixed(1)}m`);
    
    const dxfString = drawing.toDxfString();
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `superelevation_R${R}_V${V}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Superelevation Calculation</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Per RDM 1.1 Section 3.4 and KeRRA Rural Roads Design Manual
          </p>
        </div>
        {result && (
          <button
            onClick={exportToDXF}
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="curve-radius-r-m">Curve Radius R (m)</label>
          <input id="curve-radius-r-m" aria-label="Curve Radius R (m)"
            type="number"
            min={30}
            max={2000}
            value={R}
            onChange={(e) => setR(Number(e.target.value) || 50)}
            className={`w-full bg-[var(--bg-secondary)] border rounded px-3 py-2 text-sm font-mono ${ePercent > 7 ? 'border-red-500 text-red-400' : 'border-[var(--border-color)]'}`}
          />
          <p className="text-xs text-[var(--text-muted)] mt-0.5">e required: {ePercent.toFixed(1)}%</p>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="design-speed-v-km-h">Design Speed V (km/h)</label>
          <input id="design-speed-v-km-h" aria-label="Design Speed V (km/h)"
            type="number"
            min={20}
            max={120}
            value={V}
            onChange={(e) => setV(Number(e.target.value) || 80)}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="max-superelevation-e-max">Max Superelevation e<sub>max</sub></label>
          <select
             id="max-superelevation-e-max" value={eMax}
            onChange={(e) => setEmax(Number(e.target.value))}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm font-mono"
          >
            <option value={0.04}>4%</option>
            <option value={0.05}>5%</option>
            <option value={0.06}>6%</option>
            <option value={0.07}>7% (KeRRA default)</option>
            <option value={0.08}>8%</option>
            <option value={0.10}>10%</option>
            <option value={0.12}>12%</option>
          </select>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Min transition: {minTransition.toFixed(1)}m</p>
        </div>
      </div>

      {/* Results Summary */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-muted)]">Design e</p>
            <p className="font-mono font-semibold text-orange-400">{result.eDesign.toFixed(2)}%</p>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-muted)]">Transition Length</p>
            <p className="font-mono font-semibold">{result.transitionLength.toFixed(1)} m</p>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-muted)]">Rate</p>
            <p className="font-mono font-semibold">{result.rate.toFixed(4)}%/m</p>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
            <p className="text-xs text-[var(--text-muted)]">Max e</p>
            <p className="font-mono font-semibold">{result.eMax.toFixed(2)}%</p>
          </div>
        </div>
      )}

      {/* Transition Table */}
      {result && (
        <div>
          <h4 className="font-semibold mb-2 text-sm">Superelevation Transition Table</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] text-xs">
                  <th className="text-left py-2 pr-4">Offset (m)</th>
                  <th className="text-left py-2 pr-4">e Applied (%)</th>
                  <th className="text-left py-2">Progress</th>
                </tr>
              </thead>
              <tbody>
                {result.table.map((row, i) => (
                  <tr key={`${row}-${i}`} className="border-b border-[var(--border-color)]/30">
                    <td className="py-1.5 pr-4">{row.chainageOffset.toFixed(2)}</td>
                    <td className="py-1.5 pr-4">{row.eApplied.toFixed(2)}</td>
                    <td className="py-1.5">
                      <div className="w-24 h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 transition-all" 
                          style={{ width: `${(i / result.table.length) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Visual Diagram - Simple SVG representation */}
      {result && (
        <div className="mt-4">
          <h4 className="font-semibold mb-2 text-sm">Transition Diagram</h4>
          <svg viewBox="0 0 400 120" className="w-full h-32 bg-[var(--bg-secondary)] rounded-lg">
            {/* Center line */}
            <line x1="20" y1="60" x2="380" y2="60" stroke="#444" strokeWidth="1" strokeDasharray="4 2" />
            
            {/* Normal crown (before transition) */}
            <line x1="20" y1="50" x2="60" y2="50" stroke="#666" strokeWidth="3" />
            
            {/* Transition curve */}
            <path 
              d={`M 60 50 Q ${60 + result.transitionLength * 0.5} 30 ${Math.min(60 + result.transitionLength, 380)} 30`}
              stroke="#e8a020"
              strokeWidth="3"
              fill="none"
            />
            
            {/* Full superelevation (after transition) */}
            <line 
              x1={Math.min(60 + result.transitionLength, 380)} 
              y1="30" 
              x2="380" 
              y2="30" 
              stroke="#e8a020" 
              strokeWidth="3" 
            />

            {/* Labels */}
            <text x="40" y="75" fill="#666" fontSize="10">Normal Crown</text>
            <text x="140" y="25" fill="#e8a020" fontSize="10">Transition</text>
            <text x="300" y="25" fill="#e8a020" fontSize="10">Full e = {result.eDesign}%</text>
          </svg>
        </div>
      )}

      {/* Formula Reference */}
      <div className="mt-4 p-3 bg-[var(--bg-secondary)] rounded-lg">
        <p className="text-xs text-[var(--text-muted)]">
          <strong>Reference:</strong> RDM 1.1 Equation 3.1 — e = V²/(225R) - 0.01
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          <strong>KeRRA:</strong> Minimum transition L = 0.6V²/R (minimum 30m)
        </p>
      </div>
    </div>
  );
}
