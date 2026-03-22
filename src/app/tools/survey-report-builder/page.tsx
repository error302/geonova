'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateSurveyReport } from '@/lib/reports/surveyReport'
import { checkReportAccess, seedProfessionalTier } from '@/lib/reports/surveyReport/subscription'
import { bearingFromDelta, distance } from '@/lib/reports/surveyPlan/geometry'
import { bearingToString } from '@/lib/engine/angles'
import type { SurveyReportData, Photo, SubscriptionTier } from '@/lib/reports/surveyReport/types'
import UpgradeModal from '@/components/UpgradeModal'
import PhotoUploader from '@/components/PhotoUploader'

interface Project {
  id: string
  name: string
  location: string | null
  utm_zone: number
  hemisphere: string
  survey_type?: string
  client_name?: string | null
  surveyor_name?: string | null
  created_at: string
}

interface Point {
  id: string
  name: string
  easting: number
  northing: number
  elevation: number | null
  is_control: boolean
  control_order?: string
}

interface Parcel {
  id: string
  name: string | null
  boundary_points: { name?: string; easting: number; northing: number }[]
  area_sqm: number
  area_ha: number
  area_acres: number
  perimeter_m: number
}

type Step = 1 | 2 | 3 | 4

export default function SurveyReportBuilderPage() {
  const [step, setStep] = useState<Step>(1)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [subscription, setSubscription] = useState<{ canGenerate: boolean; tier: SubscriptionTier }>({
    canGenerate: false,
    tier: 'free',
  })

  const [reportTitle, setReportTitle] = useState('Topographic / Boundary Survey Report')
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().slice(0, 10))
  const [parcelRef, setParcelRef] = useState('')
  const [scale, setScale] = useState(1000)
  const [includeMobilisation, setIncludeMobilisation] = useState(false)
  const [includePhotos, setIncludePhotos] = useState(false)
  const [customIntro, setCustomIntro] = useState('')
  const [mobilisation, setMobilisation] = useState({
    instrument: '', serialNumber: '', calibrationDate: '', fieldTeam: '', weather: '', siteAccess: '',
  })
  const [photos, setPhotos] = useState<Photo[]>([])

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { window.location.href = '/login'; return }

    await seedProfessionalTier(user.id)

    const [sub, { data: projData }] = await Promise.all([
      checkReportAccess(user.id),
      supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])

    setSubscription(sub)
    setProjects(projData || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  const handleGenerate = async () => {
    if (!selectedProject) return

    if (!subscription.canGenerate) {
      setShowUpgrade(true)
      return
    }

    setGenerating(true)

    try {
      const { data: pts } = await supabase
        .from('survey_points')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('created_at')

      const { data: parcels } = await supabase
        .from('parcels')
        .select('*')
        .eq('project_id', selectedProject.id)
        .limit(1)

      const parcel = parcels?.[0] as Parcel | null

      const points: Point[] = (pts || []) as Point[]
      const controlPts = points.filter(p => p.is_control)

      const boundaryPts = controlPts.length >= 3
        ? controlPts.map(p => ({ name: p.name, easting: p.easting, northing: p.northing, elevation: p.elevation, is_control: p.is_control, control_order: p.control_order }))
        : points.slice(0, 4).map((p, i) => ({ name: p.name || String(i + 1), easting: p.easting, northing: p.northing, elevation: p.elevation, is_control: false }))

      const area_sqm = parcel?.area_sqm || 0
      const perimeter_m = parcel?.perimeter_m || 0

      const bearingSchedule = boundaryPts.map((pt, i) => {
        const next = boundaryPts[(i + 1) % boundaryPts.length]
        const dist = distance(pt.easting, pt.northing, next.easting, next.northing)
        const bearingDeg = bearingFromDelta(next.easting - pt.easting, next.northing - pt.northing)
        return {
          from: pt.name || String(i + 1),
          to: next.name || String(((i + 1) % boundaryPts.length) + 1),
          bearing: bearingToString(bearingDeg),
          distance: dist,
        }
      })

      const reportData: SurveyReportData = {
        project: {
          name: selectedProject.name,
          location: selectedProject.location || 'Kenya',
          utm_zone: selectedProject.utm_zone || 37,
          hemisphere: selectedProject.hemisphere || 'S',
          datum: 'ARC1960',
          client_name: selectedProject.client_name || undefined,
          surveyor_name: selectedProject.surveyor_name || undefined,
          survey_type: selectedProject.survey_type || 'Cadastral / Boundary',
          scale,
          survey_date: surveyDate,
          parcel_ref: parcelRef,
        },
        controlPoints: boundaryPts,
        parcel: parcel ? {
          name: parcel.name || 'Parcel',
          boundaryPoints: boundaryPts,
          area_sqm: parcel.area_sqm,
          area_ha: parcel.area_ha,
          area_acres: parcel.area_acres,
          perimeter_m: parcel.perimeter_m,
          parcel_ref: parcelRef,
        } : {
          boundaryPoints: boundaryPts,
          area_sqm,
          area_ha: area_sqm / 10000,
          area_acres: area_sqm * 0.000247105,
          perimeter_m,
        },
        bearingSchedule,
        mobilisation: includeMobilisation ? {
          instrument: mobilisation.instrument || 'Total Station',
          serialNumber: mobilisation.serialNumber || '—',
          calibrationDate: mobilisation.calibrationDate || '—',
          fieldTeam: mobilisation.fieldTeam || '—',
          weather: mobilisation.weather || '—',
          surveyDate: surveyDate,
          siteAccess: mobilisation.siteAccess,
        } : undefined,
        photos: includePhotos ? photos : undefined,
      }

      generateSurveyReport(reportData, {
        includeMobilisation,
        includePhotos,
        customIntroduction: customIntro,
        scale,
        reportTitle,
        parcelRef,
      })

      setStep(4)
    } catch (err) {
      console.error('Report generation failed:', err)
      alert('Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Survey Report Builder</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Generate a professional RDM 1.1-compliant survey report in PDF format.
          </p>
        </div>

        {step < 4 && (
          <div className="flex items-center gap-1 mb-8">
            {([1, 2, 3] as Step[]).map(s => (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step >= s ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                }`}>
                  {s}
                </div>
                <span className={`text-xs ${step >= s ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                  {s === 1 ? 'Select Project' : s === 2 ? 'Report Settings' : 'Review & Generate'}
                </span>
                {s < 3 && <div className={`w-8 h-0.5 mx-1 ${step > s ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'}`} />}
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Select Project</h2>
            {projects.length === 0 ? (
              <p className="text-[var(--text-muted)]">No projects found. Create a project first.</p>
            ) : (
              <div className="space-y-2">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProjectId(p.id)
                      setReportTitle(`${p.name} — Survey Report`)
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      selectedProjectId === p.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                        : 'border-[var(--border-color)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <div className="font-medium text-[var(--text-primary)]">{p.name}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {p.location || '—'} · {p.survey_type || 'Survey'} · UTM Zone {p.utm_zone}{p.hemisphere}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedProjectId}
                className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg text-sm transition-colors disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Report Settings</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-[var(--text-muted)] mb-1">Report Title</label>
                <input value={reportTitle} onChange={e => setReportTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Survey Date</label>
                <input type="date" value={surveyDate} onChange={e => setSurveyDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm" />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Scale</label>
                <select value={scale} onChange={e => setScale(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm">
                  {[100, 200, 250, 500, 1000, 2000, 5000].map(s => (
                    <option key={s} value={s}>1:{s.toLocaleString()}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-[var(--text-muted)] mb-1">Parcel / LR Reference (optional)</label>
                <input value={parcelRef} onChange={e => setParcelRef(e.target.value)}
                  placeholder="e.g. LR No. 123/456 or Plot 789"
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-[var(--text-muted)] mb-1">Custom Introduction (optional)</label>
                <textarea value={customIntro} onChange={e => setCustomIntro(e.target.value)} rows={3}
                  placeholder="Leave blank for default wording"
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] text-sm resize-none" />
              </div>
            </div>

            <div className="border-t border-[var(--border-color)] pt-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={includeMobilisation} onChange={e => setIncludeMobilisation(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)]" />
                <div>
                  <div className="text-sm text-[var(--text-primary)] font-medium">Include Mobilisation Report</div>
                  <div className="text-xs text-[var(--text-muted)]">Instrument, team, weather, and site access details</div>
                </div>
              </label>

              {includeMobilisation && (
                <div className="grid grid-cols-2 gap-3 pl-8">
                  {[
                    { k: 'instrument', l: 'Instrument' },
                    { k: 'serialNumber', l: 'Serial Number' },
                    { k: 'calibrationDate', l: 'Calibration Date' },
                    { k: 'fieldTeam', l: 'Field Team' },
                    { k: 'weather', l: 'Weather' },
                    { k: 'siteAccess', l: 'Site Access' },
                  ].map(({ k, l }) => (
                    <div key={k}>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">{l}</label>
                      <input value={mobilisation[k as keyof typeof mobilisation]} onChange={e => setMobilisation({ ...mobilisation, [k]: e.target.value })}
                        className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer pt-2">
                <input type="checkbox" checked={includePhotos} onChange={e => setIncludePhotos(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)]" />
                <div>
                  <div className="text-sm text-[var(--text-primary)] font-medium">Include Field Photographs</div>
                  <div className="text-xs text-[var(--text-muted)]">Up to 8 photos with captions and orientation</div>
                </div>
              </label>

              {includePhotos && (
                <div className="pl-8">
                  <PhotoUploader
                    projectId={selectedProjectId}
                    photos={photos}
                    onChange={setPhotos}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t border-[var(--border-color)]">
              <button onClick={() => setStep(1)}
                className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg text-sm transition-colors">
                ← Back
              </button>
              <button onClick={() => setStep(3)}
                className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg text-sm transition-colors">
                Review →
              </button>
            </div>
          </div>
        )}

        {step === 3 && selectedProject && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review & Generate</h2>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Report Title', reportTitle],
                ['Project', selectedProject.name],
                ['Survey Date', surveyDate],
                ['Scale', `1:${scale.toLocaleString()}`],
                ['Parcel Ref.', parcelRef || '—'],
                ['Datum', 'ARC1960 / UTM Zone 37S (EPSG:21037)'],
                ['Mobilisation', includeMobilisation ? 'Included' : 'Not included'],
                ['Photos', includePhotos ? `${photos.length} photo(s)` : 'Not included'],
              ].map(([l, v]) => (
                <div key={l} className="flex gap-2">
                  <span className="text-[var(--text-muted)] min-w-[90px]">{l}</span>
                  <span className="text-[var(--text-primary)] font-medium">{v}</span>
                </div>
              ))}
            </div>

            {!subscription.canGenerate && (
              <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4">
                <p className="text-sm text-amber-300 mb-3">
                  <strong>Professional tier required</strong> — Survey Report generation is a paid feature.
                </p>
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg text-sm transition-colors"
                >
                  Upgrade to Professional — KES 4,999/month
                </button>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-[var(--border-color)]">
              <button onClick={() => setStep(2)}
                className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg text-sm transition-colors">
                ← Back
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className={`px-6 py-2.5 font-semibold rounded-lg text-sm transition-colors ${
                  !subscription.canGenerate
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : generating
                    ? 'bg-[var(--accent)]/50 text-black cursor-not-allowed'
                    : 'bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black'
                }`}
                title={!subscription.canGenerate ? 'Upgrade to Professional to generate reports' : ''}
              >
                {generating ? 'Generating...' : subscription.canGenerate ? 'Generate PDF Report' : 'Generate PDF Report'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="bg-[var(--bg-card)] border border-green-700/40 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-900/30 border border-green-700/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-green-400 mb-2">Report Downloaded!</h2>
            <p className="text-[var(--text-secondary)] mb-6">
              Your survey report has been generated and downloaded as a PDF. Review it and submit to KeNHA.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setStep(1)}
                className="px-6 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg text-sm transition-colors">
                Generate Another
              </button>
              <button onClick={() => window.location.href = '/dashboard'}
                className="px-6 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg text-sm transition-colors">
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        currentTier={subscription.tier}
      />
    </div>
  )
}
