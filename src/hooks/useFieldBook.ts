'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/api-client/client';
import { SurveyType } from '@/types/project';
import { FieldBookRow } from '@/types/fieldbook';

interface UseFieldBookOptions {
  projectId: string;
  surveyType: SurveyType;
  initialRows?: FieldBookRow[];
}

interface FieldBookEntryRow {
  id: string
  row_index: number
  raw_data: Record<string, string | number | null>
}

export function useFieldBook({ projectId, surveyType, initialRows = [] }: UseFieldBookOptions) {
  const dbClient = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<FieldBookRow[]>(initialRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await dbClient
      .from('project_fieldbook_entries')
      .select('*')
      .eq('project_id', projectId)
      .eq('survey_type', surveyType)
            .order('row_index', { ascending: true }) as unknown as { data: Array<Record<string, unknown>> | null; error: { message: string } | null };

    if (fetchError) {
      setError('Failed to load: ' + fetchError.message);
      setLoading(false);
      return;
    }

    const rowsData = data as FieldBookEntryRow[] | null
    if (rowsData && rowsData.length > 0) {
      const loadedRows = rowsData.map((r) => {
        const row: FieldBookRow = { ...r.raw_data, _id: r.id, _rowIndex: r.row_index };
        return row;
      });
      setRows(loadedRows);
    } else {
      setRows([]);
    }
    
    setLoading(false);
  }, [projectId, surveyType, dbClient]);

  const save = useCallback(async (rowsToSave: FieldBookRow[]) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      setError(null);

      const records = rowsToSave.map((row, idx) => {
        const { _id, _rowIndex, ...data } = row;
        return {
          project_id: projectId,
          survey_type: surveyType,
          row_index: idx,
          raw_data: data,
          updated_at: new Date().toISOString(),
        };
      });

      const { error: saveError } = await dbClient
        .from('project_fieldbook_entries')
        .upsert(records, { onConflict: 'project_id,survey_type,row_index' });

      if (saveError) {
        setError('Save failed: ' + saveError.message);
      } else {
        setLastSaved(new Date());
      }
      setSaving(false);
    }, 500);
  }, [projectId, surveyType, dbClient]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  return {
    rows,
    setRows,
    load,
    save,
    loading,
    saving,
    lastSaved,
    error,
  };
}

