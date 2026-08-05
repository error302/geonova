'use client';

import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/api-client/client'
import { getOrCreateProjectSubmission, updateProjectSubmission } from '@/lib/api-client/projectSubmissions'
import {
  detailsRecordToSurveyorProfile,
  getOwnSurveyorDocumentProfile,
  saveOwnSurveyorDocumentProfile,
  surveyorProfileToDetailsRecord,
} from '@/lib/api-client/surveyorProfiles'
import { ProfessionalDisclaimer } from '@/components/shared/ProfessionalDisclaimer'
import dynamic from 'next/dynamic'
import {
  getDocsForType, DocumentDef, SurveyDocType,
  generateCoverLetter, generateComputationSheet, generateAreaCertificate,
  generateFieldNotes, generateBeaconDescriptions, generateCompletionCertificate,
  generateMutationForm, generateLevelingSummary, generateControlSubmission,
  ProjectData, PointData, TraverseData, AreaData,
} from '@/lib/reports/documentPackage'
import type { SurveyPoint } from '@/types/surveyPoint'
import type { SurveyPlanData, ControlPoint } from '@/lib/reports/surveyPlan/types'
import {
  formatBearingDegMinSec,
  shoelaceArea,
  shoelacePerimeter,
  bearingFromDelta,
  distance,
} from '@/lib/reports/surveyPlan/geometry'
import { computeTraverseAccuracy, getAccuracyBadgeLabel, getAccuracyBadgeClass } from '@/lib/reports/traverseAccuracy'
import type { ProjectSubmission } from '@/types/submission'
import Link from 'next/link'
import MobileDesktopNotice from '@/components/MobileDesktopNotice'
import { useSubscription } from '@/lib/subscription/subscriptionContext'

/* ── Lazy-loaded heavy components (canvas/DXF/PDF renderers) ────────── */
const SurveyPlanViewer = dynamic(() => import('@/components/SurveyPlanViewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-[var(--text-muted)]">Loading Survey Plan…</div>,
})
const SurveyPlanExport = dynamic(() => import('@/components/SurveyPlanExport'), {
  ssr: false,
})
const ShapefileExport = dynamic(() => import('@/components/ShapefileExport'), {
  ssr: false,
})

// ── helpers ──────────────────────────────────────────────────────────────────

// Point names are user-supplied — keep label htmlFor ids safe even if a name
// contains spaces/symbols (ids with whitespace break getElementById/label matching).
const slugify = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '-')

function openPrint(html: string, filename: string) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.document.title = filename
  setTimeout(() => { win.focus(); win.print() }, 400)
}

// ── Surveyor details form (backed by surveyor profile in database) ───────

