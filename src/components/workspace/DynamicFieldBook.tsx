'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SurveyType } from '@/types/project';
import { FieldBookColumn, FieldBookRow } from '@/types/fieldbook';
import { getFieldBookTemplate } from '@/lib/workflows/fieldBookTemplates';
import { applyAutoCalculations, validateFieldBook, FieldBookWarning } from '@/lib/workflows/autoCalculate';
import { runLevelingComputation, getLevelingClosureStatus } from '@/lib/compute/levelingRunner';
import { runBowditchAdjustment, getTraversePrecisionStatus } from '@/lib/compute/traverseRunner';
import { computeCutFillVolume, getCutFillSummary } from '@/lib/compute/volumeRunner';

interface Props {
  projectId: string;
  surveyType: SurveyType;
  initialRows?: FieldBookRow[];
  openingRL?: number;
  closingRL?: number;
  startPoint?: { name: string; easting: number; northing: number };
}

const FIXED_COLUMNS = new Set([
  'station', 'bs', 'is', 'fs', 'rl', 'instrument_height', 'remark',
]);

function emptyRow(columns: FieldBookColumn[]): FieldBookRow {
  return Object.fromEntries(columns.map((c) => [c.key, '']));
}

function rowToDbRecord(
  row: FieldBookRow,
  rowIndex: number,
  projectId: string,
  surveyType: string,
  columns: FieldBookColumn[]
) {
  const fixed: Record<string, unknown> = {
    project_id: projectId,
    row_index: rowIndex,
    survey_type: surveyType,
    updated_at: new Date().toISOString(),
  };

  const rawData: Record<string, unknown> = {};

  for (const col of columns) {
    const value = row[col.key] ?? null;
    const targetColumn = col.fixedColumn ?? (FIXED_COLUMNS.has(col.key) ? col.key : null);

    if (targetColumn) {
      if (['bs', 'is', 'fs', 'rl', 'instrument_height'].includes(targetColumn)) {
        fixed[targetColumn] = value !== '' && value !== null ? Number(value) : null;
      } else {
        fixed[targetColumn] = value !== '' ? value : null;
      }
    } else {
      rawData[col.key] = value !== '' ? value : null;
    }
  }

  fixed['raw_data'] = rawData;
  return fixed;
}

