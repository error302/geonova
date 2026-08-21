'use client';

import { useState } from 'react'
import Link from 'next/link'
import {
  FileCheck, FileText, Map as MapIcon, Award, BookOpen, FileSpreadsheet,
  ArrowRight, Search,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'

const reportTypes = [
  { name: 'RIM Report', icon: FileCheck, href: '/rim', description: 'Resurvey and Index Map — cadastral section with parcels, beacons and ownership' },
  { name: 'Survey Report', icon: FileText, href: '/tools/survey-report-builder', description: 'Comprehensive 14-section RDM 1.1 survey report with computations' },
  { name: 'Deed Plan', icon: MapIcon, href: '/deed-plan', description: 'Form No. 4 — legal document showing property boundaries and beacons' },
  { name: 'Beacon Certificate', icon: Award, href: '/tools/beacon-certificate', description: 'Official beacon coordinates, descriptions, and condition records' },
  { name: 'Field Book', icon: BookOpen, href: '/fieldbook', description: 'Raw field observations and measurements with rise & fall' },
  { name: 'Statutory Workbook', icon: FileSpreadsheet, href: '/tools/statutory-workbook', description: 'Regulatory compliance workbook for NLIMS submissions' },
]

export default function ReportsPage() {
  const [query, setQuery] = useState('')

  const filtered = reportTypes.filter(r =>
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    r.description.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <PageHeader
        title="Reports & Documents"
        subtitle="Generate statutory survey documents, certificates, and compliance reports"
        reference="Survey Act Cap. 299 | RDM 1.1 Table 5.4 | Survey Regulations 1994"
      />

      {/* Search */}
      <div className="mb-8">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search report types..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      </div>

      {/* Report type grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {filtered.map(report => {
          const Icon = report.icon
          return (
            <Link
              key={report.name}
              href={report.href}
              className="group p-6 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] transition-all duration-300 hover:-translate-y-0.5 no-underline"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center shrink-0 group-hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-colors">
                  <Icon className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1.5">
                    {report.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {report.description}
                  </p>
                  <div className="flex items-center gap-1 mt-3 text-xs text-[var(--accent)] font-medium group-hover:gap-2 transition-all">
                    Generate
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
