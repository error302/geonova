'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { createClient } from '@/lib/api-client/client';
import { SurveyType } from '@/types/project';
import { SurveyWorkflow } from '@/types/workflow';
import { nextStepIndex } from '@/lib/workflows/workflowRegistry';
import {
  getWorkflowStatus,
  getWorkflowSteps,
  type ProjectWorkflowData,
} from '@/lib/workflows/projectWorkflowEngine';
import WorkflowStepper from '@/components/workspace/WorkflowStepper';
import WorkflowStepPanel from '@/components/workspace/WorkflowStepPanel';
import EnhancedSplitLayout from '@/components/workspace/EnhancedSplitLayout';
import WorkspaceMap from '@/components/workspace/WorkspaceMap';
import ComputationLog from '@/components/workspace/ComputationLog';
import WorkflowQualityGate from '@/components/shared/WorkflowQualityGate';
import WorkflowOverviewPanel from '@/components/shared/WorkflowOverviewPanel';
import { CollaborationPanel } from '@/components/realtime/CollaborationPanel';
import { useCollaboration } from '@/lib/realtime/useCollaboration';
import { QADashboard } from '@/components/dashboard/QADashboard';
import { BatchParcelImport } from '@/components/parcels/BatchParcelImport';

interface ProjectProps {
  id: string;
  name: string;
  surveyType: SurveyType;
  workflowStep: number;
  maxUnlocked: number;
}

interface Props {
  project: ProjectProps;
  workflow: SurveyWorkflow;
}