export default function DynamicFieldBook({ projectId, surveyType, initialRows = [], openingRL, closingRL, startPoint }: Props) {
  const supabase = createClient();
  const template = getFieldBookTemplate(surveyType);

  const [rows, setRows] = useState<FieldBookRow[]>(
    initialRows.length > 0 ? initialRows : [emptyRow(template.columns)]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [computeResult, setComputeResult] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<FieldBookWarning[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const saveTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };

  const addRow = () => setRows((prev) => [...prev, emptyRow(template.columns)]);

  const removeRow = (idx: number) => {
    if (deleteConfirm === idx) {
      setRows((prev) => prev.filter((_, i) => i !== idx));
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(idx);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const updateCell = useCallback((rowIdx: number, key: string, value: string) => {
    setRows((prev) => {
      const updated = prev.map((row, i) => (i === rowIdx ? { ...row, [key]: value } : row));
      const recalculated = applyAutoCalculations(surveyType, updated, rowIdx);
      const newWarnings = validateFieldBook(surveyType, recalculated);
      setWarnings(newWarnings);
      return recalculated;
    });

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      const records = rows.map((row, idx) =>
        rowToDbRecord(row, idx, projectId, surveyType, template.columns)
      );
      const { error: dbError } = await supabase
        .from('project_fieldbook_entries')
        .upsert(records, { onConflict: 'project_id,row_index' });
      if (!dbError) setLastSaved(new Date());
      setSaving(false);
    }, 500);
  }, [surveyType, projectId, template.columns, supabase, rows]);

  const handleCompute = useCallback(() => {
    try {
      if (surveyType === 'engineering' || surveyType === 'mining') {
        if (openingRL) {
          const result = runLevelingComputation({
            rows,
            openingRL,
            closingRL: closingRL ? Number(closingRL) : undefined,
            method: 'rise_and_fall',
          });
          const status = getLevelingClosureStatus(result);
          setComputeResult(status.message);
        } else {
          setComputeResult('Please provide opening RL in project settings');
        }
      } else if (surveyType === 'cadastral') {
        if (startPoint) {
          const result = runBowditchAdjustment({
            rows,
            startPoint,
          });
          const status = getTraversePrecisionStatus(result);
          setComputeResult(status.message);
        } else {
          setComputeResult('Please provide start point coordinates in project settings');
        }
      } else if (surveyType === 'topographic') {
        const sections = rows
          .filter((r) => r.chainage && r.area)
          .map((r) => ({ chainage: Number(r.chainage), area: Number(r.area) }))
          .sort((a, b) => a.chainage - b.chainage);
        
        if (sections.length >= 2) {
          const result = computeCutFillVolume(sections);
          const summary = getCutFillSummary(result);
          setComputeResult(`Cut: ${summary.cut} | Fill: ${summary.fill} | Net: ${summary.net}`);
        } else {
          setComputeResult('Need at least 2 rows with chainage and area for volume calculation');
        }
      } else if (surveyType === 'geodetic') {
        setComputeResult('Coming in Phase 16 — baseline processing');
      } else if (surveyType === 'hydrographic') {
        setComputeResult('Coming in Phase 16 — tidal correction');
      } else if (surveyType === 'drone') {
        setComputeResult('Coming in Phase 16 — GCP processing');
      } else if (surveyType === 'deformation') {
        const epochs = new Set(rows.map((r) => r.epoch).filter(Boolean));
        if (epochs.size < 2) {
          setComputeResult('Minimum 2 epochs required for comparison');
        } else {
          setComputeResult('Coming in Phase 16 — epoch comparison');
        }
      }
    } catch (e) {
      setComputeResult(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }, [rows, surveyType, openingRL, closingRL, startPoint]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const records = rows.map((row, idx) =>
      rowToDbRecord(row, idx, projectId, surveyType, template.columns)
    );

    const { error: dbError } = await supabase
      .from('project_fieldbook_entries')
      .upsert(records, { onConflict: 'project_id,row_index' });

    if (dbError) {
      setError('Save failed: ' + dbError.message);
    } else {
      setLastSaved(new Date());
    }
    setSaving(false);
  };

  const renderCell = (col: FieldBookColumn, row: FieldBookRow, rowIdx: number) => {
    const value = String(row[col.key] ?? '');
    const base = 'w-full text-sm outline-none bg-transparent px-1 py-0.5';

    if (col.type === 'select' && col.options) {
      return (
        <select
          value={value}
          onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
          className={base}
        >
          <option value="">—</option>
          {col.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
        value={value}
        placeholder={col.placeholder ?? ''}
        step={col.type === 'number' ? 'any' : undefined}
        onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
        className={base}
      />
    );
  };

  const requiredKeys = template.columns.filter((c) => c.required).map((c) => c.key);
  const hasEmptyRequired = rows.some((row) => requiredKeys.some((k) => !row[k]));

  const getComputeButtonLabel = () => {
    switch (surveyType) {
      case 'cadastral': return 'Adjust Traverse (Bowditch)';
      case 'engineering': return 'Reduce Levels';
      case 'topographic': return 'Generate DTM';
      case 'mining': return 'Calculate Volume';
      case 'geodetic': return 'Process Baselines';
      case 'hydrographic': return 'Generate Sounding Chart';
      case 'drone': return 'Process GCPs';
      case 'deformation': return 'Compare Epochs';
      default: return 'Compute';
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">{template.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {lastSaved && <span className="text-xs text-green-600">Saved {lastSaved.toLocaleTimeString()}</span>}
          <button onClick={handleCompute} disabled={saving} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
            {getComputeButtonLabel()}
          </button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-max">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-8 px-2 py-1.5 text-left text-xs font-medium text-gray-500">#</th>
              {template.columns.map((col) => (
                <th key={col.key} className={`px-2 py-1.5 text-left text-xs font-medium text-gray-600 w-${col.width ?? '28'}`}>
                  {col.label}{col.required && <span className="text-red-400 ml-0.5">*</span>}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-1 text-xs text-gray-400 text-right select-none">{rowIdx + 1}</td>
                {template.columns.map((col) => (
                  <td key={col.key} className={`border-l border-gray-100 px-1 py-0.5 ${col.required && !row[col.key] ? 'bg-red-50' : ''}`}>
                    {renderCell(col, row, rowIdx)}
                  </td>
                ))}
                <td className="border-l border-gray-100 px-1 py-0.5 text-center">
                  <button
                    onClick={() => removeRow(rowIdx)}
                    disabled={rows.length === 1}
                    className={`text-xs ${deleteConfirm === rowIdx ? 'text-red-600 font-medium' : 'text-gray-300 hover:text-red-400'} disabled:opacity-0`}
                    title={deleteConfirm === rowIdx ? 'Click again to confirm' : 'Delete row'}
                  >
                    {deleteConfirm === rowIdx ? '✓' : '✕'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
        <button onClick={addRow} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add Row</button>
        <div className="flex items-center gap-3">
          {hasEmptyRequired && <span className="text-xs text-amber-600">Required fields (*) must be filled.</span>}
          <span className="text-xs text-gray-400">{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex flex-wrap gap-2">
          {warnings.map((w, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                w.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {w.rowIndex !== undefined && <span className="mr-1">Row {w.rowIndex + 1}:</span>}
              {w.message}
            </span>
          ))}
        </div>
      )}

      {error && <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600">{error}</div>}
      {computeResult && (
        <div className={`px-4 py-2 border-t text-xs ${computeResult.startsWith('Error') ? 'bg-red-50 border-red-100 text-red-600' : 'bg-green-50 border-green-100 text-green-700'}`}>
          {computeResult}
        </div>
      )}
    </div>
  );
}