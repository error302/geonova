'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { WorkflowStep } from '@/types/workflow';
import { isStepUnlocked } from '@/lib/workflows/workflowRegistry';

interface Props {
  projectId: string;
  steps: WorkflowStep[];
  currentStep: number;
  maxUnlocked: number;
  onStepChange: (stepIndex: number) => Promise<void>;
}

export default function WorkflowStepper({
  projectId,
  steps,
  currentStep,
  maxUnlocked,
  onStepChange,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleStepClick = (step: WorkflowStep) => {
    if (!isStepUnlocked(maxUnlocked, step.index)) return;
    if (step.index === currentStep) return;

    startTransition(async () => {
      await onStepChange(step.index);
      if (step.routeSuffix) {
        router.push(`/project/${projectId}/${step.routeSuffix}`);
      }
    });
  };

  return (
    <nav aria-label="Survey workflow steps" className="w-full">
      <ol className="hidden md:flex items-start justify-between gap-0">
        {steps.map((step, idx) => {
          const unlocked = isStepUnlocked(maxUnlocked, step.index);
          const isActive = step.index === currentStep;
          const isDone = step.index < currentStep;
          const isLast = idx === steps.length - 1;

          return (
            <li key={step.id} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => handleStepClick(step)}
                  disabled={!unlocked || isPending}
                  aria-current={isActive ? 'step' : undefined}
                  className={[
                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors',
                    isActive ? 'bg-[var(--accent)] border-[var(--accent)] text-black' :
                    isDone ? 'bg-[var(--accent-dim)] border-[var(--accent-dim)] text-white' :
                    unlocked ? 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]' :
                    'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed',
                  ].join(' ')}
                >
                  {isDone ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                    </svg>
                  ) : step.index}
                </button>
                <div className="mt-2 text-center px-1">
                  <p className={`text-xs font-medium leading-tight ${isActive ? 'text-[var(--accent)]' : isDone ? 'text-[var(--accent-dim)]' : unlocked ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-tight mt-0.5 hidden lg:block">{step.description}</p>
                </div>
              </div>
              {!isLast && <div className={`flex-1 h-0.5 mt-4 mx-1 ${step.index < currentStep ? 'bg-[var(--accent)]' : 'bg-[var(--border-color)]'}`} />}
            </li>
          );
        })}
      </ol>
      <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-1">
        {steps.map((step) => {
          const unlocked = isStepUnlocked(maxUnlocked, step.index);
          const isActive = step.index === currentStep;
          const isDone = step.index < currentStep;
          return (
            <button
              key={step.id}
              onClick={() => handleStepClick(step)}
              disabled={!unlocked || isPending}
              className={[
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                isActive ? 'bg-[var(--accent)] border-[var(--accent)] text-black' :
                isDone ? 'bg-[var(--accent-dim)] border-[var(--accent-dim)] text-white' :
                unlocked ? 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)]' :
                'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-muted)] cursor-not-allowed',
              ].join(' ')}
            >
              {step.index}. {step.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}