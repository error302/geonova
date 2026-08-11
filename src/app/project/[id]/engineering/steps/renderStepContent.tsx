'use client'

import dynamic from 'next/dynamic'
import type {
  DrainageData,
  EngineeringData,
  EngineeringMode,
  RoadDesignData,
} from '@/types/engineering'
import type { EngineeringProject, EngineeringStepId } from '../shared'
import { EngineeringPanelSkeleton } from '../shared'
import { Step1Setup } from './Step1Setup'
import { Step2Horizontal } from './Step2Horizontal'
import { Step3Vertical } from './Step3Vertical'
import { Step4CrossSection } from './Step4CrossSection'
import { Step5Stations } from './Step5Stations'
import { Step6Outputs } from './Step6Outputs'
import { DrainageStep1Manholes } from './DrainageStep1Manholes'
import { DrainageStep2Pipes } from './DrainageStep2Pipes'
import { DrainageStep3Outputs } from './DrainageStep3Outputs'

/* ── Lazy-loaded engineering panels (only one step visible at a time) ─── */
const LongSectionRenderer = dynamic(() => import('@/components/engineering/LongSectionRenderer'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const CrossSectionSeries = dynamic(() => import('@/components/engineering/CrossSectionSeries'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const RoadReservePanel = dynamic(() => import('@/components/engineering/RoadReservePanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const AsBuiltSurveyPanel = dynamic(() => import('@/components/engineering/AsBuiltSurveyPanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const PavementDesignPanel = dynamic(() => import('@/components/engineering/PavementDesignPanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const DrainageDesignPanel = dynamic(() => import('@/components/engineering/DrainageDesignPanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const RoadCompletionCertificatePanel = dynamic(() => import('@/components/engineering/RoadCompletionCertificatePanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const PileGridPanel = dynamic(() => import('@/components/engineering/PileGridPanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const SlopeAnalysisPanel = dynamic(() => import('@/components/engineering/SlopeAnalysisPanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const ProgressMonitorPanel = dynamic(() => import('@/components/engineering/ProgressMonitorPanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})
const MachineControlExportPanel = dynamic(() => import('@/components/engineering/MachineControlExportPanel'), {
  ssr: false, loading: () => <EngineeringPanelSkeleton />
})

/**
 * Switch on stepId and render the appropriate step component or inline panel.
 *
 * Extracted verbatim from src/app/project/[id]/engineering/page.tsx.
 * The main page imports this function and renders it inside the workflow card;
 * the Quick Compute tab on the main page has its own separate set of dynamic
 * imports (HorizontalCurvePanel, SuperelevationPanel, VolumesPanel,
 * NetworkAdjustmentPanel, RoadReservePanel) which stay there.
 */
export function renderStepContent(
  stepId: EngineeringStepId,
  project: EngineeringProject,
  engineeringData: EngineeringData | null,
  onSave: (data: Partial<EngineeringData>) => void,
  onModeChange?: (mode: EngineeringMode) => void
) {
  const mode = engineeringData?.mode || 'road'
  const roadData = engineeringData?.road || null
  const drainageData = engineeringData?.drainage || null

  switch (stepId) {
    case 'setup':
      return (
        <Step1Setup
          project={project}
          data={roadData}
          mode={mode}
          onModeChange={(m) => onModeChange?.(m)}
          onSave={(data) => onSave({ road: { ...roadData, ...data } as RoadDesignData })}
        />
      )
    case 'horizontal':
      return (
        <Step2Horizontal
          data={roadData}
          onSave={(ips) => onSave({ road: { ...roadData, ips } as RoadDesignData })}
        />
      )
    case 'vertical':
      return (
        <Step3Vertical
          data={roadData}
          onSave={(vips) => onSave({ road: { ...roadData, vips } as RoadDesignData })}
        />
      )
    case 'cross_section':
      return (
        <Step4CrossSection
          data={roadData}
          onSave={(template) => onSave({ road: { ...roadData, crossSectionTemplate: template } as RoadDesignData })}
        />
      )
    case 'stations':
      return (
        <Step5Stations
          data={roadData}
          onSave={(stations) => onSave({ road: { ...roadData, stations } as RoadDesignData })}
        />
      )
    case 'outputs':
      return (
        <Step6Outputs
          project={project}
          data={roadData}
        />
      )
    case 'manholes':
      return (
        <DrainageStep1Manholes
          data={drainageData}
          onSave={(manholes) => onSave({ drainage: { ...drainageData, manholes } as DrainageData })}
        />
      )
    case 'pipes':
      return (
        <DrainageStep2Pipes
          data={drainageData}
          onSave={(pipeRuns) => onSave({ drainage: { ...drainageData, pipeRuns } as DrainageData })}
        />
      )
    case 'drainage_outputs':
      return (
        <DrainageStep3Outputs
          data={drainageData}
        />
      )
    case 'export':
      if (mode === 'drainage') {
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Export Package</h3>
              <p className="text-zinc-400 text-sm">Generate drainage layout PDF, invert levels schedule.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['Drainage Layout PDF', 'Invert Levels Schedule', 'Manhole Schedule', 'Long Section PDF'].map((fmt: string) => (
                <button key={fmt} className="py-3 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800">
                  ↓ {fmt}
                </button>
              ))}
            </div>
          </div>
        )
      }
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Export Package</h3>
            <p className="text-zinc-400 text-sm">Generate PDF reports, long section, peg book.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['Horizontal Alignment Report', 'Vertical Alignment Report', 'Earthworks Summary', 'Long Section PDF'].map((fmt: string) => (
              <button key={fmt} className="py-3 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800">
                ↓ {fmt}
              </button>
            ))}
          </div>
        </div>
      )
    case 'long_section': {
      const stations = roadData?.stations || []
      const vips = roadData?.vips || []
      if (stations.length === 0) {
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Long Section</h3>
              <p className="text-zinc-400 text-sm">Chainage vs elevation profile.</p>
            </div>
            <div className="text-center py-12 text-zinc-500">
              <p>Add station levels in Step 5 (Stations & Levels) first.</p>
            </div>
          </div>
        )
      }
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Long Section</h3>
            <p className="text-zinc-400 text-sm">Chainage vs elevation profile with vertical curves, cut/fill areas.</p>
          </div>
          <LongSectionRenderer
            stations={stations.map(s => ({
              chainage: s.chainage,
              groundLevel: s.groundLevel,
              designLevel: s.designLevel,
            }))}
            verticalIPs={vips.map(v => ({
              chainage: v.chainage,
              reducedLevel: v.reducedLevel,
              kValue: v.kValue,
            }))}
            projectInfo={{
              roadName: roadData?.roadName || 'Unnamed Road',
              roadClass: roadData?.roadClass || 'C',
              designSpeed: roadData?.designSpeed || 60,
              startChainage: roadData?.startChainage || 0,
              datum: roadData?.datum || 'Arc 1960',
            }}
          />
        </div>
      )
    }
    case 'cross_section_view': {
      const stations = roadData?.stations || []
      const template = roadData?.crossSectionTemplate
      if (stations.length === 0 || !template) {
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Cross Sections</h3>
              <p className="text-zinc-400 text-sm">Formation template sections at each chainage.</p>
            </div>
            <div className="text-center py-12 text-zinc-500">
              <p>Add station levels and a cross section template first.</p>
            </div>
          </div>
        )
      }
      const sections = stations.map(s => ({
        chainage: s.chainage,
        groundPoints: [
          { offset: -(template.carriagewayWidth / 2 + template.shoulderWidth + 10), level: s.groundLevel + 0.3 },
          { offset: -(template.carriagewayWidth / 2 + template.shoulderWidth), level: s.groundLevel + 0.1 },
          { offset: -(template.carriagewayWidth / 2), level: s.groundLevel },
          { offset: 0, level: s.groundLevel - 0.1 },
          { offset: template.carriagewayWidth / 2, level: s.groundLevel },
          { offset: template.carriagewayWidth / 2 + template.shoulderWidth, level: s.groundLevel + 0.1 },
          { offset: template.carriagewayWidth / 2 + template.shoulderWidth + 10, level: s.groundLevel + 0.3 },
        ],
        formationLevel: s.designLevel ?? s.groundLevel,
        cutArea: s.designLevel ? Math.max(0, s.groundLevel - s.designLevel) * (template.carriagewayWidth + template.shoulderWidth * 2) : 0,
        fillArea: s.designLevel ? Math.max(0, s.designLevel - s.groundLevel) * (template.carriagewayWidth + template.shoulderWidth * 2) : 0,
      }))
      const defaultTemplate = {
        carriagewayWidth: template.carriagewayWidth,
        shoulderWidth: template.shoulderWidth,
        cutSlope: template.cutSlope,
        fillSlope: template.fillSlope,
        camber: template.camber,
        subgradeDepth: template.subgradeDepth,
      }
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Cross Sections</h3>
            <p className="text-zinc-400 text-sm">Formation template sections at each chainage station.</p>
          </div>
          <CrossSectionSeries sections={sections} template={defaultTemplate} interval={20} />
        </div>
      )
    }
    case 'pavement_design': {
      const stations = roadData?.stations || []
      const template = roadData?.crossSectionTemplate
      const roadLength = stations.length >= 2 ? stations[stations.length - 1].chainage - stations[0].chainage : 0
      return (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Pavement Layer Design</h3>
          <p className="text-zinc-400 text-sm mb-4">CBR-based pavement design per KeNHA Pavement Design Manual. Input traffic &amp; subgrade data to determine layer thicknesses.</p>
          <PavementDesignPanel
            roadClass={roadData?.roadClass}
            carriagewayWidth={template?.carriagewayWidth}
            roadLength={roadLength || 1000}
          />
        </div>
      )
    }
    case 'drainage_design': {
      const stations = roadData?.stations || []
      const roadLength = stations.length >= 2 ? stations[stations.length - 1].chainage - stations[0].chainage : 0
      return (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Drainage Design Tools</h3>
          <p className="text-zinc-400 text-sm mb-4">Manning&apos;s equation pipe capacity, Rational Method catchment analysis, trapezoidal channel design per RDM 1.3.</p>
          <DrainageDesignPanel roadLength={roadLength || 1000} />
        </div>
      )
    }
    case 'as_built': {
      return (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">As-Built Survey</h3>
          <p className="text-zinc-400 text-sm mb-4">Compare design levels against as-built survey data. Paste CSV (chainage, design_level, as_built_level) to compute deviations and KeNHA compliance.</p>
          <AsBuiltSurveyPanel roadClass={roadData?.roadClass} />
        </div>
      )
    }
    case 'road_completion': {
      return (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Road Completion Certificate</h3>
          <p className="text-zinc-400 text-sm mb-4">Generate a road completion certificate per Kenya Roads Act, Cap 407. Fill in project details, certification checklist, and surveyor declaration.</p>
          <RoadCompletionCertificatePanel roadClass={roadData?.roadClass} />
        </div>
      )
    }
    case 'road_reserve': {
      const stations = roadData?.stations || []
      const template = roadData?.crossSectionTemplate
      const roadLength = stations.length >= 2 ? stations[stations.length - 1].chainage - stations[0].chainage : 0
      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Road Reserve</h3>
            <p className="text-zinc-400 text-sm">Reserve width compliance, land acquisition estimate, and property impact.</p>
          </div>
          <RoadReservePanel
            roadClass={roadData?.roadClass || 'C'}
            roadLength={roadLength || undefined}
            existingRoadWidth={template?.carriagewayWidth ? template.carriagewayWidth + template.shoulderWidth * 2 : undefined}
          />
        </div>
      )
    }
    case 'pile_grid': {
      return (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Pile / Column Grid Setting Out</h3>
          <p className="text-zinc-400 text-sm mb-4">Generate pile or column grid coordinates, compute bearings and distances from an instrument station, and export DXF setout drawings.</p>
          <PileGridPanel />
        </div>
      )
    }
    case 'slope_analysis': {
      return (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Slope &amp; Area Analysis</h3>
          <p className="text-zinc-400 text-sm mb-4">DTM slope classification, cut/fill volume computation, and area calculation per KENHA standards.</p>
          <SlopeAnalysisPanel />
        </div>
      )
    }
    case 'progress_monitor': {
      return (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Construction Progress Monitor</h3>
          <p className="text-zinc-400 text-sm mb-4">Track construction progress against programme milestones with S-curve analysis, inspection workflow, and photo attachments.</p>
          <ProgressMonitorPanel projectId={project.id || ''} />
        </div>
      )
    }
    case 'topo_drawing': {
      return (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Topographic Drawing Composer</h3>
          <p className="text-zinc-400 text-sm mb-4">Assign feature codes to survey points and produce professional DXF drawings with proper layers, spot heights, and sheet layout.</p>
          <div className="text-amber-400/80 text-sm bg-amber-900/20 border border-amber-800 rounded-lg p-3">
            For the full topographic drawing experience with feature code browser and SVG preview, use the dedicated tool at{' '}
            <a href="/tools/topo-drawing" className="underline text-amber-400 hover:text-amber-300">Tools → Topographic Drawing</a>.
          </div>
        </div>
      )
    }
    case 'machine_control': {
      return (
        <div>
          <h3 className="text-xl font-bold text-white mb-4">Machine Control Export</h3>
          <p className="text-zinc-400 text-sm mb-4">Export design points in formats compatible with Trimble, Leica, and Topcon machine control systems.</p>
          <MachineControlExportPanel />
        </div>
      )
    }
    default:
      return <div>Unknown step</div>
  }
}
