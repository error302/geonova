'use client'
import { FieldRecordVault } from '@/components/survey/FieldRecordVault'
import { PageHeader } from '@/components/shared/PageHeader'

export default function FieldRecordsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <PageHeader
        title="Field Record Vault"
        subtitle="Crowdsourced historic F/R index — find old survey records spatially"
        reference="Saves archival research time | Community-contributed"
      />
      <div className="mt-6">
        <FieldRecordVault />
      </div>
    </div>
  )
}
