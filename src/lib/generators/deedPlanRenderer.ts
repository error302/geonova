import { jsPDF } from 'jspdf';
import { DeedPlanGeometry } from './deedPlanGeometry';

interface PanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
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

export function renderBoundaryPlan(doc: jsPDF, geom: DeedPlanGeometry, panel: PanelBounds) {
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
  doc.setTextColor(30, 80, 100);
  doc.text('SURVEY PLAN', panel.x + panel.width / 2, panel.y + 5, { align: 'center' });

  const spanE = geom.maxE - geom.minE || 1;
  const spanN = geom.maxN - geom.minN || 1;

  const scaleFromE = spanE / (drawW / 1000);
  const scaleFromN = spanN / (drawH / 1000);
  const rawScale = Math.max(scaleFromE, scaleFromN) * 1.15;

  const standardScales = [100, 200, 250, 500, 1000, 1250, 2000, 2500, 5000];
  const scaleRatio = standardScales.find((s: any) => s >= rawScale) ?? 10000;

  const centreE = (geom.minE + geom.maxE) / 2;
  const centreN = (geom.minN + geom.maxN) / 2;

  const worldToMm = (e: number, n: number): [number, number] => {
    const px = drawX + drawW / 2 + ((e - centreE) / scaleRatio) * 1000;
    const py = drawY + drawH / 2 - ((n - centreN) / scaleRatio) * 1000;
    return [px, py];
  };

  const pts = geom.stations.map((s: any) => worldToMm(s.easting, s.northing));

  doc.setDrawColor(30, 80, 100);
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

  drawNorthArrow(doc, panel.x + margin + 8, panel.y + panel.height - 20);

  const barLen = 30;
  drawScaleBar(doc, panel.x + panel.width / 2 - barLen / 2, panel.y + panel.height - 18, scaleRatio, barLen);

  return scaleRatio;
}

