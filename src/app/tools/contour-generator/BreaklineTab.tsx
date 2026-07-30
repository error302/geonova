'use client';

/**
 * BreaklineTab — manage breaklines for the contour generator.
 *
 * AUDIT FIX (2026-07-03): The contour engine has full breakline support
 * (enforceBreaklines, splitTriangleByBreakline) but there was no UI to
 * define them. This tab provides three ways to add breaklines:
 *
 * 1. Manual entry: type start/end point names (must match imported points)
 *    or enter raw easting/northing coordinates
 * 2. Import from CSV: paste a polyline definition (one breakline per line,
 *    format: startName,endName or e1,n1,e2,n2)
 * 3. Pick from existing points: click two points from a dropdown
 *
 * Breaklines constrain the TIN so triangles don't cross ridges, roads,
 * channels, or other terrain discontinuities. Without breaklines, the
 * Delaunay triangulation may create triangles that smooth over real
 * terrain features.
 */

import { useState, useMemo } from 'react';
import { Plus, Trash2, Upload, Zap, Info } from 'lucide-react';
import type { SpotHeight, Breakline } from '@/lib/engine/contours';
import { fmt } from './helpers';

interface BreaklineTabProps {
  points: SpotHeight[];
  breaklines: Breakline[];
  setBreaklines: (bl: Breakline[]) => void;
}

