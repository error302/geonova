import { createHash } from 'crypto';
import { jsPDF } from 'jspdf';
import { DeedPlanGeometry } from './deedPlanGeometry';
import { getRoadReserveWidth } from '../reports/surveyPlan/types';

interface PanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Road segment descriptor for truncation line rendering */
export interface RoadSegment {
  /** Index of the boundary segment that abuts a road */
  segmentIndex: number;
  /** From point (easting, northing) */
  from: { easting: number; northing: number };
  /** To point (easting, northing) */
  to: { easting: number; northing: number };
}

/** Revision entry for the revision history table */
export interface RevisionEntry {
  rev: string;
  date: string;
  description: string;
  by: string;
}

/** Extended options for the boundary plan renderer */
export interface BoundaryPlanOptions {
  /** Road segments that abut the parcel — used for truncation lines */
  roadSegments?: RoadSegment[];
  /** Surveyor name for stamp area */
  surveyorName?: string;
  /** Surveyor licence number */
  surveyorLicence?: string;
  /** ISK registration number */
  iskRegNo?: string;
  /** Firm name */
  firmName?: string;
  /** Revision entries for history table */
  revisions?: RevisionEntry[];
  /** Road classification code (e.g. 'A', 'K', 'P') for road reserve width */
  roadClass?: string;
}

const MONUMENT_SIZE = 2.5;

function drawMonumentSymbol(doc: jsPDF, px: number, py: number, type: string) {
  const s = MONUMENT_SIZE;
  doc.setLineWidth(0.3);

  switch (type?.toLowerCase()) {
    case 'psc found':
      doc.setDrawColor(0);
      doc.circle(px, py, s, 'S');
      doc.setFillColor(0, 0, 0);
      doc.circle(px, py, 0.5, 'F');
      break;
    case 'psc set':
      doc.setFillColor(0, 0, 0);
      doc.circle(px, py, s, 'F');
      break;
    case 'ssc':
      doc.setDrawColor(0);
      doc.rect(px - s, py - s, s * 2, s * 2, 'S');
      break;
    case 'masonry nail':
      doc.setDrawColor(0);
      doc.line(px - s, py, px + s, py);
      doc.line(px, py - s, px, py + s);
      break;
    case 'indicatory':
      doc.setDrawColor(0);
      doc.lines([[s * 2, 0], [-s, s * 1.5], [-s, -s * 1.5]], px - s, py, [1, 1], 'S', true);
      break;
    case 'bm':
      doc.setDrawColor(0, 80, 160);
      doc.lines([[s, s], [s, -s], [-s, -s], [-s, s]], px, py - s, [1, 1], 'S', true);
      break;
    default:
      doc.setDrawColor(100);
      doc.circle(px, py, s * 0.8, 'S');
  }
}

function drawNorthArrow(doc: jsPDF, cx: number, cy: number) {
  const h = 10;
  const w = 3;
  doc.setFillColor(0, 0, 0);
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.lines([[w, h / 2], [-w * 2, 0], [w, -h / 2]], cx - w / 2, cy + h / 2, [1, 1], 'F', true);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('N', cx, cy - h / 2 - 1.5, { align: 'center' });
}

/**
 * Draw a decorative compass rose with GN/TN/MN bearings.
 * ponytail: added per audit — real deed plans have a compass rose
 * showing Grid North, True North, and Magnetic North bearings.
 */
function drawCompassRose(doc: jsPDF, cx: number, cy: number, radius: number = 8) {
  // Outer circle
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.circle(cx, cy, radius, 'S');

  // Inner circle
  doc.circle(cx, cy, radius * 0.7, 'S');

  // North arrow (filled triangle)
  doc.setFillColor(0, 0, 0);
  doc.lines([[1.5, radius * 0.6], [-3, 0], [1.5, -radius * 0.6]], cx - 1.5, cy - radius * 0.3, [1, 1], 'F', true);

  // South arrow (outline)
  doc.lines([[1.5, -radius * 0.6], [-3, 0], [1.5, radius * 0.6]], cx - 1.5, cy + radius * 0.3, [1, 1], 'S', true);

  // Labels
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text('N', cx, cy - radius - 1, { align: 'center' });
  doc.text('S', cx, cy + radius + 3, { align: 'center' });

  // GN / TN / MN labels (ponytail: simplified — only GN shown by default)
  doc.setFontSize(4);
  doc.setFont('helvetica', 'normal');
  doc.text('GN', cx + radius * 0.8, cy - 1, { align: 'left' });
}

