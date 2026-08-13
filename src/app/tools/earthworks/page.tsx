'use client';

import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import CrossSectionInput from '@/components/earthworks/CrossSectionInput'
import ProjectCrossSections from '@/components/earthworks/ProjectCrossSections'
import { useLanguage } from '@/lib/i18n/LanguageContext'

/**
 * Earthworks Calculator — extends Cross Sections with:
 * - Mass Haul Diagram (cumulative volume chart)
 * - Cut/Fill balance analysis
 * - End-Area vs Prismoidal volume comparison
 * - Free-haul and overhaul distance analysis
 */

export default function EarthworksPage() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  // Remove hardcoded demo — the CrossSectionInput below handles real computation
  // The old summary panel showed fake 7600/8000 m³ regardless of input.

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.earthworks')}
        subtitle={t('tools.earthworksDesc')}
      />

      {/* Info banner replacing hardcoded demo summary */}
      <div className="mb-6 p-4 border border-[var(--accent)]/30 bg-[var(--accent)]/5 rounded-md">
        <p className="font-mono text-[10px] text-[var(--accent)] tracking-[0.08em] uppercase mb-1">How this works</p>
        <p className="text-sm text-[var(--text-secondary)]">
          Enter cross-section data below (or load from project via <code className="font-mono text-[var(--accent)]">?project=ID</code>).
          The calculator computes cut/fill volumes, mass-haul diagram, and BoQ quantities.
          Use the print button for a formal earthworks report.
        </p>
      </div>

      {/* Full cross section calculator — this is the real tool */}
      <div className="mt-8 border-t border-[var(--border-color)] pt-6">
        <h2 className="text-lg font-semibold mb-4">Cross Section Data Entry</h2>
        {projectId && projectId !== 'new' ? (
          <ProjectCrossSections projectId={projectId} />
        ) : (
          <CrossSectionInput />
        )}
      </div>
    </div>
  )
}
