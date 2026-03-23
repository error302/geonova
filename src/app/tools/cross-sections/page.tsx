'use client'

import Link from 'next/link'

export default function CrossSectionsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Cross Sections</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Cross section analysis for earthworks and volume calculations
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Cross Section Tools</h2>
          <ul className="space-y-3">
            <li>
              <Link href="/tools/earthworks" className="text-[var(--accent)] hover:underline">
                Earthworks Calculator →
              </Link>
              <p className="text-sm text-[var(--text-muted)]">
                Cross section input with area calculation and volume computation
              </p>
            </li>
            <li>
              <Link href="/tools/chainage" className="text-[var(--accent)] hover:underline">
                Chainage Calculator →
              </Link>
              <p className="text-sm text-[var(--text-muted)]">
                Calculate chainage along alignments
              </p>
            </li>
          </ul>
        </div>

        <div className="card">
          <h2 className="font-semibold mb-4">Features</h2>
          <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)]">
            <li>End Area Method (Average End Area)</li>
            <li>Prismoidal Formula</li>
            <li>Shrinkage/Swell factor adjustment</li>
            <li>Mass haul diagram</li>
            <li>Cut/Fill calculations</li>
            <li>Export to PDF</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
