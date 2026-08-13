// DXF / SVG / CSV / GeoJSON export generators for the contour generator tool.
//
// Extracted from src/app/tools/contour-generator/page.tsx — pure functions,
// no React, no hooks, so this file does not need 'use client'.

import type { ContourLine, SpotHeight } from '@/lib/engine/contours';
import { MARGIN, SVG_HEIGHT, SVG_WIDTH } from './constants';
import { elevationToColor, computeHypsometricBands, fmt } from './helpers';

type Bounds2D = { minE: number; maxE: number; minN: number; maxN: number };

export function generateDXF(contours: ContourLine[], _bounds: Bounds2D): string {
  const lines: string[] = [];
  lines.push('0');
  lines.push('SECTION');
  lines.push('2');
  lines.push('HEADER');
  lines.push('0');
  lines.push('ENDSEC');
  lines.push('0');
  lines.push('SECTION');
  lines.push('2');
  lines.push('TABLES');
  lines.push('0');
  lines.push('TABLE');
  lines.push('2');
  lines.push('LAYER');
  lines.push('70');
  lines.push(String(contours.length));

  const uniqueElevations = [...new Set(contours.map(c => c.elevation))].sort((a, b) => a - b);
  for (const elev of uniqueElevations) {
    lines.push('0');
    lines.push('LAYER');
    lines.push('2');
    lines.push(`C${elev.toFixed(1)}`);
    lines.push('70');
    lines.push('0');
    lines.push('62');
    lines.push('7');
    lines.push('6');
    lines.push('CONTINUOUS');
  }

  lines.push('0');
  lines.push('ENDTAB');
  lines.push('0');
  lines.push('ENDSEC');

  lines.push('0');
  lines.push('SECTION');
  lines.push('2');
  lines.push('ENTITIES');

  for (const contour of contours) {
    const layerName = `C${contour.elevation.toFixed(1)}`;
    lines.push('0');
    lines.push('LWPOLYLINE');
    lines.push('8');
    lines.push(layerName);
    lines.push('62');
    lines.push('7');
    lines.push('90');
    lines.push(String(contour.points.length));

    if (contour.points[0].easting === contour.points[contour.points.length - 1].easting &&
        contour.points[0].northing === contour.points[contour.points.length - 1].northing) {
      lines.push('70');
      lines.push('1');
    } else {
      lines.push('70');
      lines.push('0');
    }

    for (const pt of contour.points) {
      lines.push('10');
      lines.push(fmt(pt.easting, 4));
      lines.push('20');
      lines.push(fmt(pt.northing, 4));
    }
  }

  lines.push('0');
  lines.push('ENDSEC');
  lines.push('0');
  lines.push('EOF');
  return lines.join('\n');
}

