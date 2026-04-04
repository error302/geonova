import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from '@/lib/supabase/client';
import { computeDeedPlanGeometry } from './deedPlanGeometry';
import { renderBoundaryPlan } from './deedPlanRenderer';
import { addPageFooter } from './pdfTitleBlock';

const A3_W = 420;
const A3_H = 297;
const MARGIN = 8;
const PLAN_WIDTH = Math.round(A3_W * 0.63);
const SCHEDULE_X = PLAN_WIDTH + MARGIN;
const SCHEDULE_W = A3_W - PLAN_WIDTH - MARGIN * 1.5;

export async function generateDeedPlan(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select(`
      name, survey_type, lr_number, folio_number, register_number,
      fir_number, registration_block, registration_district,
      locality, computations_no, field_book_no, file_reference,
      client_name, survey_date, area_ha, utm_zone, hemisphere,
      user_id, created_at
    `)
    .eq('id', projectId)
    .single();

  if (projError || !project) throw new Error('Project not found: ' + projError?.message);

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, isk_number, firm_name')
    .eq('id', project.user_id)
    .single();

  const geom = await computeDeedPlanGeometry(projectId, supabase);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
  });

  const today = new Date().toLocaleDateString('en-KE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const surveyDate = project.survey_date
    ? new Date(project.survey_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })
    : today;

  doc.setDrawColor(0);
  doc.setLineWidth(1.0);
  doc.rect(MARGIN, MARGIN, A3_W - MARGIN * 2, A3_H - MARGIN * 2);

  doc.setLineWidth(0.5);
  doc.line(PLAN_WIDTH, MARGIN, PLAN_WIDTH, A3_H - MARGIN);

  const scaleRatio = renderBoundaryPlan(doc, geom, {
    x: MARGIN,
    y: MARGIN,
    width: PLAN_WIDTH - MARGIN,
    height: A3_H - MARGIN * 2,
  });

  let ry = MARGIN + 4;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text('DEED PLAN', SCHEDULE_X + SCHEDULE_W / 2, ry + 4, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('(Form No. 4 — Survey Act Cap 299)', SCHEDULE_X + SCHEDULE_W / 2, ry + 9, { align: 'center' });
  ry += 13;

  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(SCHEDULE_X, ry, SCHEDULE_X + SCHEDULE_W, ry);
  ry += 4;

  const infoRows = [
    ['LR No.', project.lr_number ?? '—'],
    ['Folio No.', project.folio_number ?? '—'],
    ['Register No.', project.register_number ?? '—'],
    ['FIR No.', project.fir_number ?? '—'],
    ['Reg. Block', project.registration_block ?? '—'],
    ['Reg. District', project.registration_district ?? '—'],
    ['Locality', project.locality ?? '—'],
    ['Computations No.', project.computations_no ?? '—'],
    ['Field Book No.', project.field_book_no ?? '—'],
    ['File Reference', project.file_reference ?? '—'],
    ['Client', project.client_name ?? '—'],
  ].filter(([, v]) => v !== '—') as [string, string][];

  autoTable(doc, {
    startY: ry,
    head: [['Field', 'Value']],
    body: infoRows,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255, fontSize: 7 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 1: { cellWidth: SCHEDULE_W - 34 } },
    margin: { left: SCHEDULE_X, right: MARGIN },
    tableWidth: SCHEDULE_W,
    theme: 'grid',
  });

  ry = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text('AREA', SCHEDULE_X, ry);
  ry += 4;

  autoTable(doc, {
    startY: ry,
    body: [
      ['Area (m²)', geom.areaM2.toFixed(2)],
      ['Area (Ha)', geom.areaHa.toFixed(4)],
      ['Area (Acres)', geom.areaAcres.toFixed(4)],
    ],
    styles: { fontSize: 7, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 1: { cellWidth: SCHEDULE_W - 34 } },
    margin: { left: SCHEDULE_X, right: MARGIN },
    tableWidth: SCHEDULE_W,
    theme: 'grid',
  });

  ry = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text('BEARING & DISTANCE SCHEDULE', SCHEDULE_X, ry);
  ry += 4;

  const bearingBody = geom.bearingSchedule.map((l: any) => [l.from, l.to, l.bearing, l.distance]);

  autoTable(doc, {
    startY: ry,
    head: [['From', 'To', 'Bearing', 'Distance (m)']] as unknown as (string | number)[][],
    body: bearingBody as (string | number)[][],
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 14 }, 2: { cellWidth: 28 }, 3: { cellWidth: SCHEDULE_W - 58 } },
    margin: { left: SCHEDULE_X, right: MARGIN },
    tableWidth: SCHEDULE_W,
    theme: 'grid',
  });

  ry = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text('COORDINATE SCHEDULE', SCHEDULE_X, ry);
  ry += 4;

  autoTable(doc, {
    startY: ry,
    head: [['Stn', 'Easting (m)', 'Northing (m)', 'Beacon No.']] as unknown as (string | number)[][],
    body: geom.stations.map((s: any) => [s.station, s.easting.toFixed(3), s.northing.toFixed(3), s.beaconNo ?? '—']) as unknown as (string | number)[][],
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 80, 100], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 24 }, 2: { cellWidth: 24 }, 3: { cellWidth: SCHEDULE_W - 62 } },
    margin: { left: SCHEDULE_X, right: MARGIN },
    tableWidth: SCHEDULE_W,
    theme: 'grid',
  });

  ry = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text('TRAVERSE ACCURACY', SCHEDULE_X, ry);
  ry += 4;

  const statusColor: [number, number, number] = geom.closureStatus === 'PASS' ? [0, 120, 60] : [180, 0, 0];

  autoTable(doc, {
    startY: ry,
    body: [
      ['Precision ratio', geom.precisionRatio],
      ['Linear misclosure', `${geom.misclosureMm.toFixed(1)} mm`],
      ['Status', geom.closureStatus],
      ['Min. standard', '1:5000 (Survey Act Cap 299)'],
    ],
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 32 }, 1: { cellWidth: SCHEDULE_W - 34 } },
    margin: { left: SCHEDULE_X, right: MARGIN },
    tableWidth: SCHEDULE_W,
    theme: 'grid',
    didParseCell: (data) => {
      if (data.row.index === 2 && data.column.index === 1) {
        data.cell.styles.textColor = statusColor;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  ry = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  const certY = ry;
  const certH = A3_H - MARGIN - 2 - certY;

  doc.setDrawColor(30, 80, 100);
  doc.setLineWidth(0.4);
  doc.rect(SCHEDULE_X, certY, SCHEDULE_W, certH);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 80, 100);
  doc.text("SURVEYOR'S CERTIFICATE", SCHEDULE_X + SCHEDULE_W / 2, certY + 4, { align: 'center' });

  const iskNo = profile?.isk_number ?? '___________';
  const survName = profile?.full_name ?? '___________________________';
  const firm = profile?.firm_name ?? '___________________________';

  const certText = [
    `I, ${survName},`,
    `Licensed Surveyor No. ${iskNo},`,
    `${firm},`,
    'hereby certify that this plan was prepared',
    'by me and that the survey was carried out',
    'in accordance with the Survey Act Cap 299',
    'and Kenya Survey Regulations 1994.',
    '',
    `Survey date: ${surveyDate}`,
    `Scale: 1:${scaleRatio.toLocaleString()}`,
    `Datum: Arc 1960 / UTM Zone ${project.utm_zone ?? ''}${project.hemisphere ?? ''}`,
  ];

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);

  let lineY = certY + 10;
  certText.forEach((line) => {
    doc.text(line, SCHEDULE_X + 3, lineY);
    lineY += 4;
  });

  const sigY = certY + certH - 10;
  doc.setLineWidth(0.2);
  doc.setDrawColor(0);
  doc.line(SCHEDULE_X + 3, sigY, SCHEDULE_X + SCHEDULE_W - 3, sigY);
  doc.setFontSize(6);
  doc.setTextColor(80);
  doc.text('Signature / Date', SCHEDULE_X + 3, sigY + 3.5);

  addPageFooter(doc, 1, 1, project.name ?? '');

  return Buffer.from(doc.output('arraybuffer'));
}

