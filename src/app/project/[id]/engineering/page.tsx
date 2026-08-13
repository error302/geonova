'use client';

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/api-client/client'
import { z } from 'zod'
import { apiGet, apiPost } from '@/lib/api/client'
import type {
  EngineeringData,
  EngineeringMode,
  EngineeringStandard,
  RoadDesignData,
  DrainageData,
  StationData,
  IntersectionPoint,
  VerticalIP,
  CrossSectionTemplate,
} from '@/types/engineering'
import type { SurveyorProfileSubmission } from '@/lib/api-client/community'
import MobileDesktopNotice from '@/components/MobileDesktopNotice'
import type { EngineeringProject, EngineeringStepId } from './shared'
import { getEngineeringSteps } from './getEngineeringSteps'
import { renderStepContent } from './steps/renderStepContent'
import { QuickComputeTab } from './QuickComputeTab'

// ponytail: response schemas — Phase 4 wave 2 will move these to src/lib/api/schemas/

// GET /api/engineering/alignment returns { data: <alignment row or null> }.
// Use z.union([schema, z.null()]) instead of .nullable() so we keep .passthrough() on the inner object.
const alignmentRowSchema = z.object({
  id: z.union([z.string(), z.number()]),
  road_name: z.string().nullable().optional(),
  start_chainage: z.union([z.number(), z.string(), z.null()]).optional(),
  datum: z.string().nullable().optional(),
  coordinate_system: z.string().nullable().optional(),
  design_speed: z.union([z.number(), z.string(), z.null()]).optional(),
  road_class: z.string().nullable().optional(),
  standard: z.string().nullable().optional(),
  cross_section_template: z.any().optional(),
  ips: z.array(z.any()).optional(),
  vips: z.array(z.any()).optional(),
  stations: z.array(z.any()).optional(),
}).passthrough()

const alignmentResponseSchema = z.object({
  data: z.union([alignmentRowSchema, z.null()]),
}).passthrough()

// POST /api/engineering/alignment returns { data: { id, ... } }
const alignmentMutationSchema = z.object({
  data: alignmentRowSchema,
}).passthrough()

// The three sub-resource POSTs return various shapes — accept any object payload.
const subResourceMutationSchema = z.record(z.any())

interface CrossSectionTemplateRow {
  carriageway_width?: number | string | null
  carriagewayWidth?: number | string | null
  shoulder_width?: number | string | null
  shoulderWidth?: number | string | null
  cut_slope?: string | null
  cutSlope?: string | null
  fill_slope?: string | null
  fillSlope?: string | null
  camber?: number | string | null
  subgrade_depth?: number | string | null
  subgradeDepth?: number | string | null
}

interface EngineeringIpRow {
  id: string | number
  name: string | null
  easting: number | string | null
  northing: number | string | null
  radius: number | string | null
  deflection_angle?: number | string | null
  tangent_length?: number | string | null
  arc_length?: number | string | null
  chainage_tc?: number | string | null
  chainage_mc?: number | string | null
  chainage_ct?: number | string | null
  sort_order?: number | string | null
}

interface EngineeringVipRow {
  id: string | number
  chainage: number | string | null
  reduced_level: number | string | null
  k_value?: number | string | null
}

interface EngineeringStationRow {
  chainage: number | string | null
  ground_level: number | string | null
}

interface EngineeringAlignmentRow {
  id: string | number
  road_name?: string | null
  start_chainage?: number | string | null
  datum?: string | null
  coordinate_system?: string | null
  design_speed?: number | string | null
  road_class?: string | null
  standard?: string | null
  cross_section_template?: CrossSectionTemplateRow | null
  ips?: EngineeringIpRow[]
  vips?: EngineeringVipRow[]
  stations?: EngineeringStationRow[]
}

interface ProjectDbRow {
  id: string
  user_id?: string | null
  engineering_data?: unknown
  [key: string]: unknown
}

interface SurveyorProfileDbRow {
  isk_number?: string | null
  verified_isk?: boolean | null
  full_name?: string | null
  name?: string | null
  firm_name?: string | null
  company?: string | null
}

