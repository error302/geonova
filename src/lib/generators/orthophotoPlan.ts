import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { jsPDF } from 'jspdf';
import db from '@/lib/db';
import {
  chooseBoundaryPoints,
  chooseOrthophotoCandidate,
  computeBoundingBox,
  computeScaleBarLengthMetres,
  extractOverlayPolygons,
  type OverlayPolygon,
  type WorldPoint,
} from './orthophotoPlanHelpers';

// Direct database queries via pg

interface ProjectRecord {
  id: string;
  user_id?: string;
  name?: string;
  location?: string;
  locality?: string;
  client_name?: string;
  lr_number?: string;
  plot_parcel_number?: string;
  utm_zone?: number;
  hemisphere?: string;
  [key: string]: unknown;
}

interface ParcelRecord {
  boundary_points?: unknown;
  area_sqm?: number | string | null;
  [key: string]: unknown;
}

interface SurveyPointRecord {
  name?: string;
  easting?: number | string;
  northing?: number | string;
  is_control?: boolean;
  [key: string]: unknown;
}

interface ProfileRecord {
  full_name?: string;
  firm_name?: string;
  isk_number?: string;
}

interface ImageResolution {
  image: unknown | null;
  sourceLabel: string;
  fitted: boolean;
}

interface DrawContext {
  save(): void
  restore(): void
  globalAlpha: number
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineJoin: string
  lineCap: string
  font: string
  drawImage(image: unknown, dx: number, dy: number, dw: number, dh: number): void
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient
  fillRect(x: number, y: number, w: number, h: number): void
  strokeRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  fill(): void
  arc(x: number, y: number, r: number, start: number, end: number): void
  translate(x: number, y: number): void
  rotate(angle: number): void
  fillText(text: string, x: number, y: number): void
  strokeText(text: string, x: number, y: number): void
}

const PAGE_W = 420;
const PAGE_H = 297;
const MAP_FRAME = { x: 14, y: 20, w: 392, h: 175 };
const PANEL_Y = 205;
const PANEL_H = 78;

