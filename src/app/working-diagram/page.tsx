import { createClient } from '@/lib/api-client/server';
import { redirect } from 'next/navigation';
import WorkingDiagramClient, { type ProjectInfo, type FieldbookEntry } from './WorkingDiagramClient';

interface Props {
  searchParams: { projectId?: string };
}

export default async function WorkingDiagramPage({ searchParams }: Props) {
  const { projectId } = searchParams;
  if (!projectId) redirect('/projects');

  const dbClient = await createClient();

  const { data: { session } } = await dbClient.auth.getSession();
  if (!session) redirect('/login');

  const { data: project } = await dbClient
    .from('projects')
    .select(`
      id, name, survey_type, lr_number, locality,
      registration_district, utm_zone, hemisphere, datum
    `)
    .eq('id', projectId)
    .eq('user_id', (session as { user?: { id?: string } } | null)?.user?.id as string)
    .single();

  if (!project) redirect('/projects');

  const { data: entries } = await dbClient
    .from('project_fieldbook_entries')
    .select('row_index, station, raw_data, bs, remark')
    .eq('project_id', projectId)
    .order('row_index', { ascending: true });

  return (
    <WorkingDiagramClient
      project={project as unknown as ProjectInfo}
      entries={(entries ?? []) as unknown as FieldbookEntry[]}
      projectId={projectId}
    />
  );
}
