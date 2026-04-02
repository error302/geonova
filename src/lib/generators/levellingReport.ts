import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@/lib/supabase/client';
import { drawTitleBlock, addPageFooter } from './pdfTitleBlock';

export async function generateLevellingReport(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {

  const { data: project } = await supabase
    .from('projects')
    .select('name, survey_type, ref_no')
    .eq('id', projectId)
    .single();

  const { data: entries } = await supabase
    .from('project_fieldbook_entries')
    .select('row_index, raw_data')
    .eq('project_id', projectId)
    .order('row_index', { ascending: true });

  const rows = (entries ?? []).map((e) => e.raw_data as Record<string, unknown>);

  const bsReadings = rows.filter((r) => r.bs).map((r) => parseFloat(String(r.bs)) || 0);
  const fsReadings = rows.filter((r) => r.fs).map((r) => parseFloat(String(r.fs)) || 0);
  const sumBS = bsReadings.reduce((a, b) => a + b, 0);
  const sumFS = fsReadings.reduce((a, b) => a + b, 0);
  const misclosureMm = Math.abs(sumBS - sumFS) * 1000;

  const totalDistanceM = rows.length * 50;
  const totalDistanceKm = totalDistanceM / 1000;
  const toleranceMm = 10 * Math.sqrt(totalDistanceKm);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('en-KE');

  let y = drawTitleBlock(doc, {
    projectName: project?.name ?? 'Unknown Project',
    surveyType: project?.survey_type ?? '',
    reportTitle: 'LEVELLING REPORT',
    date: today,
    refNo: project?.ref_no,
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text('1. LEVEL BOOK (HEIGHT OF COLLIMATION METHOD)', 15, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Station', 'BS (m)', 'IS (m)', 'FS (m)', 'HPC (m)', 'RL (m)', 'Remark']],
    body: rows.map((r) => [
      String(r.station ?? ''),
      String(r.bs ?? ''),
      String(r.is ?? ''),
      String(r.fs ?? ''),
      String(r.instrument_height ?? ''),
      String(r.rl ?? ''),
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
  doc.text('2. CLOSURE CHECK', 15, y);
  y += 6;

  const closureStatus = misclosureMm <= toleranceMm ? 'PASS ✓' : 'FAIL ✗';
  const closureColor: [number, number, number] = misclosureMm <= toleranceMm ? [0, 120, 60] : [180, 0, 0];

  autoTable(doc, {
    startY: y,
    head: [['Parameter', 'Value']],
    body: [
      ['Sum of BS readings', `${sumBS.toFixed(4)} m`],
      ['Sum of FS readings', `${sumFS.toFixed(4)} m`],
      ['Misclosure', `${misclosureMm.toFixed(1)} mm`],
      ['Allowable tolerance (10√K mm)', `${toleranceMm.toFixed(1)} mm`],
      ['Closure status', closureStatus],
      ['Standard reference', 'RDM 1.1 (2025) Table 5.1 — 10√K mm'],
      ['Adjustment method', 'Proportional to distance (Bowditch)'],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
    margin: { left: 15, right: 15 },
    theme: 'grid',
    didParseCell: (data) => {
      if (data.row.index === 4 && data.column.index === 1) {
        data.cell.styles.textColor = closureColor;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  addPageFooter(doc, 1, doc.getNumberOfPages(), project?.name ?? '');

  return Buffer.from(doc.output('arraybuffer'));
}