export function BreaklineTab({ points, breaklines, setBreaklines }: BreaklineTabProps) {
  const [inputMode, setInputMode] = useState<'pick' | 'coords' | 'csv'>('pick');
  const [startName, setStartName] = useState('');
  const [endName, setEndName] = useState('');
  const [startE, setStartE] = useState('');
  const [startN, setStartN] = useState('');
  const [endE, setEndE] = useState('');
  const [endN, setEndN] = useState('');
  const [startZ, setStartZ] = useState('');
  const [endZ, setEndZ] = useState('');
  const [csvText, setCsvText] = useState('');
  const [error, setError] = useState('');

  // Build a lookup map of point names → SpotHeight
  const pointMap = useMemo(() => {
    const m = new Map<string, SpotHeight>();
    for (const p of points) {
      if (p.name) m.set(p.name.toUpperCase(), p);
    }
    return m;
  }, [points]);

  const addBreaklinePick = () => {
    setError('');
    if (!startName || !endName) {
      setError('Select both start and end points.');
      return;
    }
    const start = pointMap.get(startName.toUpperCase());
    const end = pointMap.get(endName.toUpperCase());
    if (!start) {
      setError(`Point "${startName}" not found in imported data.`);
      return;
    }
    if (!end) {
      setError(`Point "${endName}" not found in imported data.`);
      return;
    }
    if (start.name === end.name) {
      setError('Start and end points must be different.');
      return;
    }
    setBreaklines([...breaklines, { start, end }]);
    setStartName('');
    setEndName('');
  };

  const addBreaklineCoords = () => {
    setError('');
    const se = parseFloat(startE);
    const sn = parseFloat(startN);
    const ee = parseFloat(endE);
    const en = parseFloat(endN);
    if (isNaN(se) || isNaN(sn) || isNaN(ee) || isNaN(en)) {
      setError('Enter valid numeric coordinates for both endpoints.');
      return;
    }
    const sz = startZ ? parseFloat(startZ) : 0;
    const ez = endZ ? parseFloat(endZ) : 0;
    if (se === ee && sn === en) {
      setError('Start and end coordinates must be different.');
      return;
    }
    setBreaklines([
      ...breaklines,
      {
        start: { easting: se, northing: sn, elevation: sz, name: `BL${breaklines.length + 1}S` },
        end: { easting: ee, northing: en, elevation: ez, name: `BL${breaklines.length + 1}E` },
      },
    ]);
    setStartE(''); setStartN(''); setStartZ('');
    setEndE(''); setEndN(''); setEndZ('');
  };

  const importCSV = () => {
    setError('');
    const lines = csvText.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
    if (lines.length === 0) {
      setError('Paste at least one breakline line.');
      return;
    }

    const newBreaklines: Breakline[] = [];
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/[,\t]/).map(s => s.trim());
      if (parts.length < 2) {
        errors.push(`Line ${i + 1}: expected at least 2 columns`);
        continue;
      }

      // Try name-based first (2 columns = startName, endName)
      if (parts.length === 2) {
        const start = pointMap.get(parts[0].toUpperCase());
        const end = pointMap.get(parts[1].toUpperCase());
        if (!start) { errors.push(`Line ${i + 1}: point "${parts[0]}" not found`); continue; }
        if (!end) { errors.push(`Line ${i + 1}: point "${parts[1]}" not found`); continue; }
        newBreaklines.push({ start, end });
      } else if (parts.length >= 4) {
        // Coordinate-based: e1, n1, e2, n2 [, z1, z2]
        const e1 = parseFloat(parts[0]);
        const n1 = parseFloat(parts[1]);
        const e2 = parseFloat(parts[2]);
        const n2 = parseFloat(parts[3]);
        if (isNaN(e1) || isNaN(n1) || isNaN(e2) || isNaN(n2)) {
          errors.push(`Line ${i + 1}: invalid coordinates`);
          continue;
        }
        const z1 = parts[4] ? parseFloat(parts[4]) : 0;
        const z2 = parts[5] ? parseFloat(parts[5]) : 0;
        newBreaklines.push({
          start: { easting: e1, northing: n1, elevation: z1, name: `BL${breaklines.length + newBreaklines.length + 1}S` },
          end: { easting: e2, northing: n2, elevation: z2, name: `BL${breaklines.length + newBreaklines.length + 1}E` },
        });
      } else {
        errors.push(`Line ${i + 1}: expected 2 columns (names) or 4+ columns (coords)`);
      }
    }

    if (newBreaklines.length > 0) {
      setBreaklines([...breaklines, ...newBreaklines]);
    }
    if (errors.length > 0) {
      setError(`${errors.length} line(s) skipped:\n${errors.join('\n')}`);
    }
    setCsvText('');
  };

  const removeBreakline = (index: number) => {
    setBreaklines(breaklines.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setBreaklines([]);
    setError('');
  };

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/15">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300/80">
          <p className="font-semibold mb-1">Breaklines</p>
          <p className="text-xs leading-relaxed">
            Breaklines constrain the TIN so triangles don&apos;t cross terrain discontinuities
            (ridges, roads, channels, retaining walls, river banks). Without breaklines,
            Delaunay triangulation may smooth over these features. Define breaklines along
            the tops and bottoms of slopes for accurate contour generation.
          </p>
        </div>
      </div>

      {/* Input mode selector */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
        <div className="flex gap-2 mb-4">
          {([
            { id: 'pick', label: 'Pick from points' },
            { id: 'coords', label: 'Enter coordinates' },
            { id: 'csv', label: 'Import CSV' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => { setInputMode(tab.id); setError(''); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                inputMode === tab.id
                  ? 'bg-[var(--accent)] text-black'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mode 1: Pick from existing points */}
        {inputMode === 'pick' && (
          <div className="space-y-3">
            {points.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                Import survey points first, then pick breakline endpoints from them.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">Start point</label>
                    <select
                      value={startName}
                      onChange={e => setStartName(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white"
                    >
                      <option value="">— select —</option>
                      {points.map((p, i) => (
                        <option key={i} value={p.name || ''}>
                          {p.name || `${fmt(p.easting, 1)}, ${fmt(p.northing, 1)}`} (Z={fmt(p.elevation, 2)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-1">End point</label>
                    <select
                      value={endName}
                      onChange={e => setEndName(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white"
                    >
                      <option value="">— select —</option>
                      {points.map((p, i) => (
                        <option key={i} value={p.name || ''}>
                          {p.name || `${fmt(p.easting, 1)}, ${fmt(p.northing, 1)}`} (Z={fmt(p.elevation, 2)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={addBreaklinePick}
                  disabled={!startName || !endName}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" /> Add Breakline
                </button>
              </>
            )}
          </div>
        )}

        {/* Mode 2: Enter coordinates directly */}
        {inputMode === 'coords' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Start E</label>
                <input type="number" step="0.001" value={startE} onChange={e => setStartE(e.target.value)}
                  placeholder="254812.403"
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white font-mono" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Start N</label>
                <input type="number" step="0.001" value={startN} onChange={e => setStartN(e.target.value)}
                  placeholder="9856214.778"
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white font-mono" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Start Z (opt)</label>
                <input type="number" step="0.01" value={startZ} onChange={e => setStartZ(e.target.value)}
                  placeholder="1560.12"
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">End E</label>
                <input type="number" step="0.001" value={endE} onChange={e => setEndE(e.target.value)}
                  placeholder="254937.125"
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white font-mono" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">End N</label>
                <input type="number" step="0.001" value={endN} onChange={e => setEndN(e.target.value)}
                  placeholder="9856340.501"
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white font-mono" />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">End Z (opt)</label>
                <input type="number" step="0.01" value={endZ} onChange={e => setEndZ(e.target.value)}
                  placeholder="1561.08"
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm text-white font-mono" />
              </div>
            </div>
            <button
              onClick={addBreaklineCoords}
              disabled={!startE || !startN || !endE || !endN}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Add Breakline
            </button>
          </div>
        )}

        {/* Mode 3: Import from CSV */}
        {inputMode === 'csv' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              One breakline per line. Format: <code className="bg-[var(--bg-tertiary)] px-1 rounded">startName,endName</code> (names must match imported points)
              {' '}or <code className="bg-[var(--bg-tertiary)] px-1 rounded">e1,n1,e2,n2[,z1,z2]</code> (raw coordinates).
              Lines starting with # are ignored.
            </p>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={'# Name-based:\nBP1, BP5\nBP5, BP12\n\n# Coordinate-based:\n254812.403, 9856214.778, 254937.125, 9856340.501\n254937.125, 9856340.501, 255061.802, 9856466.234'}
              rows={8}
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-sm font-mono text-white placeholder:text-[var(--text-muted)]"
            />
            <button
              onClick={importCSV}
              disabled={!csvText.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold disabled:opacity-40"
            >
              <Upload className="w-4 h-4" /> Import Breaklines
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-900/20 border border-red-700/40 text-red-400 text-xs whitespace-pre-line">
            {error}
          </div>
        )}
      </div>

      {/* Breakline list */}
      {breaklines.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">
              Defined Breaklines ({breaklines.length})
            </h2>
            <button
              onClick={clearAll}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear all
            </button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {breaklines.map((bl, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]"
              >
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--text-muted)]">Start: </span>
                    <span className="font-mono text-white">
                      {bl.start.name || `${fmt(bl.start.easting, 1)},${fmt(bl.start.northing, 1)}`}
                    </span>
                    {bl.start.elevation !== 0 && (
                      <span className="text-[var(--text-muted)]"> Z={fmt(bl.start.elevation, 2)}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">End: </span>
                    <span className="font-mono text-white">
                      {bl.end.name || `${fmt(bl.end.easting, 1)},${fmt(bl.end.northing, 1)}`}
                    </span>
                    {bl.end.elevation !== 0 && (
                      <span className="text-[var(--text-muted)]"> Z={fmt(bl.end.elevation, 2)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeBreakline(i)}
                  className="p-1 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                  title="Remove breakline"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {breaklines.length === 0 && points.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No breaklines defined. Breaklines are optional — contours will still
            generate without them, but may smooth over terrain discontinuities.
          </p>
        </div>
      )}
    </div>
  );
}
