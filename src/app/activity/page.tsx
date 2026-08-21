import type { Metadata } from 'next'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'

export const metadata: Metadata = {
  title: 'Recent Activity — METARDU',
  description: 'Everything that happened in your METARDU projects.',
}

export default function ActivityPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Recent Activity</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Project creation, computations, documents and more — newest first.
        </p>
      </div>
      <ActivityFeed limit={50} />
    </div>
  )
}