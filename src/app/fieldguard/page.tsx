// src/app/fieldguard/page.tsx

export const dynamic = 'force-dynamic'

import DataCleaner from '@/components/fieldguard/DataCleaner'

export default function FieldGuardPage() {
  // TODO: Get projectId from context/URL - using placeholder for now
  const projectId = 'default-project'
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">FieldGuard AI</h1>
      <DataCleaner projectId={projectId} />
    </div>
  )
}