export async function generateOrthophotoPlan(
  projectId: string
): Promise<Buffer> {
  const [
    projectRes,
    parcelRes,
    pointsRes,
    validationRes,
    attachmentsRes,
    docsRes,
    submissionRes,
  ] = await Promise.all([
    db.query('SELECT * FROM projects WHERE id = $1', [projectId]),
    db.query('SELECT * FROM parcels WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [projectId]),
    db.query('SELECT * FROM survey_points WHERE project_id = $1 ORDER BY created_at ASC', [projectId]),
    db.query('SELECT * FROM cadastra_validations WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1', [projectId]),
    db.query('SELECT * FROM project_attachments WHERE project_id = $1 ORDER BY created_at DESC', [projectId]),
    db.query('SELECT * FROM documents WHERE project_id = $1 ORDER BY created_at DESC', [projectId]),
    db.query('SELECT supporting_attachments FROM project_submissions WHERE project_id = $1 ORDER BY updated_at DESC LIMIT 1', [projectId]),
  ]);

  const project = projectRes.rows[0] as ProjectRecord | null;
  if (!project) {
    throw new Error('Project not found');
  }

  const profileRes = project.user_id
    ? await db.query(
        'SELECT full_name, firm_name, isk_number FROM profiles WHERE id = $1',
        [project.user_id]
      )
    : null;
  
  const profile = profileRes?.rows[0] as ProfileRecord | null;

  const parcel = parcelRes.rows[0] as ParcelRecord | null;
  const surveyPoints = (pointsRes.rows ?? []) as SurveyPointRecord[];
  const validation = validationRes.rows[0] as Record<string, unknown> | null;
  const overlays = extractOverlayPolygons(validation);
  const boundaryPoints = chooseBoundaryPoints(
    parcel?.boundary_points ?? ((validation?.boundary_data as { points?: unknown } | undefined)?.points ?? []),
    surveyPoints
  );

  if (boundaryPoints.length < 3) {
    throw new Error('Orthophoto plan requires at least 3 parcel boundary points');
  }

  const orthophotoCandidate = chooseOrthophotoCandidate(
    validation?.satellite_overlay,
    submissionRes.rows[0],
    attachmentsRes.rows,
    docsRes.rows,
    project
  );

  const imageResolution = await resolveBaseImage(orthophotoCandidate?.ref ?? null);
  const title = buildPlanTitle(project, overlays);
  const parcelRef = getParcelReference(project);

  const mapDataUrl = await renderOrthophotoMap({
    title,
    boundaryPoints,
    overlays,
    imageResolution,
  });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.rect(8, 8, PAGE_W - 16, PAGE_H - 16);

  doc.setFont('times', 'normal');
  doc.setFontSize(18);
  doc.text(title, PAGE_W / 2, 14, { align: 'center' });

  doc.addImage(mapDataUrl, 'PNG', MAP_FRAME.x, MAP_FRAME.y, MAP_FRAME.w, MAP_FRAME.h);

  drawBottomPanel(doc, {
    project,
    profile,
    parcelRef,
    overlays,
    boundaryPoints,
    imageSourceLabel: imageResolution.sourceLabel,
    usedFallbackBackground: !imageResolution.image,
  });

  return Buffer.from(doc.output('arraybuffer'));
}

function drawBottomPanel(
  doc: jsPDF,
  params: {
    project: ProjectRecord;
    profile: ProfileRecord | null;
    parcelRef: string;
    overlays: OverlayPolygon[];
    boundaryPoints: WorldPoint[];
    imageSourceLabel: string;
    usedFallbackBackground: boolean;
  }
) {
  const { project, profile, parcelRef, overlays, boundaryPoints, imageSourceLabel, usedFallbackBackground } = params;
  const x = 14;
  const y = PANEL_Y;
  const w = 392;
  const h = PANEL_H;

  doc.setLineWidth(0.4);
  doc.rect(x, y, w, h);

  drawScaleBar(doc, x + 6, y + 9, boundaryPoints);

  const infoTop = y + 22;
  const prepW = 110;
  const clientW = 78;
  const legendW = 120;
  const arrowW = w - prepW - clientW - legendW;

  doc.rect(x, infoTop, prepW, h - 22);
  doc.rect(x + prepW, infoTop, clientW, h - 22);
  doc.rect(x + prepW + clientW, infoTop, legendW, h - 22);
  doc.rect(x + prepW + clientW + legendW, infoTop, arrowW, h - 22);

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.text('PREPARED BY', x + prepW / 2, infoTop + 6, { align: 'center' });
  doc.text('CLIENT', x + prepW + clientW / 2, infoTop + 6, { align: 'center' });
  doc.text('LEGEND', x + prepW + clientW + 6, infoTop + 6);

  doc.setFontSize(8.5);
  doc.text(profile?.firm_name || profile?.full_name || 'Surveyor / Firm', x + prepW / 2, infoTop + 24, { align: 'center' });
  if (profile?.isk_number) {
    doc.setFontSize(7);
    doc.text(`Licence: ${profile.isk_number}`, x + prepW / 2, infoTop + 31, { align: 'center' });
  }

  doc.setFontSize(8.5);
  doc.text(project.client_name || 'Project Client', x + prepW + clientW / 2, infoTop + 24, { align: 'center' });
  doc.setFontSize(7);
  doc.text(parcelRef, x + prepW + clientW / 2, infoTop + 31, { align: 'center' });

  const legendX = x + prepW + clientW + 8;
  let legendY = infoTop + 16;
  drawLegendItem(doc, legendX, legendY, [255, 214, 10], 'Parcel boundary');
  legendY += 8;
  drawLegendItem(doc, legendX, legendY, [220, 38, 38], 'Encroached / overlap area');
  if (overlays.some((overlay) => overlay.kind === 'gap')) {
    legendY += 8;
    drawLegendItem(doc, legendX, legendY, [245, 158, 11], 'Gap / unresolved area');
  }

  doc.setFontSize(6.5);
  doc.text(
    usedFallbackBackground
      ? 'Background: generated survey grid (no orthophoto found)'
      : `Background: ${imageSourceLabel}`,
    legendX,
    infoTop + 40
  );
  doc.text(`UTM Zone ${project.utm_zone || 37}${project.hemisphere || 'S'}`, legendX, infoTop + 46);

  drawNorthArrow(doc, x + prepW + clientW + legendW + arrowW / 2, infoTop + 24);

  const footerY = y + h - 5;
  doc.setFontSize(6.5);
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-KE')}  |  METARDU Orthophoto Plan  |  Parcel ${parcelRef}`,
    PAGE_W / 2,
    footerY,
    { align: 'center' }
  );
}

