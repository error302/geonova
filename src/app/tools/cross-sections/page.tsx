'use client'

import CrossSectionInput from '@/components/earthworks/CrossSectionInput'

export default function CrossSectionsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Cross Sections</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Cross section analysis for earthworks and volume calculations | End Area Method | Prismoidal Formula | RDM 1.1 (2025)
      </p>
      <CrossSectionInput />
    </div>
  )
}
