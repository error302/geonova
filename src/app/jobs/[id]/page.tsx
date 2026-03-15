'use client'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getJob, getEquipmentByType, getChecklistByType, GeoNovaJob } from '@/lib/supabase/jobs'
import { useEffect, useState } from 'react'
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

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<GeoNovaJob | null>(null)
  const [equipment, setEquipment] = useState<string[]>([])
  const [checklist, setChecklist] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadJob()
  }, [params.id])

  const loadJob = async () => {
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
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div>Loading mission...</div></div>
  }

  if (!job) {
    notFound()
  }

  const workflow = WORKFLOW_GUIDES[job.survey_type] || []

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
          <Link href="/jobs" className="text-gray-400 hover:text-gray-200 flex items-center gap-2">
            ← Missions
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <JobCard job={job} />
        
        <div className="grid md:grid-cols-2 gap-8 mt-8">
          {/* Equipment */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
              🛠 Equipment Needed
            </h3>
            {equipment.length > 0 ? (
              <div className="space-y-2">
                {equipment.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No equipment recommendations</p>
            )}
          </div>

          {/* Checklist */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
              ✅ Preparation Checklist
            </h3>
            <div className="space-y-2">
              {checklist.map((task, idx) => (
                <label key={idx} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800">
                  <input type="checkbox" className="mt-1 flex-shrink-0 rounded text-[#E8841A]" />
                  <span className="text-gray-300 text-sm">{task}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Workflow */}
        {workflow.length > 0 && (
          <div className="mt-8 bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              📋 Field Workflow Guide
            </h3>
            <ol className="space-y-3">
              {workflow.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-xl border-l-4 border-[#E8841A]">
                  <span className="flex-shrink-0 w-6 h-6 bg-[#E8841A]/20 text-[#E8841A] rounded-full flex items-center justify-center font-medium text-sm">
                    {idx + 1}
                  </span>
                  <span className="text-gray-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Notes & Actions */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {job.notes && (
            <div className="md:col-span-2 bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
              <h4 className="font-semibold text-gray-100 mb-3">Notes</h4>
              <p className="text-gray-400 whitespace-pre-wrap">{job.notes}</p>
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