function SurveyorDetailsPanel({
  details, onChange, saveState,
}: {
  details: Record<string,string>
  onChange: (d: Record<string,string>) => void
  saveState: 'idle' | 'saving' | 'saved' | 'error'
}) {
  const [open, setOpen] = useState(Object.keys(details).length === 0)
  const [local, setLocal] = useState(details)
  const f = (k: string, v: string) => { const n = {...local,[k]:v}; setLocal(n); onChange(n) }

  useEffect(() => {
    setLocal(details)
  }, [details])

  const saveLabel = saveState === 'saving'
    ? 'Saving profile...'
    : saveState === 'saved'
      ? 'Saved to your profile'
      : saveState === 'error'
        ? 'Unable to save profile'
        : 'Profile-backed document identity'

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl mb-6 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          Your surveyor details — printed on every document
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] ${saveState === 'error' ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
            {saveLabel}
          </span>
          <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 grid grid-cols-2 gap-4 border-t border-[var(--border-color)] pt-4">
          {[
            { k:'name',    label:'Full name', ph:'John Kamau' },
            { k:'firm',    label:'Firm name', ph:'John Kamau Surveying Co.' },
            { k:'licence', label:'Licence / reg. number',  ph:'LSK/2456' },
            { k:'phone',   label:'Phone',                  ph:'+254712345678' },
            { k:'email',   label:'Email',                  ph:'jkamau@survey.co.ke' },
            { k:'address', label:'Office address',         ph:'Nairobi, Kenya', span: true },
          ].map(({ k, label, ph, span }) => (
            <div key={k} className={span ? 'col-span-2' : ''}>
              <label htmlFor={`sd-${k}`} className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
              <input id={`sd-${k}`} value={local[k] || ''} onChange={e => f(k, e.target.value)}
                placeholder={ph} className="input w-full text-sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Extra fields per document type ───────────────────────────────────────────

function ExtraFieldsForm({
  docId, extraFields, onChange, points,
}: { docId: SurveyDocType; extraFields: Record<string,string>; onChange: (d: Record<string,string>) => void; points: PointData[] }) {
  const f = (k: string, v: string) => onChange({ ...extraFields, [k]: v })

  if (docId === 'cover_letter') return (
    <div className="space-y-3">
      <div><label htmlFor="clientAddress" className="text-xs text-[var(--text-muted)] block mb-1">Client address</label>
        <textarea id="clientAddress" value={extraFields.clientAddress||''} onChange={e=>f('clientAddress',e.target.value)} rows={2} className="input w-full resize-none text-sm" placeholder="P.O. Box 12345, Nairobi" /></div>
      <div><label htmlFor="enclosures" className="text-xs text-[var(--text-muted)] block mb-1">Documents enclosed (one per line)</label>
        <textarea id="enclosures" value={extraFields.enclosures||'Survey plan\nField notes\nComputation sheet\nArea certificate'} onChange={e=>f('enclosures',e.target.value)} rows={4} className="input w-full resize-none text-sm" /></div>
      <div><label htmlFor="closureNote" className="text-xs text-[var(--text-muted)] block mb-1">Closure/precision note (optional)</label>
        <input id="closureNote" value={extraFields.closureNote||''} onChange={e=>f('closureNote',e.target.value)} className="input w-full text-sm" placeholder="The traverse closed to a precision of 1:12,500." /></div>
    </div>
  )

  if (docId === 'field_notes') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          {k:'fieldDate',  label:'Field date',    ph:'15 March 2025'},
          {k:'weather',    label:'Weather',       ph:'Clear, warm'},
          {k:'instrument', label:'Instrument',    ph:'Leica TS16'},
          {k:'serial',     label:'Serial number', ph:'1847293'},
          {k:'datum',      label:'Datum',         ph:'Arc 1960'},
          {k:'team',       label:'Team members',  ph:'J. Kamau, M. Otieno'},
        ].map(({k,label,ph}) => (
          <div key={k}>
            <label htmlFor={`fn-${k}`} className="text-xs text-[var(--text-muted)] block mb-1">{label}</label>
            <input id={`fn-${k}`} value={extraFields[k]||''} onChange={e=>f(k,e.target.value)} placeholder={ph} className="input w-full text-sm" />
          </div>
        ))}
      </div>
      <div><label htmlFor="fn-observations" className="text-xs text-[var(--text-muted)] block mb-1">General observations / remarks</label>
        <textarea id="fn-observations" value={extraFields.observations||''} onChange={e=>f('observations',e.target.value)} rows={3} className="input w-full resize-none text-sm" placeholder="Site conditions, obstructions encountered, any deviations from standard procedure..." /></div>
    </div>
  )

   if (docId === 'beacon_descriptions') return (
     <div className="space-y-3">
       <p className="text-xs text-[var(--text-muted)]">Describe each control/boundary beacon. These descriptions appear in the official document.</p>
        {points.filter((p: SurveyPoint) => p.is_control).map((pt: SurveyPoint) => (
         <div key={pt.name} className="border border-[var(--border-color)] rounded-lg p-3">
           <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Beacon {pt.name}</p>
           <div className="space-y-2">
             <div>
               <label htmlFor={`beacon-type-${slugify(pt.name)}`} className="text-xs text-[var(--text-muted)] block mb-0.5">Beacon type and condition</label>
               <input id={`beacon-type-${slugify(pt.name)}`} value={extraFields[`beacon_type_${pt.name}`]||''} onChange={e=>f(`beacon_type_${pt.name}`,e.target.value)} className="input w-full text-sm" placeholder="Concrete beacon with iron pin — Good condition" />
             </div>
             <div>
               <label htmlFor={`beacon-desc-${slugify(pt.name)}`} className="text-xs text-[var(--text-muted)] block mb-0.5">Physical description and location</label>
               <textarea id={`beacon-desc-${slugify(pt.name)}`} value={extraFields[`beacon_desc_${pt.name}`]||''} onChange={e=>f(`beacon_desc_${pt.name}`,e.target.value)} rows={2} className="input w-full resize-none text-sm" placeholder="Located at the NE corner of the plot, 2m from the road fence..." />
             </div>
           </div>
         </div>
       ))}
        {points.filter((p: SurveyPoint) => p.is_control).length === 0 && (
         <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded px-3 py-2">No control points in this project. Mark points as control in the workspace to generate beacon descriptions.</p>
       )}
     </div>
   )

  if (docId === 'area_certificate') return (
    <div className="space-y-3">
      <div>
        <label htmlFor="parcelRef" className="text-xs text-[var(--text-muted)] block mb-1">Parcel reference (LR No., plot number, etc.)</label>
        <input id="parcelRef" value={extraFields.parcelRef||''} onChange={e=>f('parcelRef',e.target.value)} className="input w-full text-sm" placeholder="LR No. 123/456 or Plot 789" />
      </div>
    </div>
  )

  if (docId === 'completion_certificate') return (
    <div className="space-y-3">
      <div>
        <label htmlFor="fieldDate" className="text-xs text-[var(--text-muted)] block mb-1">Field / completion date</label>
        <input id="fieldDate" value={extraFields.fieldDate||''} onChange={e=>f('fieldDate',e.target.value)} className="input w-full text-sm" placeholder="15 March 2025" />
      </div>
      <div>
        <label htmlFor="completionItems" className="text-xs text-[var(--text-muted)] block mb-1">Completion items (one per line)</label>
        <textarea id="completionItems" value={extraFields.completionItems||'All survey points established and recorded\nField observations independently checked\nComputations verified and within acceptable limits\nSurvey documents prepared and certified'} onChange={e=>f('completionItems',e.target.value)} rows={4} className="input w-full resize-none text-sm" />
      </div>
      <div>
        <label htmlFor="notes" className="text-xs text-[var(--text-muted)] block mb-1">Additional notes</label>
        <textarea id="notes" value={extraFields.notes||''} onChange={e=>f('notes',e.target.value)} rows={2} className="input w-full resize-none text-sm" placeholder="Any limitations, recommendations, or special notes..." />
      </div>
    </div>
  )

  if (docId === 'mutation_form') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          {k:'originalLR',   label:'Original LR No. / Plot No.',      ph:'LR 123/456'},
          {k:'regSection',   label:'Registration Section',             ph:'Nairobi Block 123'},
          {k:'mutationType', label:'Nature of mutation',               ph:'Subdivision'},
          {k:'county',       label:'County',                           ph:'Nairobi'},          {k:'clientId',     label:'Landowner ID / Passport No.',      ph:'12345678' },
        ].map(({k,label,ph}) => (
          <div key={k}>
            <label htmlFor={`mf-${k}`} className="text-xs text-[var(--text-muted)] block mb-1">{label}</label>
            <input id={`mf-${k}`} value={extraFields[k]||''} onChange={e=>onChange({...extraFields,[k]:e.target.value})} placeholder={ph} className="input w-full text-sm" />
          </div>
        ))}
      </div>
       {points.filter((p: PointData) => p.is_control).map((pt: PointData) => (
        <div key={pt.name}>
          <label htmlFor={`mutation-beacon-${slugify(pt.name)}`} className="text-xs text-[var(--text-muted)] block mb-1">Beacon {pt.name} — description</label>
          <input id={`mutation-beacon-${slugify(pt.name)}`} value={extraFields[`beacon_desc_${pt.name}`]||''} onChange={e=>onChange({...extraFields,[`beacon_desc_${pt.name}`]:e.target.value})} className="input w-full text-sm" placeholder="Concrete beacon at NE corner..." />
        </div>
      ))}
    </div>
  )

  if (docId === 'leveling_summary') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          {k:'openingBM',     label:'Opening BM name',             ph:'BM1'},
          {k:'openingRL',     label:'Opening RL (m)',               ph:'100.000'},
          {k:'closingBM',     label:'Closing BM name',             ph:'BM2'},
          {k:'closingRLObs',  label:'Closing RL — observed (m)',   ph:'102.453'},
          {k:'closingRLKnown',label:'Closing RL — known (m)',      ph:'102.451'},
          {k:'misclosure',    label:'Misclosure (m)',               ph:'+0.002'},
          {k:'distanceKm',    label:'Total distance (km)',          ph:'2.4'},
          {k:'allowable',     label:'Allowable misclosure (m)',     ph:'0.019'},
          {k:'sumBS',         label:'ΣBS (m)',                      ph:'4.521'},
          {k:'sumFS',         label:'ΣFS (m)',                      ph:'2.068'},          {k:'rlDiff',        label:'Last RL − First RL (m)',       ph:'2.453' },
        ].map(({k,label,ph}) => (
          <div key={k}>
            <label htmlFor={`ls-${k}`} className="text-xs text-[var(--text-muted)] block mb-1">{label}</label>
            <input id={`ls-${k}`} value={extraFields[k]||''} onChange={e=>onChange({...extraFields,[k]:e.target.value})} placeholder={ph} className="input w-full text-sm" />
          </div>
        ))}
      </div>
    </div>
  )

  if (docId === 'control_submission') return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          {k:'network',     label:'Network / order',         ph:'Third Order'},
          {k:'datum',       label:'Datum',                   ph:'Arc 1960'},
          {k:'method',      label:'Adjustment method',       ph:'Bowditch Rule'},
          {k:'precision',   label:'Precision achieved',      ph:'1 : 12,500'},
          {k:'dateObserved',label:'Date observed',           ph:'15 March 2025'},
          {k:'instrument',  label:'Instrument',              ph:'Leica TS16'},
          {k:'serial',      label:'Serial number',           ph:'1847293'},
          {k:'calibDate',   label:'Calibration date',        ph:'January 2025'},
          {k:'rounds',      label:'No. of rounds',           ph:'3'},          {k:'accuracy',    label:'Default accuracy (±m)',   ph:'0.05' },
        ].map(({k,label,ph}) => (
          <div key={k}>
            <label htmlFor={`cs-${k}`} className="text-xs text-[var(--text-muted)] block mb-1">{label}</label>
            <input id={`cs-${k}`} value={extraFields[k]||''} onChange={e=>onChange({...extraFields,[k]:e.target.value})} placeholder={ph} className="input w-full text-sm" />
          </div>
        ))}
      </div>
    </div>
  )

  return <p className="text-sm text-[var(--text-muted)]">No additional fields required for this document.</p>
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface PageProps { params: { id: string } }

