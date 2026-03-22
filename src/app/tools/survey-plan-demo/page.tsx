import SurveyPlanViewer from '@/components/SurveyPlanViewer'
import type { SurveyPlanData } from '@/lib/reports/surveyPlan/types'

const demoData: SurveyPlanData = {
  project: {
    name: 'Test Survey',
    location: 'Nairobi',
    municipality: 'Nairobi County',
    utm_zone: 37,
    hemisphere: 'S',
    datum: 'WGS84',
    client_name: 'Test Client',
    surveyor_name: 'J. Doe',
    surveyor_licence: 'LS/2024/001',
    firm_name: 'GeoTech Surveyors Ltd',
    firm_address: '1 Survey St, Nairobi',
    firm_phone: '+254 700 000 000',
    firm_email: 'survey@metro.co.ke',
    drawing_no: 'MD-2024-001',
    reference: 'REF/2024/TEST',
    plan_title: 'Boundary Identification Plan',
    area_sqm: 5000,
    area_ha: 0.5,
    parcel_id: 'LR 12345',
    street: 'Kenyatta Avenue',
    hundred: 'Nairobi',
    iskRegNo: 'ISK/2024/001',
    northRotationDeg: 0,
    sheetNo: '1',
    totalSheets: '1',
    revisions: [{ rev: 'A', date: '22 Mar 2026', description: 'Initial issue', by: 'J. Smith' }],
  },
  parcel: {
    boundaryPoints: [
      { name: '1', easting: 5000, northing: 5000 },
      { name: '2', easting: 5100, northing: 5000 },
      { name: '3', easting: 5100, northing: 5050 },
      { name: '4', easting: 5000, northing: 5050 },
    ],
    area_sqm: 5000,
    perimeter_m: 200,
    pin: 'KRN-2024-001',
    parts: ['PART 1'],
  },
  controlPoints: [
    { name: '1', easting: 5000, northing: 5000, monumentType: 'found' },
    { name: '2', easting: 5100, northing: 5000, monumentType: 'set' },
    { name: '3', easting: 5100, northing: 5050, monumentType: 'masonry_nail' },
    { name: '4', easting: 5000, northing: 5050, monumentType: 'iron_pin' },
  ],
  fenceOffsets: [
    { segmentIndex: 0, type: 'chain_link' as const, offsetMetres: 1.5 },
    { segmentIndex: 1, type: 'board_fence' as const, offsetMetres: 2.0 },
    { segmentIndex: 2, type: 'fence_on_boundary' as const, offsetMetres: 0 },
    { segmentIndex: 3, type: 'chain_link' as const, offsetMetres: 1.5 },
  ],
}

export const metadata = {
  title: 'Survey Plan CAD Demo — METARDU'
}

export default function SurveyPlanDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Survey Plan CAD Generator</h1>
          <p className="text-sm text-gray-500">Live preview of the professional Boundary Identification Plan renderer.</p>
        </div>
        <a href="/tools" className="text-sm font-semibold text-blue-600 hover:underline">
          ← Back to Tools
        </a>
      </header>
      <main className="flex-1 flex flex-col items-center">
        <div className="w-full h-[75vh] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden m-4">
          <SurveyPlanViewer data={demoData} className="h-full" />
        </div>
      </main>
    </div>
  )
}
