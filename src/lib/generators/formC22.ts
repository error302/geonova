import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPageFooter } from './pdfTitleBlock';
import { shoelaceArea as computePolygonArea } from '@/lib/engine/area';

// ---------------------------------------------------------------------------
// Input interface
// ---------------------------------------------------------------------------

export interface FormC22Input {
  projectName: string;
  lrNumber: string;
  parcelNumber: string;
  county: string;
  division: string;
  district: string;
  locality: string;
  surveyType: string;
  surveyorName: string;
  iskNumber: string;
  firmName: string;
  referenceNumber: string;
  revision: string;
  stations: Array<{
    label: string;
    observedBearing: number; // degrees
    observedDistance: number; // metres
    easting: number;
    northing: number;
    adjustedEasting: number;
    adjustedNorthing: number;
    departureRaw: number;
    latitudeRaw: number;
    departureCorrection: number;
    latitudeCorrection: number;
  }>;
  angularMisclosureSec: number;
  angularToleranceSec: number;
  linearMisclosureM: number;
  perimeterM: number;
  precisionRatio: number;
  areaM2: number;
  areaHa: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert decimal degrees to DMS string e.g. 45°30'15.2" */
function decimalToDMS(deg: number): string {
  const absolute = Math.abs(deg);
  const d = Math.floor(absolute);
  const minFloat = (absolute - d) * 60;
  const m = Math.floor(minFloat);
  const s = (minFloat - m) * 60;
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(1)}"`;
}

/** Convert decimal degrees to WCB (Whole Circle Bearing) quadrant string e.g. N 45°30'15.2" E */
function decimalToWCB(deg: number): string {
  const normalised = ((deg % 360) + 360) % 360;
  if (normalised <= 90) {
    return `N ${decimalToDMS(normalised)} E`;
  } else if (normalised <= 180) {
    return `S ${decimalToDMS(180 - normalised)} E`;
  } else if (normalised <= 270) {
    return `S ${decimalToDMS(normalised - 180)} W`;
  } else {
    return `N ${decimalToDMS(360 - normalised)} W`;
  }
}

// computeShoelaceArea removed — now uses canonical shoelaceArea from @/lib/engine/area
// Call sites map adjustedEasting/adjustedNorthing → easting/northing.

