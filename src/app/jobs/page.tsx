'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getUserJobs, GeoNovaJob } from '@/lib/supabase/jobs'
import JobCard from '@/components/jobs/JobCard'
import { createClient } from '@/lib/supabase/client'

export default function JobsPage() {
  const [jobs, setJobs] = useState<GeoNovaJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const userJobs = await getUserJobs()
      setJobs(userJobs)
    } catch (err: any) {
      setError(err.message || 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => loadJobs()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading your missions...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Field Missions</h1>
            <p className="text-gray-400 mt-1">Plan, schedule, and prepare your survey jobs</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
            >
              🔄 Refresh
            </button>
            <Link
              href="/jobs/new"
              className="px-6 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded-lg transition-colors"
            >
              + New Mission
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600/50 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {jobs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🧭</div>
            <h2 className="text-2xl font-bold text-gray-100 mb-4">No missions planned</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Create your first field mission to get equipment recommendations, checklists, and workflow guidance.
            </p>
            <Link
              href="/jobs/new"
              className="inline-block px-8 py-3 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded-lg transition-colors"
            >
              Create First Mission
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

