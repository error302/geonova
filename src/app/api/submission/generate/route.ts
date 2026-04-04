import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { projectId, documentId } = body as { projectId?: string; documentId?: string };

  if (!projectId || !documentId) {
    return NextResponse.json({ error: 'Missing projectId or documentId' }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, survey_type')
    .eq('id', projectId)
    .eq('user_id', session.user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  await supabase
    .from('submission_documents')
    .upsert({
      project_id: projectId,
      document_id: documentId,
      status: 'generating',
      error_message: null,
    }, { onConflict: 'project_id,document_id' });

  try {
    const { generateDocument } = await import('@/lib/submission/assembleDocument');
    const result = await generateDocument({ projectId, documentId, surveyType: project.survey_type, supabase: supabase as any });

    await supabase
      .from('submission_documents')
      .upsert({
        project_id: projectId,
        document_id: documentId,
        status: 'ready',
        file_url: result.fileUrl,
        error_message: null,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,document_id' });

    return NextResponse.json({ success: true, fileUrl: result.fileUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await supabase
      .from('submission_documents')
      .upsert({
        project_id: projectId,
        document_id: documentId,
        status: 'error',
        error_message: message,
      }, { onConflict: 'project_id,document_id' });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}