/** Format a precision ratio like "1:12500" */
function formatPrecisionRatio(ratio: number): string {
  if (ratio <= 0 || !isFinite(ratio)) return '—';
  return `1:${Math.round(ratio).toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Page dimensions — A3 landscape
// ---------------------------------------------------------------------------

const PAGE_W = 420;
const PAGE_H = 297;
const MARGIN = 10;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateFormC22Pdf(input: FormC22Input): Buffer {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
  });

  const today = new Date().toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Track pages for numbering — we add footer at the end for all pages
  let currentPage = 1;
  const totalPages = estimateTotalPages(input.stations.length);

  // =========================================================================
  // PAGE 1 — Header + Info + Tables 1 & 2
  // =========================================================================
  drawPageHeader(doc, input, today);
  drawProjectInfoBlock(doc, input, today);
  drawSurveyorInfoBlock(doc, input);

  let y = 56;

  // --- Table 1: Observed Bearings and Distances ---
  y = drawObservedBearingsTable(doc, input, y);
  y += 4;

  // --- Table 2: Traverse Adjustment ---
  y = drawTraverseAdjustmentTable(doc, input, y);
  y += 4;

  // Check if we need a new page for Table 3 & 4
  if (y > PAGE_H - 100) {
    addPageFooter(doc, currentPage, totalPages, input.projectName);
    doc.addPage();
    currentPage++;
    y = MARGIN;
  }

  // --- Table 3: Area Computation ---
  y = drawAreaComputationTable(doc, input, y);
  y += 4;

  // --- Table 4: Closure Summary ---
  y = drawClosureSummaryTable(doc, input, y);
  y += 6;

  // Check if we need a new page for certificate
  if (y > PAGE_H - 70) {
    addPageFooter(doc, currentPage, totalPages, input.projectName);
    doc.addPage();
    currentPage++;
    y = MARGIN;
  }

  // --- Surveyor's Certificate ---
  drawSurveyorCertificate(doc, input, y, today);

  // --- Professional Disclaimer ---
  drawDisclaimer(doc);

  // Finalize page footers on all pages
  const actualTotal = doc.getNumberOfPages();
  for (let p = 1; p <= actualTotal; p++) {
    doc.setPage(p);
    // Remove any previously drawn footer on this page by overwriting with white
    // Actually, addPageFooter draws a line + text; we just call it for every page
    addPageFooter(doc, p, actualTotal, input.projectName);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ---------------------------------------------------------------------------
// Estimate page count
// ---------------------------------------------------------------------------

function estimateTotalPages(stationCount: number): number {
  // Rough heuristic: up to ~15 stations fit on 1 page, more needs 2
  if (stationCount <= 15) return 1;
  if (stationCount <= 30) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// Draw the Republic of Kenya / DoLS header
// ---------------------------------------------------------------------------

function drawPageHeader(doc: jsPDF, _input: FormC22Input, _today: string): void {
  const cx = PAGE_W / 2;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.0);
  doc.rect(MARGIN, MARGIN, CONTENT_W, 36);

  // Double border effect
  doc.setLineWidth(0.3);
  doc.rect(MARGIN + 1.5, MARGIN + 1.5, CONTENT_W - 3, 33);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('REPUBLIC OF KENYA', cx, MARGIN + 10, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.text('DEPARTMENT OF LAND SERVICES', cx, MARGIN + 17, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('FORM NO. C22 — COMPUTATION SHEET', cx, MARGIN + 26, { align: 'center' });

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(80, 80, 80);
  doc.text(
    'Survey Act Cap 299 — Survey Regulations 1994 — Arc 1960 / UTM Zone 37S (EPSG:21037)',
    cx,
    MARGIN + 33,
    { align: 'center' }
  );
}

// ---------------------------------------------------------------------------
// Draw project information block (left column)
// ---------------------------------------------------------------------------

function drawProjectInfoBlock(doc: jsPDF, input: FormC22Input, today: string): void {
  const x = MARGIN;
  const y = 50;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('PROJECT INFORMATION', x, y);

  const fields: [string, string][] = [
    ['LR Number', input.lrNumber || '—'],
    ['Parcel Number', input.parcelNumber || '—'],
    ['County', input.county || '—'],
    ['Division', input.division || '—'],
    ['District', input.district || '—'],
    ['Locality', input.locality || '—'],
    ['Survey Type', input.surveyType || '—'],
    ['Reference No.', input.referenceNumber || '—'],
    ['Revision', input.revision || '—'],
    ['Date', today],
  ];

  autoTable(doc, {
    startY: y + 2,
    head: [['Field', 'Value']] as unknown as (string | number)[][],
    body: fields as unknown as (string | number)[][],
    styles: { fontSize: 6.5, cellPadding: 1 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 6.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32 },
      1: { cellWidth: 80 },
    },
    margin: { left: x },
    tableWidth: 112,
    theme: 'grid',
  });
}

// ---------------------------------------------------------------------------
// Draw surveyor information block (right column, beside project info)
// ---------------------------------------------------------------------------

function drawSurveyorInfoBlock(doc: jsPDF, input: FormC22Input): void {
  const x = MARGIN + 120;
  const y = 50;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('SURVEYOR INFORMATION', x, y);

  const fields: [string, string][] = [
    ['Surveyor Name', input.surveyorName || '—'],
    ['ISK Number', input.iskNumber || '—'],
    ['Firm', input.firmName || '—'],
    ['Datum', 'Arc 1960 / UTM Zone 37S'],
    ['EPSG', '21037'],
  ];

  autoTable(doc, {
    startY: y + 2,
    head: [['Field', 'Value']] as unknown as (string | number)[][],
    body: fields as unknown as (string | number)[][],
    styles: { fontSize: 6.5, cellPadding: 1 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 6.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32 },
      1: { cellWidth: 80 },
    },
    margin: { left: x },
    tableWidth: 112,
    theme: 'grid',
  });
}

// ---------------------------------------------------------------------------
// Table 1: Observed Bearings and Distances
// ---------------------------------------------------------------------------

function drawObservedBearingsTable(doc: jsPDF, input: FormC22Input, startY: number): number {
  const x = MARGIN;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TABLE 1: OBSERVED BEARINGS AND DISTANCES', x, startY);
  startY += 2;

  const stations = input.stations;
  const body: (string | number)[][] = [];

  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    const next = stations[(i + 1) % stations.length];

    // Reduced bearing (WCB) from coordinates
    const dE = next.adjustedEasting - st.adjustedEasting;
    const dN = next.adjustedNorthing - st.adjustedNorthing;
    const reducedBearing = ((Math.atan2(dE, dN) * 180) / Math.PI + 360) % 360;
    const reducedDistance = Math.sqrt(dE * dE + dN * dN);

    body.push([
      st.label,
      next.label,
      decimalToDMS(st.observedBearing),
      st.observedDistance.toFixed(3),
      decimalToWCB(reducedBearing),
      reducedDistance.toFixed(3),
    ]);
  }

  autoTable(doc, {
    startY,
    head: [
      [
        'Stn From',
        'Stn To',
        'Observed Bearing',
        'Obs Dist (m)',
        'Reduced Bearing (WCB)',
        'Reduced Dist (m)',
      ],
    ] as unknown as (string | number)[][],
    body: body as (string | number)[][],
    styles: { fontSize: 6, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 5.5 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 40, halign: 'center', font: 'courier' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 48, halign: 'center', font: 'courier' },
      5: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: x, right: MARGIN },
    tableWidth: CONTENT_W,
    theme: 'grid',
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

// ---------------------------------------------------------------------------
// Table 2: Traverse Adjustment
// ---------------------------------------------------------------------------

function drawTraverseAdjustmentTable(doc: jsPDF, input: FormC22Input, startY: number): number {
  const x = MARGIN;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TABLE 2: TRAVERSE ADJUSTMENT', x, startY);
  startY += 2;

  const stations = input.stations;
  const body: (string | number)[][] = stations.map((st) => [
    st.label,
    st.departureRaw.toFixed(4),
    st.latitudeRaw.toFixed(4),
    st.departureCorrection.toFixed(4),
    st.latitudeCorrection.toFixed(4),
    st.adjustedEasting.toFixed(3),
    st.adjustedNorthing.toFixed(3),
  ]);

  // Sums row
  const sumDepRaw = stations.reduce((s, st) => s + st.departureRaw, 0);
  const sumLatRaw = stations.reduce((s, st) => s + st.latitudeRaw, 0);
  const sumCorrE = stations.reduce((s, st) => s + st.departureCorrection, 0);
  const sumCorrN = stations.reduce((s, st) => s + st.latitudeCorrection, 0);

  autoTable(doc, {
    startY,
    head: [
      [
        'Station',
        'Departure\nRaw (m)',
        'Latitude\nRaw (m)',
        'Correction\nE (m)',
        'Correction\nN (m)',
        'Adjusted\nEasting (m)',
        'Adjusted\nNorthing (m)',
      ],
    ] as unknown as (string | number)[][],
    body: body as (string | number)[][],
    foot: [
      [
        'Σ',
        sumDepRaw.toFixed(4),
        sumLatRaw.toFixed(4),
        sumCorrE.toFixed(4),
        sumCorrN.toFixed(4),
        '',
        '',
      ],
    ] as (string | number)[][],
    styles: { fontSize: 6, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 5.5 },
    footStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', fontSize: 6 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 32, halign: 'right' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 32, halign: 'right' },
      6: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: x, right: MARGIN },
    tableWidth: CONTENT_W,
    theme: 'grid',
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

// ---------------------------------------------------------------------------
// Table 3: Area Computation (Shoelace)
// ---------------------------------------------------------------------------

function drawAreaComputationTable(doc: jsPDF, input: FormC22Input, startY: number): number {
  const x = MARGIN;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TABLE 3: AREA COMPUTATION (Shoelace Formula)', x, startY);
  startY += 2;

  const stations = input.stations;
  const body: (string | number)[][] = [];

  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    const next = stations[(i + 1) % stations.length];
    const eTimesNextN = st.adjustedEasting * next.adjustedNorthing;
    const nTimesNextE = st.adjustedNorthing * next.adjustedEasting;

    body.push([
      st.label,
      st.adjustedEasting.toFixed(3),
      st.adjustedNorthing.toFixed(3),
      eTimesNextN.toFixed(3),
      nTimesNextE.toFixed(3),
    ]);
  }

  const shoelaceArea = computePolygonArea(stations.map(s => ({ easting: s.adjustedEasting, northing: s.adjustedNorthing })));

  autoTable(doc, {
    startY,
    head: [
      ['Station', 'E (m)', 'N (m)', 'E × N(next)', 'N × E(next)'],
    ] as unknown as (string | number)[][],
    body: body as (string | number)[][],
    foot: [
      [
        'Σ / 2',
        '',
        '',
        stations
          .reduce((s, st, i) => s + st.adjustedEasting * stations[(i + 1) % stations.length].adjustedNorthing, 0)
          .toFixed(3),
        stations
          .reduce((s, st, i) => s + st.adjustedNorthing * stations[(i + 1) % stations.length].adjustedEasting, 0)
          .toFixed(3),
      ],
    ] as (string | number)[][],
    styles: { fontSize: 6, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 6 },
    footStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold', fontSize: 6 },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 48, halign: 'right' },
      4: { cellWidth: 48, halign: 'right' },
    },
    margin: { left: x, right: MARGIN },
    tableWidth: CONTENT_W,
    theme: 'grid',
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;

  // Area result line
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 80, 40);
  doc.text(
    `Computed Area = ${shoelaceArea.toFixed(2)} m²  =  ${(shoelaceArea / 10000).toFixed(4)} Ha`,
    x + 2,
    y
  );
  doc.setTextColor(0, 0, 0);

  y += 2;
  return y;
}

// ---------------------------------------------------------------------------
// Table 4: Closure Summary
// ---------------------------------------------------------------------------

function drawClosureSummaryTable(doc: jsPDF, input: FormC22Input, startY: number): number {
  const x = MARGIN;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TABLE 4: CLOSURE SUMMARY', x, startY);
  startY += 2;

  const angularPass = Math.abs(input.angularMisclosureSec) <= input.angularToleranceSec;
  const linearPass = input.precisionRatio >= 5000;
  const overallPass = angularPass && linearPass;

  const precisionStr = formatPrecisionRatio(input.precisionRatio);
  const statusStr = overallPass ? 'PASS' : 'FAIL';
  const statusColor: [number, number, number] = overallPass ? [0, 120, 60] : [180, 0, 0];

  const body: (string | number)[][] = [
    ['Angular Misclosure', `${input.angularMisclosureSec.toFixed(1)}″`],
    ['Angular Tolerance', `${input.angularToleranceSec.toFixed(1)}″`],
    ['Angular Status', angularPass ? 'PASS' : 'FAIL'],
    ['Linear Misclosure', `${input.linearMisclosureM.toFixed(4)} m`],
    ['Perimeter', `${input.perimeterM.toFixed(3)} m`],
    ['Precision Ratio', precisionStr],
    ['Minimum Standard (Cap 299)', '1:5,000'],
    ['Overall Status', statusStr],
    ['Area (m²)', input.areaM2.toFixed(2)],
    ['Area (Ha)', input.areaHa.toFixed(4)],
  ];

  autoTable(doc, {
    startY,
    head: [['Parameter', 'Value']] as unknown as (string | number)[][],
    body: body as (string | number)[][],
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255, fontSize: 6.5 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 60 },
    },
    margin: { left: x },
    tableWidth: 120,
    theme: 'grid',
    didParseCell: (data) => {
      // Colour the status cells
      if (data.section === 'body') {
        const rowIdx = data.row.index;
        const colIdx = data.column.index;
        if (colIdx === 1) {
          if (rowIdx === 2) {
            // Angular Status
            data.cell.styles.textColor = angularPass ? [0, 120, 60] : [180, 0, 0];
            data.cell.styles.fontStyle = 'bold';
          }
          if (rowIdx === 7) {
            // Overall Status
            data.cell.styles.textColor = statusColor;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    },
  });

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

// ---------------------------------------------------------------------------
// Surveyor's Certificate block
// ---------------------------------------------------------------------------

function drawSurveyorCertificate(
  doc: jsPDF,
  input: FormC22Input,
  startY: number,
  today: string
): void {
  const x = MARGIN;
  const certH = 52;
  const certW = CONTENT_W;

  // Outer box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.rect(x, startY, certW, certH);

  // Inner border
  doc.setLineWidth(0.2);
  doc.rect(x + 1, startY + 1, certW - 2, certH - 2);

  // Title
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text("SURVEYOR'S CERTIFICATE", x + certW / 2, startY + 6, { align: 'center' });

  // Certificate text — per Survey Regulations 1994, Regulation 3(2)
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);

  const lines = [
    `I, ${input.surveyorName || '___________________________'}, Licensed Surveyor No. ${input.iskNumber || '___________'},`,
    `of ${input.firmName || '___________________________'}, hereby certify that the computations set out`,
    `in this document were carried out by me (or under my immediate direction and control)`,
    `in accordance with the Survey Act Cap 299 and the Survey Regulations 1994,`,
    `Regulation 3(2), and that to the best of my knowledge and belief the same are correct.`,
    '',
    `Datum: Arc 1960 / UTM Zone 37S (EPSG:21037)`,
    `Date: ${today}`,
  ];

  let lineY = startY + 12;
  for (const line of lines) {
    doc.text(line, x + 4, lineY);
    lineY += 3.5;
  }

  // Signature line
  const sigY = startY + certH - 6;
  doc.setLineWidth(0.3);
  doc.setDrawColor(0);
  doc.line(x + 4, sigY, x + certW / 2 - 4, sigY);
  doc.text('Signature / Date', x + 4, sigY + 3);

  // Stamp area
  doc.setDrawColor(120);
  doc.setLineWidth(0.2);
  doc.rect(x + certW / 2 + 10, sigY - 12, 30, 12);
  doc.setFontSize(5);
  doc.setTextColor(120, 120, 120);
  doc.text('Official Stamp', x + certW / 2 + 15, sigY - 5);
}

// ---------------------------------------------------------------------------
// Professional Disclaimer
// ---------------------------------------------------------------------------

function drawDisclaimer(doc: jsPDF): void {
  const y = PAGE_H - MARGIN - 16;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(140, 60, 60);
  doc.text(
    'This document was generated by METARDU, a computation tool. All values must be independently verified by a licensed surveyor.',
    PAGE_W / 2,
    y + 3,
    { align: 'center' }
  );

  doc.setFontSize(5);
  doc.setTextColor(160, 160, 160);
  doc.text(
    'Survey Act Cap 299 · Survey Regulations 1994 · Arc 1960 / UTM Zone 37S (EPSG:21037) · Form No. C22',
    PAGE_W / 2,
    y + 7,
    { align: 'center' }
  );
}
