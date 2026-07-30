'use client';

import SurveyPlanViewer from '@/components/SurveyPlanViewer'
import GeometryValidationPanel from '@/components/GeometryValidationPanel'
import { PageHeader } from '@/components/shared/PageHeader'
import type { SurveyPlanData } from '@/lib/reports/surveyPlan/types'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const demoData: SurveyPlanData = {
  project: {
    name: 'NYERI/MWEIGA/PLOT 105',
    location: 'MWEIGA, NYERI COUNTY',
    municipality: 'NYERI COUNTY COUNCIL',
    utm_zone: 37,
    hemisphere: 'S',
    datum: 'ARC1960',
    client_name: 'SAMUEL MAINA',
    surveyor_name: 'ELIAS OKUMU',
    surveyor_licence: 'LS/0488',
    firm_name: 'METARDU GEOMATICS',
    firm_address: 'P.O. BOX 101, NYERI',
    firm_phone: '+254 712 345 678',
    firm_email: 'info@metardu.com',
    drawing_no: 'GN-20260419-001',
    reference: 'REF/MK/001',
    plan_title: 'BOUNDARY IDENTIFICATION PLAN',
    area_sqm: 1500.0,
    area_ha: 0.15,
    parcel_id: 'LOT 105',
    street: 'KIGANJO ROAD',
    hundred: 'MWEIGA',
    iskRegNo: 'ISK/FS/1055',
    northRotationDeg: 0,
    sheetNo: '1',
    totalSheets: '1',
    revisions: [
      { rev: 'A', date: '2026-04-10', description: 'Boundary adjustment', by: 'EO' }
    ],
  },
  parcel: {
    boundaryPoints: [
      { name: 'P1', easting: 250000.00, northing: 9945000.00 },
      { name: 'P2', easting: 250050.00, northing: 9945000.00 },
      { name: 'P3', easting: 250050.00, northing: 9945030.00 },
      { name: 'P4', easting: 250000.00, northing: 9945030.00 },
    ],
    area_sqm: 1500.0,
    perimeter_m: 160.0,
    pin: 'P/10/105',
    parts: ['PART A (SUBDIVISION)', 'PART B (REMAINDER)'],
  },
  controlPoints: [
    { name: 'P1', easting: 250000.00, northing: 9945000.00, elevation: 1850.5, monumentType: 'found' },
    { name: 'P2', easting: 250050.00, northing: 9945000.00, elevation: 1851.2, monumentType: 'set' },
  ],
  fenceOffsets: [
    { segmentIndex: 0, type: 'iron_fence', offsetMetres: 0.15 },
    { segmentIndex: 1, type: 'chain_link', offsetMetres: 0.20 },
  ],
}


function SurveyPlanDemoPage() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex justify-between items-center">
        <PageHeader
          title={t('tools.surveyPlanDemo')}
          subtitle={t('tools.surveyPlanDemoDesc')}
        />
        <a href="/tools" className="text-sm font-semibold text-blue-600 hover:underline flex-shrink-0">
          ← Back to Tools
        </a>
      </header>
      <main className="flex-1 flex flex-col items-center">
        <div className="w-full h-[75vh] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden m-4">
          <SurveyPlanViewer data={demoData} className="h-full" />
        </div>
        <div className="w-full max-w-2xl px-4 pb-4">
          <GeometryValidationPanel />
        </div>
      </main>
    </div>
  )
}

// P0-2 (2026-07-24): Wrap in <ToolGate> so direct-URL access can't
// bypass the plan check. The catalog page (/tools) shows lock badges,
// but those are display-only — this gate enforces the same check at
// the page level. Server-side enforcement for any export API this
// tool calls happens via the requirePlan() decorator on the route.
import { ToolGate } from '@/components/shared/ToolGate'

export default function SurveyPlanDemoPageGated() {
  return (
    <ToolGate toolPath="/tools/survey-plan-demo">
      <SurveyPlanDemoPage />
    </ToolGate>
  )
}