function drawScaleBar(doc: jsPDF, x: number, y: number, scaleRatio: number, barLengthMm: number) {
  const groundDist = (barLengthMm * scaleRatio) / 1000;
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.rect(x, y, barLengthMm, 2);
  const half = barLengthMm / 2;
  doc.setFillColor(0, 0, 0);
  doc.rect(x, y, half, 2, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(x + half, y, half, 2, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text('0', x, y + 4.5, { align: 'center' });
  doc.text(`${(groundDist / 2).toFixed(0)} m`, x + half, y + 4.5, { align: 'center' });
  doc.text(`${groundDist.toFixed(0)} m`, x + barLengthMm, y + 4.5, { align: 'center' });
  doc.text(`Scale 1:${scaleRatio.toLocaleString()}`, x + barLengthMm / 2, y + 7.5, { align: 'center' });
}

/**
 * Draw road truncation lines (perpendicular tick marks) on boundary
 * segments that abut roads, with road width annotation.
 * Per Kenya cadastral practice, road boundaries are shown with short
 * perpendicular tick marks at regular intervals. Road reserve width
 * is shown as a text annotation along the road segment.
 * Source: Survey Act Cap. 299, Form No. 3 & 4
 */
function drawRoadTruncationLines(
  doc: jsPDF,
  roadSegments: RoadSegment[],
  worldToMm: (e: number, n: number) => [number, number],
  scaleRatio: number,
  centroidX: number,
  centroidY: number,
  roadWidth?: number
): void {
  if (!roadSegments || roadSegments.length === 0) return;

  // Convert centroid to mm for direction checking
  const [cmmX, cmmY] = worldToMm(centroidX, centroidY);

  for (const seg of roadSegments) {
    const [x1, y1] = worldToMm(seg.from.easting, seg.from.northing);
    const [x2, y2] = worldToMm(seg.to.easting, seg.to.northing);

    const dxMm = x2 - x1;
    const dyMm = y2 - y1;
    const segLenMm = Math.sqrt(dxMm * dxMm + dyMm * dyMm);
    if (segLenMm < 1) continue;

    // Perpendicular direction
    let perpX = -dyMm / segLenMm;
    let perpY = dxMm / segLenMm;

    // Ensure perpendicular points AWAY from centroid
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const toMidX = midX - cmmX;
    const toMidY = midY - cmmY;
    if (perpX * toMidX + perpY * toMidY < 0) {
      perpX = -perpX;
      perpY = -perpY;
    }

    const tickSpacing = 5; // mm
    const tickLength = 3;  // mm
    const numTicks = Math.max(2, Math.floor(segLenMm / tickSpacing));

    doc.setDrawColor(0);
    doc.setLineWidth(0.2);

    for (let t = 1; t < numTicks; t++) {
      const frac = t / numTicks;
      const baseX = x1 + dxMm * frac;
      const baseY = y1 + dyMm * frac;
      const endX = baseX + perpX * tickLength;
      const endY = baseY + perpY * tickLength;

      doc.line(baseX, baseY, endX, endY);
    }

    // Road width annotation text next to truncation tick marks
    if (roadWidth && roadWidth > 0) {
      const labelOffset = tickLength + 1.5; // Place text just beyond tick ends
      const labelX = midX + perpX * labelOffset;
      const labelY = midY + perpY * labelOffset;
      const widthLabel = `${roadWidth.toFixed(2)}m`;

      // Rotate label to align with road segment direction
      const angle = Math.atan2(dyMm, dxMm) * (180 / Math.PI);
      const textAngle = -(angle > 90 || angle < -90 ? angle + 180 : angle);

      doc.setFontSize(4.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100);
      doc.text(widthLabel, labelX, labelY, { angle: textAngle, align: 'center' });
    }
  }
}

/**
 * Draw stamp and seal area in the bottom-left of the boundary plan panel.
 * Includes ISK rubber stamp placeholder and surveyor's corporate seal circle.
 */
function drawStampAndSealArea(
  doc: jsPDF,
  panel: PanelBounds,
  options: BoundaryPlanOptions
): void {
  const margin = 8;
  const stampX = panel.x + margin;
  const stampY = panel.y + panel.height - margin - 28;
  const stampW = 50;
  const stampH = 24;

  // Outer rectangle
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(stampX, stampY, stampW, stampH);

  // Header
  doc.setFontSize(3.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('STAMP & SEAL AREA', stampX + stampW / 2, stampY + 2.5, { align: 'center' });

  doc.setLineWidth(0.15);
  doc.line(stampX, stampY + 3.5, stampX + stampW, stampY + 3.5);

  // Left: ISK rubber stamp placeholder
  const iskX = stampX + 1;
  const iskY = stampY + 5;
  const iskW = 28;
  const iskH = 12;

  doc.setDrawColor(150);
  doc.setLineDashPattern([1.5, 0.75], 0);
  doc.rect(iskX, iskY, iskW, iskH);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(2.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(170);
  doc.text('ISK ASSOCIATION', iskX + iskW / 2, iskY + 4, { align: 'center' });
  doc.text('RUBBER STAMP', iskX + iskW / 2, iskY + 6.5, { align: 'center' });

  if (options.firmName) {
    doc.setFontSize(2);
    doc.setTextColor(190);
    doc.text(options.firmName, iskX + iskW / 2, iskY + 9, { align: 'center' });
  }

  doc.setFontSize(2);
  doc.setTextColor(200);
  doc.text('Approved: ____________', iskX + iskW / 2, iskY + 11, { align: 'center' });

  // Right: Surveyor's seal circle
  const sealCX = stampX + stampW - 10;
  const sealCY = iskY + iskH / 2;

  doc.setDrawColor(180);
  doc.setLineDashPattern([1, 0.5], 0);
  doc.circle(sealCX, sealCY, 4);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(2.5);
  doc.setTextColor(170);
  doc.text('SURVEYOR', sealCX, sealCY - 1, { align: 'center' });
  doc.text('SEAL', sealCX, sealCY + 2, { align: 'center' });

  // Surveyor credentials below stamp area
  const credY = stampY + 18.5;

  // Signature line above surveyor credentials
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(stampX + 1, credY - 2, stampX + stampW - 1, credY - 2);

  doc.setFontSize(3);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  if (options.surveyorName) {
    doc.text(options.surveyorName, stampX + 1, credY);
  }
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  if (options.surveyorLicence) {
    doc.text(`LS/${options.surveyorLicence}`, stampX + 1, credY + 2.5);
  }
  if (options.iskRegNo) {
    doc.text(`ISK Reg. ${options.iskRegNo}`, stampX + 1, credY + 5);
  }

  // Date line below surveyor credentials
  doc.setTextColor(100);
  doc.text('Date: ___________', stampX + 1, credY + 7.5);
}

/**
 * Draw print verification text at the bottom of the boundary plan panel.
 * Uses SHA-256 cryptographic hash for production-grade verification.
 */
function drawPrintVerification(
  doc: jsPDF,
  panel: PanelBounds,
  geom: DeedPlanGeometry,
  scaleRatio: number,
  options?: BoundaryPlanOptions
): void {
  const coordString = geom.stations
    .map(s => `${s.easting.toFixed(4)},${s.northing.toFixed(4)}`)
    .join('|');
  const areaVal = geom.areaM2.toFixed(4);
  const dateStr = new Date().toISOString().split('T')[0];
  const surveyorLicence = options?.surveyorLicence || '';
  const revisionsCount = (options?.revisions || []).length;

  // SHA-256 cryptographic hash
  const rawString = `${coordString}|${areaVal}|${scaleRatio}|${dateStr}|${surveyorLicence}|${revisionsCount}`;
  const verCode = createHash('sha256').update(rawString).digest('hex').toUpperCase().slice(0, 16);

  const verifyX = panel.x + panel.width / 2;
  const verifyY = panel.y + panel.height - 1;

  doc.setFontSize(3);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160);
  doc.text(
    `Verification: ${verCode} | Generated: ${dateStr} | Scale: 1:${scaleRatio}`,
    verifyX,
    verifyY,
    { align: 'center' }
  );
  doc.setFontSize(2.2);
  doc.setTextColor(190);
  doc.text(
    'Alteration invalidates verification — Per Survey Act Cap. 299, Sec. 23',
    verifyX,
    verifyY + 1.5,
    { align: 'center' }
  );
}

export function renderBoundaryPlan(
  doc: jsPDF,
  geom: DeedPlanGeometry,
  panel: PanelBounds,
  options?: BoundaryPlanOptions
) {
  const margin = 8;
  const drawX = panel.x + margin;
  const drawY = panel.y + margin;
  const drawW = panel.width - margin * 2;
  const drawH = panel.height - margin * 2 - 20;

  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.5);
  doc.rect(panel.x, panel.y, panel.width, panel.height);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('SURVEY PLAN', panel.x + panel.width / 2, panel.y + 5, { align: 'center' });

  const spanE = geom.maxE - geom.minE || 1;
  const spanN = geom.maxN - geom.minN || 1;

  const scaleFromE = spanE / (drawW / 1000);
  const scaleFromN = spanN / (drawH / 1000);
  const rawScale = Math.max(scaleFromE, scaleFromN) * 1.15;

  const standardScales = [100, 200, 250, 500, 1000, 1250, 2000, 2500, 5000];
  const scaleRatio = standardScales.find((s) => s >= rawScale) ?? 10000

  const centreE = (geom.minE + geom.maxE) / 2;
  const centreN = (geom.minN + geom.maxN) / 2;

  const worldToMm = (e: number, n: number): [number, number] => {
    const px = drawX + drawW / 2 + ((e - centreE) / scaleRatio) * 1000;
    const py = drawY + drawH / 2 - ((n - centreN) / scaleRatio) * 1000;
    return [px, py];
  };

  const pts = geom.stations.map((s) => worldToMm(s.easting, s.northing))

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);

  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    doc.line(x1, y1, x2, y2);

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const leg = geom.bearingSchedule[i];
    if (leg) {
      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 60, 120);
      doc.text(
        `${leg.bearing}  ${leg.distance}m`,
        mx, my,
        { angle: -(angle > 90 || angle < -90 ? angle + 180 : angle), align: 'center' }
      );
    }
  }

  geom.stations.forEach((st, i) => {
    const [px, py] = pts[i];
    drawMonumentSymbol(doc, px, py, st.monument ?? '');

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const label = st.beaconNo ? `${st.station}\n(${st.beaconNo})` : st.station;
    doc.text(label, px + MONUMENT_SIZE + 1, py - 1);
  });

  // ── Phase 2: Road truncation lines with road width annotation ──
  if (options?.roadSegments && options.roadSegments.length > 0) {
    // Compute road reserve width from road class
    const roadWidth = options.roadClass ? getRoadReserveWidth(options.roadClass) : undefined;
    drawRoadTruncationLines(doc, options.roadSegments, worldToMm, scaleRatio, centreE, centreN, roadWidth);
  }

  drawNorthArrow(doc, panel.x + margin + 8, panel.y + panel.height - 20);

  // ponytail: draw compass rose at top-right corner of the plan panel
  drawCompassRose(doc, panel.x + panel.width - margin - 10, panel.y + margin + 10);

  // ponytail: draw adjoining properties labels (if provided in options)
  if ((options as Record<string, unknown>)?.adjoiningProperties) {
    const adjoining = (options as Record<string, unknown>).adjoiningProperties as Array<{ fromStation: string; toStation: string; lrNumber: string }>
    doc.setFontSize(5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(80, 80, 80)
    for (const adj of adjoining) {
      const from = geom.stations.find(s => s.station === adj.fromStation)
      const to = geom.stations.find(s => s.station === adj.toStation)
      if (from && to) {
        const midX = (from.easting + to.easting) / 2
        const midY = (from.northing + to.northing) / 2
        const [mx, my] = worldToMm(midX, midY)
        doc.text(`LR ${adj.lrNumber}`, mx + 2, my - 1, { align: 'left' })
      }
    }
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
  }

  const barLen = 30;
  drawScaleBar(doc, panel.x + panel.width / 2 - barLen / 2, panel.y + panel.height - 18, scaleRatio, barLen);

  // ── Phase 2: Stamp & Seal Area ──
  if (options?.surveyorName || options?.firmName) {
    drawStampAndSealArea(doc, panel, options);
  }

  // ── Phase 2: Print Verification (SHA-256) ──
  drawPrintVerification(doc, panel, geom, scaleRatio, options);

  return scaleRatio;
}

