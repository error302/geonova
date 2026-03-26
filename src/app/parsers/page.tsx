'use client'

import { useEffect, useState } from 'react'
import UploadZone from '@/components/UploadZone'

export default function ParsersPage() {
  const [mounted, setMounted] = useState(false)

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

        <div className="bg-[var(--bg-secondary)]/30 rounded-xl border border-[var(--border-color)] p-6">
          <UploadZone />
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-[var(--bg-secondary)]/30 rounded-lg p-4 border border-[var(--border-color)]">
            <div className="text-blue-400 font-medium">CAD</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">DXF, DWG</div>
          </div>
          <div className="bg-[var(--bg-secondary)]/30 rounded-lg p-4 border border-[var(--border-color)]">
            <div className="text-purple-400 font-medium">BIM</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">IFC</div>
          </div>
          <div className="bg-[var(--bg-secondary)]/30 rounded-lg p-4 border border-[var(--border-color)]">
            <div className="text-red-400 font-medium">PDF</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">Scanned drawings</div>
          </div>
          <div className="bg-[var(--bg-secondary)]/30 rounded-lg p-4 border border-[var(--border-color)]">
            <div className="text-emerald-400 font-medium">BOQ</div>
            <div className="text-[var(--text-muted)] text-xs mt-1">XLSX, CSV</div>
          </div>
        </div>
      </div>
    </div>
  )
}