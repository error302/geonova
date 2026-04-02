'use client';

import { ParseResult } from '@/types/importer';

interface Props {
  result: ParseResult;
  fileName: string;
  onCommit: () => void;
  onCancel: () => void;
  committing: boolean;
  error: string | null;
  precision?: string;
}

const PREVIEW_COLUMNS: (keyof ParseResult['points'][0])[] = ['point_no', 'easting', 'northing', 'rl', 'code', 'remark'];

export default function ImportPreviewTable({ result, fileName, onCommit, onCancel, committing, error, precision }: Props) {
  const preview = result.points.slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">{fileName}</h3>
          <p className="text-sm text-gray-500">
            Format: <strong>{result.format.toUpperCase()}</strong> — {result.points.length} points parsed
          </p>
          {precision && (
            <p className="text-sm text-green-600 font-medium">Precision: {precision}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onCommit}
            disabled={committing || result.points.length === 0}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {committing ? 'Importing…' : `Add ${result.points.length} rows to Field Book`}
          </button>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-700">{w}</p>
          ))}
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              {PREVIEW_COLUMNS.map((col) => (
                <th key={String(col)} className="px-3 py-2 text-left font-medium text-gray-600">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((point, i) => (
              <tr key={i} className="border-t border-gray-100">
                {PREVIEW_COLUMNS.map((col) => (
                  <td key={String(col)} className="px-3 py-1.5 text-gray-700">
                    {String(point[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {result.points.length > 20 && (
          <p className="text-xs text-gray-400 text-center py-2">
            Showing first 20 of {result.points.length} rows
          </p>
        )}
      </div>
    </div>
  );
}
