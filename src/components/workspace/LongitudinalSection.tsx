'use client';

import { useState } from 'react';

interface SectionPoint {
  chainage: number;
  rl: number;
  remark?: string;
}

interface Props {
  projectId: string;
  points?: SectionPoint[];
}

export default function LongitudinalSection({ projectId, points = [] }: Props) {
  const [data, setData] = useState<SectionPoint[]>(points);

  const addRow = () =>
    setData((prev) => [...prev, { chainage: 0, rl: 0, remark: '' }]);

  const updateRow = (
    idx: number,
    field: keyof SectionPoint,
    value: string
  ) => {
    setData((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, [field]: field === 'remark' ? value : parseFloat(value) || 0 } : row
      )
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4 bg-white">
      <h3 className="font-semibold text-gray-800 mb-3">Longitudinal Section</h3>
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[320px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-2 py-1 text-left">Chainage (m)</th>
            <th className="border px-2 py-1 text-left">RL (m)</th>
            <th className="border px-2 py-1 text-left">Remark</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={`lsec-${idx}`}>
              <td className="border px-1 py-1">
                <input aria-label="Chainage"
                  type="number"
                  value={row.chainage}
                  onChange={(e) => updateRow(idx, 'chainage', e.target.value)}
                  className="w-full outline-none"
                />
              </td>
              <td className="border px-1 py-1">
                <input aria-label="Rl"
                  type="number"
                  value={row.rl}
                  onChange={(e) => updateRow(idx, 'rl', e.target.value)}
                  className="w-full outline-none"
                />
              </td>
              <td className="border px-1 py-1">
                <input aria-label="Remark"
                  type="text"
                  value={row.remark ?? ''}
                  onChange={(e) => updateRow(idx, 'remark', e.target.value)}
                  className="w-full outline-none"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <button
        onClick={addRow}
        className="mt-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
      >
        + Add Row
      </button>
    </div>
  );
}
