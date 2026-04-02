'use client';

import { useState } from 'react';
import { ParseResult, ParsedPoint } from '@/types/importer';

interface Props {
  rawContent: string;
  onMapped: (result: ParseResult) => void;
  onCancel: () => void;
}

const TARGET_FIELDS: (keyof ParsedPoint)[] = [
  'point_no', 'easting', 'northing', 'rl', 'bearing', 'distance', 'code', 'remark'
];

export default function GenericCSVMapper({ rawContent, onMapped, onCancel }: Props) {
  const lines = rawContent.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());

  const [mappings, setMappings] = useState<Record<string, keyof ParsedPoint | ''>>(() => {
    const initial: Record<string, keyof ParsedPoint | ''> = {};
    headers.forEach((h) => {
      const lower = h.toLowerCase();
      if (lower.includes('east') || lower === 'e' || lower === 'x') initial[h] = 'easting';
      else if (lower.includes('north') || lower === 'n' || lower === 'y') initial[h] = 'northing';
      else if (lower.includes('rl') || lower.includes('elev') || lower.includes('height') || lower === 'z') initial[h] = 'rl';
      else if (lower.includes('point') || lower.includes('pt') || lower.includes('name')) initial[h] = 'point_no';
      else if (lower.includes('code') || lower.includes('desc')) initial[h] = 'code';
      else initial[h] = '';
    });
    return initial;
  });

  const handleApply = () => {
    const points: ParsedPoint[] = [];
    const warnings: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const point: ParsedPoint = { raw: {} };

      headers.forEach((h, idx) => {
        const target = mappings[h];
        if (!target) return;
        const val = values[idx];
        const numericFields: (keyof ParsedPoint)[] = ['easting', 'northing', 'rl', 'bearing', 'distance'];
        if (numericFields.includes(target)) {
          (point as Record<string, unknown>)[target] = parseFloat(val);
        } else {
          (point as Record<string, unknown>)[target] = val;
        }
        (point.raw as Record<string, unknown>)[h] = val;
      });

      if (Number.isNaN(point.easting!) && Number.isNaN(point.northing!)) {
        warnings.push(`Row ${i + 1}: no valid coordinates after mapping — skipped`);
        continue;
      }

      points.push(point);
    }

    onMapped({ format: 'csv', points, warnings });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800">Map Columns</h3>
      <p className="text-sm text-gray-500">
        Format not recognised. Match your file columns to survey fields.
      </p>

      <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
        {headers.map((h) => (
          <div key={h} className="flex items-center gap-2">
            <span className="text-sm text-gray-700 w-32 truncate">{h}</span>
            <select
              value={mappings[h]}
              onChange={(e) => setMappings((prev) => ({ ...prev, [h]: e.target.value as keyof ParsedPoint | '' }))}
              className="flex-1 text-sm border rounded px-2 py-1"
            >
              <option value="">— skip —</option>
              {TARGET_FIELDS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={handleApply} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
          Apply Mapping
        </button>
      </div>
    </div>
  );
}
