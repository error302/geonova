'use client'

import Link from 'next/link'
import { GeoNovaJob } from '@/lib/supabase/jobs'

const statusColors = {
  planned: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800'
}

export default function JobCard({ job }: { job: GeoNovaJob }) {
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
      <div className="border border-gray-800 bg-gray-900/50 rounded-lg p-6 hover:border-[#E8841A]/50 hover:shadow-md transition-all group">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-100 group-hover:text-[#E8841A] transition">
            {job.name}
          </h3>
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${statusColors[job.status as keyof typeof statusColors]}`}>
            {job.status.toUpperCase()}
          </span>
        </div>
        
        <p className="text-gray-400 text-sm mb-4 line-clamp-2">
          {job.client ? `Client: ${job.client}` : 'Personal project'}
        </p>
        
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <span>📍</span>
            <span>{job.location ? 'Location set' : 'No location'}</span>
          </div>
          {job.crew_size && (
            <div className="flex items-center gap-2 text-gray-400">
              <span>👥</span>
              <span>{job.crew_size} crew</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-300 font-medium">
            <span>📅</span>
            <span>{formatDate(job.scheduled_date)}</span>
          </div>
        </div>
        
        {job.survey_type && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <span className="text-xs bg-[#E8841A]/20 text-[#E8841A] px-2 py-1 rounded">
              {job.survey_type.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