function drawScaleBar(doc: jsPDF, x: number, y: number, boundaryPoints: WorldPoint[]) {
  const totalMetres = computeScaleBarLengthMetres(boundaryPoints);
  const widthMm = 70;
  const stepMm = widthMm / 10;

  doc.setLineWidth(0.4);
  doc.line(x, y, x + widthMm, y);

  for (let i = 0; i <= 10; i += 1) {
    const tickX = x + i * stepMm;
    const tickHeight = i % 5 === 0 ? 3 : 1.6;
    doc.line(tickX, y - tickHeight, tickX, y + tickHeight);
  }

  doc.setFontSize(8);
  doc.text('0', x, y - 5, { align: 'center' });
  doc.text(`${Math.round(totalMetres / 2)}`, x + widthMm / 2, y - 5, { align: 'center' });
  doc.text(`${Math.round(totalMetres)} m`, x + widthMm, y - 5, { align: 'center' });
}

function drawLegendItem(doc: jsPDF, x: number, y: number, rgb: [number, number, number], label: string) {
  doc.setDrawColor(...rgb);
  doc.setLineWidth(1.2);
  doc.rect(x, y - 4, 10, 6);
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text(label, x + 14, y);
}

function drawNorthArrow(doc: jsPDF, centerX: number, centerY: number) {
  const size = 18;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.circle(centerX, centerY, size * 0.6);
  doc.line(centerX, centerY + size * 0.8, centerX, centerY - size * 0.9);
  doc.line(centerX, centerY - size * 0.9, centerX - 4, centerY - size * 0.3);
  doc.line(centerX, centerY - size * 0.9, centerX + 4, centerY - size * 0.3);
  doc.line(centerX, centerY + size * 0.1, centerX - 7, centerY + size * 0.8);
  doc.line(centerX, centerY + size * 0.1, centerX + 7, centerY + size * 0.8);
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('N', centerX, centerY - size - 2, { align: 'center' });
}

async function renderOrthophotoMap(params: {
  title: string;
  boundaryPoints: WorldPoint[];
  overlays: OverlayPolygon[];
  imageResolution: ImageResolution;
}): Promise<string> {
  const { createCanvas } = await import('canvas');
  const canvas = createCanvas(2200, 1150);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const frame = {
    x: 70,
    y: 60,
    w: canvas.width - 140,
    h: canvas.height - 120,
  };

  const worldPoints = [
    ...params.boundaryPoints,
    ...params.overlays.flatMap((overlay) => overlay.points),
  ];
  const bounds = computeBoundingBox(worldPoints);
  const paddedBounds = padBounds(bounds);

  const worldToPixel = createWorldToPixel(paddedBounds, frame);

  drawBackground(ctx, frame, params.imageResolution);
  drawGrid(ctx, frame, paddedBounds, worldToPixel);
  drawBoundary(ctx, params.boundaryPoints, worldToPixel);
  drawBoundaryLabels(ctx, params.boundaryPoints, worldToPixel);
  drawOverlayPolygons(ctx, params.overlays, worldToPixel);
  drawPointLabels(ctx, params.boundaryPoints, worldToPixel);
  drawFrame(ctx, frame);

  return canvas.toDataURL('image/png');
}

