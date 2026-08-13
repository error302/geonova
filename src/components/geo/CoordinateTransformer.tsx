'use client';

import { useState } from 'react';
import { getSupportedCRS, CoordSystem } from '@/lib/geo/transform';

interface Point { id: string; x: string; y: string; z: string; }

export default function CoordinateTransformer({ projectId }: { projectId?: string }) {
  const [fromCRS, setFromCRS] = useState<CoordSystem>('Arc1960-UTM37S');
  const [toCRS, setToCRS] = useState<CoordSystem>('WGS84');
  const [rows, setRows] = useState<Point[]>([{ id: '1', x: '', y: '', z: '' }]);
  const [results, setResults] = useState<Array<{ id: string; x: number; y: number; z?: number; warning?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crsList = getSupportedCRS();

  const addRow = () => setRows((r) => [...r, { id: String(r.length + 1), x: '', y: '', z: '' }]);

  const updateRow = (idx: number, field: keyof Point, value: string) =>
    setRows((r) => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  const handleTransform = async () => {
    setLoading(true);
    setError(null);
    try {
      const points = rows
        .filter((r) => r.x && r.y)
        .map((r) => ({ id: r.id, x: parseFloat(r.x), y: parseFloat(r.y), z: r.z ? parseFloat(r.z) : undefined }));

      const res = await fetch('/api/geo/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, fromCRS, toCRS, projectId }),
      });
      const data = (await res.json()) as { error?: string; points: Array<{ id: string; x: number; y: number; z?: number; warning?: string }> };
      if (!res.ok) throw new Error(data.error);
      setResults(data.points);
    } catch (err: unknown) {
      setError(err instanceof Error ? (err as Error).message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-lg font-semibold text-gray-800">Coordinate Transform</h2>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block" htmlFor="from">From</label>
          <select id="from" value={fromCRS} onChange={(e) => setFromCRS(e.target.value as CoordSystem)}
            className="w-full border rounded px-3 py-2 text-sm">
            {crsList.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block" htmlFor="to">To</label>
          <select  id="to" value={toCRS} onChange={(e) => setToCRS(e.target.value as CoordSystem)}
            className="w-full border rounded px-3 py-2 text-sm">
            {crsList.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[400px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-2 py-1 text-left">Point</th>
            <th className="border px-2 py-1 text-left">X / Easting</th>
            <th className="border px-2 py-1 text-left">Y / Northing</th>
            <th className="border px-2 py-1 text-left">Z / RL (opt)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`row-${row.id}-${idx}`}>
              <td className="border px-1"><input aria-label="Id" value={row.id} onChange={(e) => updateRow(idx, 'id', e.target.value)} className="w-full outline-none px-1" /></td>
              <td className="border px-1"><input value={row.x} onChange={(e) => updateRow(idx, 'x', e.target.value)} className="w-full outline-none px-1" aria-label="X coordinate" placeholder="0.000" /></td>
              <td className="border px-1"><input value={row.y} onChange={(e) => updateRow(idx, 'y', e.target.value)} className="w-full outline-none px-1" aria-label="Y coordinate" placeholder="0.000" /></td>
              <td className="border px-1"><input value={row.z} onChange={(e) => updateRow(idx, 'z', e.target.value)} className="w-full outline-none px-1" aria-label="Z coordinate (optional)" placeholder="optional" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="flex gap-2">
        <button onClick={addRow} className="px-3 py-1.5 text-sm bg-gray-100 rounded hover:bg-gray-200">+ Add Row</button>
        <button onClick={handleTransform} disabled={loading}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Transforming…' : 'Transform'}
        </button>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {results.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Results — {toCRS}</h3>
          <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[400px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-2 py-1 text-left">Point</th>
                <th className="border px-2 py-1 text-left">X</th>
                <th className="border px-2 py-1 text-left">Y</th>
                <th className="border px-2 py-1 text-left">Z</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, _i) => (
                <tr key={r.id} className={r.warning ? 'bg-yellow-50' : ''}>
                  <td className="border px-2 py-1">{r.id}</td>
                  <td className="border px-2 py-1">{r.x}</td>
                  <td className="border px-2 py-1">{r.y}</td>
                  <td className="border px-2 py-1">{r.z ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