/**
 * Draw revision history table using jsPDF.
 * Per Survey Act Cap. 299, every amendment to a registered plan must
 * be recorded with a revision entry.
 */
export function drawRevisionHistory(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  revisions: RevisionEntry[],
  surveyorName?: string
): number {
  const rows = revisions.length > 0 ? revisions.slice(0, 5) : [
    { rev: 'A', date: new Date().toLocaleDateString('en-GB'), description: 'Initial issue', by: surveyorName || '' }
  ];

  const headerH = 5;
  const rowH = 4;
  const tableH = headerH + rows.length * rowH;

  // Table border
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, tableH);

  // Header
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('REVISION HISTORY', x + 2, y + 3.5);

  doc.setLineWidth(0.15);
  doc.line(x, y + headerH, x + w, y + headerH);

  // Column headers
  const colWidths = [w * 0.1, w * 0.2, w * 0.45, w * 0.25];
  let colX = x;
  const colHeaders = ['Rev', 'Date', 'Description', 'By'];
  doc.setFontSize(4.5);
  doc.setTextColor(100);
  colHeaders.forEach((h, i) => {
    doc.text(h, colX + 1, y + headerH + 3);
    colX += colWidths[i];
  });

  doc.setLineWidth(0.1);
  doc.line(x, y + headerH + 4, x + w, y + headerH + 4);

  // Data rows
  doc.setFontSize(4.5);
  doc.setTextColor(0);
  rows.forEach((row, i) => {
    const rowY = y + headerH + 4 + (i + 1) * rowH;
    if (i > 0) {
      doc.setDrawColor(200);
      doc.setLineWidth(0.05);
      doc.line(x, rowY - rowH + 1, x + w, rowY - rowH + 1);
    }
    let cx = x;
    const cells = [
      row.rev,
      row.date,
      row.description.length > 30 ? row.description.slice(0, 28) + '..' : row.description,
      row.by,
    ];
    cells.forEach((cell, ci) => {
      doc.text(String(cell), cx + 1, rowY - 1);
      cx += colWidths[ci];
    });
  });

  return tableH;
}