export function generateSVGExport(
  contours: ContourLine[],
  bounds: Bounds2D,
  points: SpotHeight[]
): string {
  const usableW = SVG_WIDTH - 2 * MARGIN;
  const usableH = SVG_HEIGHT - 2 * MARGIN;
  const rangeE = bounds.maxE - bounds.minE || 1;
  const rangeN = bounds.maxN - bounds.minN || 1;

  const elevations = contours.map(c => c.elevation);
  const minElev = Math.min(...elevations);
  const maxElev = Math.max(...elevations);

  function toSvgX(e: number) { return MARGIN + ((e - bounds.minE) / rangeE) * usableW; }
  function toSvgY(n: number) { return MARGIN + ((bounds.maxN - n) / rangeN) * usableH; }

  const svgLines: string[] = [];
  svgLines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svgLines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" width="${SVG_WIDTH}" height="${SVG_HEIGHT}">`);
  svgLines.push(`<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#1a1a2e"/>`);
  svgLines.push(`<rect x="${MARGIN}" y="${MARGIN}" width="${usableW}" height="${usableH}" fill="#0d1117" stroke="#30363d" stroke-width="1"/>`);

  // Hypsometric tint bands — discrete relief background.
  {
    const indexContours = contours.filter(c => c.isIndex).map(c => c.elevation).sort((a, b) => a - b);
    let ci = 1;
    if (indexContours.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < indexContours.length; i++) gaps.push(indexContours[i] - indexContours[i - 1]);
      ci = gaps.reduce((s, v) => s + v, 0) / gaps.length;
    } else {
      const sorted = contours.map(c => c.elevation).sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);
      ci = gaps.length ? gaps.reduce((s, v) => s + v, 0) / gaps.length : 1;
    }
    const bands = computeHypsometricBands(minElev, maxElev, ci);
    for (const band of bands) {
      const yTop = toSvgY(bounds.minN + (rangeN * (band.toElev - minElev)) / (maxElev - minElev || 1));
      const yBot = toSvgY(bounds.minN + (rangeN * (band.fromElev - minElev)) / (maxElev - minElev || 1));
      const h = Math.max(0, yBot - yTop);
      svgLines.push(`<rect x="${MARGIN}" y="${yTop.toFixed(2)}" width="${usableW}" height="${h.toFixed(2)}" fill="${band.color}" opacity="${band.isIndex ? 0.22 : 0.14}"/>`);
    }
  }

  // Contour lines
  for (const contour of contours) {
    const color = elevationToColor(contour.elevation, minElev, maxElev);
    const sw = contour.isIndex ? 2.0 : 0.8;
    const pts = contour.points.map(p => `${toSvgX(p.easting).toFixed(2)},${toSvgY(p.northing).toFixed(2)}`).join(' ');
    svgLines.push(`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`);

    if (contour.isIndex && contour.points.length > 5) {
      const midIdx = Math.floor(contour.points.length / 2);
      const midPt = contour.points[midIdx];
      const x = toSvgX(midPt.easting);
      const y = toSvgY(midPt.northing);
      svgLines.push(`<text x="${x.toFixed(2)}" y="${(y - 3).toFixed(2)}" fill="#e0e0e0" font-size="10" font-family="monospace" text-anchor="middle">${contour.elevation.toFixed(1)}</text>`);
    }
  }

  // Spot height crosses
  for (const pt of points) {
    const x = toSvgX(pt.easting);
    const y = toSvgY(pt.northing);
    svgLines.push(`<line x1="${(x - 3).toFixed(2)}" y1="${(y - 3).toFixed(2)}" x2="${(x + 3).toFixed(2)}" y2="${(y + 3).toFixed(2)}" stroke="#666" stroke-width="0.5"/>`);
    svgLines.push(`<line x1="${(x + 3).toFixed(2)}" y1="${(y - 3).toFixed(2)}" x2="${(x - 3).toFixed(2)}" y2="${(y + 3).toFixed(2)}" stroke="#666" stroke-width="0.5"/>`);
  }

  // Coordinate labels
  const numTicksE = 5;
  const numTicksN = 5;
  for (let i = 0; i <= numTicksE; i++) {
    const e = bounds.minE + (rangeE * i) / numTicksE;
    const x = toSvgX(e);
    svgLines.push(`<text x="${x.toFixed(2)}" y="${(SVG_HEIGHT - MARGIN / 3).toFixed(2)}" fill="#888" font-size="9" font-family="monospace" text-anchor="middle">${e.toFixed(1)}</text>`);
  }
  for (let i = 0; i <= numTicksN; i++) {
    const n = bounds.minN + (rangeN * i) / numTicksN;
    const y = toSvgY(n);
    svgLines.push(`<text x="${(MARGIN / 2).toFixed(2)}" y="${(y + 3).toFixed(2)}" fill="#888" font-size="9" font-family="monospace" text-anchor="middle">${n.toFixed(1)}</text>`);
  }

  // North arrow
  svgLines.push(`<g transform="translate(${SVG_WIDTH - 40}, ${MARGIN + 30})">`);
  svgLines.push(`<line x1="0" y1="20" x2="0" y2="0" stroke="#aaa" stroke-width="1.5"/>`);
  svgLines.push(`<polygon points="0,0 -4,8 4,8" fill="#aaa"/>`);
  svgLines.push(`<text x="0" y="30" fill="#aaa" font-size="10" text-anchor="middle" font-family="sans-serif">N</text>`);
  svgLines.push(`</g>`);

  // Scale bar
  const scaleBarWorldLen = rangeE / 5;
  const scaleBarSvgLen = usableW / 5;
  const sbX = MARGIN;
  const sbY = SVG_HEIGHT - 18;
  svgLines.push(`<line x1="${sbX}" y1="${sbY}" x2="${sbX + scaleBarSvgLen}" y2="${sbY}" stroke="#aaa" stroke-width="1.5"/>`);
  svgLines.push(`<line x1="${sbX}" y1="${sbY - 3}" x2="${sbX}" y2="${sbY + 3}" stroke="#aaa" stroke-width="1"/>`);
  svgLines.push(`<line x1="${(sbX + scaleBarSvgLen).toFixed(2)}" y1="${sbY - 3}" x2="${(sbX + scaleBarSvgLen).toFixed(2)}" y2="${sbY + 3}" stroke="#aaa" stroke-width="1"/>`);
  svgLines.push(`<text x="${(sbX + scaleBarSvgLen / 2).toFixed(2)}" y="${(sbY - 5).toFixed(2)}" fill="#aaa" font-size="9" text-anchor="middle" font-family="monospace">${scaleBarWorldLen.toFixed(1)} m</text>`);

  svgLines.push(`</svg>`);
  return svgLines.join('\n');
}

export function generateContourCSV(contours: ContourLine[]): string {
  const lines: string[] = [];
  lines.push('contour_id,elevation,is_index,point_index,easting,northing');
  let contourId = 0;
  for (const contour of contours) {
    contourId++;
    for (let i = 0; i < contour.points.length; i++) {
      const pt = contour.points[i];
      lines.push(
        `${contourId},${contour.elevation.toFixed(4)},${contour.isIndex ? 'true' : 'false'},${i},${pt.easting.toFixed(4)},${pt.northing.toFixed(4)}`
      );
    }
  }
  return lines.join('\n');
}

export function generateGeoJSON(contours: ContourLine[]): string {
  const features = contours.map((contour, idx) => ({
    type: 'Feature' as const,
    properties: {
      id: idx + 1,
      elevation: contour.elevation,
      is_index: contour.isIndex,
    },
    geometry: {
      type: 'MultiLineString' as const,
      coordinates: [
        contour.points.map(p => [p.easting, p.northing]),
      ],
    },
  }));
  const geojson = {
    type: 'FeatureCollection' as const,
    features,
  };
  return JSON.stringify(geojson, null, 2);
}
