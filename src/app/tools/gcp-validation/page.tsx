'use client';

import { PageHeader } from '@/components/shared/PageHeader';

import type { TabId } from './types';
import { SAMPLE_AGISOFT, accuracyClasses } from './constants';
import { useGCPValidation } from './useGCPValidation';
import { GcpTab } from './GcpTab';
import { ResidualsTab } from './ResidualsTab';
import { ResultsTab } from './ResultsTab';
import { ReportTab } from './ReportTab';
import { useLanguage } from '@/lib/i18n/LanguageContext'

/* ══════════════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ══════════════════════════════════════════════════════════════════════ */

export default function GCPValidationPage() {
  const { t } = useLanguage()
  const v = useGCPValidation();
  const {
    activeTab,
    setActiveTab,
    utmZone,
    setUtmZone,
    selectedClass,
    setSelectedClass,
    knownGCPs,
    setKnownGCPs,
    residualText,
    setResidualText,
    residualFormat,
    setResidualFormat,
    detectedFormat,
    setDetectedFormat,
    parsedResiduals,
    setParsedResiduals,
    parseError,
    validationSummary,
    setValidationSummary,
    fileInputRef,
    csvInputRef,
    addGCP,
    removeGCP,
    updateGCP,
    clearGCPs,
    loadSampleGCPs,
    handleCSVFileUpload,
    handleGeoJSONUpload,
    handleParseResiduals,
    handleResidualFileUpload,
    loadSampleResiduals,
    clearResiduals,
    handleRunValidation,
    clearAll,
    generateReportText,
    handleCopyReport,
    handleExportCSV,
    handlePrint,
  } = v;

  /* ══════════════════════════════════════════════════════════════════════
   *  RENDER
   * ══════════════════════════════════════════════════════════════════════ */

  const tabs: { id: TabId; label: string }[] = [
    { id: 'gcp', label: 'Known GCPs' },
    { id: 'residuals', label: 'Import Residuals' },
    { id: 'results', label: 'Validation Results' },
    { id: 'report', label: 'Report' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.gcpValidation')}
        subtitle={t('tools.gcpValidationDesc')}
        reference="ISK Survey Standards | Kenya Accuracy Classes I/II/III | Agisoft Metashape / Pix4D"
        badge="GCP VALIDATION"
      />

      {/* ── Global Settings ── */}
      <div className="card mb-6">
        <div className="card-header flex flex-wrap gap-4 items-center justify-between">
          <span className="label">Settings</span>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="utm-zone">UTM Zone</label>
              <select id="utm-zone"
                className="input w-24"
                value={utmZone}
                onChange={e => setUtmZone(parseInt(e.target.value))}
              >
                <option value={36}>36S</option>
                <option value={37}>37S</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1" htmlFor="accuracy-class">Accuracy Class</label>
              <select
                 id="accuracy-class" className="input"
                value={selectedClass.name}
                onChange={e => {
                  const cls = accuracyClasses.find(c => c.name === e.target.value);
                  if (cls) {
                    setSelectedClass(cls);
                    setValidationSummary(null);
                  }
                }}
              >
                {accuracyClasses.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} — {c.scale} (H: ≤{c.horizontal}m, V: ≤{c.vertical}m)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={clearAll} className="btn btn-secondary text-sm">Clear All</button>
              <button
                onClick={() => {
                  loadSampleGCPs();
                  setResidualText(SAMPLE_AGISOFT);
                  setResidualFormat('auto');
                  setParsedResiduals([]);
                  setValidationSummary(null);
                }}
                className="btn btn-secondary text-sm"
              >
                Load Sample Data
              </button>
            </div>
          </div>
        </div>
        <div className="p-3 bg-[var(--bg-tertiary)] rounded text-sm">
          <div className="flex flex-wrap gap-6">
            <div>
              <span className="text-[var(--text-secondary)]">Horizontal Limit: </span>
              <span className="font-mono text-[var(--accent)]">≤ {selectedClass.horizontal} m</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Vertical Limit: </span>
              <span className="font-mono text-[var(--accent)]">≤ {selectedClass.vertical} m</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Map Scale: </span>
              <span className="font-mono">{selectedClass.scale}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Known GCPs: </span>
              <span className="font-mono">{knownGCPs.length}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Parsed Residuals: </span>
              <span className="font-mono">{parsedResiduals.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--accent)] text-black'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--accent)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
       *  TAB 1: KNOWN GCP COORDINATES
       * ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'gcp' && (
        <GcpTab
          knownGCPs={knownGCPs}
          addGCP={addGCP}
          removeGCP={removeGCP}
          updateGCP={updateGCP}
          clearGCPs={clearGCPs}
          loadSampleGCPs={loadSampleGCPs}
          csvInputRef={csvInputRef}
          handleCSVFileUpload={handleCSVFileUpload}
          fileInputRef={fileInputRef}
          handleGeoJSONUpload={handleGeoJSONUpload}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
       *  TAB 2: IMPORT RESIDUALS
       * ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'residuals' && (
        <ResidualsTab
          residualText={residualText}
          setResidualText={setResidualText}
          residualFormat={residualFormat}
          setResidualFormat={setResidualFormat}
          detectedFormat={detectedFormat}
          setDetectedFormat={setDetectedFormat}
          setParsedResiduals={setParsedResiduals}
          parseError={parseError}
          parsedResiduals={parsedResiduals}
          knownGCPs={knownGCPs}
          loadSampleResiduals={loadSampleResiduals}
          clearResiduals={clearResiduals}
          handleResidualFileUpload={handleResidualFileUpload}
          handleParseResiduals={handleParseResiduals}
          handleRunValidation={handleRunValidation}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
       *  TAB 3: VALIDATION RESULTS
       * ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'results' && (
        <ResultsTab
          validationSummary={validationSummary}
          selectedClass={selectedClass}
          knownGCPs={knownGCPs}
          parsedResiduals={parsedResiduals}
          setActiveTab={setActiveTab}
          handleRunValidation={handleRunValidation}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
       *  TAB 4: REPORT
       * ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'report' && (
        <ReportTab
          validationSummary={validationSummary}
          selectedClass={selectedClass}
          generateReportText={generateReportText}
          handleCopyReport={handleCopyReport}
          handleExportCSV={handleExportCSV}
          handlePrint={handlePrint}
        />
      )}

      {/* ── Print Styles ── */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area *,
          .print-area *::before,
          .print-area *::after {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 2cm;
            background: white !important;
            color: black !important;
          }
          .print-area pre {
            color: black !important;
          }
          .card-header,
          nav,
          button {
            display: none !important;
          }
          .print-area ~ * {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
