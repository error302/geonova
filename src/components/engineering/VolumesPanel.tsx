'use client';

import { useState, useMemo } from 'react';
import { z } from 'zod';
import { crossSectionVolume, massHaulDiagram, logEngineeringCompute } from '@/lib/engineering/compute';
import { initialiseSokDXFLayers, DXF_LAYERS } from '@/lib/drawing/dxfLayers';

const VolumeInputSchema = z.object({
  areas: z.array(z.number()).min(2),
  stationInterval: z.number().positive().max(100).default(20),
  method: z.enum(['prismoidal', 'end-area']).default('prismoidal'),
});

interface MassHaulPoint {
  station: number;
  volume: number;
  cumulative: number;
  zone: 'cut' | 'fill' | 'balance';
}

function MassHaulDiagramSVG({ diagram, balancePoint }: { diagram: MassHaulPoint[]; balancePoint: number | null }) {
  const padding = { top: 30, right: 40, bottom: 50, left: 70 };
  const chartW = Math.max(diagram.length * 60, 600);
  const chartH = 320;
  const totalW = chartW + padding.left + padding.right;
  const totalH = chartH + padding.top + padding.bottom;

  const stations = diagram.map(d => d.station);
  const cumulatives = diagram.map(d => d.cumulative);
  const minStation = Math.min(...stations);
  const maxStation = Math.max(...stations);
  const minCum = Math.min(...cumulatives, 0);
  const maxCum = Math.max(...cumulatives, 0);
  const rangeX = maxStation - minStation || 1;
  const rangeY = maxCum - minCum || 1;

  const scaleX = (v: number) => padding.left + ((v - minStation) / rangeX) * chartW;
  const scaleY = (v: number) => padding.top + chartH - ((v - minCum) / rangeY) * chartH;
  const zeroY = scaleY(0);

  // Build polyline points
  const linePoints = diagram.map(d => `${scaleX(d.station)},${scaleY(d.cumulative)}`).join(' ');

  // Build filled polygons: surplus (green above zero) and deficit (red below zero)
  const surplusParts: string[] = [];
  const deficitParts: string[] = [];

  for (let i = 0; i < diagram.length - 1; i++) {
    const d0 = diagram[i];
    const d1 = diagram[i + 1];
    const x0 = scaleX(d0.station);
    const x1 = scaleX(d1.station);
    const y0 = scaleY(d0.cumulative);
    const y1 = scaleY(d1.cumulative);

    if (d0.cumulative >= 0 && d1.cumulative >= 0) {
      // Both above zero
      surplusParts.push(`M${x0},${zeroY} L${x0},${y0} L${x1},${y1} L${x1},${zeroY} Z`);
    } else if (d0.cumulative <= 0 && d1.cumulative <= 0) {
      // Both below zero
      deficitParts.push(`M${x0},${zeroY} L${x0},${y0} L${x1},${y1} L${x1},${zeroY} Z`);
    } else {
      // Crosses zero — interpolate crossing point
      const t = Math.abs(d0.cumulative) / (Math.abs(d0.cumulative) + Math.abs(d1.cumulative));
      const crossX = x0 + t * (x1 - x0);

      if (d0.cumulative > 0) {
        surplusParts.push(`M${x0},${zeroY} L${x0},${y0} L${crossX},${zeroY} Z`);
        deficitParts.push(`M${crossX},${zeroY} L${crossX},${zeroY} L${x1},${y1} L${x1},${zeroY} Z`);
      } else {
        deficitParts.push(`M${x0},${zeroY} L${x0},${y0} L${crossX},${zeroY} Z`);
        surplusParts.push(`M${crossX},${zeroY} L${crossX},${zeroY} L${x1},${y1} L${x1},${zeroY} Z`);
      }
    }
  }

  // Grid lines
  const gridLines: { x?: number; y?: number; label: string; axis: 'x' | 'y' }[] = [];
  const numXGrid = Math.min(diagram.length, 10);
  for (let i = 0; i <= numXGrid; i++) {
    const val = minStation + (rangeX * i) / numXGrid;
    gridLines.push({ x: scaleX(val), label: val.toFixed(0), axis: 'x' });
  }
  const numYGrid = 6;
  for (let i = 0; i <= numYGrid; i++) {
    const val = minCum + (rangeY * i) / numYGrid;
    gridLines.push({ y: scaleY(val), label: val.toFixed(0), axis: 'y' });
  }

  return (
    <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
      <div className="bg-[var(--bg-secondary)] px-4 py-2 border-b border-[var(--border-color)]">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          Mass Haul Diagram
          <span className="flex items-center gap-1 ml-3 text-xs font-normal text-[var(--text-muted)]">
            <span className="inline-block w-3 h-2 bg-green-500/40 rounded-sm border border-green-500/60" />
            Surplus (Cut)
          </span>
          <span className="flex items-center gap-1 text-xs font-normal text-[var(--text-muted)]">
            <span className="inline-block w-3 h-2 bg-red-500/40 rounded-sm border border-red-500/60" />
            Deficit (Fill)
          </span>
        </h4>
      </div>
      <div className="bg-white p-2" style={{ maxHeight: 400 }}>
        <svg
          viewBox={`0 0 ${totalW} ${totalH}`}
          className="w-full h-auto"
          style={{ maxHeight: 380 }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <pattern id="mhd-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect x={padding.left} y={padding.top} width={chartW} height={chartH} fill="url(#mhd-grid)" />

          {/* Zero line */}
          <line
            x1={padding.left} y1={zeroY} x2={padding.left + chartW} y2={zeroY}
            stroke="#374151" strokeWidth="1.5" strokeDasharray="6 3"
          />

          {/* Surplus fill (green) */}
          {surplusParts.map((d, i) => (
            <path key={`surplus-${i}`} d={d} fill="rgba(34,197,94,0.2)" stroke="rgba(34,197,94,0.4)" strokeWidth="0.5" />
          ))}

          {/* Deficit fill (red) */}
          {deficitParts.map((d, i) => (
            <path key={`deficit-${i}`} d={d} fill="rgba(239,68,68,0.2)" stroke="rgba(239,68,68,0.4)" strokeWidth="0.5" />
          ))}

          {/* Cumulative volume line */}
          <polyline points={linePoints} fill="none" stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* Data points */}
          {diagram.map((d) => (
            <circle
              key={d.station}
              cx={scaleX(d.station)} cy={scaleY(d.cumulative)}
              r="3"
              fill={d.cumulative >= 0 ? '#16a34a' : '#dc2626'}
              stroke="white" strokeWidth="1.5"
            />
          ))}

          {/* Balance point marker */}
          {balancePoint !== null && (
            <line
              x1={scaleX(balancePoint)} y1={padding.top}
              x2={scaleX(balancePoint)} y2={padding.top + chartH}
              stroke="#d97706" strokeWidth="2" strokeDasharray="8 4"
            />
          )}
          {balancePoint !== null && (
            <text
              x={scaleX(balancePoint)} y={padding.top - 8}
              textAnchor="middle"
              className="text-[10px]"
              fill="#d97706" fontWeight="600"
            >
              Balance @{balancePoint.toFixed(0)}m
            </text>
          )}

          {/* X axis labels */}
          {gridLines.filter(g => g.axis === 'x').map((g, i) => (
            <text key={`xl-${i}`} x={g.x} y={totalH - 8} textAnchor="middle" className="text-[10px]" fill="#6b7280">
              {g.label}m
            </text>
          ))}

          {/* Y axis labels */}
          {gridLines.filter(g => g.axis === 'y').map((g, i) => (
            <g key={`yl-${i}`}>
              <line
                x1={padding.left} y1={g.y} x2={padding.left + chartW} y2={g.y}
                stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2 4"
              />
              <text x={padding.left - 8} y={(g.y ?? 0) + 3} textAnchor="end" className="text-[10px]" fill="#6b7280">
                {g.label}
              </text>
            </g>
          ))}

          {/* Axis titles */}
          <text x={totalW / 2} y={totalH - 0} textAnchor="middle" className="text-[11px]" fill="#374151" fontWeight="500">
            Chainage (m)
          </text>
          <text
            x={12} y={padding.top + chartH / 2}
            textAnchor="middle"
            className="text-[11px]"
            fill="#374151"
            fontWeight="500"
            transform={`rotate(-90, 12, ${padding.top + chartH / 2})`}
          >
            Cumulative Volume (m³)
          </text>
        </svg>
      </div>
    </div>
  );
}

interface VolumesPanelProps {
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
}

export function VolumesPanel({ projectId, projectData: _projectData, surveyorProfile: _surveyorProfile }: VolumesPanelProps) {
  const [areas, setAreas] = useState<number[]>([5, 8, 12, 15, 10, 5, 3, -2, -5, -3]);
  const [stationInterval, setStationInterval] = useState(20);
  const [method, setMethod] = useState<'prismoidal' | 'end-area'>('prismoidal');
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    try {
      const input = VolumeInputSchema.parse({ areas, stationInterval, method });
      setError(null);
      const res = crossSectionVolume(input);
      logEngineeringCompute('cross_section_volume', input, res, { projectId });
      return res;
    } catch (e) {
      if (e instanceof z.ZodError) {
        setError(e.errors[0]?.message);
      }
      return null;
    }
  }, [areas, stationInterval, method, projectId]);

  const massHaul = useMemo(() => {
    if (!result) return null;
    const cumulative = areas.map((a, i) => {
      let sum = 0;
      for (let j = 0; j <= i; j++) sum += areas[j];
      return sum;
    });
    return massHaulDiagram({ cumulativeVolumes: cumulative, stationInterval });
  }, [areas, stationInterval, result]);

  const updateArea = (index: number, value: number) => {
    const newAreas = [...areas];
    newAreas[index] = value;
    setAreas(newAreas);
  };

  const exportDXF = async () => {
    if (!result) return;

    const { default: Drawing } = await import('dxf-writer');
    const drawing = new Drawing();
    initialiseSokDXFLayers(drawing);

    const baseY = 100;
    const scale = 2;

    drawing.setActiveLayer(DXF_LAYERS.PROFILE.name);
    
    let prevX = 50;
    let prevY = baseY;
    
    areas.forEach((area, i) => {
      const x = 50 + i * 20 * scale;
      const y = baseY - area * scale;
      drawing.drawLine(prevX, prevY, x, y);
      prevX = x;
      prevY = y;
    });

    drawing.setActiveLayer(DXF_LAYERS.CHAIN.name);
    drawing.drawText(50, baseY + 30, 0.2, 0, `Total Cut: ${result.totalCut.toFixed(2)} m³`);
    drawing.drawText(50, baseY + 50, 0.2, 0, `Total Fill: ${result.totalFill.toFixed(2)} m³`);

    const dxfString = drawing.toDxfString();
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volumes_${projectId || 'export'}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Cross-Section Volumes & Mass Haul</h3>
          <p className="text-sm text-[var(--text-muted)]">
            Per RDM 1.1 Volume 3, Chapter 2 — Earthworks
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="station-interval-m">Station Interval (m)</label>
          <input id="station-interval-m" aria-label="Station Interval (m)"
            type="number"
            min={5}
            max={100}
            value={stationInterval}
            onChange={(e) => setStationInterval(Number(e.target.value) || 20)}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1" htmlFor="method">Method</label>
          <select
             id="method" value={method}
            onChange={(e) => setMethod(e.target.value as 'prismoidal' | 'end-area')}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm"
          >
            <option value="prismoidal">Prismoidal (RDM 1.1 preferred)</option>
            <option value="end-area">End-Area (simple)</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg">
        <div className="bg-[var(--bg-secondary)] px-4 py-2 border-b border-[var(--border-color)]">
          <h4 className="font-semibold text-sm">Cross-Section Areas (positive = cut, negative = fill)</h4>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {areas.map((area, i) => (
              <div key={`${area}-${i}`} className="flex items-center gap-1">
                <span className="text-xs text-[var(--text-muted)] w-8">{i * stationInterval}</span>
                <input aria-label="Area"
                  type="number"
                  value={area}
                  onChange={(e) => updateArea(i, Number(e.target.value) || 0)}
                  className={`w-16 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-2 py-1 text-sm font-mono text-right ${area > 0 ? 'text-red-400' : 'text-green-400'}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">Total Cut</p>
              <p className="font-mono font-semibold text-red-400">{result.totalCut.toFixed(2)} m³</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">Total Fill</p>
              <p className="font-mono font-semibold text-green-400">{result.totalFill.toFixed(2)} m³</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">Net Volume</p>
              <p className={`font-mono font-semibold ${result.netVolume >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {result.netVolume.toFixed(2)} m³
              </p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)]">Balanced?</p>
              <p className={`font-mono font-semibold ${result.isBalanced ? 'text-green-400' : 'text-yellow-400'}`}>
                {result.isBalanced ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          {massHaul && (
            <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg">
              <div className="bg-[var(--bg-secondary)] px-4 py-2 border-b border-[var(--border-color)]">
                <h4 className="font-semibold text-sm">Volume Table</h4>
              </div>
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] text-xs">
                    <th className="text-left py-2 px-4">Station</th>
                    <th className="text-right py-2 px-4">Cut Area</th>
                    <th className="text-right py-2 px-4">Fill Area</th>
                    <th className="text-right py-2 px-4">Cut Vol</th>
                    <th className="text-right py-2 px-4">Fill Vol</th>
                    <th className="text-right py-2 px-4">Cum. Cut</th>
                    <th className="text-right py-2 px-4">Cum. Fill</th>
                  </tr>
                </thead>
                <tbody>
                  {result.volumeTable.slice(0, 15).map((row) => (
                    <tr key={row.station} className="border-b border-[var(--border-color)]/30">
                      <td className="py-1.5 px-4">{row.station.toFixed(0)}</td>
                      <td className="py-1.5 px-4 text-right text-red-400">{row.cutArea.toFixed(2)}</td>
                      <td className="py-1.5 px-4 text-right text-green-400">{row.fillArea.toFixed(2)}</td>
                      <td className="py-1.5 px-4 text-right">{row.cutVolume.toFixed(2)}</td>
                      <td className="py-1.5 px-4 text-right">{row.fillVolume.toFixed(2)}</td>
                      <td className="py-1.5 px-4 text-right text-red-400">{row.cumulativeCut.toFixed(2)}</td>
                      <td className="py-1.5 px-4 text-right text-green-400">{row.cumulativeFill.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {massHaul && massHaul.diagram.length > 0 && (
        <MassHaulDiagramSVG diagram={massHaul.diagram} balancePoint={massHaul.balancePoint} />
      )}

      <div className="text-xs text-[var(--text-muted)]">
        <p><strong>Reference:</strong> RDM 1.1 Volume 3 — Prismoidal: V = (d/6)(A₁ + 4Am + A₂)</p>
      </div>
    </div>
  );
}
