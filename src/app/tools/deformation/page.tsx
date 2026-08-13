'use client'
import { DeformationTrackerPanel } from '@/components/survey/DeformationTrackerPanel'
import { PageHeader } from '@/components/shared/PageHeader'

export default function DeformationPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader title="Deformation Monitoring" subtitle="Epoch comparison and structural displacement tracking" reference="Time-series analysis | Mining, dams, structures" />
      <div className="mt-6"><DeformationTrackerPanel /></div>
    </div>
  )
}
