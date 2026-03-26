'use client'

import Link from 'next/link'
import { MetarduJob } from '@/lib/supabase/jobs'

const statusColors = {
  planned: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30'
}

export default function JobCard({ job }: { job: MetarduJob }) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date'
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <div className="border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 rounded-lg p-6 hover:border-[var(--accent)]/50 hover:shadow-md transition-all group">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition">
            {job.name}
          </h3>
          <span className={`px-2 py-1 text-xs rounded-full font-medium border ${statusColors[job.status as keyof typeof statusColors]}`}>
            {job.status.toUpperCase()}
          </span>
        </div>
        
        <p className="text-[var(--text-secondary)] text-sm mb-4 line-clamp-2">
          {job.client ? `Client: ${job.client}` : 'Personal project'}
        </p>
        
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <span>📍</span>
            <span>{job.location ? 'Location set' : 'No location'}</span>
          </div>
          {job.crew_size && (
            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
              <span>👥</span>
              <span>{job.crew_size} crew</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
            <span>📅</span>
            <span>{formatDate(job.scheduled_date ?? null)}</span>
          </div>
        </div>
        
        {job.survey_type && (
          <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
            <span className="text-xs bg-[var(--accent)]/20 text-[var(--accent)] px-2 py-1 rounded">
              {job.survey_type.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

