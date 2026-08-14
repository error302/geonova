import { Suspense } from 'react'
import dynamic from 'next/dynamic'

const WorkingDiagramClient = dynamic(
  () => import('@/components/working-diagram/WorkingDiagramClient'),
  { ssr: false, loading: () => <div className="p-8 text-gray-500">Loading diagram editor…</div> }
)

export default function WorkingDiagramPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={null}>
        <WorkingDiagramClient />
      </Suspense>
    </div>
  )
}
