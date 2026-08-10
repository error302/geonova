'use client';
import Link from 'next/link';
import { logger } from '@/lib/logger';
import { z } from 'zod';

import { SurveyType } from '@/types/project';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { FileText, Map, Download, Loader2, Sparkles } from 'lucide-react';
import { getActiveSurveyorProfile } from '@/lib/submission/surveyorProfile';
import { useState } from 'react';
import { apiPost, ApiError } from '@/lib/api/client';

// ponytail: response schemas — Phase 4 wave 2 will move these to src/lib/api/schemas/

const surveyReportGenerateSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  sections: z.any().optional(),
  completeness: z.any().optional(),
  input: z.any().optional(),
}).passthrough();

const DynamicFieldBook = dynamic(() => import('./DynamicFieldBook'), { ssr: false });
const GenerateReportModal = dynamic(() => import('./GenerateReportModal'), { ssr: false });
const CadastralComputeIntegration = dynamic(() => import('./CadastralComputeIntegration'), { ssr: false });
const FieldToFinishButton = dynamic(() => import('./FieldToFinishButton').then(m => ({ default: m.FieldToFinishButton })), { ssr: false });

interface Props {
  projectId: string;
  surveyType: SurveyType;
  stepIndex: number;
  projectName: string;
}

export default function WorkflowStepPanel({ projectId, surveyType, stepIndex }: Props) {
  if (stepIndex === 5) return null;

  return (
    <div className="space-y-4">
      {stepIndex === 1 && <SetupPanel surveyType={surveyType} />}
      {stepIndex === 2 && <FieldBookStepPanel projectId={projectId} surveyType={surveyType} />}
        {stepIndex === 3 && <ComputeStepPanel surveyType={surveyType} projectId={projectId} />}
      {stepIndex === 4 && <ReviewStepPanel surveyType={surveyType} projectId={projectId} />}
    </div>
  );
}

function SetupPanel({ surveyType }: { surveyType: SurveyType }) {
  const hints: Record<SurveyType, string[]> = {
    cadastral: ['LR Number / Title Number', 'Client name and contact', 'UTM Zone', 'County'],
    engineering: ['Road / structure reference', 'Chainage start and end', 'Design authority', 'Contract number'],
    topographic: ['Drawing scale', 'Contour interval', 'Datum', 'Area boundary'],
    geodetic: ['Network order', 'Datum', 'Control point references', 'GNSS equipment'],
    drone: ['Mission ID', 'Aircraft', 'Camera', 'Target GSD'],
    deformation: ['Structure name', 'Monitoring frequency', 'Reference epoch', 'Alert threshold'],
  };

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
      <h2 className="font-semibold text-[var(--text-primary)] mb-1">Step 1 — Setup</h2>
      <p className="text-sm text-[var(--text-muted)] mb-4">Confirm project details before entering field observations.</p>
      <ul className="text-sm text-[var(--text-secondary)] space-y-1 list-disc list-inside">
        {(hints[surveyType] ?? []).map((hint) => <li key={hint}>{hint}</li>)}
      </ul>
    </div>
  );
}

function FieldBookStepPanel({ projectId, surveyType }: { projectId: string; surveyType: SurveyType }) {
  return (
    <div className="space-y-4">
      <DynamicFieldBook projectId={projectId} surveyType={surveyType} />
    </div>
  );
}

function ComputeStepPanel({ surveyType, projectId }: { surveyType: SurveyType; projectId: string }) {
  const computeItems: Record<SurveyType, string[]> = {
    engineering: ['Rise & fall reduction', '10√K mm closure (RDM 1.1)', 'Cross-section volumes'],
    topographic: ['Coordinate reduction', 'DTM generation', 'Contour extraction'],
    geodetic: ['Network adjustment', 'Baseline processing', 'Accuracy classification'],
    drone: ['GCP residuals', 'Point cloud volumes', 'Orthophoto check'],
    deformation: ['Epoch comparison', 'Displacement vectors', 'Statistical test'],
    cadastral: []
  };

  return (
    <div className="space-y-4">
      {surveyType === 'cadastral' ? (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-[var(--text-primary)] mb-1">Step 3 — Traverse Compute</h2>
              <p className="text-sm text-[var(--text-muted)]">Automatic adjustment of field book observations.</p>
            </div>
            <Link
              href="/tools/traverse"
              className="px-3 py-1.5 border border-[var(--border-color)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs font-medium rounded transition-colors"
            >
              Open Advanced Engine
            </Link>
          </div>
          <CadastralComputeIntegration projectId={projectId} />
          <div className="mt-4">
            <FieldToFinishButton projectId={projectId} />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
          <h2 className="font-semibold text-[var(--text-primary)] mb-1">Step 3 — Compute</h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">These computations will run against your field book data.</p>
          <ul className="text-sm text-[var(--text-secondary)] space-y-1.5 list-disc list-inside">
            {(computeItems[surveyType] ?? []).map((item) => <li key={item}>{item}</li>)}
          </ul>
          <div className="mt-5 rounded-md bg-[var(--accent-subtle)] border border-[var(--accent)]/20 p-3 text-sm text-[var(--accent)]">
            Compute runners ship in current release. Ensure field book data is complete before advancing.
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewStepPanel({ surveyType, projectId }: { surveyType: SurveyType; projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const handleSurveyReport = async () => {
    setLoading('report');
    try {
      const data = await apiPost(
        '/api/survey-report/generate',
        surveyReportGenerateSchema,
        { projectId },
      );
      if (data.id) {
        // ponytail: binary download bypasses typed client (PDF response, not JSON)
        const downloadRes = await fetch('/api/survey-report/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId: data.id, format: 'pdf' }),
        });
        if (downloadRes.ok) {
          const blob = await downloadRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `survey_report_${projectId}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        logger.error('Survey report error:', { message: err.message });
      } else {
        logger.error('Survey report error:', { error: err });
      }
    } finally {
      setLoading(null);
    }
  };

  const handleDXFExport = async () => {
    setLoading('dxf');
    try {
      // ponytail: binary download bypasses typed client (DXF response, not JSON)
      const response = await fetch(`/api/submission/form-no-4?projectId=${projectId}&format=dxf`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `form_no_4_${projectId}.dxf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      logger.error('DXF export error:', { error: err });
    } finally {
      setLoading(null);
    }
  };

  const handleWorkingDiagram = () => {
    router.push(`/working-diagram?projectId=${projectId}`);
  };

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
      <h2 className="font-semibold text-[var(--text-primary)] mb-1">Step 4 — Review</h2>
      <p className="text-sm text-[var(--text-muted)] mb-5">Review computation results before generating submission documents.</p>
      
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setIsAiModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          Generate Report
        </button>

        <button
          onClick={handleSurveyReport}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading === 'report' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          PDF Report
        </button>
        
        <button
          onClick={handleDXFExport}
          disabled={loading !== null}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading === 'dxf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Map className="w-4 h-4" />}
          DXF Export
        </button>
        
        <button
          onClick={handleWorkingDiagram}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-[var(--text-secondary)] text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Working Diagram
        </button>
      </div>

      <div className="mt-5 p-4 bg-gray-50 rounded-md">
        <p className="text-sm text-[var(--text-secondary)]">
          After reviewing your computation results, generate the outputs above and proceed to the Submission tab to compile your survey package.
        </p>
      </div>

      <GenerateReportModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        surveyType={surveyType}
        projectId={projectId}
      />
    </div>
  );
}