export default function DocumentsPage({ params }: PageProps) {
  const { plan } = useSubscription()
  const [project, setProject] = useState<ProjectData | null>(null)
  const [points, setPoints]   = useState<PointData[]>([])
  const [traverse, setTraverse] = useState<TraverseData | undefined>()
  const [area, setArea]         = useState<AreaData | undefined>()
  const [loading, setLoading]   = useState(true)
  const [surveyorDetails, setSurveyorDetails] = useState<Record<string,string>>({})
  const [activeTab, setActiveTab] = useState<'docs' | 'plan'>('docs')
  const [activeDoc, setActiveDoc] = useState<SurveyDocType | null>(null)
  const [extraFields, setExtraFields] = useState<Record<string,Record<string,string>>>({})
  const [submissionNumber, setSubmissionNumber] = useState<string>('')
  const [isCreatingSubmission, setIsCreatingSubmission] = useState(false)
  const [generated, setGenerated] = useState<Set<SurveyDocType>>(new Set())
  const [adjacentParcels, setAdjacentParcels] = useState<Array<{ id: string; lrNumber: string; planReference: string; boundaryPoints: Array<{ easting: number; northing: number }> }>>([])

  const load = useCallback(async () => {
    const dbClient = createClient()
    const { data: { session } } = await dbClient.auth.getSession()
    if (!session?.user) {
      window.location.replace(`/login?next=/project/${params.id}/documents`)
      return
    }

    const [{ data: proj }, { data: pts }, { data: parcels }] = await Promise.all([
      dbClient.from('projects').select('*').eq('id', params.id).single(),
      dbClient.from('survey_points').select('*').eq('project_id', params.id).order('created_at'),
      dbClient.from('parcels').select('*').eq('project_id', params.id).limit(1).single(),
    ])

    if (proj) setProject(proj)
     if (pts) setPoints(pts.map((p: SurveyPoint) => ({
       name: p.name, easting: p.easting, northing: p.northing,
       elevation: p.elevation ?? undefined, is_control: p.is_control,
     })))
    setLoading(false)
  }, [params.id])

  useEffect(() => { load() }, [load])

  // Fetch submission number if available
  useEffect(() => {
    if (params.id) {
      const dbClient = createClient()
      dbClient.from('project_submissions')
        .select('submission_number')
        .eq('project_id', params.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]?.submission_number) {
            setSubmissionNumber(data[0].submission_number)
          }
        })
    }
  }, [params.id])

  // Fetch adjacent parcels (other parcels in the same block/scheme)
  useEffect(() => {
    if (!project) return
    const dbClient = createClient()
    // Fetch parcels in the same project that are not the subject parcel
    dbClient.from('parcels')
      .select('id, parcel_number, lr_number_proposed, boundary_geojson')
      .eq('project_id', params.id)
      .then(({ data }) => {
        if (data && data.length > 1) {
          const adjLots = data.slice(0, 5).map((p: any) => {
            // Parse boundary coordinates from GeoJSON if available
            let bdyPts: Array<{ easting: number; northing: number }> = []
            if (p.boundary_geojson) {
              try {
                const geojson = typeof p.boundary_geojson === 'string'
                  ? JSON.parse(p.boundary_geojson)
                  : p.boundary_geojson
                if (geojson?.features?.[0]?.geometry?.coordinates) {
                  const coords = geojson.features[0].geometry.coordinates[0] || geojson.features[0].geometry.coordinates
                  bdyPts = coords.map((c: number[]) => ({ easting: c[0], northing: c[1] }))
                } else if (geojson?.geometry?.coordinates) {
                  const coords = geojson.geometry.coordinates[0] || geojson.geometry.coordinates
                  bdyPts = coords.map((c: number[]) => ({ easting: c[0], northing: c[1] }))
                } else if (Array.isArray(geojson?.coordinates)) {
                  const coords = geojson.coordinates[0] || geojson.coordinates
                  bdyPts = coords.map((c: number[]) => ({ easting: c[0], northing: c[1] }))
                }
              } catch { /* ignore parse errors */ }
            }
            return {
              id: p.lr_number_proposed || p.parcel_number || `Parcel ${p.id}`,
              lrNumber: p.lr_number_proposed || '',
              planReference: p.parcel_number || '',
              boundaryPoints: bdyPts,
            }
          }).filter((lot: any) => lot.boundaryPoints.length >= 2)
          setAdjacentParcels(adjLots)
        }
      })
  }, [project, params.id])



  const getExtra = (docId: SurveyDocType) => extraFields[docId] || {}
  const setExtra = (docId: SurveyDocType, d: Record<string,string>) =>
    setExtraFields(prev => ({ ...prev, [docId]: d }))

  const generateDoc = (docId: SurveyDocType) => {
    if (!project) return
    const extra = getExtra(docId)
    let html = ''
    const args = [project, surveyorDetails] as const

    switch (docId) {
      case 'cover_letter':
        html = generateCoverLetter(...args, extra); break
      case 'computation_sheet':
        html = generateComputationSheet(...args, points, traverse, area); break
      case 'area_certificate':
        html = generateAreaCertificate(...args, area, extra); break
      case 'field_notes':
        html = generateFieldNotes(...args, points, extra); break
      case 'beacon_descriptions':
        html = generateBeaconDescriptions(...args, points, extra); break
      case 'completion_certificate':
      case 'as_built_certificate':
        html = generateCompletionCertificate(...args, extra); break
      case 'mutation_form':
        html = generateMutationForm(...args, points, area, extra); break
      case 'leveling_summary':
        html = generateLevelingSummary(...args, points, extra); break
      case 'control_submission':
        html = generateControlSubmission(...args, points, extra); break
      default:
        html = generateComputationSheet(...args, points, traverse, area)
    }

    openPrint(html, `${project.name} — ${docId.replace(/_/g,' ')}.pdf`)
    setGenerated(prev => { const s = new Set(Array.from(prev)); s.add(docId); return s })
  }

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!project) return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="text-center"><p className="text-[var(--text-muted)] mb-4">Project not found</p>
        <Link href="/dashboard" className="btn btn-primary">Dashboard</Link></div>
    </div>
  )

  const docs = getDocsForType(project.survey_type)

  // Build SurveyPlanData from project
  const buildSurveyPlanData = (): SurveyPlanData | null => {
    if (!project) return null
     const controlPts: ControlPoint[] = points
       .filter((p: SurveyPoint) => p.is_control)
       .map((p: SurveyPoint) => ({
        name: p.name,
        easting: p.easting,
        northing: p.northing,
        // Canonical SurveyPoint.elevation is `number | null | undefined`;
        // ControlPoint.elevation is `number | undefined`. Coerce null to undefined.
        elevation: p.elevation ?? undefined,
        monumentType: 'found' as const,
      }))
    const boundaryPts = controlPts.length >= 3
      ? controlPts
      : [
          { name: '1', easting: 5000, northing: 5000 },
          { name: '2', easting: 5100, northing: 5000 },
          { name: '3', easting: 5100, northing: 5050 },
          { name: '4', easting: 5000, northing: 5050 },
        ]
    const area_sqm = shoelaceArea(boundaryPts)
    const perimeter_m = shoelacePerimeter(boundaryPts)
    const bearingSchedule = boundaryPts.map((pt, i) => {
      const next = boundaryPts[(i + 1) % boundaryPts.length]
      const dE = next.easting - pt.easting
      const dN = next.northing - pt.northing
      return {
        from: pt.name,
        to: next.name,
        bearing: formatBearingDegMinSec(bearingFromDelta(dE, dN)),
        distance: distance(pt.easting, pt.northing, next.easting, next.northing),
      }
    })
    const linearError = traverse?.linearError
    const traverseAccuracyResult = linearError != null
      ? computeTraverseAccuracy(linearError, perimeter_m)
      : null
    const proj = project as any
    return {
      project: {
        name: project.name,
        location: project.location || '',
        municipality: surveyorDetails['address']?.split(',')[0] || undefined,
        utm_zone: project.utm_zone || 37,
        hemisphere: (project.hemisphere || 'S') as 'N' | 'S',
        datum: 'ARC1960',
        client_name: project.client_name || undefined,
        surveyor_name: surveyorDetails['name'] || undefined,
        surveyor_licence: surveyorDetails['licence'] || undefined,
        firm_name: surveyorDetails['name'] || undefined,
        firm_address: surveyorDetails['address'] || undefined,
        firm_phone: surveyorDetails['phone'] || undefined,
        firm_email: surveyorDetails['email'] || undefined,
        drawing_no: `MD-${Date.now().toString().slice(-6)}`,
        plan_title: 'Boundary Identification Plan',
        northRotationDeg: 0,
        bearingSchedule,
        revisions: [],
        iskRegNo: surveyorDetails['licence'] || '',
        // Form No. 4 / Kenya submission fields
        lrNumber: proj.lr_number || undefined,
        folioNumber: proj.folio_number || undefined,
        registerNumber: proj.register_number || undefined,
        plotParcelNumber: proj.plot_parcel_number || undefined,
        registrationDistrict: proj.registration_district || undefined,
        locality: proj.locality || undefined,
      },
      parcel: {
        boundaryPoints: boundaryPts,
        area_sqm,
        perimeter_m,
      },
      traverse: traverseAccuracyResult ? {
        linearError: linearError ?? undefined,
      } : undefined,
      controlPoints: controlPts,
      fenceOffsets: [],
      // Adjacent lots — populated from other parcels in the same project
      // Used to draw adjacent LR numbers on boundary lines per Cap. 299 practice
      adjacentLots: adjacentParcels.map(ap => ({
        id: ap.lrNumber || ap.id,
        boundaryPoints: ap.boundaryPoints,
        planReference: ap.planReference,
      })),
    }
  }

  const planData = buildSurveyPlanData()
  const traverseAccuracy = traverse && traverse.linearError != null && planData?.parcel?.perimeter_m
    ? computeTraverseAccuracy(traverse.linearError, planData.parcel.perimeter_m)
    : null

  const handleCreateSubmission = async () => {
    if (!project || isCreatingSubmission) return
    
    setIsCreatingSubmission(true)
    try {
      const response = await fetch('/api/submissions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: params.id })
      })
      
      const result = await response.json()
      
      if (result.success && result.submissionNumber) {
        setSubmissionNumber(result.submissionNumber)
        alert(`Submission created: ${result.submissionNumber}`)
      } else {
        alert(result.error || 'Failed to create submission')
      }
    } catch (error) {
      console.error('Error creating submission:', error)
      alert('Error creating submission. Please try again.')
    } finally {
      setIsCreatingSubmission(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-4xl mx-auto px-4 py-8">

{/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href={`/project/${params.id}`} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)]">← Back to project</Link>
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Documents & Plans</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {project.name} · {project.survey_type || 'Survey'} · {project.location || ''}
            </p>
          </div>

          {/* Submission Actions */}
          <div className="flex flex-col items-end gap-2">
            {submissionNumber ? (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-xs text-green-600 font-mono">Submission: {submissionNumber}</p>
              </div>
            ) : (
              <button
                onClick={handleCreateSubmission}
                disabled={isCreatingSubmission || !project}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black font-semibold rounded-lg text-sm hover:bg-[var(--accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreatingSubmission ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Create Submission
                  </>
                )}
              </button>
            )}

            {submissionNumber && (
              <button
                onClick={() => alert('Download full submission package coming soon!')}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Package
              </button>
            )}
          </div>
        </div>

        <MobileDesktopNotice>
          Document generation and review involve long forms, tables, previews, and export checks. Use desktop for the best experience; mobile is suitable for viewing and minor edits.
        </MobileDesktopNotice>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border-color)]">
          <button onClick={() => setActiveTab('docs')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'docs'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}>
            Document Package
          </button>
          <button onClick={() => setActiveTab('plan')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === 'plan'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}>
            Survey Plan
          </button>
        </div>

        {/* Survey Plan tab */}
        {activeTab === 'plan' && (
          <div className="space-y-4">
            <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-4 text-sm">
              <p className="text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Boundary Identification Plan</strong> — A professional A3 survey plan rendered from your project coordinates, ready to print and sign.
              </p>
              <p className="text-[var(--text-muted)] mt-1 text-xs">
                Requires at least 3 control points marked on the parcel boundary.
              </p>
            </div>
            {traverseAccuracy && traverse && (
              <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
                <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider">Traverse Accuracy</span>
                <span className={`px-2.5 py-1 rounded text-xs font-semibold ${getAccuracyBadgeClass(traverseAccuracy)}`}>
                  {getAccuracyBadgeLabel(traverseAccuracy)}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  Linear Error: {traverse.linearError?.toFixed(4)}m
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  Precision: 1:{traverseAccuracy.K_km > 0 ? Math.round(traverseAccuracy.K_km * traverseAccuracy.C_mm / traverseAccuracy.allowed) : '—'}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-mono ml-auto">
                  {traverseAccuracy.formula}
                </span>
              </div>
            )}
<div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden" style={{ height: '70vh' }}>
          {planData ? (
            <SurveyPlanViewer 
              data={planData} 
              className="h-full" 
              submissionNumber={submissionNumber}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">Loading...</div>
          )}
        </div>
        <div className="flex justify-end gap-3">
          {planData && (
            <>
              <ShapefileExport 
                data={{
                  beacons: planData.controlPoints.map(cp => ({
                    station: cp.name,
                    easting: cp.easting,
                    northing: cp.northing,
                    elevation: cp.elevation,
                    beacon_class: cp.monumentType,
                    description: cp.beaconDescription
                  })),
                  boundaries: (planData.project.bearingSchedule || []).map(b => ({
                    from: b.from,
                    to: b.to,
                    from_easting: 0, // Will be populated from actual data
                    from_northing: 0,
                    to_easting: 0,
                    to_northing: 0,
                    bearing: b.bearing,
                    distance: b.distance
                  })),
                  parcels: [{
                    id: planData.project.parcel_id || 'P1',
                    lr_number: planData.project.lrNumber,
                    area_sqm: planData.parcel.area_sqm,
                    area_ha: planData.parcel.area_sqm / 10000,
                    coordinates: planData.parcel.boundaryPoints.map(p => [p.easting, p.northing] as [number, number])
                  }],
                  projection: {
                    zone: planData.project.utm_zone || 37,
                    hemisphere: planData.project.hemisphere || 'S',
                    datum: planData.project.datum || 'ARC1960',
                    ellipsoid: 'WGS84'
                  }
                }}
                projectName={project?.name || 'survey'}
              />
              <SurveyPlanExport data={planData} projectId={params.id} plan={plan} />
            </>
          )}
        </div>
          </div>
        )}

        {/* Document package tab */}
        {activeTab === 'docs' && (
        <>

        {/* Info banner */}
        <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-4 mb-6 text-sm">
          <p className="text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">{docs.filter((d: any) =>d.required).length} required documents</strong> for a {(project.survey_type||'boundary').toLowerCase()} survey — pre-filled with your project data.
            Fill in the extra fields for each document, then click <strong>Generate &amp; Print</strong>. Each opens in a new tab ready to print as PDF.
          </p>
        </div>

        {/* Professional disclaimer */}
        <ProfessionalDisclaimer />

        {/* Surveyor details */}
        <SurveyorDetailsPanel details={surveyorDetails} onChange={setSurveyorDetails} saveState="saved" />

        {/* Document list */}
        <div className="space-y-3">
          {docs.map((doc: any) => {
            const isActive = activeDoc === doc.id
            const isDone = generated.has(doc.id)

            return (
              <div key={doc.id}
                className={`bg-[var(--bg-card)] border rounded-xl overflow-hidden transition-colors ${
                  isDone ? 'border-green-700/40' : isActive ? 'border-[var(--accent)]/40' : 'border-[var(--border-color)]'
                }`}>

                {/* Document header */}
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors"
                  onClick={() => setActiveDoc(isActive ? null : doc.id)}>
                  {/* Status icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isDone ? 'bg-green-900/40 border border-green-700/40' : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)]'
                  }`}>
                    {isDone
                      ? <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                      : <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{doc.title}</p>
                      {doc.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">Required</span>}
                      {isDone && <span className="text-[10px] text-green-400"> Generated</span>}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{doc.description}</p>
                  </div>

                  {/* Generate button — inline for quick access */}
                  <button onClick={e => { e.stopPropagation(); generateDoc(doc.id) }}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isDone
                        ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-700/30'
                        : 'bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)]'
                    }`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-4.5c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                    </svg>
                    {isDone ? 'Re-print' : 'Generate & Print'}
                  </button>

                  <svg className={`w-4 h-4 text-[var(--text-muted)] transition-transform flex-shrink-0 ${isActive ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
                </div>

                {/* Expanded extra fields */}
                {isActive && (
                  <div className="px-5 pb-5 border-t border-[var(--border-color)] pt-4">
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                      Fill in any additional details before generating. Project data is already included automatically.
                    </p>
                    <ExtraFieldsForm
                      docId={doc.id}
                      extraFields={getExtra(doc.id)}
                      onChange={d => setExtra(doc.id, d)}
                      points={points}
                    />
                    <button onClick={() => generateDoc(doc.id)}
                      className="btn btn-primary w-full mt-4">
                      Generate &amp; Print — {doc.title}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Generate all button */}
        {docs.filter((d: any) => !generated.has(d.id)).length > 0 && (
          <div className="mt-6 pt-6 border-t border-[var(--border-color)]">
            <button onClick={() => docs.forEach((d, i) => setTimeout(() => generateDoc(d.id), i * 300))}
              className="btn btn-secondary w-full">
              Generate all {docs.length} documents at once
            </button>
            <p className="text-xs text-center text-[var(--text-muted)] mt-2">Opens each document in a separate tab for printing</p>
          </div>
        )}

        </>
        )}

      </div>
    </div>
  )
}
