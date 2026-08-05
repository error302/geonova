'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import {
  FileText,
  Loader2,
  Download,
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
} from 'lucide-react';
import { createClient, type BrowserSession } from '@/lib/api-client/client';
import { z } from 'zod';
import { apiPost, ApiError } from '@/lib/api/client';

// ─── API response schemas (Zod) ────────────────────────────────────────────
const formC22JsonResponseSchema = z.object({
  success: z.boolean().optional(),
  metadata: z.object({}).passthrough().optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectData {
  id: string;
  name: string;
  lr_number: string | null;
  registration_district: string | null;
  locality: string | null;
  survey_type: string | null;
  area_ha: number | null;
  ref_no: string | null;
  surveyor_name: string | null;
  surveyor_isk: string | null;
  surveyor_firm: string | null;
}

interface C22Metadata {
  projectName: string;
  lrNumber: string;
  county: string;
  stationCount: number;
  areaHa: number;
  precisionRatio: number;
  angularMisclosureSec: number;
  linearMisclosureM: number;
}

interface Props {
  projectId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FormC22Generator({ projectId }: Props) {
  // Editable form state
  const [project, setProject] = useState<ProjectData | null>(null);
  const [lrNumber, setLrNumber] = useState('');
  const [county, setCounty] = useState('');
  const [division, setDivision] = useState('');
  const [district, setDistrict] = useState('');
  const [locality, setLocality] = useState('');
  const [surveyType, setSurveyType] = useState('');
  const [surveyorName, setSurveyorName] = useState('');
  const [iskNumber, setIskNumber] = useState('');
  const [firmName, setFirmName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [revision, setRevision] = useState('');

  // UI state
  const [loadingProject, setLoadingProject] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [metadata, setMetadata] = useState<C22Metadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Load project data on mount ─────────────────────────────────────────
  useEffect(() => {
    async function loadProject() {
      try {
        setLoadingProject(true);
        const dbClient = createClient();

        const { data, error: dbError } = await dbClient
          .from('projects')
          .select('id, name, lr_number, registration_district, locality, survey_type, area_ha, ref_no')
          .eq('id', projectId)
          .maybeSingle();

        if (dbError) throw dbError;
        if (!data) {
          setError('Project not found');
          return;
        }

        const proj = data as unknown as ProjectData;

        // Also fetch surveyor profile
        const { data: sData } = await dbClient.auth.getSession();
        const session = sData?.session as BrowserSession | null | undefined;
        const userId = session?.user?.id;

        let surveyorNameVal = '';
        let iskNumberVal = '';
        let firmNameVal = '';

        if (userId) {
          const { data: spData } = await dbClient
            .from('surveyor_profiles')
            .select('isk_number, firm_name')
            .eq('user_id', userId)
            .maybeSingle();

          if (spData) {
            iskNumberVal = (spData as Record<string, unknown>).isk_number as string || '';
            firmNameVal = (spData as Record<string, unknown>).firm_name as string || '';
          }

          surveyorNameVal = session?.user?.user_metadata?.full_name || '';
        }

        const enriched: ProjectData = {
          ...proj,
          surveyor_name: surveyorNameVal,
          surveyor_isk: iskNumberVal,
          surveyor_firm: firmNameVal,
        };

        setProject(enriched);

        // Populate form fields from DB
        setLrNumber(enriched.lr_number || '');
        setCounty(enriched.registration_district || '');
        setLocality(enriched.locality || '');
        setSurveyType(enriched.survey_type || '');
        setSurveyorName(surveyorNameVal);
        setIskNumber(iskNumberVal);
        setFirmName(firmNameVal);
        setReferenceNumber(enriched.ref_no || '');
      } catch (err: unknown) {
        const msg = err instanceof Error ? (err as Error).message : 'Failed to load project data';
        setError(msg);
      } finally {
        setLoadingProject(false);
      }
    }

    loadProject();
  }, [projectId]);

  // ── Handle generate ───────────────────────────────────────────────────
  const handleGenerate = useCallback(async (format?: 'pdf' | 'json') => {
    setGenerating(true);
    setError(null);
    setSuccess(false);
    setMetadata(null);

    const requestBody = {
      projectId,
      county,
      division,
      district,
      locality,
      surveyType,
      revision,
      parcelNumber: '',
      referenceNumber,
    };

    try {
      if (format === 'json') {
        const json = await apiPost(
          '/api/submission/form-c22?format=json',
          formC22JsonResponseSchema,
          requestBody,
        );
        if (json.metadata) {
          setMetadata(json.metadata as unknown as C22Metadata);
        }
        return;
      }

      // PDF binary — auto-download
      // ponytail: binary download bypasses typed client
      const response = await fetch('/api/submission/form-c22', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const safeName = (lrNumber || project?.name || 'form-c22')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .replace(/\s+/g, '_')
        .toLowerCase();
      a.download = `form-c22-${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(true);

      // Also fetch metadata for the summary panel
      try {
        const metaJson = await apiPost(
          '/api/submission/form-c22?format=json',
          formC22JsonResponseSchema,
          requestBody,
        );
        if (metaJson.metadata) {
          setMetadata(metaJson.metadata as unknown as C22Metadata);
        }
      } catch {
        // Best-effort — PDF already downloaded successfully
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        const msg = err instanceof Error ? (err as Error).message : 'Failed to generate Form C22';
        setError(msg);
      }
    } finally {
      setGenerating(false);
    }
  }, [projectId, lrNumber, project?.name, county, division, district, locality, surveyType, revision, referenceNumber]);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loadingProject) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
          <span className="text-sm text-[var(--text-muted)]">Loading project data…</span>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-400 text-sm">Load Error</h3>
            <p className="text-sm text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)] text-base">
                Form C22 — Computation Sheet
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Generate a Republic of Kenya Form C22 PDF from traverse data
              </p>
            </div>
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-secondary)] px-2.5 py-1 rounded-full">
            Survey Act Cap 299
          </span>
        </div>
      </div>

      {/* Editable fields — two-column grid */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Project Information
          </h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
          <FormField label="Project Name" value={project?.name || ''} disabled />
          <FormField label="LR Number" value={lrNumber} onChange={setLrNumber} />
          <FormField label="County / District" value={county} onChange={setCounty} />
          <FormField label="Division" value={division} onChange={setDivision} />
          <FormField label="District" value={district} onChange={setDistrict} />
          <FormField label="Locality" value={locality} onChange={setLocality} />
          <FormField label="Survey Type" value={surveyType} onChange={setSurveyType} />
          <FormField label="Reference No." value={referenceNumber} onChange={setReferenceNumber} />
          <FormField label="Revision" value={revision} onChange={setRevision} />
        </div>
      </div>

      {/* Surveyor fields */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Surveyor Information
          </h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
          <FormField label="Surveyor Name" value={surveyorName} onChange={setSurveyorName} />
          <FormField label="ISK Number" value={iskNumber} onChange={setIskNumber} />
          <FormField label="Firm Name" value={firmName} onChange={setFirmName} />
        </div>
      </div>

      {/* Generate button */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 space-y-3">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
          <button
            onClick={() => handleGenerate('pdf')}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {generating ? 'Generating C22…' : 'Generate C22 PDF'}
          </button>

          <button
            onClick={() => handleGenerate('json')}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-[var(--border-color)] text-[var(--text-secondary)] text-sm font-medium rounded-lg hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Info className="w-3.5 h-3.5" />
            )}
            Preview Metadata
          </button>
        </div>

        {/* Success banner */}
        {success && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Form C22 PDF generated and downloaded successfully.
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium">Generation failed: </span>
              {error}
            </div>
          </div>
        )}

        {/* Info hint */}
        {!success && !error && !generating && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] p-3 rounded-lg">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Ensure traverse data has been computed (Step 3) before generating. The C22 sheet uses adjusted coordinates and closure data.
          </div>
        )}
      </div>

      {/* Metadata summary (shown after preview or generation) */}
      {metadata && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              C22 Sheet Metadata
            </h3>
            <button
              onClick={() => handleGenerate('json')}
              className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatBox label="Stations" value={String(metadata.stationCount)} />
            <StatBox label="Area" value={`${metadata.areaHa.toFixed(4)} Ha`} />
            <StatBox
              label="Precision"
              value={metadata.precisionRatio > 0 ? `1 : ${Math.round(metadata.precisionRatio).toLocaleString()}` : '—'}
            />
            <StatBox
              label="Linear Misclosure"
              value={`${metadata.linearMisclosureM.toFixed(4)} m`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FormFieldProps {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}

function FormField({ label, value, onChange, disabled }: FormFieldProps) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </label>
      {disabled ? (
        <div className="text-sm text-[var(--text-secondary)] font-medium py-1.5 px-0">
          {value || '—'}
        </div>
      ) : (
        <input id={id}
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}…`}
          className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors"
        />
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
      <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5 font-mono">{value}</div>
    </div>
  );
}
