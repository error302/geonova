'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SurveyType } from '@/types/project';
import { FieldBookRow } from '@/types/fieldbook';

interface UseFieldBookOptions {
  projectId: string;
  surveyType: SurveyType;
  initialRows?: FieldBookRow[];
}

export function useFieldBook({ projectId, surveyType, initialRows = [] }: UseFieldBookOptions) {
  const supabase = createClient();
  const [rows, setRows] = useState<FieldBookRow[]>(initialRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: fetchError } = await supabase
      .from('project_fieldbook_entries')
      .select('*')
      .eq('project_id', projectId)
      .eq('survey_type', surveyType)
      .order('row_index', { ascending: true });

    if (fetchError) {
      setError('Failed to load: ' + fetchError.message);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const loadedRows = data.map((r) => {
        const row: FieldBookRow = { ...r.raw_data };
        row._id = r.id;
        row._rowIndex = r.row_index;
        return row;
      });
      setRows(loadedRows);
    } else {
      setRows([]);
    }
    
    setLoading(false);
  }, [projectId, surveyType, supabase]);

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

      const { error: saveError } = await supabase
        .from('project_fieldbook_entries')
        .upsert(records, { onConflict: 'project_id,survey_type,row_index' });

      if (saveError) {
        setError('Save failed: ' + saveError.message);
      } else {
        setLastSaved(new Date());
      }
      setSaving(false);
    }, 500);
  }, [projectId, surveyType, supabase]);

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
