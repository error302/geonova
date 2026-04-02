import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { ParsedPoint } from '@/types/importer';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId, points, fileName, format } = await req.json() as {
    projectId: string;
    points: ParsedPoint[];
    fileName: string;
    format: string;
  };

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', session.user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { data: importSession } = await supabase
    .from('import_sessions')
    .insert({
      project_id: projectId,
      file_name: fileName,
      format,
      row_count: points.length,
      status: 'committed',
    })
    .select()
    .single();

  const { data: existing } = await supabase
    .from('project_fieldbook_entries')
    .select('row_index')
    .eq('project_id', projectId)
    .order('row_index', { ascending: false })
    .limit(1);

  const startIndex = (existing?.[0]?.row_index ?? -1) + 1;

  const entries = points.map((point, idx) => ({
    project_id: projectId,
    row_index: startIndex + idx,
    raw_data: point,
    import_session_id: importSession?.id ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('project_fieldbook_entries')
    .upsert(entries, { onConflict: 'project_id,row_index' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, imported: points.length });
}
