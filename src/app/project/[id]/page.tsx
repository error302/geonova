import { redirect } from 'next/navigation';
import { SurveyType } from '@/types/project';
import { getWorkflow } from '@/lib/workflows/workflowRegistry';
import ProjectWorkspaceClient from './ProjectWorkspaceClient';
import { getAuthUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: { id: string };
  searchParams: { step?: string };
}

export default async function ProjectWorkspacePage({ params, searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, survey_type, workflow_step, workflow_max_unlocked')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !project) redirect('/dashboard');

  const surveyType = project.survey_type as SurveyType;
  const workflow = getWorkflow(surveyType);

  const urlStep = parseInt(searchParams.step ?? '', 10);
  const stepIndex = Number.isFinite(urlStep) ? urlStep : (project.workflow_step ?? 1);

  return (
    <ProjectWorkspaceClient
      project={{
        id: project.id,
        name: project.name,
        surveyType,
        workflowStep: stepIndex,
        maxUnlocked: project.workflow_max_unlocked ?? 1,
      }}
      workflow={workflow}
    />
  );
}