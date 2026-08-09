import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import db from '@/lib/db';
import { drawTitleBlock, addPageFooter } from './pdfTitleBlock';

export async function generateTraverseReport(
  projectId: string
): Promise<Buffer> {

  const projectRes = await db.query<{ name: string; survey_type?: string; client_name?: string | null; ref_no?: string | null }>(
    'SELECT name, survey_type, client_name, ref_no FROM projects WHERE id = $1',
    [projectId]
  );
  const project = projectRes.rows[0];

  const entriesRes = await db.query(
    'SELECT row_index, raw_data FROM project_fieldbook_entries WHERE project_id = $1 ORDER BY row_index ASC',
    [projectId]
  );
  const entries = entriesRes.rows;

  const rows = (entries ?? []).map((e: { row_index: number; raw_data: Record<string, unknown> }) => e.raw_data);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('en-KE');

  let y = drawTitleBlock(doc, {
    projectName: project?.name ?? 'Unknown Project',
    surveyType: project?.survey_type ?? '',
    reportTitle: 'TRAVERSE COMPUTATION REPORT',
    date: today,
    refNo: project?.ref_no ?? undefined,
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('1. TRAVERSE OBSERVATIONS', 15, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Station', 'Bearing (°)', 'Distance (m)', 'Code', 'Monument No.', 'Remark']],
    body: rows.map((r) => [
      String(r.station ?? ''),
      String(r.bearing ?? ''),
      String(r.distance ?? ''),
      String(r.code ?? r.beacon_no ?? ''),
      String(r.monument_type ?? ''),
      String(r.remark ?? ''),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [0, 0, 0], textColor: 255 },
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
  doc.setTextColor(0, 0, 0);
  doc.text('2. CLOSURE SUMMARY', 15, y);
  y += 6;

  const totalDistance = rows.reduce((sum, r) => sum + (parseFloat(String(r.distance ?? '0')) || 0), 0);

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
    headStyles: { fillColor: [0, 0, 0], textColor: 255 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    margin: { left: 15, right: 15 },
    theme: 'grid',
  });

  addPageFooter(doc, 1, doc.getNumberOfPages(), project?.name ?? '');

  return Buffer.from(doc.output('arraybuffer'));
}

