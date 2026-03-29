// src/app/fieldguard/page.tsx

import dynamic from 'next/dynamic'

const DataCleaner = dynamic(
  () => import('@/components/fieldguard/DataCleaner'),
  { ssr: false, loading: () => <div className="p-8">Loading...</div> }
)

export default function FieldGuardPage() {
  const projectId = 'default-project'
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">FieldGuard AI</h1>
      <DataCleaner projectId={projectId} />
    </div>
  )
}