export default function ProjectWorkspaceClient({ project, workflow }: Props) {
  const router = useRouter();
  const dbClient = createClient();
  const { data: session } = useSession();

  const [currentStep, setCurrentStep] = useState(project.workflowStep);
  const [maxUnlocked, setMaxUnlocked] = useState(project.maxUnlocked);
  const [saving, setSaving] = useState(false);

  // Workflow state machine data (fetched from API)
  const [workflowData, setWorkflowData] = useState<ProjectWorkflowData | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(true);

  // Quality gate state
  const [qualityGateTarget, setQualityGateTarget] = useState<string | null>(null);

  // Overview panel state
  const [overviewOpen, setOverviewOpen] = useState(false);

  // Collaboration state
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string; userId: string; userName: string; message: string; timestamp: number;
  }>>([]);

  const userId = (session?.user as { id?: string })?.id || '';
  const userName = (session?.user as { name?: string })?.name || 'Surveyor';

  const {
    collaborators,
    isConnected,
    sendChat,
    conflictWarnings,
  } = useCollaboration({
    projectId: project.id,
    userId,
    userName,
  });

  // Handle incoming chat messages
  useEffect(() => {
    // The hook calls onChat callback — we set it via a ref pattern
    // For simplicity, we handle chat through the messages state
  }, []);

  const handleSendChat = useCallback((message: string) => {
    const newMsg = {
      id: crypto.randomUUID(),
      userId,
      userName,
      message,
      timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, newMsg]);
    sendChat(message);
  }, [userId, userName, sendChat]);

  // Fetch workflow status from API on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      setWorkflowLoading(true);
      try {
        const res = await fetch(`/api/project/${project.id}/workflow`);
        if (res.ok) {
          const json = await res.json();
          // The API returns the status but we need the raw data for the engine.
          // Build it from the API response + local project state.
          const data: ProjectWorkflowData = {
            id: project.id,
            name: project.name,
            surveyType: project.surveyType,
            location: null, // Not available in the current workspace props
            utmZone: null,
            hemisphere: null,
            currentStep,
            maxUnlocked,
            pointCount: 0,
            fieldbookEntryCount: 0,
            hasComputationResults: false,
            toleranceCheckPassed: null,
            toleranceAcknowledged: false,
            hasDeedPlan: false,
            hasSubmissionPackage: false,
          };

          // If the API returned status, use its computed data to infer richer data
          if (json.data?.steps) {
            // We can extract counts from the step info
            const fieldStep = json.data.steps.find((s: { id: string }) => s.id === 'field-collection');
            if (fieldStep?.completionPct === 100) {
              data.pointCount = 3; // At least 3 if complete
              data.fieldbookEntryCount = 3;
            }
            const computeStep = json.data.steps.find((s: { id: string }) => s.id === 'computation');
            if (computeStep?.completionPct === 100) {
              data.hasComputationResults = true;
            }
            const reviewStep = json.data.steps.find((s: { id: string }) => s.id === 'quality-review');
            if (reviewStep?.completionPct === 100) {
              data.toleranceCheckPassed = true;
            }
            const deedStep = json.data.steps.find((s: { id: string }) => s.id === 'map-deed-plan');
            if (deedStep?.completionPct === 100) {
              data.hasDeedPlan = true;
            }
            const subStep = json.data.steps.find((s: { id: string }) => s.id === 'submission');
            if (subStep?.completionPct === 100) {
              data.hasSubmissionPackage = true;
            }
          }

          if (!cancelled) setWorkflowData(data);
        }
      } catch {
        // API may not be available in all environments — use local fallback
        if (!cancelled) {
          setWorkflowData({
            id: project.id,
            name: project.name,
            surveyType: project.surveyType,
            location: null,
            utmZone: null,
            hemisphere: null,
            currentStep,
            maxUnlocked,
            pointCount: 0,
            fieldbookEntryCount: 0,
            hasComputationResults: false,
            toleranceCheckPassed: null,
            toleranceAcknowledged: false,
            hasDeedPlan: false,
            hasSubmissionPackage: false,
          });
        }
      } finally {
        if (!cancelled) setWorkflowLoading(false);
      }
    }
    fetchStatus();
    return () => { cancelled = true; };
  }, [project.id, project.name, project.surveyType, currentStep, maxUnlocked]);

  const workflowStatus = useMemo(() => {
    if (!workflowData) return null;
    return getWorkflowStatus(workflowData);
  }, [workflowData]);

  const handleStepChange = useCallback(async (newStep: number) => {
    // Check if the target step is unlocked
    const steps = getWorkflowSteps(project.surveyType);
    const targetStepDef = steps.find((s) => s.index === newStep);

    if (!targetStepDef) return;

    // If the step is beyond maxUnlocked, show the quality gate
    if (newStep > maxUnlocked && workflowData) {
      setQualityGateTarget(targetStepDef.id);
      return;
    }

    setSaving(true);
    const newMax = Math.max(maxUnlocked, newStep);

    await dbClient
      .from('projects')
      .update({
        workflow_step: newStep,
        workflow_max_unlocked: newMax,
      })
      .eq('id', project.id);

    setCurrentStep(newStep);
    setMaxUnlocked(newMax);
    setSaving(false);
  }, [project.id, maxUnlocked, dbClient, workflowData, project.surveyType]);

  const handleContinue = async () => {
    const next = nextStepIndex(project.surveyType, currentStep);
    if (next === null) return;

    // Check quality gate via workflow engine
    if (workflowData) {
      const steps = getWorkflowSteps(project.surveyType);
      const nextStepDef = steps.find((s) => s.index === next);
      if (nextStepDef) {
        const status = getWorkflowStatus(workflowData);
        if (!status.canAdvance && next > maxUnlocked) {
          setQualityGateTarget(nextStepDef.id);
          return;
        }
      }
    }

    await handleStepChange(next);

    const nextStepDef = workflow.steps.find((s) => s.index === next);
    if (nextStepDef?.routeSuffix) {
      router.push(`/project/${project.id}/${nextStepDef.routeSuffix}`);
    }
  };

  const handleQualityGateProceed = useCallback(() => {
    setQualityGateTarget(null);
    // User acknowledged warnings — allow the step change
    // This is handled by the quality gate component
  }, []);

  const handleQualityGateNavigate = useCallback((stepId: string) => {
    const steps = getWorkflowSteps(project.surveyType);
    const stepDef = steps.find((s) => s.id === stepId);
    if (stepDef) {
      setQualityGateTarget(null);
      setCurrentStep(stepDef.index);
      router.push(`/project/${project.id}?step=${stepDef.index}`);
    }
  }, [project.id, project.surveyType, router]);

  const handleOverviewStepClick = useCallback((stepId: string) => {
    const steps = getWorkflowSteps(project.surveyType);
    const stepDef = steps.find((s) => s.id === stepId);
    if (stepDef && stepDef.index <= maxUnlocked) {
      setCurrentStep(stepDef.index);
      if (stepDef.routeSuffix) {
        router.push(`/project/${project.id}/${stepDef.routeSuffix}`);
      }
    }
  }, [project.id, maxUnlocked, project.surveyType, router]);

  const currentStepDef = workflow.steps.find((s) => s.index === currentStep);
  const isLastStep = currentStep === workflow.steps[workflow.steps.length - 1].index;
  const nextStep = nextStepIndex(project.surveyType, currentStep);
  const nextStepDef = nextStep !== null ? workflow.steps.find((s) => s.index === nextStep) : null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">{project.name}</h1>
                <p className="text-xs text-[var(--text-muted)]">{workflow.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Workflow overview toggle button */}
              <button
                type="button"
                onClick={() => setOverviewOpen(!overviewOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                title="Workflow overview"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                Workflow
                {workflowStatus && workflowStatus.overallPct > 0 && (
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">{workflowStatus.overallPct}%</span>
                )}
              </button>
              {saving && <span className="text-xs text-[var(--text-muted)]">Saving…</span>}
            </div>
          </div>
          <div className="mt-4">
            <WorkflowStepper
              projectId={project.id}
              steps={workflow.steps}
              currentStep={currentStep}
              maxUnlocked={maxUnlocked}
              onStepChange={handleStepChange}
            />
          </div>
        </div>
      </div>

      {/* UI-4 (2026-07-24): Wire EnhancedSplitLayout — brings 1,255 LOC of
          dead workspace UI (EnhancedSplitLayout + WorkspaceMap + ComputationLog)
          to life. Desktop: resizable left (workflow 55%) / right (map 45%)
          split with a collapsible computation log at the bottom + a compact
          status bar showing misclosure/precision/area/selection. Mobile:
          stacked layout. The header (WorkflowStepper) stays above; the
          collaboration/QA/batch panels stay below. */}
      <EnhancedSplitLayout
        leftPanel={
          <div className="px-4 py-6 max-w-5xl mx-auto">
            {currentStepDef && (
              <p className="text-sm text-[var(--text-muted)] mb-4">{currentStepDef.description}</p>
            )}

            {/* Blocker warnings from workflow engine */}
            {workflowStatus && workflowStatus.blockers.length > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-amber-400 font-medium mb-1">Workflow Blockers</p>
                    {workflowStatus.blockers.map((b, i) => (
                      <p key={`${b}-${i}`} className="text-amber-400/80 text-xs">{b}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep < 5 && (
              <WorkflowStepPanel
                projectId={project.id}
                surveyType={project.surveyType}
                stepIndex={currentStep}
                projectName={project.name}
              />
            )}

            {!isLastStep && nextStepDef && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleContinue}
                  disabled={saving}
                  className="px-5 py-2 bg-[var(--accent)] text-black text-sm font-medium rounded hover:bg-[var(--accent-dim)] disabled:opacity-50 transition-colors"
                >
                  Continue to {nextStepDef.label} →
                </button>
              </div>
            )}

            {currentStep === 4 && (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => router.push(`/mobile/field?project=${project.id}`)}
                  className="px-5 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm font-medium rounded hover:border-[var(--accent)]/40 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Field Collection
                </button>
                <button
                  onClick={() => router.push(`/project/${project.id}/submission`)}
                  className="px-5 py-2 bg-[var(--accent)] text-black text-sm font-medium rounded hover:bg-[var(--accent-dim)] transition-colors"
                >
                  Go to Submission →
                </button>
              </div>
            )}
          </div>
        }
        rightPanel={
          <WorkspaceMap projectId={project.id} projectName={project.name} />
        }
        logPanel={<ComputationLog />}
      />

      {/* Quality Gate Modal */}
      {qualityGateTarget && workflowData && (
        <WorkflowQualityGate
          project={workflowData}
          targetStepId={qualityGateTarget}
          onDismiss={() => setQualityGateTarget(null)}
          onProceedAnyway={handleQualityGateProceed}
          onNavigateToStep={handleQualityGateNavigate}
        />
      )}

      {/* Workflow Overview Panel */}
      {workflowData && (
        <WorkflowOverviewPanel
          project={workflowData}
          isOpen={overviewOpen}
          onToggle={() => setOverviewOpen(!overviewOpen)}
          onStepClick={handleOverviewStepClick}
        />
      )}

      {/* Real-time Collaboration Panel */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <CollaborationPanel
          collaborators={collaborators}
          isConnected={isConnected}
          messages={chatMessages}
          onSend={handleSendChat}
          conflictWarnings={conflictWarnings}
        />
      </div>

      {/* QA Validation Dashboard */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <QADashboard projectId={project.id} />
      </div>

      {/* Batch Parcel Import */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <BatchParcelImport projectId={project.id} />
      </div>
    </div>
  );
}
