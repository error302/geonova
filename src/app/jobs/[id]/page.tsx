'use client'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getJob, getEquipmentByType, getChecklistByType, MetarduJob } from '@/lib/supabase/jobs'
import { useEffect, useState, useCallback } from 'react'
import JobCard from '@/components/jobs/JobCard'

interface WorkflowGuide {
  [key: string]: string[]
}

const WORKFLOW_GUIDES: WorkflowGuide = {
  boundary: [
    '1. Locate existing control points',
    '2. Set up total station on control',
    '3. Orient backsight',
    '4. Observe boundary corners',
    '5. Record coordinates',
    '6. Perform closure check'
  ],
  topographic: [
    '1. Establish control network',
    '2. GNSS/Total station setup',
    '3. Systematic feature capture',
    '4. Breaklines and spot heights',
    '5. Drone flight (optional)',
    '6. Cloud processing'
  ],
  leveling: [
    '1. Instrument setup on benchmark',
    '2. Backsight to known level',
    '3. Foresight sequence',
    '4. Instrument move',
    '5. Misclosure check',
    '6. Level adjustment'
  ]
  // Add more as needed
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<MetarduJob | null>(null)
  const [equipment, setEquipment] = useState<string[]>([])
  const [checklist, setChecklist] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadJob = useCallback(async () => {
    try {
      setLoading(true)
      const jobData = await getJob(params.id)
      if (!jobData) {
        notFound()
      }
      setJob(jobData)

      if (jobData.survey_type) {
        const equip = await getEquipmentByType(jobData.survey_type)
        const checks = await getChecklistByType(jobData.survey_type)
        setEquipment(equip)
        setChecklist(checks)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    loadJob()
  }, [loadJob])

  if (loading) {
    return <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center"><div>Loading mission...</div></div>
  }

  if (!job) {
    notFound()
  }

  const workflow = WORKFLOW_GUIDES[job.survey_type] || []

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
          <Link href="/jobs" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2">
            ← Missions
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <JobCard job={job} />
        
        <div className="grid md:grid-cols-2 gap-8 mt-8">
          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-2xl p-6">
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              🛠 Equipment Needed
            </h3>
            {equipment.length > 0 ? (
              <div className="space-y-2">
                {equipment.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)]/50 rounded-lg">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-[var(--text-secondary)]">{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[var(--text-muted)]">No equipment recommendations</p>
            )}
          </div>

          <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-2xl p-6">
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              ✅ Preparation Checklist
            </h3>
            <div className="space-y-2">
              {checklist.map((task, idx) => (
                <label key={idx} className="flex items-start gap-3 p-3 bg-[var(--bg-tertiary)]/50 rounded-lg cursor-pointer hover:bg-[var(--bg-tertiary)]">
                  <input type="checkbox" className="mt-1 flex-shrink-0 rounded text-[var(--accent)]" />
                  <span className="text-[var(--text-secondary)] text-sm">{task}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {workflow.length > 0 && (
          <div className="mt-8 bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-2xl p-6">
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-6 flex items-center gap-2">
              📋 Field Workflow Guide
            </h3>
            <ol className="space-y-3">
              {workflow.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 p-4 bg-[var(--bg-tertiary)]/50 rounded-xl border-l-4 border-[var(--accent)]">
                  <span className="flex-shrink-0 w-6 h-6 bg-[var(--accent)]/20 text-[var(--accent)] rounded-full flex items-center justify-center font-medium text-sm">
                    {idx + 1}
                  </span>
                  <span className="text-[var(--text-secondary)]">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {job.notes && (
            <div className="md:col-span-2 bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-2xl p-6">
              <h4 className="font-semibold text-[var(--text-primary)] mb-3">Notes</h4>
              <p className="text-[var(--text-secondary)] whitespace-pre-wrap">{job.notes}</p>
            </div>
          )}
          <Link
            href="/jobs"
            className="block p-4 text-center bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition"
          >
            Back to Missions
          </Link>
        </div>
      </main>
    </div>
  )
}

