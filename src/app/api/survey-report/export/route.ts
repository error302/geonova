export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { getSurveyReportById } from '@/lib/api-client/surveyReports'
import { generatePdf } from '@/lib/pdf/generatePdf'
import { generateDocx } from '@/lib/docx/generateDocx'
import { getTemplateSections } from '@/lib/docx/templates'

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { reportId, format } = ctx.body as { reportId?: string; format?: 'pdf' | 'docx' }

  if (!reportId) {
    return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
  }

  if (!format || !['pdf', 'docx'].includes(format)) {
    return NextResponse.json({ error: 'Format must be pdf or docx' }, { status: 400 })
  }

  const report = await getSurveyReportById(reportId)

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  }

  const reportRow = report as NonNullable<typeof report> & {
    surveyType?: string
    projectName?: string
  }

  if (format === 'pdf') {
    const pdfBuffer = await generatePdf({
      title: report.reportTitle || 'Survey Report',
      sections: report.sections,
      paperSize: 'A4',
      orientation: 'portrait',
    })

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${report.reportNumber?.replace(/[^a-z0-9]/gi, '_') || 'survey_report'}.pdf"`,
      }
    })
  } else if (format === 'docx') {
    // Determine survey type and use template if available
    const surveyType = (reportRow.surveyType || 'cadastral') as Parameters<typeof getTemplateSections>[0]
    const templateSections = getTemplateSections(surveyType, {
      reportNumber: report.reportNumber,
      clientName: reportRow.clientName,
      projectName: reportRow.projectName,
      projectLocation: reportRow.projectLocation,
      areaHectares: reportRow.areaHectares,
      date: new Date().toLocaleDateString('en-GB'),
      precisionRatio: '5000',
      pointSpacing: '20m',
      contourInterval: '0.5m',
      horizontalAccuracy: '20mm',
      verticalAccuracy: '10mm',
      pointDensity: '1 per 400m²',
      contractNumber: reportRow.contractNumber,
      projectPurpose: reportRow.projectPurpose,
      structuralTolerance: '5mm',
      earthworksTolerance: '20mm',
      asBuiltTolerance: '10mm',
      mineralType: 'TBD',
      stockpileId: 'SP-001',
      stockpileVolume: 'TBD',
      materialType: 'Overburden',
      gridSpacing: '5m',
    })

    const docxBuffer = await generateDocx({
      title: report.reportTitle || 'Survey Report',
      reportNumber: report.reportNumber,
      sections: templateSections.length > 0 ? templateSections : report.sections,
      surveyType,
      clientName: reportRow.clientName,
      projectName: reportRow.projectName,
      projectLocation: reportRow.projectLocation,
      areaHectares: reportRow.areaHectares,
      useTemplate: true,
    })

    return new NextResponse(Buffer.from(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${report.reportNumber?.replace(/[^a-z0-9]/gi, '_') || 'report'}.docx"`,
      }
    })
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
})
