import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@/lib/supabase/client';
import { computeDeedPlanGeometry } from './deedPlanGeometry';
import { renderBoundaryPlan } from './deedPlanRenderer';
import { addPageFooter } from './pdfTitleBlock';

const A4_W = 297;
const A4_H = 210;
const MARGIN = 8;
const PLAN_W = Math.round(A4_W * 0.60);
const TABLE_X = PLAN_W + MARGIN;
const TABLE_W = A4_W - PLAN_W - MARGIN * 1.5;

export async function generateWorkingDiagramPdf(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {

  const { data: project } = await supabase
    .from('projects')
    .select('name, survey_type, lr_number, utm_zone, hemisphere, datum, field_book_no, computations_no')
    .eq('id', projectId)
    .single();

  if (!project) throw new Error('Project not found.');

  const geom = await computeDeedPlanGeometry(projectId, supabase);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const today = new Date().toLocaleDateString('en-KE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  doc.setDrawColor(0);
  doc.setLineWidth(0.8);
  doc.rect(MARGIN, MARGIN, A4_W - MARGIN * 2, A4_H - MARGIN * 2);

  doc.setLineWidth(0.4);
  doc.line(PLAN_W, MARGIN, PLAN_W, A4_H - MARGIN);

  renderBoundaryPlan(doc, geom, {
    x: MARGIN,
    y: MARGIN,
    width: PLAN_W - MARGIN,
    height: A4_H - MARGIN * 2,
  });

  let ry = MARGIN + 4;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text('WORKING DIAGRAM', TABLE_X + TABLE_W / 2, ry + 3, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(project.name ?? '', TABLE_X + TABLE_W / 2, ry + 8, { align: 'center' });

  if (project.lr_number) {
    doc.text(`LR No: ${project.lr_number}`, TABLE_X + TABLE_W / 2, ry + 12, { align: 'center' });
  }

  doc.text(`Date: ${today}`, TABLE_X + TABLE_W / 2, ry + 16, { align: 'center' });
  ry += 20;

  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(TABLE_X, ry, TABLE_X + TABLE_W, ry);
  ry += 3;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text("GALE'S TABLE", TABLE_X, ry);
  ry += 3;

  const galeBody = geom.bearingSchedule.map((leg, i) => {
    const st = geom.stations[i];
    const next = geom.stations[(i + 1) % geom.stations.length];
    const dE = next.easting - st.easting;
    const dN = next.northing - st.northing;
    return [
      st.station,
      leg.bearing,
      leg.distance,
      dE.toFixed(3),
      dN.toFixed(3),
      st.easting.toFixed(3),
      st.northing.toFixed(3),
    ];
  });

  const totalDist = geom.bearingSchedule.reduce((s, l) => s + parseFloat(l.distance), 0);
  const lastSt = geom.stations[geom.stations.length - 1];
  const firstSt = geom.stations[0];

  autoTable(doc, {
    startY: ry,
    head: [['Stn', 'Bearing', 'Dist (m)', 'ΔE (m)', 'ΔN (m)', 'Adj E', 'Adj N']],
    body: galeBody,
    foot: [
      ['Σ', '', totalDist.toFixed(3), lastSt.easting - firstSt.easting, lastSt.northing - firstSt.northing, '', '']
    ],
    styles: { fontSize: 6, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
    footStyles: { fillColor: [30, 80, 100], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25, font: 'courier', fontSize: 5.5 },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 16, halign: 'right' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: TABLE_W - 103, halign: 'right' },
    },
    margin: { left: TABLE_X, right: MARGIN },
    tableWidth: TABLE_W,
    theme: 'grid',
  });

  ry = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  const statusColor: [number, number, number] =
    geom.closureStatus === 'PASS' ? [0, 120, 60] : [180, 0, 0];

  autoTable(doc, {
    startY: ry,
    head: [['Closure Check', 'Value']],
    body: [
      ['Misclosure (mm)', `${geom.misclosureMm.toFixed(1)} mm`],
      ['Precision ratio', geom.precisionRatio],
      ['Status', geom.closureStatus],
      ['Standard (Cap 299)', '1:5000 minimum'],
      ['Adj. method', 'Bowditch (Compass Rule)'],
    ],
    styles: { fontSize: 6, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32 },
      1: { cellWidth: TABLE_W - 34 },
    },
    margin: { left: TABLE_X, right: MARGIN },
    tableWidth: TABLE_W,
    theme: 'grid',
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 2 && data.column.index === 1) {
        data.cell.styles.textColor = statusColor;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  addPageFooter(doc, 1, 1, project.name ?? '');

  return Buffer.from(doc.output('arraybuffer'));
}

