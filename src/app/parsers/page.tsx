'use client';

import { useEffect, useState } from 'react'
import UploadZone from '@/components/UploadZone'
import { DWGImportGuidance } from '@/components/import/DWGImportGuidance'

export default function ParsersPage() {
  const [mounted, setMounted] = useState(false)
  const [showDwgGuidance, setShowDwgGuidance] = useState(false)

  useEffect(() => {
    setMounted(true)
    document.title = 'Import Building Plans - METARDU'
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Import Building Plans</h1>
          <p className="text-[var(--text-secondary)] mt-2">
            Upload architectural drawings, BIM models, or BOQ spreadsheets for analysis
          </p>
        </div>

        <div className="bg-[color-mix(in_srgb,var(--bg-secondary)_30%,transparent)] rounded-xl border border-[var(--border-color)] p-6">
          <UploadZone />
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div 
            className="bg-[color-mix(in_srgb,var(--bg-secondary)_30%,transparent)] rounded-lg p-4 border border-[var(--border-color)] cursor-pointer hover:border-blue-400"
            onClick={() => setShowDwgGuidance(!showDwgGuidance)}
          >
            <div className="text-blue-400 font-medium">CAD</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">DXF, DWG</div>
            {showDwgGuidance && <div className="mt-2"><DWGImportGuidance /></div>}
          </div>
          <div className="bg-[color-mix(in_srgb,var(--bg-secondary)_30%,transparent)] rounded-lg p-4 border border-[var(--border-color)]">
            <div className="text-purple-400 font-medium">BIM</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">IFC</div>
          </div>
          <div className="bg-[color-mix(in_srgb,var(--bg-secondary)_30%,transparent)] rounded-lg p-4 border border-[var(--border-color)]">
            <div className="text-red-400 font-medium">PDF</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">Scanned drawings</div>
          </div>
          <div className="bg-[color-mix(in_srgb,var(--bg-secondary)_30%,transparent)] rounded-lg p-4 border border-[var(--border-color)]">
            <div className="text-emerald-400 font-medium">BOQ</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">XLSX, CSV</div>
          </div>
        </div>
      </div>
    </div>
  )
}