function drawBackground(
  ctx: DrawContext,
  frame: { x: number; y: number; w: number; h: number },
  imageResolution: ImageResolution
) {
  if (imageResolution.image) {
    ctx.save();
    ctx.globalAlpha = imageResolution.fitted ? 0.98 : 0.92;
    ctx.drawImage(imageResolution.image as CanvasImageSource, frame.x, frame.y, frame.w, frame.h);
    ctx.restore();
    return;
  }

  const gradient = ctx.createLinearGradient(frame.x, frame.y, frame.x + frame.w, frame.y + frame.h);
  gradient.addColorStop(0, '#e7f4ea');
  gradient.addColorStop(0.45, '#c9d7b8');
  gradient.addColorStop(1, '#d7c3a3');
  ctx.fillStyle = gradient;
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h);

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  for (let x = frame.x - frame.h; x < frame.x + frame.w + frame.h; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, frame.y);
    ctx.lineTo(x + frame.h, frame.y + frame.h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGrid(
  ctx: DrawContext,
  frame: { x: number; y: number; w: number; h: number },
  bounds: { minE: number; maxE: number; minN: number; maxN: number },
  worldToPixel: (point: WorldPoint) => { x: number; y: number }
) {
  const rangeE = bounds.maxE - bounds.minE;
  const rangeN = bounds.maxN - bounds.minN;
  const step = chooseGridStep(Math.max(rangeE, rangeN));

  ctx.save();
  ctx.strokeStyle = 'rgba(30, 136, 229, 0.65)';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.font = '28px "Times New Roman"';
  ctx.lineWidth = 2;

  const startE = Math.floor(bounds.minE / step) * step;
  const endE = Math.ceil(bounds.maxE / step) * step;
  const startN = Math.floor(bounds.minN / step) * step;
  const endN = Math.ceil(bounds.maxN / step) * step;

  for (let easting = startE; easting <= endE; easting += step) {
    const { x } = worldToPixel({ easting, northing: bounds.minN });
    ctx.beginPath();
    ctx.moveTo(x, frame.y);
    ctx.lineTo(x, frame.y + frame.h);
    ctx.stroke();
    ctx.fillText(easting.toFixed(0), x, frame.y - 10);
  }

  for (let northing = startN; northing <= endN; northing += step) {
    const { y } = worldToPixel({ easting: bounds.minE, northing });
    ctx.beginPath();
    ctx.moveTo(frame.x, y);
    ctx.lineTo(frame.x + frame.w, y);
    ctx.stroke();

    ctx.save();
    ctx.translate(frame.x - 18, y + 6);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(northing.toFixed(0), 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function drawBoundary(
  ctx: DrawContext,
  boundaryPoints: WorldPoint[],
  worldToPixel: (point: WorldPoint) => { x: number; y: number }
) {
  ctx.save();
  ctx.strokeStyle = '#ffe600';
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  boundaryPoints.forEach((point, index) => {
    const px = worldToPixel(point);
    if (index === 0) ctx.moveTo(px.x, px.y);
    else ctx.lineTo(px.x, px.y);
  });
  const first = worldToPixel(boundaryPoints[0]);
  ctx.lineTo(first.x, first.y);
  ctx.stroke();
  ctx.restore();
}

function drawBoundaryLabels(
  ctx: DrawContext,
  boundaryPoints: WorldPoint[],
  worldToPixel: (point: WorldPoint) => { x: number; y: number }
) {
  ctx.save();
  ctx.font = 'bold 36px Arial';
  ctx.fillStyle = '#ffe600';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 4;

  boundaryPoints.forEach((point, index) => {
    const next = boundaryPoints[(index + 1) % boundaryPoints.length];
    const fromPx = worldToPixel(point);
    const toPx = worldToPixel(next);
    const midX = (fromPx.x + toPx.x) / 2;
    const midY = (fromPx.y + toPx.y) / 2;
    const angle = Math.atan2(toPx.y - fromPx.y, toPx.x - fromPx.x);
    const length = Math.hypot(next.easting - point.easting, next.northing - point.northing);

    ctx.save();
    ctx.translate(midX, midY);
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      ctx.rotate(angle + Math.PI);
    } else {
      ctx.rotate(angle);
    }
    ctx.strokeText(length.toFixed(2), 0, -10);
    ctx.fillText(length.toFixed(2), 0, -10);
    ctx.restore();
  });

  ctx.restore();
}

function drawOverlayPolygons(
  ctx: DrawContext,
  overlays: OverlayPolygon[],
  worldToPixel: (point: WorldPoint) => { x: number; y: number }
) {
  overlays.forEach((overlay) => {
    const stroke = overlay.kind === 'gap' ? '#f59e0b' : '#ef4444';
    const fill = overlay.kind === 'gap' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(239, 68, 68, 0.12)';

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    ctx.lineWidth = 6;
    ctx.beginPath();
    overlay.points.forEach((point, index) => {
      const px = worldToPixel(point);
      if (index === 0) ctx.moveTo(px.x, px.y);
      else ctx.lineTo(px.x, px.y);
    });
    const first = worldToPixel(overlay.points[0]);
    ctx.lineTo(first.x, first.y);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function drawPointLabels(
  ctx: DrawContext,
  boundaryPoints: WorldPoint[],
  worldToPixel: (point: WorldPoint) => { x: number; y: number }
) {
  ctx.save();
  ctx.fillStyle = '#d62828';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 4;
  ctx.font = 'bold 44px Arial';

  boundaryPoints.forEach((point, index) => {
    const px = worldToPixel(point);
    const label = point.name || `P${index + 1}`;
    ctx.beginPath();
    ctx.fillStyle = '#d4af37';
    ctx.arc(px.x, px.y, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d62828';
    ctx.strokeText(label, px.x + 8, px.y - 8);
    ctx.fillText(label, px.x + 8, px.y - 8);
  });

  ctx.restore();
}

function drawFrame(ctx: DrawContext, frame: { x: number; y: number; w: number; h: number }) {
  ctx.save();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 4;
  ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);
  ctx.restore();
}

function buildPlanTitle(project: ProjectRecord, overlays: OverlayPolygon[]): string {
  const parcelRef = getParcelReference(project);
  return overlays.length > 0
    ? `MAP SHOWING ${parcelRef} AND ENCROACHMENTS THEREON`
    : `ORTHOPHOTO PLAN OF ${parcelRef}`;
}

function getParcelReference(project: ProjectRecord): string {
  const lrNumber = asDisplayString(project.lr_number);
  const plotNo = asDisplayString(project.plot_parcel_number);
  const projectName = asDisplayString(project.name);

  if (lrNumber) return `PARCEL ${lrNumber}`;
  if (plotNo) return `PARCEL ${plotNo}`;
  return projectName || 'SUBJECT PARCEL';
}

async function resolveBaseImage(ref: string | null): Promise<ImageResolution> {
  if (!ref) {
    return { image: null, sourceLabel: 'No orthophoto found', fitted: false };
  }

  const localPath = resolveLocalAssetPath(ref);
  try {
    const { loadImage } = await import('canvas');

    if (localPath) {
      const buffer = await readFile(localPath);
      return {
        image: await loadImage(buffer),
        sourceLabel: shortLabel(ref),
        fitted: true,
      };
    }

    if (/^https?:/i.test(ref) || ref.startsWith('data:image/')) {
      const response = await fetch(ref);
      if (!response.ok) {
        throw new Error(`Unable to load image (${response.status})`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      return {
        image: await loadImage(buffer),
        sourceLabel: shortLabel(ref),
        fitted: true,
      };
    }
  } catch {
    return {
      image: null,
      sourceLabel: `Unresolved image: ${shortLabel(ref)}`,
      fitted: false,
    };
  }

  return {
    image: null,
    sourceLabel: `Unresolved image: ${shortLabel(ref)}`,
    fitted: false,
  };
}

function resolveLocalAssetPath(ref: string): string | null {
  const normalized = ref.replace(/\\/g, '/');
  const candidates = [
    join(process.cwd(), normalized.replace(/^\/+/, '')),
    join(process.cwd(), 'public', normalized.replace(/^\/+/, '')),
    join(process.cwd(), 'public', 'uploads', normalized.replace(/^\/+/, '')),
    join(process.cwd(), 'public', 'uploads', 'documents', normalized.replace(/^\/+/, '')),
    join(process.cwd(), 'public', 'uploads', 'project-attachments', normalized.replace(/^\/+/, '')),
    join(process.cwd(), 'public', 'uploads', 'submission-docs', normalized.replace(/^\/+/, '')),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function createWorldToPixel(
  bounds: { minE: number; maxE: number; minN: number; maxN: number },
  frame: { x: number; y: number; w: number; h: number }
) {
  const spanE = Math.max(bounds.maxE - bounds.minE, 1);
  const spanN = Math.max(bounds.maxN - bounds.minN, 1);
  const scale = Math.min(frame.w / spanE, frame.h / spanN);
  const offsetX = frame.x + (frame.w - spanE * scale) / 2;
  const offsetY = frame.y + (frame.h - spanN * scale) / 2;

  return (point: WorldPoint) => ({
    x: offsetX + (point.easting - bounds.minE) * scale,
    y: frame.y + frame.h - (offsetY - frame.y) - (point.northing - bounds.minN) * scale,
  });
}

function padBounds(bounds: { minE: number; maxE: number; minN: number; maxN: number }) {
  const spanE = Math.max(bounds.maxE - bounds.minE, 1);
  const spanN = Math.max(bounds.maxN - bounds.minN, 1);
  const padE = Math.max(spanE * 0.1, 5);
  const padN = Math.max(spanN * 0.1, 5);

  return {
    minE: bounds.minE - padE,
    maxE: bounds.maxE + padE,
    minN: bounds.minN - padN,
    maxN: bounds.maxN + padN,
  };
}

function chooseGridStep(range: number): number {
  const niceSteps = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  return niceSteps.find((step) => step >= range / 4) ?? 5000;
}

function asDisplayString(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function shortLabel(value: string): string {
  const compact = value.replace(/^https?:\/\//i, '');
  return compact.length > 64 ? `...${compact.slice(-61)}` : compact;
}
