'use client'

import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import MobileDesktopNotice from '@/components/MobileDesktopNotice'
import type { SurveyorProfileSubmission } from '@/lib/api-client/community'
import { EngineeringPanelSkeleton, type EngineeringProject } from './shared'

/* ── Lazy-loaded engineering panels for the Quick Compute tab ─── */
const HorizontalCurvePanel = dynamic(() => import('@/components/engineering/HorizontalCurvePanel').then(m => ({ default: m.HorizontalCurvePanel })), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const SuperelevationPanel = dynamic(() => import('@/components/engineering/SuperelevationPanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const VolumesPanel = dynamic(() => import('@/components/engineering/VolumesPanel').then(m => ({ default: m.VolumesPanel })), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const NetworkAdjustmentPanel = dynamic(() => import('@/components/compute/NetworkAdjustmentPanel').then(m => ({ default: m.NetworkAdjustmentPanel })), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const RoadReservePanel = dynamic(() => import('@/components/engineering/RoadReservePanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})

const QUICK_COMPUTE_TABS = [
  { id: 'curves', label: 'Horizontal Curves' },
  { id: 'chainage', label: 'Chainage' },
  { id: 'tacheometry', label: 'Tacheometry' },
  { id: 'cross_sections', label: 'Cross Sections' },
  { id: 'setting_out', label: 'Setting Out' },
  { id: 'superelevation', label: 'Superelevation' },
  { id: 'volumes', label: 'Volumes' },
  { id: 'network', label: 'Network Adjustment' },
  { id: 'road_reserve', label: 'Road Reserve' },
  { id: 'workflow', label: '← Back to Workflow' },
] as const

/**
 * Quick Compute tab — secondary tab bar of the engineering page that hosts
 * the standalone compute panels (horizontal curves, superelevation, volumes,
 * network adjustment, road reserve).
 *
 * Extracted verbatim from src/app/project/[id]/engineering/page.tsx —
 * the JSX, the dynamic() panel imports, and the tab array are unchanged.
 */
export function QuickComputeTab({
  projectId,
  project,
  surveyorProfile,
  activeTab,
}: {
  projectId: string
  project: EngineeringProject
  surveyorProfile: SurveyorProfileSubmission | null
  activeTab: string
}) {
  const router = useRouter()

  const projectData = {
    lr_number: project.lr_number,
    county: project.county,
    district: project.district,
    locality: project.locality,
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <MobileDesktopNotice>
            Engineering compute panels use dense tables, diagrams, and exports. Mobile is useful for quick field checks; desktop is recommended for final design review.
          </MobileDesktopNotice>
        </div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/project/${projectId}`)} className="text-zinc-500 hover:text-zinc-300">← Back</button>
            <h1 className="text-xl font-bold">Engineering Compute</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/project/${projectId}/engineering?tab=workflow`)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'workflow' ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-300'}`}
            >
              Workflow
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-2">
          {QUICK_COMPUTE_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => router.push(`/project/${projectId}/engineering?tab=${tab.id}`)}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                activeTab === tab.id
                  ? 'bg-zinc-800 text-white border-t border-l border-r border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-zinc-900 rounded-xl p-6">
          {activeTab === 'curves' && <HorizontalCurvePanel projectId={projectId} projectData={projectData} surveyorProfile={surveyorProfile} />}
          {activeTab === 'superelevation' && <SuperelevationPanel projectId={projectId} projectData={projectData} surveyorProfile={surveyorProfile} />}
          {activeTab === 'volumes' && <VolumesPanel projectId={projectId} projectData={projectData} surveyorProfile={surveyorProfile} />}
          {activeTab === 'network' && <NetworkAdjustmentPanel projectId={projectId} projectData={project as unknown as Record<string, unknown>} />}
          {activeTab === 'road_reserve' && <RoadReservePanel
            roadClass={project.engineering_data?.road?.roadClass || 'C'}
            roadLength={undefined}
            existingRoadWidth={project.engineering_data?.road?.crossSectionTemplate?.carriagewayWidth ? project.engineering_data.road.crossSectionTemplate.carriagewayWidth + (project.engineering_data.road.crossSectionTemplate.shoulderWidth ?? 1) * 2 : undefined}
          />}
        </div>
      </div>
    </div>
  )
}
