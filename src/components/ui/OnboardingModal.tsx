'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

export default function OnboardingModal({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const steps = [
    {
      title: 'Welcome to METARDU',
      description: 'Get started with professional surveying tools designed for Kenya and beyond.',
    },
    {
      title: 'Create Your First Project',
      description: 'Start a new survey project by clicking the "+ New Project" button on the dashboard.',
    },
    {
      title: 'Collect Field Data',
      description: 'Use the Digital Field Book to record observations, or import data from total stations and GPS devices.',
    },
    {
      title: 'Process & Adjust',
      description: 'Run traverse adjustments, leveling networks, and COGO calculations with built-in engines.',
    },
    {
      title: 'Generate Documents',
      description: 'Produce professional survey reports, plans, and certificates ready for submission and printing.',
    },
  ];

  const [stepIndex, setStepIndex] = useState(0);

  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${
        open ? '' : 'hidden'
      }`}
    >
      <div className="relative w-full max-w-2xl mx-4 p-6 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {steps[stepIndex].title}
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[var(--text-secondary)] mb-6">
          {steps[stepIndex].description}
        </p>
        <div className="flex justify-between">
          {!isLastStep && (
            <button
              onClick={() => setStepIndex((i) => i + 1)}
              className="btn btn-secondary"
            >
              Next
            </button>
          )}
          {isLastStep && (
            <>
              <Link
                href="/project/new"
                className="btn btn-primary mr-2"
              >
                Start New Project
              </Link>
              <button
                onClick={() => {
                  onClose();
                  onComplete();
                }}
                className="btn"
              >
                Skip for now
              </button>
            </>
          )}
          {isLastStep && (
            <>
              <Link
                href="/guide"
                className="btn btn-secondary mr-2"
              >
                View Full Guide
              </Link>
              <button
                onClick={() => {
                  onClose();
                  onComplete();
                }}
                className="btn"
              >
                I&apos;ll try later
              </button>
            </>
          )}
          {!isLastStep && (
            <button
              onClick={() => setStepIndex(0)}
              className="btn"
            >
              Restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