export default function EngineeringWorkspacePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dbClient = createClient()

  const [project, setProject] = useState<EngineeringProject | null>(null)
  const [surveyorProfile, setSurveyorProfile] = useState<SurveyorProfileSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingEngineering, setLoadingEngineering] = useState(false)
  const [activeStep, setActiveStep] = useState<EngineeringStepId>('setup')
  const [saving, setSaving] = useState(false)
  const [, setAlignmentId] = useState<string | null>(null)

  // Sub-tab for quick compute panels
  const activeTab = searchParams.get('tab') || 'workflow'

  // --- Load engineering data from the relational DB backend ---
  const loadEngineeringData = useCallback(async (projectId: string) => {
    setLoadingEngineering(true)
    try {
      const result = await apiGet(
        `/api/engineering/alignment?project_id=${projectId}`,
        alignmentResponseSchema,
        { ttlMs: 0 },
      )
      const dbData = result.data as EngineeringAlignmentRow | null

      if (!dbData) {
        // No alignment row yet — nothing to hydrate
        setLoadingEngineering(false)
        return
      }

      // Store the alignment ID for subsequent saves (IPs, VIPs, stations)
      setAlignmentId(String(dbData.id))

      // Map DB column names → TypeScript shape
      const crossSectionTemplate: CrossSectionTemplate | undefined = dbData.cross_section_template
        ? {
            carriagewayWidth: Number(dbData.cross_section_template.carriageway_width ?? dbData.cross_section_template.carriagewayWidth ?? 6.0),
            shoulderWidth: Number(dbData.cross_section_template.shoulder_width ?? dbData.cross_section_template.shoulderWidth ?? 1.0),
            cutSlope: String(dbData.cross_section_template.cut_slope ?? dbData.cross_section_template.cutSlope ?? '1:1'),
            fillSlope: String(dbData.cross_section_template.fill_slope ?? dbData.cross_section_template.fillSlope ?? '1:1.5'),
            camber: Number(dbData.cross_section_template.camber ?? 3),
            subgradeDepth: Number(dbData.cross_section_template.subgrade_depth ?? dbData.cross_section_template.subgradeDepth ?? 0.5),
          }
        : undefined

      const ips: IntersectionPoint[] = (dbData.ips || []).map((row) => ({
        id: String(row.id),
        name: String(row.name),
        easting: Number(row.easting),
        northing: Number(row.northing),
        radius: Number(row.radius),
        deflectionAngle: row.deflection_angle != null ? Number(row.deflection_angle) : undefined,
        tangentLength: row.tangent_length != null ? Number(row.tangent_length) : undefined,
        arcLength: row.arc_length != null ? Number(row.arc_length) : undefined,
        chainageTC: row.chainage_tc != null ? Number(row.chainage_tc) : undefined,
        chainageMC: row.chainage_mc != null ? Number(row.chainage_mc) : undefined,
        chainageCT: row.chainage_ct != null ? Number(row.chainage_ct) : undefined,
        sortOrder: row.sort_order != null ? Number(row.sort_order) : undefined,
      }))

      const vips: VerticalIP[] = (dbData.vips || []).map((row) => ({
        id: String(row.id),
        chainage: Number(row.chainage),
        reducedLevel: Number(row.reduced_level),
        kValue: row.k_value != null ? Number(row.k_value) : undefined,
      }))

      const stations: StationData[] = (dbData.stations || []).map((row) => ({
        chainage: Number(row.chainage),
        groundLevel: Number(row.ground_level),
      }))

      // Build a RoadDesignData object from the DB row
      const roadFromDb: RoadDesignData = {
        roadName: String(dbData.road_name || ''),
        startChainage: Number(dbData.start_chainage ?? 0),
        datum: String(dbData.datum || 'Arc 1960'),
        coordinateSystem: String(dbData.coordinate_system || 'UTM Zone 37S'),
        designSpeed: Number(dbData.design_speed ?? 60),
        roadClass: String(dbData.road_class || 'C') as RoadDesignData['roadClass'],
        standard: (dbData.standard || 'KRDM2017') as EngineeringStandard,
        ips,
        vips,
        crossSectionTemplate: crossSectionTemplate || {
          carriagewayWidth: 6.0,
          shoulderWidth: 1.0,
          cutSlope: '1:1',
          fillSlope: '1:1.5',
          camber: 3,
          subgradeDepth: 0.5,
        },
        stations,
      }

      // Merge into the existing engineering_data, preserving mode/drainage
      setProject(prev => {
        if (!prev) return prev
        const current: EngineeringData = prev.engineering_data || { mode: 'road', standard: 'KRDM2017' }
        return {
          ...prev,
          engineering_data: {
            ...current,
            road: roadFromDb,
          },
        }
      })
    } catch {
      /* ignore load error */
    } finally {
      setLoadingEngineering(false)
    }
  }, [])

  const fetchProject = useCallback(async () => {
    setLoading(true)
    const projectResult = (await dbClient
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single()) as { data: ProjectDbRow | null; error: { message: string } | null }
    const { data, error } = projectResult

    if (error || !data) {
      setLoading(false)
      return
    }

    const engData = (data?.engineering_data ?? null) as EngineeringData | null
    setProject({ ...data, engineering_data: engData } as EngineeringProject)

    const profileResult = (await dbClient
      .from('surveyor_profiles')
      .select('isk_number, verified_isk, full_name, name, firm_name, company')
      .eq('user_id', data.user_id)
      .single()) as { data: SurveyorProfileDbRow | null }
    const profile = profileResult.data

    if (profile) {
      setSurveyorProfile({
        registrationNumber: profile.isk_number ?? '',
        iskNumber: profile.isk_number ?? '',
        verifiedIsk: profile.verified_isk ?? false,
        fullName: profile.full_name ?? profile.name ?? '',
        firmName: profile.firm_name ?? profile.company ?? '',
        isKMemberActive: profile.verified_isk ?? true
      })
    }

    setLoading(false)
  }, [params.id, dbClient])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  // Load engineering data from the relational backend after project is fetched
  const projectId = project?.id
  useEffect(() => {
    if (projectId && !loading) {
      loadEngineeringData(projectId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, loading, loadEngineeringData])

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleModeChange = async (newMode: EngineeringMode) => {
    if (!project) return
    setSaving(true)

    try {
      const current = project.engineering_data || { mode: 'road' as EngineeringMode, standard: 'KRDM2017' as EngineeringStandard }
      const updated: EngineeringData = {
        ...current,
        mode: newMode,
        standard: current.standard || 'KRDM2017'
      }

      await dbClient
        .from('projects')
        .update({ engineering_data: updated })
        .eq('id', project.id)

      setProject({ ...project, engineering_data: updated })
      setActiveStep('setup')
      showToast('Mode switched successfully')
    } catch {
      showToast('Failed to save. Check your connection and try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // --- Save the entire current engineering state to the relational backend ---
  const saveToBackend = useCallback(async (engData: EngineeringData): Promise<boolean> => {
    if (!project) return false
    const road = engData.road
    if (!road) return false

    try {
      // Step 1: Upsert alignment header → get alignment_id
      const templateForDb = road.crossSectionTemplate
        ? {
            carriagewayWidth: road.crossSectionTemplate.carriagewayWidth,
            shoulderWidth: road.crossSectionTemplate.shoulderWidth,
            cutSlope: road.crossSectionTemplate.cutSlope,
            fillSlope: road.crossSectionTemplate.fillSlope,
            camber: road.crossSectionTemplate.camber,
            subgradeDepth: road.crossSectionTemplate.subgradeDepth,
          }
        : {}

      const alignResult = await apiPost(
        '/api/engineering/alignment',
        alignmentMutationSchema,
        {
          project_id: project.id,
          road_name: road.roadName || 'Unnamed Road',
          start_chainage: road.startChainage ?? 0,
          datum: road.datum || 'Arc 1960',
          coordinate_system: road.coordinateSystem || 'UTM Zone 37S',
          design_speed: road.designSpeed ?? 60,
          road_class: road.roadClass || 'C',
          standard: road.standard || 'KRDM2017',
          cross_section_template: templateForDb,
        },
      )
      const aId = alignResult.data?.id
      if (!aId) throw new Error('No alignment ID returned')
      setAlignmentId(String(aId))

      // Step 2: Save IPs (if any)
      if (road.ips && road.ips.length > 0) {
        await apiPost(
          '/api/engineering/ips',
          subResourceMutationSchema,
          {
            alignment_id: aId,
            ips: road.ips.map(ip => ({
              name: ip.name,
              easting: ip.easting,
              northing: ip.northing,
              radius: ip.radius,
            })),
          },
        )
      }

      // Step 3: Save VIPs (if any)
      if (road.vips && road.vips.length > 0) {
        await apiPost(
          '/api/engineering/vips',
          subResourceMutationSchema,
          {
            alignment_id: aId,
            vips: road.vips.map(v => ({
              chainage: v.chainage,
              reduced_level: v.reducedLevel,
              k_value: v.kValue ?? null,
            })),
          },
        )
      }

      // Step 4: Save stations (if any)
      if (road.stations && road.stations.length > 0) {
        await apiPost(
          '/api/engineering/stations',
          subResourceMutationSchema,
          {
            alignment_id: aId,
            stations: road.stations.map(s => ({
              chainage: s.chainage,
              ground_level: s.groundLevel,
            })),
          },
        )
      }

      return true
    } catch {
      return false
    }
  }, [project])

  const handleSave = async (data: Partial<EngineeringData>) => {
    if (!project) return
    setSaving(true)

    try {
      const current = project.engineering_data || { mode: 'road' as EngineeringMode, standard: 'KRDM2017' as EngineeringStandard }

      let updated: EngineeringData
      if (data.mode) {
        updated = {
          ...current,
          mode: data.mode,
          standard: data.standard || current.standard || 'KRDM2017'
        }
      } else {
        updated = {
          ...current,
          mode: current.mode || 'road',
          standard: current.standard || 'KRDM2017',
          road: { ...current.road, ...data.road } as RoadDesignData,
          drainage: { ...current.drainage, ...data.drainage } as DrainageData
        }
      }

      // Save to database (engineering_data JSONB column)
      await dbClient
        .from('projects')
        .update({ engineering_data: updated })
        .eq('id', project.id)

      setProject({ ...project, engineering_data: updated })

      // Also persist to relational backend for road mode
      if (updated.road) {
        const backendOk = await saveToBackend(updated)
        if (backendOk) {
          showToast('Saved successfully')
        } else {
          showToast('Saved locally, but backend sync failed.', 'error')
        }
      } else {
        showToast('Saved successfully')
      }
    } catch {
      showToast('Failed to save. Check your connection and try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Save All handler — persists the full current state to the backend
  const handleSaveAll = async () => {
    if (!project || !project.engineering_data) return
    setSaving(true)
    try {
      // First ensure local state is up to date
      await dbClient
        .from('projects')
        .update({ engineering_data: project.engineering_data })
        .eq('id', project.id)

      if (project.engineering_data.road) {
        const backendOk = await saveToBackend(project.engineering_data)
        if (backendOk) {
          showToast('All engineering data saved to backend')
        } else {
          showToast('Backend sync failed. Local data is preserved.', 'error')
        }
      } else {
        showToast('All data saved')
      }
    } catch {
      showToast('Failed to save. Check your connection and try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500 animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-red-400">Project not found</div>
        <button onClick={() => router.push('/dashboard')} className="text-amber-500 mt-4">Back to Dashboard</button>
      </div>
    )
  }

  const steps = getEngineeringSteps(project.engineering_data || null)
  const currentStep = steps.find((s) => s.id === activeStep) || steps[0]
  const mode = project.engineering_data?.mode || 'road'

  // Quick Compute Panel Mode
  if (activeTab !== 'workflow') {
    return (
      <QuickComputeTab
        projectId={params.id}
        project={project}
        surveyorProfile={surveyorProfile}
        activeTab={activeTab}
      />
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-zinc-500 hover:text-zinc-300 text-sm">← Projects</button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-white">{project.name}</h1>
            <div className="text-xs text-zinc-500">Engineering Mode • {mode === 'road' ? 'Road Design' : 'Drainage Survey'}</div>
          </div>
          <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded">{mode === 'road' ? 'Road Design' : 'Drainage Survey'}</span>
          <button
            onClick={handleSaveAll}
            disabled={saving || loadingEngineering}
            className="text-xs px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            {saving ? 'Saving...' : 'Save All ↓'}
          </button>
          <button
            onClick={() => router.push(`/project/${params.id}/engineering?tab=curves`)}
            className="text-xs px-3 py-1 bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30"
          >
            Quick Compute →
          </button>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-900/90 text-green-300 border border-green-700' : 'bg-red-900/90 text-red-300 border border-red-700'
        }`}>
          {toast.type === 'success' ? ' ' : '[x] '}{toast.message}
        </div>
      )}

      {/* Saving indicator */}
      {(saving || loadingEngineering) && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-zinc-600 text-zinc-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          {loadingEngineering ? 'Loading engineering data...' : 'Saving...'}
        </div>
      )}

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row">
        <nav className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800">
          <div className="p-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Workflow</div>
            <ol className="space-y-1">
              {steps.map((step, idx) => {
                const isActive = step.id === activeStep
                const isLocked = step.status === 'locked'
                return (
                  <li key={step.id}>
                    <button
                      disabled={isLocked}
                      onClick={() => setActiveStep(step.id)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-3 ${
                        isActive ? 'bg-zinc-800 border border-zinc-700' :
                        isLocked ? 'opacity-40 cursor-not-allowed' :
                        'hover:bg-zinc-900 border border-transparent'
                      }`}
                    >
                      <span className={`shrink-0 w-6 h-6 rounded-full text-xs flex items-center justify-center mt-0.5 ${
                        step.status === 'complete' ? 'bg-amber-500 text-black' :
                        step.status === 'in_progress' ? 'bg-blue-500 text-white' :
                        step.status === 'locked' ? 'bg-zinc-800 text-zinc-600' :
                        'bg-zinc-700 text-zinc-300'
                      }`}>
                        {step.status === 'complete' ? '' : isLocked ? '[Lock]' : idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-sm font-medium ${isLocked ? 'text-zinc-600' : isActive ? 'text-white' : 'text-zinc-300'}`}>
                          {step.label}
                        </div>
                        <div className="text-xs text-zinc-600 truncate">{step.description}</div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        </nav>

        <main className="flex-1 min-w-0 p-4 lg:p-8">
          <div className="mb-4">
            <MobileDesktopNotice>
              Engineering workflows are desktop-first because they include alignments, long sections, cross sections, and export review. Use mobile for quick reference only.
            </MobileDesktopNotice>
          </div>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">{currentStep?.label}</h2>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
            {renderStepContent(currentStep?.id || 'setup', project, project.engineering_data || null, handleSave, handleModeChange)}
          </div>
        </main>
      </div>
    </div>
  )
}
