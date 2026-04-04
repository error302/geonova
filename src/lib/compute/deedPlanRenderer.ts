import type { DeedPlanInput, BoundaryLeg, BoundaryPoint, ClosureCheck } from '@/types/deedPlan'
import { getBeaconSymbolSVG } from './beaconSymbols'

export function renderDeedPlanSVG(
  input: DeedPlanInput,
  bearingSchedule: BoundaryLeg[],
  closureCheck: ClosureCheck
): string {
  const { boundaryPoints, scale, utmZone, hemisphere } = input

  const VIEWBOX_WIDTH = 840
  const VIEWBOX_HEIGHT = 594
  const DRAWING_WIDTH = 580
  const PANEL_X = 580

  const coords = boundaryPoints.map((p: any) => ({ x: p.easting, y: p.northing }))
  const minX = Math.min(...coords.map((c: any) => c.x))
  const maxX = Math.max(...coords.map((c: any) => c.x))
  const minY = Math.min(...coords.map((c: any) => c.y))
  const maxY = Math.max(...coords.map((c: any) => c.y))

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const padding = 40

  const scaleX = (DRAWING_WIDTH - padding * 2) / rangeX
  const scaleY = (VIEWBOX_HEIGHT - padding * 2) / rangeY
  const plotScale = Math.min(scaleX, scaleY) * 0.8

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  const toSvgX = (easting: number) => DRAWING_WIDTH / 2 + (easting - centerX) * plotScale
  const toSvgY = (northing: number) => VIEWBOX_HEIGHT / 2 - (northing - centerY) * plotScale

  let polygonPoints = boundaryPoints.map((p: any) => 
    `${toSvgX(p.easting)},${toSvgY(p.northing)}`
  ).join(' ')

  let beaconElements = ''
  boundaryPoints.forEach((p, i) => {
    const sx = toSvgX(p.easting)
    const sy = toSvgY(p.northing)
    beaconElements += `<g transform="translate(${sx}, ${sy})">${getBeaconSymbolSVG(p.markType, p.markStatus)}</g>`
  })

  let boundaryLabels = ''
  for (let i = 0; i < bearingSchedule.length; i++) {
    const leg = bearingSchedule[i]
    const fromPt = boundaryPoints.find((p: any) => p.id === leg.fromPoint)
    const toPt = boundaryPoints.find((p: any) => p.id === leg.toPoint)
    if (!fromPt || !toPt) continue

    const mx = (toSvgX(fromPt.easting) + toSvgX(toPt.easting)) / 2
    const my = (toSvgY(fromPt.northing) + toSvgY(toPt.northing)) / 2
    boundaryLabels += `<text x="${mx}" y="${my - 5}" font-size="3" text-anchor="middle">${leg.bearing}</text>`
    boundaryLabels += `<text x="${mx}" y="${my + 5}" font-size="3" text-anchor="middle">${leg.distance.toFixed(2)}m</text>`
  }

  let pointLabels = ''
  boundaryPoints.forEach((p: any) => {
    const sx = toSvgX(p.easting) + 4
    const sy = toSvgY(p.northing) - 4
    pointLabels += `<text x="${sx}" y="${sy}" font-size="3">${p.id}</text>`
  })

  const areaHa = input.area / 10000

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" width="${VIEWBOX_WIDTH}" height="${VIEWBOX_HEIGHT}">
  <style>
    .title { font-size: 10pt; font-weight: bold; font-family: Arial, sans-serif; }
    .section-header { font-size: 7pt; font-weight: bold; font-family: Arial, sans-serif; }
    .table-text { font-size: 5pt; font-family: Arial, sans-serif; }
    .body-text { font-size: 6pt; font-family: Arial, sans-serif; }
  </style>
  
  <!-- LEFT PANEL: Survey Plan Drawing Area -->
  <rect x="0" y="0" width="${DRAWING_WIDTH}" height="${VIEWBOX_HEIGHT}" fill="white" stroke="black" stroke-width="0.5"/>
  
  <!-- Grid -->
  <g stroke="#E5E5E5" stroke-width="0.2">
    ${generateGrid(toSvgX, toSvgY, minX, maxX, minY, maxY, boundaryPoints)}
  </g>
  
  <!-- Boundary Polygon -->
  <polygon points="${polygonPoints}" fill="#FEFCE8" stroke="black" stroke-width="0.5"/>
  
  <!-- Boundary Dimensions -->
  ${boundaryLabels}
  
  <!-- Beacon Symbols -->
  ${beaconElements}
  
  <!-- Point Labels -->
  ${pointLabels}
  
  <!-- North Arrow -->
  <g transform="translate(${DRAWING_WIDTH - 40}, 40)">
    <line x1="0" y1="15" x2="0" y2="-15" stroke="black" stroke-width="0.5"/>
    <polygon points="0,-15 -3,0 3,0" fill="black"/>
    <text x="0" y="22" font-size="4" text-anchor="middle">N</text>
  </g>
  
  <!-- Scale Bar -->
  <g transform="translate(${DRAWING_WIDTH / 2 - 50}, ${VIEWBOX_HEIGHT - 25})">
    <line x1="0" y1="0" x2="100" y2="0" stroke="black" stroke-width="0.5"/>
    <line x1="0" y1="-3" x2="0" y2="3" stroke="black" stroke-width="0.5"/>
    <line x1="50" y1="-2" x2="50" y2="2" stroke="black" stroke-width="0.5"/>
    <line x1="100" y1="-3" x2="100" y2="3" stroke="black" stroke-width="0.5"/>
    <text x="50" y="8" font-size="4" text-anchor="middle">1 : ${input.scale}</text>
  </g>
  
  <!-- RIGHT PANEL: Information -->
  <rect x="${PANEL_X}" y="0" width="${VIEWBOX_WIDTH - PANEL_X}" height="${VIEWBOX_HEIGHT}" fill="#FAFAFA" stroke="black" stroke-width="0.5"/>
  
  <!-- SECTION A: Title Block -->
  <text x="${PANEL_X + 10}" y="20" class="title">DEED PLAN</text>
  <text x="${PANEL_X + 10}" y="35" class="body-text">Survey No: ${input.surveyNumber}</text>
  <text x="${PANEL_X + 10}" y="47" class="body-text">Drawing No: ${input.drawingNumber}</text>
  <text x="${PANEL_X + 10}" y="59" class="body-text">Scale: 1 : ${input.scale}</text>
  <text x="${PANEL_X + 10}" y="71" class="body-text">Date: ${input.surveyDate}</text>
  <line x1="${PANEL_X + 10}" y1="80" x2="${VIEWBOX_WIDTH - 10}" y2="80" stroke="black" stroke-width="0.5"/>
  
  <!-- SECTION B: Parcel Information -->
  <text x="${PANEL_X + 10}" y="95" class="section-header">PARCEL INFORMATION</text>
  <text x="${PANEL_X + 10}" y="108" class="body-text">Parcel: ${input.parcelNumber}</text>
  <text x="${PANEL_X + 10}" y="120" class="body-text">Reg. Section: ${input.registrationSection}</text>
  <text x="${PANEL_X + 10}" y="132" class="body-text">Locality: ${input.locality}</text>
  <text x="${PANEL_X + 10}" y="144" class="body-text">County: ${input.county}</text>
  <text x="${PANEL_X + 10}" y="156" class="body-text">Area: ${input.area.toFixed(4)} m²</text>
  <text x="${PANEL_X + 10}" y="168" class="body-text">Area: ${areaHa.toFixed(6)} ha</text>
  <text x="${PANEL_X + 10}" y="180" class="body-text">Datum: ${input.datum} (Zone ${utmZone}${hemisphere})</text>
  <line x1="${PANEL_X + 10}" y1="188" x2="${VIEWBOX_WIDTH - 10}" y2="188" stroke="black" stroke-width="0.5"/>
  
  <!-- SECTION C: Abuttals -->
  <text x="${PANEL_X + 10}" y="203" class="section-header">ABUTTALS</text>
  <text x="${PANEL_X + 10}" y="216" class="body-text">North: ${input.abuttalNorth}</text>
  <text x="${PANEL_X + 10}" y="228" class="body-text">South: ${input.abuttalSouth}</text>
  <text x="${PANEL_X + 10}" y="240" class="body-text">East: ${input.abuttalEast}</text>
  <text x="${PANEL_X + 10}" y="252" class="body-text">West: ${input.abuttalWest}</text>
  <line x1="${PANEL_X + 10}" y1="260" x2="${VIEWBOX_WIDTH - 10}" y2="260" stroke="black" stroke-width="0.5"/>
  
  <!-- SECTION D: Bearing Schedule -->
  <text x="${PANEL_X + 10}" y="275" class="section-header">BEARING SCHEDULE</text>
  <line x1="${PANEL_X + 10}" y1="278" x2="${VIEWBOX_WIDTH - 10}" y2="278" stroke="black" stroke-width="0.3"/>
  <text x="${PANEL_X + 15}" y="288" class="table-text" font-weight="bold">LEG</text>
  <text x="${PANEL_X + 40}" y="288" class="table-text" font-weight="bold">FROM</text>
  <text x="${PANEL_X + 75}" y="288" class="table-text" font-weight="bold">TO</text>
  <text x="${PANEL_X + 110}" y="288" class="table-text" font-weight="bold">BEARING</text>
  <text x="${PANEL_X + 175}" y="288" class="table-text" font-weight="bold">DIST (m)</text>
  ${generateBearingSchedule(bearingSchedule, PANEL_X)}
  <line x1="${PANEL_X + 10}" y1="350" x2="${VIEWBOX_WIDTH - 10}" y2="350" stroke="black" stroke-width="0.5"/>
  
  <!-- SECTION E: Coordinate Schedule -->
  <text x="${PANEL_X + 10}" y="365" class="section-header">COORDINATE SCHEDULE</text>
  <line x1="${PANEL_X + 10}" y1="368" x2="${VIEWBOX_WIDTH - 10}" y2="368" stroke="black" stroke-width="0.3"/>
  <text x="${PANEL_X + 15}" y="378" class="table-text" font-weight="bold">POINT</text>
  <text x="${PANEL_X + 45}" y="378" class="table-text" font-weight="bold">MARK</text>
  <text x="${PANEL_X + 90}" y="378" class="table-text" font-weight="bold">STATUS</text>
  <text x="${PANEL_X + 135}" y="378" class="table-text" font-weight="bold">EASTING</text>
  <text x="${PANEL_X + 195}" y="378" class="table-text" font-weight="bold">NORTHING</text>
  ${generateCoordinateSchedule(boundaryPoints, PANEL_X)}
  <line x1="${PANEL_X + 10}" y1="440" x2="${VIEWBOX_WIDTH - 10}" y2="440" stroke="black" stroke-width="0.5"/>
  
  <!-- SECTION F: Surveyor's Certificate -->
  <text x="${PANEL_X + 10}" y="455" class="section-header">SURVEYOR'S CERTIFICATE</text>
  <text x="${PANEL_X + 10}" y="470" class="body-text">I hereby certify that this survey was carried out under</text>
  <text x="${PANEL_X + 10}" y="482" class="body-text">my supervision and that the plan is correct to the best</text>
  <text x="${PANEL_X + 10}" y="494" class="body-text">of my knowledge and belief.</text>
  <text x="${PANEL_X + 10}" y="518" class="body-text">Name: ${input.surveyorName}</text>
  <text x="${PANEL_X + 10}" y="530" class="body-text">ISK No: ${input.iskNumber}</text>
  <text x="${PANEL_X + 10}" y="542" class="body-text">Firm: ${input.firmName}</text>
  <text x="${PANEL_X + 10}" y="554" class="body-text">Date: ${input.signatureDate}</text>
  <line x1="${PANEL_X + 10}" y1="580" x2="${VIEWBOX_WIDTH - 10}" y2="580" stroke="black" stroke-width="0.5"/>
  
  <!-- Closure Check Badge -->
  <rect x="${PANEL_X + 10}" y="440" width="60" height="18" fill="${closureCheck.passes ? '#22C55E' : '#EF4444'}" stroke="black" stroke-width="0.3" rx="2"/>
  <text x="${PANEL_X + 40}" y="453" font-size="5" fill="white" text-anchor="middle">${closureCheck.precisionRatio}</text>
</svg>`
}

function generateGrid(
  toSvgX: (e: number) => number,
  toSvgY: (n: number) => number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  points: BoundaryPoint[]
): string {
  let grid = ''
  const rangeX = maxX - minX
  const rangeY = maxY - minY
  const stepX = rangeX / 10
  const stepY = rangeY / 10

  for (let i = 0; i <= 10; i++) {
    const x = minX + i * stepX
    grid += `<line x1="${toSvgX(x)}" y1="20" x2="${toSvgX(x)}" y2="570" />`
  }
  for (let i = 0; i <= 10; i++) {
    const y = minY + i * stepY
    grid += `<line x1="20" y1="${toSvgY(y)}" x2="560" y2="${toSvgY(y)}" />`
  }
  return grid
}

function generateBearingSchedule(legs: BoundaryLeg[], panelX: number): string {
  let rows = ''
  let yPos = 298
  legs.forEach((leg, i) => {
    const legNum = i + 1
    rows += `<text x="${panelX + 15}" y="${yPos}" class="table-text">${legNum}</text>`
    rows += `<text x="${panelX + 40}" y="${yPos}" class="table-text">${leg.fromPoint}</text>`
    rows += `<text x="${panelX + 75}" y="${yPos}" class="table-text">${leg.toPoint}</text>`
    rows += `<text x="${panelX + 110}" y="${yPos}" class="table-text">${leg.bearing}</text>`
    rows += `<text x="${panelX + 175}" y="${yPos}" class="table-text">${leg.distance.toFixed(2)}</text>`
    yPos += 8
  })
  return rows
}

function generateCoordinateSchedule(points: BoundaryPoint[], panelX: number): string {
  let rows = ''
  let yPos = 388
  points.forEach((p: any) => {
    rows += `<text x="${panelX + 15}" y="${yPos}" class="table-text">${p.id}</text>`
    rows += `<text x="${panelX + 45}" y="${yPos}" class="table-text">${p.markType}</text>`
    rows += `<text x="${panelX + 90}" y="${yPos}" class="table-text">${p.markStatus}</text>`
    rows += `<text x="${panelX + 135}" y="${yPos}" class="table-text">${p.easting.toFixed(4)}</text>`
    rows += `<text x="${panelX + 195}" y="${yPos}" class="table-text">${p.northing.toFixed(4)}</text>`
    yPos += 8
  })
  return rows
}
