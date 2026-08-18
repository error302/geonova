'use client';

import { useState, useCallback, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { CheckCircle2 } from 'lucide-react'
import { z } from 'zod';
import { createClient } from '@/lib/api-client/client';
import { apiGet, apiPost, apiInvalidate, ApiError } from '@/lib/api/client';
import { DocumentStatus, ProjectDocument } from '@/types/submission';
import { getDocumentsForSurveyType } from '@/lib/submission/submissionDocuments';
import { SurveyType } from '@/types/project';
import { SupportingDocUpload } from '@/components/submission/SupportingDocUpload';
import { FormNo4Preview } from '@/components/drawing/FormNo4Preview';
import { NLIMSExportPanel } from '@/components/submission/NLIMSExportPanel';
import { StatutoryGatePanel } from '@/components/validation/StatutoryGatePanel';

// ponytail: response schemas — Phase 4 wave 2 will move these to src/lib/api/schemas/

const previewSchema = z.object({
  submissionRef: z.string().optional(),
  projectId: z.string().optional(),
  surveyor: z.any().optional(),
  subtype: z.string().optional(),
  parcel: z.any().optional(),
  traverse: z.any().optional(),
  supportingDocs: z.array(z.any()).optional(),
  generatedAt: z.string().optional(),
  revision: z.number().optional(),
}).passthrough();

// ponytail: persisted submission QA status (GET /api/submission/status) — the
// reviewer-facing mirror of the package manifest's qaResult, so the GNSS QC
// override reason + underlying QC failures show without opening the ZIP.
const submissionStatusSchema = z.object({
  hasPackage: z.boolean().optional(),
  submissionNumber: z.string().optional(),
  packageStatus: z.string().optional(),
  generatedAt: z.string().optional(),
  gnssVerdict: z.string().optional(),
  gnssReportId: z.string().optional(),
  gnssFailures: z.array(z.any()).optional(),
  gnssWarnings: z.array(z.any()).optional(),
  gnssOverrideReason: z.string().optional(),
}).passthrough();

const generateResponseSchema = z.object({
  success: z.boolean().optional(),
  fileUrl: z.string().optional(),
  downloadUrl: z.string().optional(),
}).passthrough();

const packageResponseSchema = z.object({
  downloadUrl: z.string().optional(),
}).passthrough();

interface Props {
  project: { id: string; name: string; survey_type: string };
  existingDocs: ProjectDocument[];
  projectId: string;
}

interface DocState {
  id: string;
  status: DocumentStatus;
  progress: number;
  error?: string;
  fileUrl?: string;
  generatedAt?: string;
}

interface GNSSQCViewIssue {
  level: string;
  code: string;
  message: string;
}

interface SubmissionQAStatusView {
  hasPackage: boolean;
  submissionNumber?: string;
  packageStatus?: string;
  generatedAt?: string;
  gnssVerdict?: string;
  gnssReportId?: string;
  gnssFailures: GNSSQCViewIssue[];
  gnssWarnings: GNSSQCViewIssue[];
  gnssOverrideReason?: string;
}

interface SubmissionPackage {
  submissionRef: string;
  projectId: string;
  surveyor: { registrationNumber: string; iskNumber: string; verifiedIsk: boolean; fullName: string; firmName: string; isKMemberActive: boolean };
  subtype: 'cadastral_subdivision' | 'cadastral_amalgamation' | 'cadastral_resurvey' | 'cadastral_mutation';
  parcel: { lrNumber: string; parcelNumber: string; county: string; division: string; district: string; locality: string; areaM2: number; perimeterM: number };
  traverse: {
    points: { pointName: string; easting: number; northing: number; adjustedEasting: number; adjustedNorthing: number; observedBearing: number; observedDistance: number }[];
    angularMisclosure: number;
    linearMisclosure: number;
    precisionRatio: string;
    closingErrorE: number;
    closingErrorN: number;
    adjustmentMethod: 'bowditch' | 'transit';
    areaM2: number;
    perimeterM: number;
  };
  supportingDocs: { type: 'ppa2' | 'lcb_consent' | 'mutation_form' | 'beacon_cert'; label: string; required: boolean; fileUrl: string | null; uploadedAt: string | null }[];
  generatedAt: string;
  revision: number;
}

export default function SubmissionClient({ project, existingDocs, projectId }: Props) {
  const dbClient = createClient();
  const [previewPkg, setPreviewPkg] = useState<SubmissionPackage | null>(null);
  // Statutory gate block state — when true, Generate buttons are disabled
  // because the project would fail ArdhiSasa pre-flight. Lifted up from
  // StatutoryGatePanel via the onResult callback.
  const [gateBlocked, setGateBlocked] = useState(false);
  const [docStates, setDocStates] = useState<Record<string, DocState>>(() => {
    const initial: Record<string, DocState> = {};
    getDocumentsForSurveyType(project.survey_type).forEach((doc) => {
      const existing = existingDocs.find((d) => d.document_id === doc.id);
      initial[doc.id] = {
        id: doc.id,
        status: existing?.status ?? 'pending',
        progress: existing?.status === 'ready' ? 100 : 0,
        fileUrl: existing?.file_url ?? undefined,
        generatedAt: existing?.generated_at ?? undefined,
      };
    });
    return initial;
  });

  const documents = getDocumentsForSurveyType(project.survey_type as SurveyType);
  const readyCount = Object.values(docStates).filter((d) => d.status === 'ready').length;
  const totalCount = documents.length;
  const progressPct = totalCount > 0 ? (readyCount / totalCount) * 100 : 0;

  const [assembling, setAssembling] = useState(false);
  // Reason recorded by the surveyor to override a FAILED GNSS session QC
  // gate. The route embeds it in the QA result and the package manifest.
  const [gnssOverrideReason, setGnssOverrideReason] = useState('');
  const [packageResult, setPackageResult] = useState<{
    passed: boolean;
    ref: string;
    blockers: { code: string; message: string }[];
    warnings: { code: string; message: string }[];
  } | null>(null);
  // Persisted submission QA status — refresh after each assemble attempt so
  // the GNSS override reason and QC failures are visible immediately.
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionQAStatusView | null>(null);

  useEffect(() => {
    async function loadPreview() {
      try {
        const pkg = await apiGet(
          `/api/submission/preview?projectId=${projectId}`,
          previewSchema,
          { ttlMs: 0 },
        );
        setPreviewPkg(pkg as unknown as SubmissionPackage);
      } catch (err) {
        // Preview is best-effort; surface non-auth errors to console only
        if (err instanceof ApiError && err.isUnauthorized) {
          logger.error('Preview load: unauthorized');
        } else {
          logger.error('Failed to load preview:', { error: err });
        }
      }
    }
    loadPreview();
  }, [projectId]);

  const loadStatus = useCallback(async () => {
    try {
      const status = await apiGet(
        `/api/submission/status?projectId=${projectId}`,
        submissionStatusSchema,
        { ttlMs: 0 },
      );
      setSubmissionStatus(status as unknown as SubmissionQAStatusView);
    } catch (err) {
      // Status is best-effort; surface non-auth errors to console only
      if (err instanceof ApiError && err.isUnauthorized) {
        logger.error('Submission status load: unauthorized');
      } else {
        logger.error('Failed to load submission status:', { error: err });
      }
    }
  }, [projectId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Assemble the submission ZIP. When a GNSS session QC verdict is FAILED,
  // the route returns 422 with a GNSS_QC_FAILED blocker; pass an override
  // reason to proceed (it is recorded in the QA result + package manifest).
  const runAssemble = useCallback(async (overrideReason?: string) => {
    setAssembling(true);
    try {
      // ponytail: binary download bypasses typed client (ZIP response with custom headers, not JSON)
      const res = await fetch('/api/submission/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          ...(overrideReason ? { gnssOverrideReason: overrideReason } : {})
        })
      });

      if (!res.ok) {
        const err = (await res.json()) as {
          blockers?: { code?: string; message?: string }[];
          warnings?: { code?: string; message?: string }[];
        };
        setPackageResult({
          passed: false,
          ref: '',
          blockers: err.blockers?.length
            ? err.blockers.map(b => ({ code: b.code ?? 'UNKNOWN', message: b.message ?? 'Unknown error' }))
            : [{ code: 'UNKNOWN', message: 'Unknown error' }],
          warnings: (err.warnings ?? []).map(w => ({ code: w.code ?? 'WARN', message: w.message ?? '' }))
        });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('X-Submission-Ref') + '.zip';
      a.click();
      URL.revokeObjectURL(url);

      setPackageResult({
        passed: true,
        ref: res.headers.get('X-Submission-Ref') ?? '',
        blockers: [],
        warnings: []
      });
    } catch (err) {
      setPackageResult({
        passed: false,
        ref: '',
        blockers: [{ code: 'UNKNOWN', message: err instanceof Error ? err.message : 'Unknown error' }],
        warnings: []
      });
    } finally {
      setAssembling(false);
      // Refresh the persisted status so the override reason / QC failures
      // panel reflects the just-completed (or just-blocked) attempt.
      loadStatus();
    }
  }, [project.id, loadStatus]);

  const generateDocument = useCallback(async (docId: string) => {
    setDocStates((prev) => ({
      ...prev,
      [docId]: { ...prev[docId], status: 'generating', progress: 10, error: undefined },
    }));

    try {
      const doc = documents.find((d) => d.id === docId);
      if (!doc) throw new Error('Document not found');

      setDocStates((prev) => ({
        ...prev,
        [docId]: { ...prev[docId], progress: 30 },
      }));

      const result = await apiPost(
        '/api/submission/generate',
        generateResponseSchema,
        {
          projectId: project.id,
          documentId: docId,
          documentType: doc.id,
          format: doc.format,
        },
      );

      setDocStates((prev) => ({
        ...prev,
        [docId]: { ...prev[docId], progress: 70 },
      }));

      const downloadUrl = result.downloadUrl ?? result.fileUrl;

      await dbClient.from('submission_documents').upsert({
        project_id: project.id,
        document_id: docId,
        status: 'ready',
        file_url: downloadUrl,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,document_id' });

      setDocStates((prev) => ({
        ...prev,
        [docId]: {
          ...prev[docId],
          status: 'ready',
          progress: 100,
          fileUrl: downloadUrl,
          generatedAt: new Date().toISOString(),
        },
      }));

      apiInvalidate(`/api/submission/preview?projectId=${project.id}`);
    } catch (err) {
      const errorMessage = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Unknown error';
      setDocStates((prev) => ({
        ...prev,
        [docId]: {
          ...prev[docId],
          status: 'error',
          error: errorMessage,
        },
      }));
    }
  }, [documents, project.id, dbClient]);

  const retryDocument = useCallback((docId: string) => {
    generateDocument(docId);
  }, [generateDocument]);

  const downloadDocument = useCallback((docId: string) => {
    const doc = docStates[docId];
    if (doc?.fileUrl) {
      window.open(doc.fileUrl, '_blank');
    }
  }, [docStates]);

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'ready':
        return <CheckCircle2 className="w-3.5 h-3.5 inline shrink-0 text-green-500" />;
      case 'generating':
        return <span className="text-amber-500">⟳</span>;
      case 'error':
        return <span className="text-red-500">✕</span>;
      default:
        return <span className="text-zinc-400">…</span>;
    }
  };

  const getStatusLabel = (status: DocumentStatus) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'generating':
        return 'Generating...';
      case 'error':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{project.name}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Submission Package —{' '}
          <span className="font-medium text-[var(--text-primary)]">{readyCount} of {totalCount}</span> documents ready
        </p>
        <div className="mt-3 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-500" 
            style={{ width: `${progressPct}%` }} 
          />
        </div>
        {progressPct === 100 && (
          <p className="mt-2 text-sm text-green-400 font-medium">
             All documents ready for submission
          </p>
        )}
      </div>

      {/* Statutory Validation Gate — pre-export compliance check.
          Shows blocking violations before the surveyor hits Generate,
          so they can fix issues in the field book or traverse adjustment
          instead of getting a rejection at export time.
          onResult lifts the block state up so Generate buttons can be
          disabled client-side when the gate is blocked. */}
      <StatutoryGatePanel
        projectId={project.id}
        onResult={(result) => setGateBlocked(result ? result.summary.block > 0 : false)}
      />

      {documents.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm">
          No documents configured for survey type: {project.survey_type}
        </p>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const state: DocState = docStates[doc.id] ?? { id: doc.id, status: 'pending' as DocumentStatus, progress: 0 };
            const isGenerating = state.status === 'generating';
            const isReady = state.status === 'ready';
            const isError = state.status === 'error';

            return (
              <div
                key={doc.id}
                className={`border rounded-lg p-4 ${
                  isReady 
                    ? 'border-green-800/40 bg-green-950/20' 
                    : isError 
                      ? 'border-red-800/40 bg-red-950/20' 
                      : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getStatusIcon(state.status)}</span>
                      <h3 className="font-semibold text-[var(--text-primary)]">{doc.label}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        isReady 
                          ? 'bg-green-900/40 text-green-400' 
                          : isError 
                            ? 'bg-red-900/40 text-red-400' 
                            : 'bg-gray-800 text-gray-400'
                      }`}>
                        {getStatusLabel(state.status)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{doc.description}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Format: {doc.format.toUpperCase()} | Required: {doc.requiredData.join(', ')}
                    </p>
                    
                    {isGenerating && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-300"
                              style={{ width: `${state.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--text-muted)]">{state.progress}%</span>
                        </div>
                      </div>
                    )}

                    {isError && state.error && (
                      <div className="mt-3 p-2 bg-red-900/30 border border-red-800/40 rounded text-sm text-red-400">
                        <strong>Error:</strong> {state.error}
                      </div>
                    )}

                    {isReady && state.generatedAt && (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Generated: {new Date(state.generatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="ml-4 flex flex-col gap-2">
                    {!isReady && (
                      <button
                        onClick={() => generateDocument(doc.id)}
                        disabled={isGenerating || gateBlocked}
                        title={gateBlocked ? 'Statutory validation is blocking — fix violations and re-run validation first' : undefined}
                        className={`px-4 py-2 text-sm font-medium rounded transition ${
                          isGenerating || gateBlocked
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isGenerating ? 'Generating...' : gateBlocked ? 'Blocked' : 'Generate'}
                      </button>
                    )}

                    {isReady && (
                      <button
                        onClick={() => downloadDocument(doc.id)}
                        className="px-4 py-2 text-sm font-medium rounded bg-green-600 text-white hover:bg-green-700 transition"
                      >
                        Download
                      </button>
                    )}

                    {isError && (
                      <button
                        onClick={() => retryDocument(doc.id)}
                        className="px-4 py-2 text-sm font-medium rounded bg-red-600 text-white hover:bg-red-700 transition"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {readyCount > 0 && readyCount < totalCount && (
        <div className="mt-8 p-4 bg-amber-950/20 border border-amber-800/40 rounded-lg">
          <h3 className="font-semibold text-amber-400">Submission Incomplete</h3>
          <p className="text-sm text-amber-300 mt-1">
            {totalCount - readyCount} document(s) still pending. Generate all remaining documents to complete your submission package.
          </p>
          <button
            onClick={() => {
              documents.forEach((doc) => {
                const state = docStates[doc.id];
                if (!state || state.status !== 'ready') {
                  generateDocument(doc.id);
                }
              });
            }}
            disabled={gateBlocked}
            title={gateBlocked ? 'Statutory validation is blocking — fix violations and re-run validation first' : undefined}
            className={`mt-3 px-4 py-2 text-white text-sm font-medium rounded transition ${
              gateBlocked
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {gateBlocked ? 'Blocked — fix violations first' : 'Generate All Missing'}
          </button>
        </div>
      )}

      {readyCount === totalCount && totalCount > 0 && (
        <div className="mt-8 p-4 bg-green-950/20 border border-green-800/40 rounded-lg">
          <h3 className="font-semibold text-green-400">Submission Package Complete</h3>
          <p className="text-sm text-green-300 mt-1">
            All {totalCount} documents are ready. You can now submit your survey package to the relevant authority.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={async () => {
                try {
                  const result = await apiPost(
                    '/api/submission/package',
                    packageResponseSchema,
                    { projectId: project.id },
                  );
                  if (result.downloadUrl) {
                    window.open(result.downloadUrl, '_blank');
                  }
                } catch (err) {
                  if (err instanceof ApiError) {
                    logger.error('Package download failed:', { message: err.message });
                  } else {
                    logger.error('Package download failed:', { error: err });
                  }
                }
              }}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition"
            >
              Download Full Package (ZIP)
            </button>
          </div>
        </div>
      )}

      <SupportingDocUpload projectId={project.id} />

      {previewPkg && (
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Form No. 4 Preview</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Verify geometry before generating package. The DXF export matches this preview exactly.
          </p>
          <FormNo4Preview pkg={previewPkg} width={760} height={500} />
        </div>
      )}

      {submissionStatus && (submissionStatus.hasPackage || submissionStatus.gnssVerdict || submissionStatus.gnssOverrideReason || submissionStatus.gnssFailures.length > 0) && (
        <div className="mt-8 p-4 border border-[var(--border)] bg-[var(--surface)] rounded-lg">
          <h3 className="font-semibold">Submission Status</h3>
          {submissionStatus.hasPackage && (
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Package {submissionStatus.submissionNumber} · {submissionStatus.packageStatus}
              {submissionStatus.generatedAt
                ? ` · generated ${new Date(submissionStatus.generatedAt).toLocaleString()}`
                : ''}
            </p>
          )}

          {(submissionStatus.gnssVerdict || submissionStatus.gnssFailures.length > 0 || submissionStatus.gnssOverrideReason) && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">GNSS Session QC:</span>
                {submissionStatus.gnssVerdict ? (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    submissionStatus.gnssVerdict === 'pass'
                      ? 'bg-green-900/40 text-green-400'
                      : submissionStatus.gnssVerdict === 'warn'
                        ? 'bg-amber-900/40 text-amber-400'
                        : 'bg-red-900/40 text-red-400'
                  }`}>
                    {submissionStatus.gnssVerdict.toUpperCase()}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">No report saved</span>
                )}
                {submissionStatus.gnssReportId && (
                  <span className="text-xs text-[var(--text-muted)]">({submissionStatus.gnssReportId})</span>
                )}
              </div>

              {submissionStatus.gnssOverrideReason && (
                <div className="p-3 border border-amber-700/40 bg-amber-950/20 rounded">
                  <p className="text-sm font-medium text-amber-300">
                    GNSS QC FAILED but overridden by the surveyor
                  </p>
                  <p className="text-sm text-amber-200 mt-1">&ldquo;{submissionStatus.gnssOverrideReason}&rdquo;</p>
                  <p className="text-xs text-amber-400/70 mt-1">
                    Reason recorded in the package manifest (qaResult) for the Director of Surveys.
                  </p>
                </div>
              )}

              {submissionStatus.gnssFailures.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-400">Underlying QC failures:</p>
                  <ul className="mt-1 text-sm text-red-300 list-disc list-inside">
                    {submissionStatus.gnssFailures.map((f, i) => (
                      <li key={`${f.code}-${i}`}>{f.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {submissionStatus.gnssWarnings.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-amber-400">QC warnings:</p>
                  <ul className="mt-1 text-sm text-amber-300 list-disc list-inside">
                    {submissionStatus.gnssWarnings.map((w, i) => (
                      <li key={`${w.code}-${i}`}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 p-4 border border-orange-800/40 bg-orange-950/20 rounded-lg">
        <h3 className="font-semibold text-orange-400">Generate Compliant Submission Package</h3>
        <p className="text-sm text-orange-300 mt-1">
          Generate a complete submission package with Form No. 4 DXF, computation workbook, and supporting documents.
        </p>
        <button
          onClick={() => runAssemble()}
          disabled={assembling}
          className="mt-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded transition"
        >
          {assembling ? 'Generating Package...' : 'Generate Submission Package'}
        </button>

        {packageResult && !packageResult.passed && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-800/40 rounded">
            <h4 className="font-medium text-red-400">QA Gate Failed</h4>
            <ul className="mt-2 text-sm text-red-300 list-disc list-inside">
              {packageResult.blockers.map((b, i) => (
                <li key={`${b.code}-${i}`}>{b.message}</li>
              ))}
            </ul>
            {packageResult.warnings.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-amber-300">Warnings:</p>
                <ul className="text-sm text-amber-400 list-disc list-inside">
                  {packageResult.warnings.map((w, i) => (
                    <li key={`${w.code}-${i}`}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {packageResult.blockers.some(b => b.code === 'GNSS_QC_FAILED') && (
              <div className="mt-3 p-3 border border-amber-700/40 bg-amber-950/20 rounded">
                <p className="text-sm text-amber-300">
                  The GNSS session QC gate failed. To assemble anyway, record why — this reason is embedded
                  in the package manifest for the Director of Surveys.
                </p>
                <div className="mt-2 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={gnssOverrideReason}
                    onChange={(e) => setGnssOverrideReason(e.target.value)}
                    placeholder="Override reason (e.g. session re-observed, slips confirmed in office)"
                    className="flex-1 px-3 py-2 text-sm bg-[var(--bg)] border border-amber-700/40 rounded focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => runAssemble(gnssOverrideReason)}
                    disabled={assembling || !gnssOverrideReason.trim()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded transition whitespace-nowrap"
                  >
                    {assembling ? 'Retrying...' : 'Override & Assemble'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {packageResult?.passed && (
          <div className="mt-4 p-3 bg-green-900/30 border border-green-800/40 rounded">
            <p className="text-green-400 font-medium">
              Package generated: {packageResult.ref}
            </p>
            <p className="text-sm text-green-300 mt-1">
              Your submission ZIP has downloaded. Submit to the Director of Surveys office.
            </p>
          </div>
        )}
      </div>

      {/* NLIMS / ArdhiSasa Export Panel */}
      <NLIMSExportPanel projectId={project.id} />
    </div>
  );
}