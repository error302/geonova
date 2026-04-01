'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getActiveSurveyorProfile } from '@/lib/submission/surveyorProfile'
import { generateSubmissionNumber } from '@/lib/submission/numbering'
import { BOUNDARY_ATTACHMENT_SLOTS } from '@/lib/submission/checklist'
import { validateSubmissionPackage } from '@/lib/submission/validateSubmission'
import { generateSubmissionWorkbook } from '@/lib/submission/workbook/generateWorkbook'
import { generateShapefileZip } from '@/lib/export/generateShapefile'
import { Button } from '@/components/ui/button' // Assume shadcn
import { generateSurveyReport } from '@/lib/reports/surveyReport'
import type { ProjectSubmission, PackageValidation, SurveyorProfile } from '@/types/submission'
import type { MetarduProject } from '@/types/metardu' // Temp - fix later

export default function ProjectSubmissionPage() {
  const params = useParams()
  const projectId = params.id as string
  const supabase = createClient()

  const [project, setProject] = useState<MetarduProject | null>(null)
  const [profile, setProfile] = useState<SurveyorProfile | null>(null)
  const [submission, setSubmission] = useState<ProjectSubmission | null>(null)
  const [validation, setValidation] = useState<PackageValidation>({ ready: false, blockers: [], warnings: [] })
  const [generating, setGenerating] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [projectId])

  const fetchData = async () => {
    const [projRes, profileRes, subRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      getActiveSurveyorProfile(),
      supabase.from('project_submissions').select('*').eq('project_id', projectId).eq('package_status', 'ready').order('created_at', { ascending: false }).maybeSingle(),
    ])

    setProject(projRes.data as MetarduProject)
    setProfile(profileRes)
    setSubmission(subRes.data as ProjectSubmission)
  }

  const createSubmission = async () => {
    if (!profile || !project) return

    const { submissionNumber } = await generateSubmissionNumber(profile.id, profile.registration_number)
    const newSubmission: ProjectSubmission = {
      id: crypto.randomUUID(),
      project_id: project.id,
      surveyor_profile_id: profile.id,
      submission_number: submissionNumber,
      revision_code: 'R00',
      submission_year: new Date().getFullYear(),
      package_status: 'draft',
      required_sections: [], // Populate from SUBMISSION_SECTIONS
      generated_artifacts: {},
      supporting_attachments: {},
      validation_results: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('project_submissions').insert(newSubmission)
    if (error) throw error

    setSubmission(newSubmission)
  }

  const generatePackage = async () => {
    setGenerating(true)
    try {
      const val = validateSubmissionPackage(submission!, project!, profile!)
      setValidation(val)
      if (!val.ready) return

      // Generate artifacts
      const workbookData = {
        submission_number: submission!.submission_number,
        surveyor_name: profile!.full_name,
        project_name: project!.name,
        lr_number: project!.lr_number || '',
        folio_number: project!.folio_number || '',
        register_number: project!.register_number || '',
        beacons: [], // From boundary_data
        parcels: [], // From boundary_data
        theoreticalCoords: [], // Final coords
        datumJoins: [],
        consistencyChecks: [],
      }
      const workbookBlob = new Blob([generateSubmissionWorkbook(workbookData)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      
      // Survey report with submission number
      // generateSurveyReport(data, { submission_number: submission!.submission_number })

      // Shapefile
      const shpBlob = await generateShapefileZip({
        submission_number: submission!.submission_number,
        beacons: [],
        boundaryLines: [],
        parcels: [],
        utmZone: project!.utm_zone,
        hemisphere: project!.hemisphere as 'N' | 'S',
      })

      // ZIP all
      const zip = new JSZip()
      zip.file('computations.xlsx', workbookBlob)
      zip.file('data.zip', shpBlob) // Shapefile ZIP
      // zip.file('survey_report.pdf', reportBlob)

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      setDownloadUrl(url)
    } catch (error) {
      console.error('Package generation failed', error)
    } finally {
      setGenerating(false)
    }
  }

  if (!project || !profile) {
    return <div>Loading submission data...</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => window.history.back()} className="text-zinc-400 hover:text-white">&larr; Back</button>
        <h1 className="text-2xl font-bold">Submission Package: {project.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Package Status */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Package Status</h2>
          <div className="space-y-2">
            <div>Submission: {submission?.submission_number || 'Not created'}</div>
            <div>Status: {submission?.package_status || 'Draft'}</div>
            {validation.ready && <div className="text-green-400 font-semibold">READY ✓</div>}
            {!validation.ready && validation.blockers.map((b, i) => (
              <div key={i} className="text-red-400 text-sm">• {b}</div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-y-3">
            {!submission && (
              <Button onClick={createSubmission} className="w-full bg-blue-600 hover:bg-blue-700">
                Create New Submission
              </Button>
            )}
            {submission && (
              <Button onClick={generatePackage} disabled={generating || !validation.ready} className="w-full bg-[#f59e0b] hover:bg-[#f59e0b]/90 text-black">
                {generating ? 'Generating...' : 'Generate Package ZIP'}
              </Button>
            )}
            {downloadUrl && (
              <a href={downloadUrl} download={`submission-${submission?.submission_number}.zip`} className="block w-full text-center p-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold">
                ⬇ Download Package
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-6">Required Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SUBMISSION_SECTIONS.map(section => (
            <div key={section.id} className={`p-4 rounded-lg border ${section.status === 'ready' ? 'border-green-500 bg-green-500/10' : 'border-zinc-700 bg-zinc-900'}`}>
              <div className={`w-3 h-3 rounded-full mb-2 ${section.status === 'ready' ? 'bg-green-500' : 'bg-zinc-600'}`} />
              <div className="font-medium">{section.label}</div>
              <div className="text-xs text-zinc-400 capitalize">{section.status}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Attachments */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-6">Supporting Attachments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BOUNDARY_ATTACHMENT_SLOTS.map(slot => (
            <div key={slot.id} className="flex items-center gap-3 p-4 border border-zinc-700 rounded-lg">
              <div className={`w-3 h-3 rounded-full ${slot.required ? 'bg-red-500' : 'bg-zinc-600'}`} />
              <div>
                <div className="font-medium">{slot.label}</div>
                <div className="text-xs text-zinc-400">{slot.helpText}</div>
              </div>
              <Button size="sm" variant="outline" className="ml-auto">Upload</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

