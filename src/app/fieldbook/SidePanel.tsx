'use client';

import type React from 'react';
import type { SaveStatus, SavedFieldbook } from './types';

interface SidePanelProps {
  t: (key: string) => string;
  panelRef: React.RefObject<HTMLDivElement>;
  projectId: string;
  setProjectId: (s: string) => void;
  projects: Array<{ id: string; name: string }>;
  name: string;
  setName: (s: string) => void;
  handleSave: () => void;
  saveStatus: SaveStatus;
  setFieldbookId: (id: string | null) => void;
  setNameReset: (s: string) => void;
  setSaveStatusIdle: () => void;
  syncStatus: { synced: number; failed: number } | null;
  handleDevelopFullPlan: () => void;
  planGenerating: boolean;
  planStep: string;
  planResult: { success: boolean; downloadUrl?: string; error?: string } | null;
  exportPDF: () => void;
  exportCSV: () => void;
  exportJSON: () => void;
  savedFieldbooks: SavedFieldbook[];
  fieldbookId: string | null;
  loadFieldbook: (entry: SavedFieldbook) => void;
  isOnline: () => boolean;
}

export default function SidePanel({
  t,
  panelRef,
  projectId,
  setProjectId,
  projects,
  name,
  setName,
  handleSave,
  saveStatus,
  setFieldbookId,
  setNameReset,
  setSaveStatusIdle,
  syncStatus,
  handleDevelopFullPlan,
  planGenerating,
  planStep,
  planResult,
  exportPDF,
  exportCSV,
  exportJSON,
  savedFieldbooks,
  fieldbookId,
  loadFieldbook,
  isOnline,
}: SidePanelProps) {
  return (
    <div className="lg:col-span-3 space-y-4" ref={panelRef}>
      <div className="card p-4 space-y-3">
        <div>
          <label className="label">{t('projects.project')}</label>
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t('projects.selectProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="fieldbook-name">{t('field.fieldBookName')}</label>
          <input id="fieldbook-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('field.fieldBookNamePlaceholder')} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleSave} className="btn btn-primary">
            {saveStatus.kind === 'saving' ? t('common.saving') : t('common.save')}
          </button>
          <button
            onClick={() => {
              setFieldbookId(null)
              setNameReset('')
              setSaveStatusIdle()
            }}
            className="btn btn-secondary"
          >
            {t('common.new')}
          </button>
        </div>

        {saveStatus.kind === 'saved' && <p className="text-xs text-green-400">Saved: {new Date(saveStatus.when).toLocaleString()}</p>}
        {saveStatus.kind === 'error' && <p className="text-xs text-red-400">{saveStatus.message}</p>}
        {syncStatus && (
          <p className={`text-xs ${syncStatus.failed ? 'text-yellow-400' : 'text-green-400'}`}>
            Sync: {syncStatus.synced} synced, {syncStatus.failed} failed
          </p>
        )}

        <div className="pt-2 border-t border-[var(--border-color)]">
          {/* "Develop Full Plan" uses green per METARDU's "go" action convention
              (used in 30+ places: develop/save/verify/approve). Not a bug. */}
          <button
            onClick={handleDevelopFullPlan}
            disabled={planGenerating || !projectId}
            className="w-full btn bg-green-600 hover:bg-green-700 text-white border-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {planGenerating ? planStep || 'Generating...' : 'Develop Full Plan'}
          </button>
          {planResult && (
            <div className="mt-2 p-2 rounded text-xs">
              {planResult.success ? (
                <a
                  href={planResult.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 underline"
                >
                  Download Plan Package
                </a>
              ) : (
                <span className="text-red-400">Error: {planResult.error}</span>
              )}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-[var(--border-color)] flex gap-2">
          <button onClick={exportPDF} className="btn btn-secondary flex-1">
            {t('common.exportPdf')}
          </button>
          <button onClick={exportCSV} className="btn btn-secondary flex-1">
            {t('common.exportCsv')}
          </button>
          <button onClick={exportJSON} className="btn btn-secondary flex-1">
            {t('common.exportJson')}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="label">{t('field.savedFieldbooks')}</span>
          <span className="text-xs text-[var(--text-muted)]">{isOnline() ? t('common.online') : t('common.offline')}</span>
        </div>
        <div className="space-y-2 max-h-[45vh] overflow-auto pr-1">
          {savedFieldbooks.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t('field.noSavedFieldbooks')}</p>
          ) : (
            savedFieldbooks.map((fb) => (
              <button
                key={fb.id}
                onClick={() => loadFieldbook(fb)}
                className={`w-full text-left px-3 py-2 rounded border ${
                  fieldbookId === fb.id ? 'border-amber-500/50 bg-amber-500/10' : 'border-[var(--border-color)] bg-[var(--bg-primary)]/30 hover:border-amber-500/20'
                }`}
              >
                <div className="text-sm text-[var(--text-primary)] truncate">{fb.name || fb.id}</div>
                 <div className="text-xs text-[var(--text-muted)]">{fb.updated_at ?? fb.created_at ? new Date(fb.updated_at ?? fb.created_at as string | number | Date).toLocaleString() : ''}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
