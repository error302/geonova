'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { coordinateArea } from '@/lib/engine/area';
import { distanceBearing } from '@/lib/engine/distance';

interface Point {
  id: string;
  name: string;
  easting: number;
  northing: number;
  elevation?: number | null;
  is_control?: boolean;
  locked?: boolean;
}

interface ParcelBuilderModalProps {
  projectId: string;
  points: Point[];
  onClose: () => void;
  onParcelCreated: (parcel?: { id: string; name: string | null; boundary_points: Array<{ name?: string; easting: number; northing: number }>; created_at?: string }) => void;
  onDraftBoundaryChange?: (boundary: Array<{ easting: number; northing: number }> | null) => void;
}

interface BoundaryPoint {
  id: string;
  name: string;
  easting: number;
  northing: number;
}

interface BoundaryLine {
  from: string;
  to: string;
  bearing: string;
  bearingDeg: number;
  distance: number;
}

export default function ParcelBuilderModal({ projectId, points, onClose, onParcelCreated, onDraftBoundaryChange }: ParcelBuilderModalProps) {
  const [parcelName, setParcelName] = useState('');
  const [selectedPoints, setSelectedPoints] = useState<BoundaryPoint[]>([]);
  const [isSelecting, setIsSelecting] = useState(true);
  const [boundaryLines, setBoundaryLines] = useState<BoundaryLine[]>([]);
  const [areaResult, setAreaResult] = useState<{
    areaSqm: number;
    areaHa: number;
    areaAcres: number;
    perimeter: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (selectedPoints.length >= 3) {
      computeParcel();
    } else {
      setBoundaryLines([]);
      setAreaResult(null);
    }
  }, [selectedPoints]);

  useEffect(() => {
    onDraftBoundaryChange?.(selectedPoints.length ? selectedPoints.map((p) => ({ easting: p.easting, northing: p.northing })) : null);
    return () => onDraftBoundaryChange?.(null);
  }, [selectedPoints, onDraftBoundaryChange]);

  const computeParcel = () => {
    if (selectedPoints.length < 3) return;

    const coords = selectedPoints.map(p => ({ easting: p.easting, northing: p.northing }));
    const areaData = coordinateArea(coords);

    const lines: BoundaryLine[] = [];
    for (let i = 0; i < selectedPoints.length; i++) {
      const from = selectedPoints[i];
      const to = selectedPoints[(i + 1) % selectedPoints.length];
      const db = distanceBearing(from, to);
      lines.push({
        from: from.name,
        to: to.name,
        bearing: db.bearingDMS,
        bearingDeg: db.bearing,
        distance: db.distance
      });
    }

    setBoundaryLines(lines);
    setAreaResult({
      areaSqm: areaData.areaSqm,
      areaHa: areaData.areaHa,
      areaAcres: areaData.areaAcres,
      perimeter: areaData.perimeter
    });
  };

  const handlePointClick = (point: Point) => {
    if (!isSelecting) return;

    if (selectedPoints.length > 0 && selectedPoints[0].id === point.id) {
      if (selectedPoints.length >= 3) setIsSelecting(false);
      return;
    }

    if (selectedPoints.find(p => p.id === point.id)) return;

    setSelectedPoints([
      ...selectedPoints,
      {
        id: point.id,
        name: point.name,
        easting: point.easting,
        northing: point.northing
      }
    ]);
  };

  const handleSave = async () => {
    if (!parcelName || selectedPoints.length < 3 || !areaResult) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.from('parcels').insert({
        project_id: projectId,
        name: parcelName,
        point_ids: selectedPoints.map(p => p.id),
        boundary_points: selectedPoints.map(p => ({
          name: p.name,
          easting: p.easting,
          northing: p.northing
        })),
        area_sqm: areaResult.areaSqm,
        area_ha: areaResult.areaHa,
        area_acres: areaResult.areaAcres,
        perimeter_m: areaResult.perimeter,
        created_by: user?.id
      }).select('id, name, boundary_points, created_at').single();

      if (error) throw error;

      onParcelCreated((data as any) ?? undefined);
      onClose();
    } catch (err) {
      console.error('Error saving parcel:', err);
      alert('Failed to save parcel');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedPoints([]);
    setIsSelecting(true);
    setBoundaryLines([]);
    setAreaResult(null);
    setParcelName('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Build Parcel</h2>
            <p className="text-sm text-gray-400">Click points in boundary order. Click first point to close.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-200 mb-3">Available Points</h3>
              <div className="bg-[var(--bg-tertiary)] rounded-lg p-3 max-h-64 overflow-y-auto">
                {points.filter(p => !p.locked).length === 0 ? (
                  <p className="text-gray-500 text-sm">No points available</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {points.filter(p => !p.locked).map(point => {
                      const isAlreadySelected = selectedPoints.some(p => p.id === point.id)
                      const isFirst = selectedPoints.length > 0 && selectedPoints[0].id === point.id
                      const canClose = isFirst && selectedPoints.length >= 3
                      const disabled = !isSelecting || (isAlreadySelected && !canClose)

                      return (
                        <button
                          key={point.id}
                          onClick={() => handlePointClick(point)}
                          disabled={disabled}
                          className={`px-3 py-2 rounded text-sm font-mono text-left transition-colors ${
                            isAlreadySelected
                              ? canClose
                                ? 'bg-green-900/40 border border-green-700 text-green-200 hover:bg-green-900/60'
                                : 'bg-[#E8841A] text-black'
                              : isSelecting
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                : 'bg-[var(--bg-tertiary)] text-gray-500 cursor-not-allowed'
                          }`}
                          title={canClose ? 'Click to close boundary' : undefined}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{point.name}</span>
                            {canClose ? <span className="text-xs font-sans">Close</span> : null}
                          </div>
                          <span className="text-xs text-gray-400 ml-1 block">
                            {point.easting.toFixed(0)}, {point.northing.toFixed(0)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {isSelecting && selectedPoints.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Selected Boundary ({selectedPoints.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPoints.map((p, idx) => (
                      <span key={p.id} className="px-2 py-1 bg-[#E8841A]/20 text-[#E8841A] rounded text-sm">
                        {p.name}
                        {idx < selectedPoints.length - 1 && ' → '}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedPoints.length >= 3) setIsSelecting(false)
                      }}
                      disabled={selectedPoints.length < 3}
                      className="px-3 py-2 bg-[var(--bg-tertiary)] hover:bg-gray-700 text-gray-200 rounded text-sm disabled:opacity-50"
                    >
                      Close boundary
                    </button>
                    <span className="text-xs text-gray-500">
                      or click the first point again
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              {areaResult ? (
                <div className="bg-[var(--bg-tertiary)] rounded-xl p-6">
                  <h3 className="font-bold text-white text-lg mb-4">PARCEL SUMMARY</h3>
                  {isSelecting ? (
                    <div className="mb-3 rounded border border-amber-700/50 bg-amber-900/10 px-3 py-2 text-xs text-amber-200">
                      Preview only — close the boundary (click the first point again) to enter a name and save.
                    </div>
                  ) : null}
                  <div className="border-b border-[var(--border-color)] pb-2 mb-3">
                    <span className="text-gray-400 text-sm">Boundary: </span>
                    <span className="text-gray-200">
                      {selectedPoints.map(p => p.name).join(' → ')}
                    </span>
                  </div>

                  <table className="w-full text-sm mb-4">
                    <thead>
                      <tr className="border-b border-[var(--border-color)]">
                        <th className="text-left py-2 text-gray-400">Line</th>
                        <th className="text-right py-2 text-gray-400">Bearing</th>
                        <th className="text-right py-2 text-gray-400">Distance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {boundaryLines.map((line, idx) => (
                        <tr key={idx} className="border-b border-[var(--border-color)]">
                          <td className="py-2 text-gray-300">{line.from}→{line.to}</td>
                          <td className="py-2 text-right font-mono text-gray-300">{line.bearing}</td>
                          <td className="py-2 text-right font-mono text-gray-300">{line.distance.toFixed(3)} m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="space-y-2 pt-4 border-t border-[var(--border-color)]">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Area:</span>
                      <span className="font-mono text-white">{areaResult.areaSqm.toFixed(4)} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400"></span>
                      <span className="font-mono text-white">{areaResult.areaHa.toFixed(6)} ha</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400"></span>
                      <span className="font-mono text-white">{areaResult.areaAcres.toFixed(4)} acres</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[var(--border-color)]">
                      <span className="text-gray-400">Perimeter:</span>
                      <span className="font-mono text-white">{areaResult.perimeter.toFixed(3)} m</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-800/50 rounded-xl p-6 text-center">
                  <p className="text-gray-500">
                    {selectedPoints.length < 3
                      ? `Select at least 3 points (${3 - selectedPoints.length} more)`
                      : 'Click the first point again to close the boundary'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {!isSelecting && areaResult && (
            <div className="border-t border-[var(--border-color)] pt-6">
              <div className="max-w-md">
                <label className="label">Parcel Name</label>
                <input
                  className="input"
                  value={parcelName}
                  onChange={e => setParcelName(e.target.value)}
                  placeholder="e.g., Plot A, Parcel 1"
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[var(--border-color)] flex gap-3 justify-end">
          <button onClick={handleReset} className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-gray-700 text-gray-300 rounded">
            Reset
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-gray-700 text-gray-300 rounded">
            Cancel
          </button>
          {!isSelecting && areaResult && (
            <button
              onClick={handleSave}
              disabled={!parcelName || saving}
              className="px-6 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Parcel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
