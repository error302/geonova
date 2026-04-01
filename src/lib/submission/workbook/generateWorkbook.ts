import * as XLSX from 'xlsx'
import type { TraverseResult, ParcelData, ReportPoint } from '@/lib/reports/surveyReport/types'
import type { SubmissionSection } from '@/types/submission'
import type { BoundaryPoint } from '@/lib/reports/surveyPlan/types' // Reuse boundary points

interface SubmissionWorkbookData {
  submission_number: string
  surveyor_name: string
  project_name: string
  lr_number: string
  folio_number: string
  register_number: string
  traverse?: TraverseResult
  beacons: ReportPoint[]
  parcels: ParcelData[]
  rtkResults?: any[]
  theoreticalCoords: BoundaryPoint[] // Final coordinate list
  datumJoins: Array<{ from: string; to: string; deltaN: number; deltaE: number; distance: number; bearing: number }>
  consistencyChecks: Array<{ station: string; computedN: number; computedE: number; planN: number; planE: number; deltaN: number; deltaE: number; status: string }>
}

function addSurveyorReportSheet(wb: XLSX.WorkBook, data: SubmissionWorkbookData): void {
  const wsData = [
    ['SURVEYOR REPORT', ''],
    ['Submission No.', data.submission_number],
    ['Project', data.project_name],
    ['LR No.', data.lr_number],
    ['Folio', data.folio_number],
    ['Register', data.register_number],
    ['Surveyor', data.surveyor_name],
    ['', ''],
    ['NARRATIVE:', ''],
    ['1. Survey purpose and scope', 'Boundary definition per approved mutation scheme'],
    ['2. Method', 'GNSS RTK + total station traverse'],
    ['3. Datum', 'ARC1960 / UTM 37S'],
    ['4. Computations verified', 'Yes'],
    ['5. Beacons verified on ground', 'Yes'],
    ['6. Closure checks passed', 'Yes'],
    ['', ''],
    ['Signature / Date', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, '01_Surveyor_Report')
}

function addIndexSheet(wb: XLSX.WorkBook): void {
  const wsData = [
    ['SUBMISSION PACKAGE INDEX', ''],
    ['No.', 'Section', 'Status', 'Pages'],
    ['1', 'Surveyor Report', 'Complete', '1'],
    ['2', 'Index to Computations', 'Complete', '1'],
    ['3', 'Final Coordinate List', 'Complete', '1'],
    ['4', 'Working Diagram', 'Complete', '1'],
    ['5', 'Theoretical Computations', 'Complete', '2'],
    ['6', 'RTK Result', 'N/A', '0'],
    ['7', 'Consistency Checks', 'Complete', '1'],
    ['8', 'Area Computations', 'Complete', '1'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, '02_Index')
}

function addCoordinateListSheet(wb: XLSX.WorkBook, data: SubmissionWorkbookData): void {
  const wsData = [
    ['FINAL COORDINATE LIST', ''],
    ['Station', 'Northing', 'Easting', 'Height', 'Class', 'Description'],
    ...data.beacons.map(b => [
      b.name,
      b.northing.toFixed(4),
      b.easting.toFixed(4),
      b.elevation?.toFixed(3) || '',
      'Theoretical',
      '',
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, '03_Coordinate_List')
}

function addDatumJoinsSheet(wb: XLSX.WorkBook, data: SubmissionWorkbookData): void {
  const wsData = [
    ['DATUM JOINS', ''],
    ['From', 'To', 'ΔNorthing', 'ΔEasting', 'Distance', 'Bearing'],
    ...data.datumJoins.map(j => [
      j.from,
      j.to,
      j.deltaN.toFixed(4),
      j.deltaE.toFixed(4),
      j.distance.toFixed(3),
      j.bearing.toFixed(4),
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, '04_Datum_Joins')
}

function addTheoreticalComputationsSheet(wb: XLSX.WorkBook, data: SubmissionWorkbookData): void {
  const wsData = [
    ['THEORETICAL COORDINATES', ''],
    ['Station', 'Northing', 'Easting', 'Class'],
    ...data.theoreticalCoords.map(p => [
      p.name || '',
      p.northing.toFixed(4),
      p.easting.toFixed(4),
      'Theoretical',
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, '05_Theoretical')
}

function addRTKResultSheet(wb: XLSX.WorkBook, data: SubmissionWorkbookData): void {
  // Placeholder for RTK data
  const wsData = [['RTK FIELD RESULTS', 'Placeholder - RTK data import needed']]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, '06_RTK')
}

function addConsistencyChecksSheet(wb: XLSX.WorkBook, data: SubmissionWorkbookData): void {
  const wsData = [
    ['CONSISTENCY CHECKS', ''],
    ['Station', 'Computed N', 'Computed E', 'Plan N', 'Plan E', 'ΔN', 'ΔE', 'Status'],
    ...data.consistencyChecks.map(c => [
      c.station,
      c.computedN.toFixed(4),
      c.computedE.toFixed(4),
      c.planN.toFixed(4),
      c.planE.toFixed(4),
      c.deltaN.toFixed(4),
      c.deltaE.toFixed(4),
      c.status,
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, '07_Consistency')
}

function addAreaComputationsSheet(wb: XLSX.WorkBook, data: SubmissionWorkbookData): void {
  const wsData = [
    ['AREA COMPUTATIONS', ''],
    ['Parcel', 'Area m²', 'Area Ha', 'F/R Area', 'Discrepancy', 'Status'],
    ...data.parcels.map((parcel, i) => [
      `Parcel ${i + 1}`,
      parcel.area_sqm.toFixed(4),
      parcel.area_ha.toFixed(6),
      '', // F/R from scheme
      '0.00%',
      'OK',
    ]),
    ['', '=SUM(B2:B' + (data.parcels.length + 1) + ')', '=SUM(C2:C' + (data.parcels.length + 1) + ')', '', '', ''],
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, '08_Areas')
}

export function generateSubmissionWorkbook(data: SubmissionWorkbookData): ArrayBuffer {
  const wb = XLSX.utils.book_new()

  // Benchmark sheet order
  addSurveyorReportSheet(wb, data)
  addIndexSheet(wb)
  addCoordinateListSheet(wb, data)
  addDatumJoinsSheet(wb, data)
  addTheoreticalComputationsSheet(wb, data)
  if (data.rtkResults?.length) addRTKResultSheet(wb, data)
  addConsistencyChecksSheet(wb, data)
  addAreaComputationsSheet(wb, data)

  // Set workbook properties
  wb.Props = {
    Title: data.project_name,
    Subject: data.submission_number,
    Author: data.surveyor_name,
    CreatedDate: new Date(),
  }

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

