import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@/lib/supabase/client';
import { drawTitleBlock, addPageFooter } from './pdfTitleBlock';

export async function generateTraverseReport(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {

  const { data: project } = await supabase
    .from('projects')
    .select('name, survey_type, client_name, ref_no')
    .eq('id', projectId)
    .single();

  const { data: entries } = await supabase
    .from('project_fieldbook_entries')
    .select('row_index, raw_data')
    .eq('project_id', projectId)
    .order('row_index', { ascending: true });

  const rows = (entries ?? []).map((e: any) => e.raw_data as Record<string, unknown>);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('en-KE');

  let y = drawTitleBlock(doc, {
    projectName: project?.name ?? 'Unknown Project',
    surveyType: project?.survey_type ?? '',
    reportTitle: 'TRAVERSE COMPUTATION REPORT',
    date: today,
    refNo: project?.ref_no,
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text('1. TRAVERSE OBSERVATIONS', 15, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Station', 'Bearing (°)', 'Distance (m)', 'Code', 'Monument No.', 'Remark']],
    body: rows.map((r: any) => [
      String(r.station ?? ''),
      String(r.bearing ?? ''),
      String(r.distance ?? ''),
      String(r.code ?? r.beacon_no ?? ''),
      String(r.monument_type ?? ''),
      String(r.remark ?? ''),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    margin: { left: 15, right: 15 },
    theme: 'grid',
    didDrawPage: (data) => {
      addPageFooter(doc, data.pageNumber, doc.getNumberOfPages(), project?.name ?? '');
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text('2. CLOSURE SUMMARY', 15, y);
  y += 6;

  const totalDistance = rows.reduce((sum: any, r: any) => sum + (parseFloat(String(r.distance ?? '0')) || 0), 0);

  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Value']],
    body: [
      ['Total number of stations', String(rows.length)],
      ['Total traverse distance', `${totalDistance.toFixed(3)} m`],
      ['Adjustment method', 'Bowditch (Compass Rule)'],
      ['Regulatory standard', 'Survey Act Cap 299 / Kenya Survey Regulations 1994'],
      ['Note', 'Angular and linear closure computed by Metardu math engine'],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    margin: { left: 15, right: 15 },
    theme: 'grid',
  });

  addPageFooter(doc, 1, doc.getNumberOfPages(), project?.name ?? '');

  return Buffer.from(doc.output('arraybuffer'));
}

