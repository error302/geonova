'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Point2D } from '@/lib/engine/types';
import { PageHeader } from '@/components/shared/PageHeader';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer';
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder';
import { coordinateAreaSolution, offsetAreaSolution } from '@/lib/engine/solution/wrappers/area';
import { generatePDF, downloadCSV, toCSV } from '@/lib/export/helpers';
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface PointInput {
  id: number;
  n: string;
  e: string;
}

export default function AreaCalculator() {
  const { t } = useLanguage()
  const [points, setPoints] = useState<PointInput[]>([
    { id: 1, n: '5000', e: '3000' },
    { id: 2, n: '5234.5678', e: '3156.7890' },
    { id: 3, n: '5100', e: '3400' },
    { id: 4, n: '4800', e: '3200' },
  ]);
  const [method, setMethod] = useState<'coordinate' | 'trapezoidal' | 'simpsons'>('coordinate');
  const [offsets, setOffsets] = useState('10, 15, 18, 22, 20, 16');
  const [interval, setIntervalValueValue] = useState('20');
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const addPoint = () => {
    setPoints([...points, { id: Date.now(), n: '', e: '' }]);
  };

  const removePoint = (id: number) => {
    setPoints(points.filter((p) => p.id !== id));
  };

  const updatePoint = (id: number, field: 'n' | 'e', value: string) => {
    setPoints(points.map((p) => p.id === id ? { ...p, [field]: value } : p));
  };

  const calculate = () => {
    try {
      setCalcError(null);
      if (method === 'coordinate') {
        const pts: Point2D[] = points
          .map((p) => ({ northing: parseFloat(p.n), easting: parseFloat(p.e) }))
          .filter((p) => !isNaN(p.northing) && !isNaN(p.easting));
        if (pts.length >= 3) {
          const out = coordinateAreaSolution(pts);
          setSteps(out.steps);
          setSolutionTitle(out.solution.title);
        } else {
          setCalcError('Please enter at least 3 valid coordinate points.');
        }
      } else {
        const ord = offsets.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
        if (ord.length < 2) { setCalcError('Please enter at least 2 valid ordinates.'); return; }
        const int = parseFloat(interval);
        if (isNaN(int) || int <= 0) { setCalcError('Please enter a valid interval.'); return; }
        const out = offsetAreaSolution({ ordinates: ord, interval: int, method: method === 'trapezoidal' ? 'trapezoidal' : 'simpsons' });
        setSteps(out.steps);
        setSolutionTitle(out.solution.title);
      }
    } catch (err: unknown) {
      setCalcError((err as Error).message || 'An error occurred during calculation.');
      setSteps(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.area')}
        subtitle={t('tools.areaDesc')}
        reference="Survey Regulations 1994 | Survey Act Cap 299 | RDM 1.1 (2025)"
      />

      <div className="flex gap-4 mb-6 flex-wrap">
        <button onClick={() => { setMethod('coordinate'); setSteps(null); setSolutionTitle(undefined); }} className={`btn ${method === 'coordinate' ? 'btn-primary' : 'btn-secondary'}`}>
          Coordinate Method
        </button>
        <button onClick={() => { setMethod('trapezoidal'); setSteps(null); setSolutionTitle(undefined); }} className={`btn ${method === 'trapezoidal' ? 'btn-primary' : 'btn-secondary'}`}>
          Trapezoidal
        </button>
        <button onClick={() => { setMethod('simpsons'); setSteps(null); setSolutionTitle(undefined); }} className={`btn ${method === 'simpsons' ? 'btn-primary' : 'btn-secondary'}`}>
          Simpson&apos;s Rule
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {method === 'coordinate' ? (
            <div className="card">
              <div className="card-header flex justify-between items-center">
                <span className="label">Polygon Coordinates</span>
                <span className="text-xs text-[var(--text-muted)]">Enter points in order (CW or CCW)</span>
              </div>
              <div className="card-body">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pt</th>
                      <th>Northing (m)</th>
                      <th>Easting (m)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p, i) => (
                      <tr key={p.id}>
                        <td className="text-left font-semibold">{String.fromCharCode(65 + i)}</td>
                        <td><input className="input" value={p.n} onChange={e => updatePoint(p.id, 'n', e.target.value)} onFocus={e => e.target.select()} aria-label="Northing (m)" placeholder="e.g. 5000" /></td>
                        <td><input className="input" value={p.e} onChange={e => updatePoint(p.id, 'e', e.target.value)} onFocus={e => e.target.select()} aria-label="Easting (m)" placeholder="e.g. 3000" /></td>
                        <td><button onClick={() => removePoint(p.id)} className="text-[var(--error)] p-2 hover:bg-[var(--error)]/10 rounded">×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={addPoint} className="btn btn-secondary w-full mt-4">{t('toolUI.addPoint')}</button>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-header"><span className="label">Offset Method</span></div>
              <div className="card-body space-y-4">
                <div>
                  <label className="label" htmlFor="ordinates-comma-separated-m">Ordinates (comma-separated, m)</label>
                  <input id="ordinates-comma-separated-m" className="input" value={offsets} onChange={e => setOffsets(e.target.value)} placeholder="10, 15, 18, 22, 20, 16" />
                </div>
                <div>
                  <label className="label" htmlFor="interval-m">Interval (m)</label>
                  <input id="interval-m" className="input" value={interval} onChange={e => setIntervalValueValue(e.target.value)} placeholder="20" />
                </div>
              </div>
            </div>
          )}

          {calcError && <div className="text-red-500 bg-red-950/20 p-4 rounded mt-4">{calcError}</div>}
          <button onClick={calculate} className="btn btn-primary w-full mt-4">Calculate Area</button>
          {steps && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  generatePDF(
                    { title: 'Area Computation Certificate', reference: 'Survey Regulations 1994 | Survey Act Cap 299 | RDM 1.1 (2025)' },
                    [
                      { title: 'Computation Steps', rows: steps.map((s: SolutionStep) => ({ label: s.label, value: s.result || s.computation || '—' })) },
                    ],
                    method === 'coordinate' ? [
                      { title: 'Coordinate List', headers: ['Point', 'Northing (m)', 'Easting (m)'], rows: points.filter(p => p.n && p.e).map((p, i) => [String.fromCharCode(65 + i), p.n, p.e]) },
                    ] : [
                      { title: 'Offset Data', headers: ['Ordinate (m)', 'Interval (m)'], rows: offsets.split(',').map(s => s.trim()).filter(Boolean).map(o => [o, interval]) },
                    ],
                  )
                }}
                className="btn btn-secondary flex-1 inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> {t('toolUI.exportPdf')}
              </button>
              <button
                onClick={() => {
                  if (method === 'coordinate') {
                    const csv = toCSV(
                      ['Point', 'Northing (m)', 'Easting (m)'],
                      points.filter(p => p.n && p.e).map((p, i) => [String.fromCharCode(65 + i), p.n, p.e]),
                    )
                    downloadCSV(csv, 'area-coordinates')
                  } else {
                    const csv = toCSV(
                      ['Ordinate (m)', 'Interval (m)', 'Method'],
                      offsets.split(',').map(s => s.trim()).filter(Boolean).map(o => [o, interval, method]),
                    )
                    downloadCSV(csv, 'area-offsets')
                  }
                }}
                className="btn btn-secondary flex-1 inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> {t('toolUI.exportCsv')}
              </button>
            </div>
          )}
        </div>

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );
}
