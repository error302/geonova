'use client';

import {
  LEGAL_DESCRIPTION_TYPES,
  CADASTRAL_SURVEY_STEPS,
  MONUMENT_TYPES,
  ENCUMBRANCE_TYPES,
  US_SURVEY_STANDARDS,
  DOJ_TITLE_STANDARDS,
  TRACT_NUMBERING,
  LAND_STATUS_TYPES
} from '@/lib/data/usSurveyStandards'
import { PageHeader } from '@/components/shared/PageHeader'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function USSurveyReferencePage() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title={t('tools.usSurveyReference')}
          subtitle={t('tools.usSurveyReferenceDesc')}
        />

        {/* Legal Description Types */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Types of Legal Descriptions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {LEGAL_DESCRIPTION_TYPES.map((type) => (
              <div key={type.name} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
                <div className="font-semibold">{type.name}</div>
                <div className="text-sm text-[var(--text-muted)] mt-1">{type.description}</div>
                <div className="text-xs text-[var(--accent)] mt-2">Use: {type.use}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Land Status Types */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Land Status Types
          </h2>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {LAND_STATUS_TYPES.map((status, i) => (
                  <tr key={`${status}-${i}`} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="py-2 font-medium">{status.type}</td>
                    <td className="py-2 text-[var(--text-muted)]">{status.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cadastral Survey Steps */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Cadastral Survey Steps (FWS Handbook)
          </h2>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CADASTRAL_SURVEY_STEPS.map((step) => (
                <div key={step.step} className="flex gap-2 items-start">
                  <span className="w-6 h-6 rounded-full bg-[var(--accent)] text-black text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {step.step}
                  </span>
                  <span className="text-sm">{step.description}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Monumentation */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Monumentation Standards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MONUMENT_TYPES.map((mon) => (
              <div key={mon.name} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
                <div className="font-semibold">{mon.name}</div>
                <div className="text-sm text-[var(--text-muted)] mt-1">{mon.description}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Encumbrances */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Title Exceptions & Encumbrances
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2">General Exceptions</h3>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                {ENCUMBRANCE_TYPES.titleExceptions.slice(0, 3).map((e, i) => (
                  <li key={`${e}-${i}`}>• {e}</li>
                ))}
              </ul>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2">Special Exceptions</h3>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                {ENCUMBRANCE_TYPES.specialExceptions.slice(0, 3).map((e, i) => (
                  <li key={`${e}-${i}`}>• {e}</li>
                ))}
              </ul>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2">Riparian Issues</h3>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                {ENCUMBRANCE_TYPES.titleExceptions.slice(3).map((e, i) => (
                  <li key={`${e}-${i}`}>• {e}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* DOJ Title Standards */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            DOJ Title Standards (2001) - When Surveys Required
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-green-600">Required Before Acquisition</h3>
              <ul className="text-sm space-y-2">
                {DOJ_TITLE_STANDARDS.requiredBeforeAcquisition.map((s, i) => (
                  <li key={`${s}-${i}`} className="flex gap-2">
                    <span className="text-green-500"></span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-amber-600">Required For Acquisition</h3>
              <ul className="text-sm space-y-2">
                {DOJ_TITLE_STANDARDS.requiredForAcquisition.map((s, i) => (
                  <li key={`${s}-${i}`} className="flex gap-2">
                    <span className="text-amber-500">!</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Survey Standards */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Field Survey Standards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2">Control Survey</h3>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                <li><strong>Method:</strong> {US_SURVEY_STANDARDS.control.method}</li>
                <li><strong>Accuracy:</strong> {US_SURVEY_STANDARDS.control.accuracy}</li>
                <li><strong>Datum:</strong> {US_SURVEY_STANDARDS.control.datum}</li>
              </ul>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2">Field Notes Requirements</h3>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                {US_SURVEY_STANDARDS.fieldNotes.requirements.slice(0, 4).map((r, i) => (
                  <li key={`${r}-${i}`}>• {r}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Tract Numbering */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Tract Numbering System
          </h2>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
            <p className="text-sm mb-2"><strong>Purpose:</strong> {TRACT_NUMBERING.purpose}</p>
            <p className="text-sm mb-2"><strong>Roman Numerals:</strong> {TRACT_NUMBERING.romanNumerals}</p>
            <p className="text-sm"><strong>Example:</strong> {TRACT_NUMBERING.example}</p>
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Note:</strong> {TRACT_NUMBERING.usage}
            </div>
          </div>
        </section>

        {/* Quick Reference */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Quick Reference
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2">Survey Requirements</h3>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                <li>• BLM Manual (chapters 5-8) for public lands</li>
                <li>• State laws for acquired lands</li>
                <li>• Federal boundary evidence standards</li>
                <li>• 3 photos per controlling corner</li>
              </ul>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2">Research Sources</h3>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                <li>• County recorder offices</li>
                <li>• BLM GLO records</li>
                <li>• Local surveyors</li>
                <li>• Utility/transportation records</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
