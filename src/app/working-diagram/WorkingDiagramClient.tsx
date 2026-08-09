'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

export interface FieldbookEntry {
  row_index: number;
  station:   string | null;
  raw_data:  Record<string, unknown> | null;
  bs:        number | null;
  remark:    string | null;
}

export interface ProjectInfo {
  id:                   string;
  name:                 string;
  survey_type:          string;
  lr_number?:           string | null;
  locality?:            string | null;
  registration_district?: string | null;
  utm_zone?:            number | null;
  hemisphere?:          string | null;
  datum?:               string | null;
}

interface Props {
  project:   ProjectInfo;
  entries:   FieldbookEntry[];
  projectId: string;
}

function parseBearing(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  const s = String(raw ?? '');
  const m = s.match(/(\d+)[°\-\s](\d+)['\-\s](\d+\.?\d*)/);
  if (m) return Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  return parseFloat(s) || 0;
}

function decimalToDMS(deg: number): string {
  const d = Math.floor(deg);
  const mf = (deg - d) * 60;
  const m  = Math.floor(mf);
  const s  = ((mf - m) * 60).toFixed(1);
  return `${String(d).padStart(3, '0')}°${String(m).padStart(2, '0')}'${s.padStart(4, '0')}"`;
}

interface GaleRow {
  station:  string;
  bearing:  string;
  distance: string;
  dE:       string;
  dN:       string;
  E:        string;
  N:        string;
  corr_dE:  string;
  corr_dN:  string;
  adjE:     string;
  adjN:     string;
  beaconNo: string;
  monument: string;
}

interface DiagramData {
  rows:           GaleRow[];
  totalDist:      number;
  closureE:       number;
  closureN:       number;
  misclosureMm:   number;
  precisionRatio: number;
  closureStatus:  'PASS' | 'FAIL' | 'UNVERIFIED';
  minE: number; maxE: number;
  minN: number; maxN: number;
}

function computeDiagram(entries: FieldbookEntry[]): DiagramData | null {
  const legs = entries
    .map((e) => ({
      station:  String(e.station ?? e.raw_data?.station ?? ''),
      bearing:  parseBearing(e.raw_data?.bearing ?? 0),
      distance: parseFloat(String(e.raw_data?.distance ?? e.raw_data?.hd ?? 0)) || 0,
      beaconNo: String(e.raw_data?.beacon_no ?? ''),
      monument: String(e.raw_data?.monument_type ?? ''),
    }))
    .filter((l) => l.distance > 0);

  if (legs.length < 3) return null;

  const totalDist = legs.reduce((s, l) => s + l.distance, 0);

  let E = 0, N = 0;
  const rawPts: { dE: number; dN: number; E: number; N: number }[] = [];
  for (const leg of legs) {
    const rad = (leg.bearing * Math.PI) / 180;
    const dE  = leg.distance * Math.sin(rad);
    const dN  = leg.distance * Math.cos(rad);
    E += dE;
    N += dN;
    rawPts.push({ dE, dN, E, N });
  }

  const closureE = E;
  const closureN = N;
  const closureLinear = Math.sqrt(closureE ** 2 + closureN ** 2);
  const misclosureMm  = closureLinear * 1000;
  const ratio = totalDist > 0 && closureLinear > 0 ? Math.round(totalDist / closureLinear) : 999999;

  let cumDist = 0;
  let adjE = 0, adjN = 0;
  const rows: GaleRow[] = legs.map((leg, i) => {
    cumDist += leg.distance;
    const corrE = closureLinear > 0 ? -(closureE / totalDist) * cumDist : 0;
    const corrN = closureLinear > 0 ? -(closureN / totalDist) * cumDist : 0;
    adjE = rawPts[i].E + corrE;
    adjN = rawPts[i].N + corrN;
    const dCorrE = (closureLinear > 0 ? -(closureE / totalDist) : 0) * leg.distance;
    const dCorrN = (closureLinear > 0 ? -(closureN / totalDist) : 0) * leg.distance;
    return {
      station:  leg.station,
      bearing:  decimalToDMS(leg.bearing),
      distance: leg.distance.toFixed(3),
      dE:       rawPts[i].dE.toFixed(3),
      dN:       rawPts[i].dN.toFixed(3),
      E:        rawPts[i].E.toFixed(3),
      N:        rawPts[i].N.toFixed(3),
      corr_dE:  dCorrE.toFixed(4),
      corr_dN:  dCorrN.toFixed(4),
      adjE:     adjE.toFixed(3),
      adjN:     adjN.toFixed(3),
      beaconNo: leg.beaconNo,
      monument: leg.monument,
    };
  });

  const eastings  = rows.map((r) => parseFloat(r.adjE));
  const northings = rows.map((r) => parseFloat(r.adjN));

  return {
    rows,
    totalDist,
    closureE,
    closureN,
    misclosureMm,
    precisionRatio: ratio,
    closureStatus: ratio >= 5000 ? 'PASS' : ratio > 0 ? 'FAIL' : 'UNVERIFIED',
    minE: Math.min(...eastings),
    maxE: Math.max(...eastings),
    minN: Math.min(...northings),
    maxN: Math.max(...northings),
  };
}

function TraverseSVG({
  data,
  width,
  height,
}: {
  data: DiagramData;
  width: number;
  height: number;
}) {
  const pad = 40;
  const spanE = data.maxE - data.minE || 1;
  const spanN = data.maxN - data.minN || 1;
  const scale = Math.min((width - pad * 2) / spanE, (height - pad * 2) / spanN) * 0.85;
  const cx    = width / 2;
  const cy    = height / 2;
  const centreE = (data.minE + data.maxE) / 2;
  const centreN = (data.minN + data.maxN) / 2;

  const toSvg = (e: number, n: number): [number, number] => [
    cx + (e - centreE) * scale,
    cy - (n - centreN) * scale,
  ];

  const pts = data.rows.map((r) => toSvg(parseFloat(r.adjE), parseFloat(r.adjN)));
  const polyline = [...pts, pts[0]].map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <svg width={width} height={height} className="bg-white">
      {[-2, -1, 0, 1, 2].map((i) => (
        <g key={`${i}-${i}`}>
          <line x1={0} y1={cy + i * 50} x2={width} y2={cy + i * 50} stroke="#e5e7eb" strokeWidth="0.5" />
          <line x1={cx + i * 50} y1={0} x2={cx + i * 50} y2={height} stroke="#e5e7eb" strokeWidth="0.5" />
        </g>
      ))}
      <polyline points={polyline} fill="rgba(30,80,100,0.06)" stroke="#1e5064" strokeWidth="1.5" strokeLinejoin="round" />
      {data.rows.map((row, i) => {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
        const rot   = angle > 90 || angle < -90 ? angle + 180 : angle;
        return (
          <text key={`${row}-${i}`} x={mx} y={my - 3} fontSize={8} fill="#1e5064" textAnchor="middle" transform={`rotate(${-rot}, ${mx}, ${my})`}>
            {row.bearing}  {row.distance}m
          </text>
        );
      })}
      {data.rows.map((row, i) => {
        const [px, py] = pts[i];
        return (
          <g key={row.station}>
            <circle cx={px} cy={py} r={5} fill="white" stroke="#1e5064" strokeWidth="1.5" />
            <circle cx={px} cy={py} r={1.5} fill="#1e5064" />
            <text x={px + 7} y={py - 4} fontSize={9} fontWeight="bold" fill="#111">{row.station}</text>
            {row.beaconNo && <text x={px + 7} y={py + 6} fontSize={7.5} fill="#6b7280">({row.beaconNo})</text>}
          </g>
        );
      })}
      {data.closureStatus !== 'UNVERIFIED' && (
        <g>
          <line
            x1={pts[pts.length - 1][0]}
            y1={pts[pts.length - 1][1]}
            x2={pts[pts.length - 1][0] + data.closureE * scale * 50}
            y2={pts[pts.length - 1][1] - data.closureN * scale * 50}
            stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 2"
          />
          <text
            x={pts[pts.length - 1][0] + data.closureE * scale * 50 + 4}
            y={pts[pts.length - 1][1] - data.closureN * scale * 50 - 4}
            fontSize={7.5} fill="#ef4444"
          >
            e={data.misclosureMm.toFixed(1)}mm (×50)
          </text>
        </g>
      )}
      <g transform={`translate(${width - 28}, ${height - 45})`}>
        <polygon points="0,-14 4,0 0,-4 -4,0" fill="#1e5064" />
        <text x={0} y={8} fontSize={10} fontWeight="bold" fill="#1e5064" textAnchor="middle">N</text>
      </g>
    </svg>
  );
}

export default function WorkingDiagramClient({ project, entries, projectId }: Props) {
  const router    = useRouter();
  const printRef  = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl]         = useState<string | null>(null);
  const [pdfError, setPdfError]     = useState<string | null>(null);

  const data = useMemo(() => computeDiagram(entries), [entries]);

  const handleGeneratePdf = async () => {
    setGenerating(true);
    setPdfError(null);
    try {
      const res = await fetch('/api/submission/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, documentId: 'working-diagram' }),
      });
      const json = await res.json() as { error?: string; fileUrl?: string };
      if (!res.ok) throw new Error(json.error ?? 'Generation failed');
      setPdfUrl(json.fileUrl ?? null);
    } catch (err: unknown) {
      setPdfError(err instanceof Error ? (err as Error).message : 'Unknown error');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between no-print">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-800 mr-3">← Back</button>
          <span className="font-semibold text-gray-900">{project.name}</span>
          <span className="text-sm text-gray-400 ml-2">Working Diagram</span>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Print</button>
          <button onClick={handleGeneratePdf} disabled={generating || !data} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {generating ? 'Generating…' : 'Download PDF'}
          </button>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">Open PDF</a>
          )}
        </div>
      </div>

      {pdfError && (
        <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 no-print">{pdfError}</div>
      )}

      {!data ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
          Insufficient traverse data. Add at least 3 bearing/distance observations in the Field Book.
        </div>
      ) : (
        <div ref={printRef} className="flex gap-0 bg-white mx-4 mt-4 mb-4 rounded-lg border border-gray-200 overflow-hidden print-container">
          <div className="flex-[62] border-r border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Traverse Plan — {project.name}</p>
            <TraverseSVG data={data} width={520} height={460} />
            <div className="mt-2 flex gap-4 text-xs text-gray-500">
              <span>UTM Zone {project.utm_zone}{project.hemisphere}</span>
              <span>{project.datum ?? 'Arc 1960'}</span>
              {project.lr_number && <span>LR: {project.lr_number}</span>}
            </div>
          </div>
          <div className="flex-[38] p-3 overflow-x-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Gale&apos;s Table</p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#1e5064] text-white">
                  {['Stn', 'Bearing', 'Dist (m)', 'ΔE', 'ΔN', 'Adj E', 'Adj N', 'Beacon'].map((h) => (
                    <th key={h} className="px-1.5 py-1 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={row.station} className={i % 2 === 0 ? 'bg-[#f0f5f8]' : 'bg-white'}>
                    <td className="px-1.5 py-1 font-medium">{row.station}</td>
                    <td className="px-1.5 py-1 font-mono text-[10px]">{row.bearing}</td>
                    <td className="px-1.5 py-1 text-right">{row.distance}</td>
                    <td className={`px-1.5 py-1 text-right ${parseFloat(row.dE) < 0 ? 'text-red-600' : ''}`}>{row.dE}</td>
                    <td className={`px-1.5 py-1 text-right ${parseFloat(row.dN) < 0 ? 'text-red-600' : ''}`}>{row.dN}</td>
                    <td className="px-1.5 py-1 text-right font-medium">{row.adjE}</td>
                    <td className="px-1.5 py-1 text-right font-medium">{row.adjN}</td>
                    <td className="px-1.5 py-1 text-gray-500">{row.beaconNo}</td>
                  </tr>
                ))}
                <tr className="bg-[#1e5064] text-white font-medium">
                  <td className="px-1.5 py-1">Σ</td><td />
                  <td className="px-1.5 py-1 text-right">{data.totalDist.toFixed(3)}</td>
                  <td className="px-1.5 py-1 text-right">{data.closureE.toFixed(3)}</td>
                  <td className="px-1.5 py-1 text-right">{data.closureN.toFixed(3)}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
            <div className="mt-4 border border-gray-200 rounded p-3 text-xs space-y-1.5">
              <p className="font-semibold text-gray-700 mb-2">Closure Summary</p>
              <div className="flex justify-between"><span className="text-gray-500">Misclosure</span><span className="font-medium">{data.misclosureMm.toFixed(1)} mm</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Precision ratio</span><span className="font-medium">1:{data.precisionRatio.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Min. standard</span><span className="text-gray-500">1:5000 (Cap 299)</span></div>
              <div className="flex justify-between mt-1 pt-1 border-t border-gray-100">
                <span className="font-medium">Status</span>
                <span className={`font-bold ${data.closureStatus === 'PASS' ? 'text-green-600' : data.closureStatus === 'FAIL' ? 'text-red-600' : 'text-gray-400'}`}>{data.closureStatus}</span>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-gray-400">Generated {new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      )}
      <style jsx global>{`
        @media print { .no-print { display: none !important; } .print-container { margin: 0 !important; border: none !important; } body { background: white; } }
      `}</style>
    </div>
  );
}
