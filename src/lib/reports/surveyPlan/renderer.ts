import type { SurveyPlanData, PlanOptions } from './types'
import { generateBearingScheduleCSV } from '../bearingScheduleCSV'
import {
  DPI, PX_PER_MM, PX_PER_M,
  PAGE_WIDTH_MM, PAGE_HEIGHT_MM,
  STANDARD_SCALES, mmToPx, mToPx,
  bearingFromDelta, bearingToDMS, distance, midpoint,
  segmentAngle, textAngleForSegment, offsetFromMidpoint,
  centroid, boundingBox, selectScale, calcScaleLabel, calcScaleBarMetres,
  formatBearingDegMinSec,
  offsetPointPerpendicular, computeFenceBoundary, rotatePoints,
} from './geometry'
import {
  svgFoundMonument, svgSetMonument, svgMasonryNail, svgIronPin,
  svgCornerDot, svgNorthArrow, svgScaleBar,
  svgSheetBorder, svgPanelDivider,
  svgFenceLine, svgFenceCallout,
  escapeXml, polylineFromPoints,
  C_BLACK, C_GREEN, C_RED, C_GRID_MINOR, C_GRID_MAJOR,
  C_LOT_FILL, C_WARNING_BG,
} from './symbols'

export class SurveyPlanRenderer {
  private data: SurveyPlanData
  private opts: Required<PlanOptions>
  private pageW: number
  private pageH: number
  private drawingAreaW: number
  private drawingAreaH: number
  private drawingX: number
  private drawingY: number
  private panelX: number
  private panelW: number
  private margin = mmToPx(10)
  private titleBlockH = mmToPx(44)
  private scale = 500
  private mPerPx = 1
  private toSvgX!: (m: number) => number
  private toSvgY!: (m: number) => number
  private rotatedPoints: Array<{ easting: number; northing: number }> = []

  constructor(data: SurveyPlanData, options?: PlanOptions) {
    this.data = data
    this.opts = {
      paperSize: options?.paperSize ?? 'a3',
      scale: options?.scale ?? 0,
      includeGrid: options?.includeGrid ?? true,
      includePanel: options?.includePanel ?? true,
      language: options?.language ?? 'en',
    }
    this.pageW = mmToPx(PAGE_WIDTH_MM)
    this.pageH = mmToPx(PAGE_HEIGHT_MM)
    this.drawingAreaW = this.pageW * 0.73
    this.drawingAreaH = this.pageH - this.margin * 2 - this.titleBlockH
    this.drawingX = this.margin
    this.drawingY = this.margin
    this.panelX = this.drawingX + this.drawingAreaW
    this.panelW = this.pageW - this.panelX - this.margin
    this.computeScale()
    this.rotatedPoints = this.getTransformedPoints()
  }

  private computeScale(): void {
    const parcel = this.data.parcel
    const bb = boundingBox(parcel.boundaryPoints)
    const drawW = this.drawingAreaW - mmToPx(20)
    const drawH = this.drawingAreaH - mmToPx(20)
    if (this.opts.scale > 0) {
      this.scale = this.opts.scale
    } else {
      const scaleByWidth = drawW / bb.rangeE
      const scaleByHeight = drawH / bb.rangeN
      const rawScale = Math.min(scaleByWidth, scaleByHeight) * PX_PER_M
      this.scale = STANDARD_SCALES.find(s => s >= rawScale) || 500
    }
    this.mPerPx = this.scale / PX_PER_M
    const offsetX = (drawW - bb.rangeE * PX_PER_M) / 2
    const offsetY = (drawH - bb.rangeN * PX_PER_M) / 2
    const minE = bb.minE
    const minN = bb.minN
    this.toSvgX = (m) => this.drawingX + mmToPx(10) + offsetX + (m - minE) * PX_PER_M
    this.toSvgY = (m) => this.drawingY + mmToPx(10) + offsetY + (m - minN) * PX_PER_M
  }

  private getTransformedPoints(): Array<{ easting: number; northing: number }> {
    const pts = this.data.parcel.boundaryPoints
    const rotDeg = this.data.project.northRotationDeg || 0
    if (rotDeg === 0) return pts
    const { minE, maxE, minN, maxN } = boundingBox(pts)
    const cx = (minE + maxE) / 2
    const cy = (minN + maxN) / 2
    return rotatePoints(pts, rotDeg, cx, cy)
  }

  private drawBackground(): string {
    return `<rect x="0" y="0" width="${this.pageW}" height="${this.pageH}" fill="white"/>`
  }

  private drawSheetBorder(): string {
    return svgSheetBorder(this.pageW, this.pageH)
  }

  private drawPanelDivider(): string {
    return svgPanelDivider(this.panelX, this.pageH, this.margin, this.titleBlockH + this.margin)
  }

  private drawGrid(): string {
    const parcel = this.data.parcel
    const bb = boundingBox(parcel.boundaryPoints)
    const gridMinE = Math.floor(bb.minE / 50) * 50 - 50
    const gridMaxE = Math.ceil(bb.maxE / 50) * 50 + 50
    const gridMinN = Math.floor(bb.minN / 50) * 50 - 50
    const gridMaxN = Math.ceil(bb.maxN / 50) * 50 + 50
    let svg = ''
    for (let e = gridMinE; e <= gridMaxE; e += 50) {
      const x = this.toSvgX(e)
      const isMajor = e % 100 === 0
      const stroke = isMajor ? C_GRID_MAJOR : C_GRID_MINOR
      const width = isMajor ? 0.8 : 0.4
      const dash = isMajor ? 'none' : '2,4'
      svg += `<line x1="${x}" y1="${this.toSvgY(gridMinN)}" x2="${x}" y2="${this.toSvgY(gridMaxN)}" stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${dash}" opacity="0.7"/>`
      if (isMajor) {
        const lx = this.drawingX - 4
        const ly = this.toSvgY(e) + 3
        svg += `<text x="${lx}" y="${ly}" text-anchor="end" font-family="Share Tech Mono, Courier New" font-size="8" fill="${C_BLACK}" opacity="0.6">${e}</text>`
      }
    }
    for (let n = gridMinN; n <= gridMaxN; n += 50) {
      const y = this.toSvgY(n)
      const isMajor = n % 100 === 0
      const stroke = isMajor ? C_GRID_MAJOR : C_GRID_MINOR
      const width = isMajor ? 0.8 : 0.4
      const dash = isMajor ? 'none' : '2,4'
      svg += `<line x1="${this.toSvgX(gridMinE)}" y1="${y}" x2="${this.toSvgX(gridMaxE)}" y2="${y}" stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${dash}" opacity="0.7"/>`
      if (isMajor) {
        const lx = this.toSvgX(n) - 4
        const ly = this.drawingY + this.drawingAreaH + 12
        svg += `<text x="${lx}" y="${ly}" text-anchor="end" font-family="Share Tech Mono, Courier New" font-size="8" fill="${C_BLACK}" opacity="0.6" transform="rotate(-45,${lx},${ly})">${n}</text>`
      }
    }
    return svg
  }

  private drawLotFill(): string {
    const pts = this.data.parcel.boundaryPoints
    if (pts.length < 3) return ''
    const coords: string[] = []
    for (const p of pts) coords.push(`${this.toSvgX(p.easting)},${this.toSvgY(p.northing)}`)
    coords.push(`${this.toSvgX(pts[0].easting)},${this.toSvgY(pts[0].northing)}`)
    return `<polygon points="${coords.join(' ')}" fill="${C_LOT_FILL}" stroke="none"/>`
  }

  private drawAdjacentLots(): string {
    const lots = this.data.adjacentLots
    if (!lots || lots.length === 0) return ''
    let svg = ''
    for (const lot of lots) {
      if (lot.boundaryPoints.length < 2) continue
      svg += polylineFromPoints(lot.boundaryPoints, this.toSvgX, this.toSvgY, true)
    }
    return svg
  }

  private drawBoundary(): string {
    const pts = this.data.parcel.boundaryPoints
    if (pts.length < 2) return ''
    return polylineFromPoints(pts, this.toSvgX, this.toSvgY, true).replace('stroke-width="1"', 'stroke-width="2.5"')
  }

  private drawBoundaryLabels(): string {
    const pts = this.rotatedPoints
    let svg = ''
    for (let i = 0; i < pts.length; i++) {
      const from = pts[i]
      const to = pts[(i + 1) % pts.length]
      const dist = distance(from.easting, from.northing, to.easting, to.northing)
      const bearing = bearingFromDelta(to.easting - from.easting, to.northing - from.northing)
      const angleDeg = segmentAngle(from.easting, from.northing, to.easting, to.northing)
      const [bx, by] = offsetFromMidpoint(from.easting, from.northing, to.easting, to.northing, 4 / PX_PER_M)
      
      const bearingStr = formatBearingDegMinSec(bearing)
      const distStr = dist.toFixed(3) + ' m'
      const bearingWidth = bearingStr.length * 5.5
      const distWidth = distStr.length * 5
      const tw = Math.max(bearingWidth, distWidth) + 8
      const th = 24
      
      let textAngle = angleDeg
      if (textAngle > 90 || textAngle < -90) textAngle += 180
      
      svg += `<g transform="translate(${bx},${by})">`
      svg += `<g transform="rotate(${textAngle})">`
      svg += `<rect x="${-tw/2}" y="${-th/2}" width="${tw}" height="${th}" fill="white" opacity="0.85" stroke="none"/>`
      svg += `<text x="0" y="-3" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="8.5" font-weight="bold" fill="#000000">${escapeXml(bearingStr)}</text>`
      svg += `<text x="0" y="8" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="8" fill="#222222">${escapeXml(distStr)}</text>`
      svg += `</g></g>`
    }
    return svg
  }

  private drawMonuments(): string {
    let svg = ''
    const rawPts = this.data.parcel.boundaryPoints
    const rotPts = this.rotatedPoints
    for (let i = 0; i < rawPts.length; i++) {
      const rawPt = rawPts[i]
      const rotPt = rotPts[i]
      const cp = this.data.controlPoints.find(
        c => c.name === rawPt.name || (Math.abs(c.easting - rotPt.easting) < 0.01 && Math.abs(c.northing - rotPt.northing) < 0.01)
      )
      const cx = this.toSvgX(rotPt.easting)
      const cy = this.toSvgY(rotPt.northing)
      svg += svgCornerDot(cx, cy)
      if (!cp) continue
      switch (cp.monumentType) {
        case 'found': svg += svgFoundMonument(cx, cy); break
        case 'set': svg += svgSetMonument(cx, cy); break
        case 'masonry_nail': svg += svgMasonryNail(cx, cy, 'Masonry Nail\n1-00 on production\nof boundary'); break
        case 'iron_pin': svg += svgIronPin(cx, cy); break
      }
    }
    return svg
  }

  private drawBuildings(): string {
    const buildings = this.data.buildings
    if (!buildings || buildings.length === 0) return ''
    const defs = `<defs><pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="6" stroke="#000" stroke-width="0.5" opacity="0.12"/></pattern></defs>`
    let svg = defs
    for (const b of buildings) {
      const cx = this.toSvgX(b.easting)
      const cy = this.toSvgY(b.northing)
      const w = b.width_m * PX_PER_M
      const h = b.height_m * PX_PER_M
      svg += `<g transform="translate(${cx},${cy}) rotate(${b.rotation_deg})">`
      svg += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="rgba(220,210,190,0.3)" stroke="${C_BLACK}" stroke-width="1"/>`
      svg += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="url(#hatch)"/>`
      if (b.label) svg += `<text x="0" y="3" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="7.5" font-weight="bold" fill="${C_BLACK}">${escapeXml(b.label)}</text>`
      svg += '</g>'
    }
    return svg
  }

  private drawLotNumber(): string {
    const pts = this.rotatedPoints
    const [ce, cn] = centroid(pts)
    const id = this.data.project.parcel_id || this.data.project.name || 'LOT'
    return `<text x="${this.toSvgX(ce)}" y="${this.toSvgY(cn)}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="28" font-weight="bold" fill="${C_BLACK}" opacity="0.12">${escapeXml(id)}</text>`
  }

  private drawAreaLabel(): string {
    const pts = this.rotatedPoints
    const [ax, ay] = offsetFromMidpoint(pts[0].easting, pts[0].northing, pts[1].easting, pts[1].northing, 0.4)
    const area = this.data.parcel.area_sqm
    const ha = area / 10000
    return [
      `<text x="${ax}" y="${ay}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="11" fill="${C_BLACK}">${area.toFixed(2)} m\u00B2</text>`,
      `<text x="${ax}" y="${ay + 4.5}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="9" fill="${C_BLACK}">${ha.toFixed(4)} ha</text>`,
    ].join('')
  }

  private drawPinLabel(): string {
    const pin = this.data.parcel.pin
    if (!pin) return ''
    const pts = this.rotatedPoints
    if (pts.length === 0) return ''
    const { minE, maxE, minN, maxN } = boundingBox(pts)
    const cx = this.toSvgX((minE + maxE) / 2)
    const cy = this.toSvgY((minN + maxN) / 2)
    const tw = pin.length * 7 + 8
    const th = 12
    let svg = `<rect x="${cx - tw/2}" y="${cy - th/2}" width="${tw}" height="${th}" fill="#FFF8DC" stroke="${C_BLACK}" stroke-width="0.5" opacity="0.7"/>`
    svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="8" font-weight="bold" fill="${C_BLACK}">PIN: ${escapeXml(pin)}</text>`
    return svg
  }

  private drawPartLabels(): string {
    const parts = this.data.parcel.parts
    if (!parts || parts.length === 0) return ''
    const pts = this.rotatedPoints
    if (pts.length === 0) return ''
    const { minE, maxE, minN, maxN } = boundingBox(pts)
    const cx = this.toSvgX((minE + maxE) / 2)
    const cy = this.toSvgY((minN + maxN) / 2)
    let svg = ''
    parts.forEach((part, i) => {
      const offset = (i - (parts.length - 1) / 2) * 15
      svg += `<text x="${cx}" y="${cy + offset}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="10" font-weight="bold" fill="${C_BLACK}" opacity="0.5">${escapeXml(part)}</text>`
    })
    return svg
  }

  private drawAssociationStamp(): string {
    const firmName = this.data.project.firm_name || ''
    if (!firmName) return ''
    const x = this.drawingX + mmToPx(3)
    const y = this.drawingY + this.drawingAreaH - mmToPx(3)
    const w = mmToPx(42)
    const h = mmToPx(20)
    return [
      `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`,
      `<line x1="${x}" y1="${y - h * 0.55}" x2="${x + w}" y2="${y - h * 0.55}" stroke="${C_BLACK}" stroke-width="0.3"/>`,
      `<text x="${x + w/2}" y="${y - h * 0.8}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="4.5" font-weight="bold" fill="${C_BLACK}">SURVEYORS ASSOCIATION STAMP</text>`,
      `<text x="${x + w/2}" y="${y - h * 0.3}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(firmName)}</text>`,
      `<text x="${x + w/2}" y="${y - h * 0.12}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="4" fill="#555">Approved: ____________</text>`,
    ].join('')
  }

  private drawAdjacentLabels(): string {
    const lots = this.data.adjacentLots
    if (!lots || lots.length === 0) return ''
    let svg = ''
    const parcelCentroid = centroid(this.rotatedPoints)
    for (const lot of lots) {
      const pts = lot.boundaryPoints
      if (pts.length < 2) continue
      const [ce, cn] = centroid(pts)
      const px = this.toSvgX(ce)
      const py = this.toSvgY(cn)
      const isLeft = ce < parcelCentroid[0]
      const isTop = cn > parcelCentroid[1]
      let transform = ''
      if (isLeft) transform = `transform="translate(${px},${py}) rotate(-90)"`
      else if (!isTop) transform = `transform="translate(${px},${py}) rotate(90)"`
      svg += `<text ${transform} x="${px}" y="${py}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="11" font-weight="bold" fill="${C_BLACK}" opacity="0.45">${escapeXml(lot.id)}</text>`
    }
    return svg
  }

  private drawNorthArrow(): string {
    const rotDeg = this.data.project.northRotationDeg || 0
    const nx = this.drawingX + mmToPx(8)
    const ny = this.drawingY + mmToPx(10) + 30
    const svg = svgNorthArrow(nx, ny, mmToPx(15))
    if (rotDeg !== 0) {
      return [
        `<g transform="translate(${nx},${ny})">`,
        `<g transform="rotate(${rotDeg})">`,
        `<rect x="-1" y="${-mmToPx(15)}" width="2" height="${mmToPx(15)}" fill="${C_BLACK}"/>`,
        `<polygon points="0,${-mmToPx(15)} -3,${-mmToPx(15) + 5} 3,${-mmToPx(15) + 5}" fill="${C_BLACK}"/>`,
        `</g>`,
        `</g>`,
        `<text x="${nx}" y="${ny + mmToPx(15) + 8}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="4.5" fill="#555">${rotDeg.toFixed(1)}°</text>`,
        `<text x="${nx}" y="${ny + mmToPx(15) + 14}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="9" font-weight="bold" fill="${C_BLACK}">N</text>`,
      ].join('')
    }
    return svg
  }

  private drawScaleBar(): string {
    const scaleBarPx = mmToPx(40)
    const segmentMetres = calcScaleBarMetres(this.scale)
    const x = this.drawingX + mmToPx(8)
    const y = this.drawingY + this.drawingAreaH - mmToPx(15)
    return svgScaleBar(x, y, scaleBarPx, segmentMetres, 4)
  }

  private drawMetricNote(leftPad: number, rightPad: number): string {
    const y = this.margin + mmToPx(30)
    return `<text x="${leftPad}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="7" font-style="italic" fill="#555">Distances in metres. Divide by 0.3048 for feet.</text>`
  }

  private drawBearingSchedule(leftPad: number, panelInnerW: number): string {
    const p = this.data.project
    const entries = p.bearingSchedule || []
    const pts = this.data.parcel.boundaryPoints
    const schedule: Array<{ from: string; to: string; bearing: string; distance: number }> = entries.length > 0 ? entries : pts.map((pt, i) => {
      const to = pts[(i + 1) % pts.length]
      const dist = distance(pt.easting, pt.northing, to.easting, to.northing)
      const bearingDeg = bearingFromDelta(to.easting - pt.easting, to.northing - pt.northing)
      return {
        from: pt.name,
        to: to.name,
        bearing: formatBearingDegMinSec(bearingDeg),
        distance: dist,
      }
    })

    const startY = this.margin + mmToPx(42)
    const colW = panelInnerW / 4
    const rowH = mmToPx(3.5)
    const headerH = mmToPx(5)
    const maxRows = 15
    const tableH = headerH + Math.min(schedule.length, maxRows) * rowH

    let svg = `<rect x="${leftPad}" y="${startY}" width="${panelInnerW}" height="${tableH}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad + 2}" y="${startY + mmToPx(3.5)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">BEARING SCHEDULE</text>`
    const hY = startY + headerH
    svg += `<line x1="${leftPad}" y1="${hY}" x2="${leftPad + panelInnerW}" y2="${hY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    const headers = ['From', 'To', 'Bearing', 'Dist (m)']
    headers.forEach((h, i) => {
      svg += `<text x="${leftPad + i * colW + 2}" y="${hY + mmToPx(2.5)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="#555">${h}</text>`
    })
    const rows = schedule.slice(0, maxRows)
    rows.forEach((row, i) => {
      const ry = hY + rowH * (i + 1)
      if (i > 0) svg += `<line x1="${leftPad}" y1="${ry}" x2="${leftPad + panelInnerW}" y2="${ry}" stroke="${C_BLACK}" stroke-width="0.25" opacity="0.3"/>`
      svg += `<text x="${leftPad + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.from)}</text>`
      svg += `<text x="${leftPad + colW + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.to)}</text>`
      svg += `<text x="${leftPad + colW * 2 + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.bearing)}</text>`
      svg += `<text x="${leftPad + colW * 3 + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${row.distance.toFixed(3)}</text>`
    })
    return svg
  }

  private drawRevisionBlock(leftPad: number, panelInnerW: number): string {
    const p = this.data.project
    const revisions = p.revisions || []
    const startY = this.margin + mmToPx(42 + 6 * 4 + 6 + 6)
    const colW = panelInnerW / 4
    const rowH = mmToPx(3.5)
    const headerH = mmToPx(5)
    const maxRows = Math.max(revisions.length, 1)
    const tableH = headerH + maxRows * rowH

    let svg = `<rect x="${leftPad}" y="${startY}" width="${panelInnerW}" height="${tableH}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad + 2}" y="${startY + mmToPx(3.5)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">REVISIONS</text>`
    const hY = startY + headerH
    svg += `<line x1="${leftPad}" y1="${hY}" x2="${leftPad + panelInnerW}" y2="${hY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    const headers = ['Rev', 'Date', 'Description', 'By']
    headers.forEach((h, i) => {
      svg += `<text x="${leftPad + i * colW + 2}" y="${hY + mmToPx(2.5)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="#555">${h}</text>`
    })
    const rows = revisions.slice(0, 10)
    if (rows.length === 0) {
      rows.push({ rev: '-', date: '-', description: 'Initial issue', by: p.surveyor_name || '' })
    }
    rows.forEach((row, i) => {
      const ry = hY + rowH * (i + 1)
      if (i > 0) svg += `<line x1="${leftPad}" y1="${ry}" x2="${leftPad + panelInnerW}" y2="${ry}" stroke="${C_BLACK}" stroke-width="0.25" opacity="0.3"/>`
      svg += `<text x="${leftPad + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.rev)}</text>`
      svg += `<text x="${leftPad + colW + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.date)}</text>`
      const desc = row.description.length > 20 ? row.description.slice(0, 18) + '…' : row.description
      svg += `<text x="${leftPad + colW * 2 + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(desc)}</text>`
      svg += `<text x="${leftPad + colW * 3 + 2}" y="${ry + mmToPx(2)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.by)}</text>`
    })
    return svg
  }

  private drawSurveyorCertificate(leftPad: number, rightPad: number, panelInnerW: number): string {
    const hasMun = !!this.data.project.municipality
    const afterWarning = this.margin + mmToPx(hasMun ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(6 * 4 + 6) + mmToPx(12 + 4)
    const afterRevisions = afterWarning + mmToPx(12 + 4) + mmToPx(6)
    const p = this.data.project
    const surveyor = p.surveyor_name || ''
    const lsNo = p.surveyor_licence || ''
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

    const certY = afterRevisions
    let svg = ''
    const panelRight = leftPad + panelInnerW

    svg += `<rect x="${leftPad}" y="${certY}" width="${panelInnerW}" height="${mmToPx(2)}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad}" y="${certY + mmToPx(4)}" font-family="Share Tech Mono, Courier New" font-size="5.5" font-weight="bold" fill="${C_BLACK}">CERTIFICATE</text>`

    const lines = [
      `I, ${surveyor || '_________________________________'}, Licensed Surveyor No. LS/${lsNo || '____________'},`,
      'do hereby certify that:',
      '',
      '\u2022  The survey represented on this plan was carried out by me / under my direct',
      `   supervision in accordance with the Survey Act (Cap. 299) and the Survey`,
      '   Regulations 1994.',
      '',
      '\u2022  All measurements, computations and beacon placements are correct.',
      '',
      '\u2022  The plan has been prepared in the form and manner required by the',
      '   Director of Surveys.',
      '',
      '\u2022  The boundaries and beacons shown are accurately plotted and correctly',
      '   related to the adjoining properties.',
      '',
      `Dated this ______ day of ______________________ 20______`,
      '',
      '_____________________________________________',
      'Signature of Licensed Surveyor',
    ]

    const lineHeight = mmToPx(3.2)
    lines.forEach((line, i) => {
      svg += `<text x="${leftPad}" y="${certY + mmToPx(7) + i * lineHeight}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(line)}</text>`
    })

    const authY = certY + mmToPx(7) + lines.length * lineHeight + mmToPx(4)
    const authH = mmToPx(16)
    svg += `<rect x="${leftPad}" y="${authY}" width="${panelInnerW}" height="${authH}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad + 2}" y="${authY + mmToPx(4)}" font-family="Share Tech Mono, Courier New" font-size="4.5" font-weight="bold" fill="${C_BLACK}">AUTHENTICATION</text>`
    svg += `<text x="${leftPad + 2}" y="${authY + mmToPx(7.5)}" font-family="Share Tech Mono, Courier New" font-size="4.5" fill="#555">For Director of Surveys use only</text>`
    svg += `<text x="${leftPad + 2}" y="${authY + mmToPx(11)}" font-family="Share Tech Mono, Courier New" font-size="4.5" fill="${C_BLACK}">Signature: ___________________________</text>`
    svg += `<text x="${leftPad + 2}" y="${authY + mmToPx(14)}" font-family="Share Tech Mono, Courier New" font-size="4.5" fill="${C_BLACK}">Seal of Survey of Kenya</text>`

    return svg
  }

  private drawStreetInfo(): string {
    const street = this.data.project.street || ''
    if (!street) return ''
    const y1 = this.margin
    const y2 = y1 + mmToPx(4)
    const cx = this.drawingX + this.drawingAreaW / 2
    let svg = `<line x1="${this.drawingX}" y1="${y2}" x2="${this.drawingX + this.drawingAreaW}" y2="${y2}" stroke="${C_BLACK}" stroke-width="2"/>`
    svg += `<line x1="${this.drawingX}" y1="${y1}" x2="${this.drawingX + this.drawingAreaW}" y2="${y1}" stroke="${C_BLACK}" stroke-width="0.8"/>`
    svg += `<text x="${cx}" y="${y1 + mmToPx(2.5)}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="12" font-weight="bold" fill="${C_BLACK}">${escapeXml(street.toUpperCase())}</text>`
    return svg
  }

  private drawAdjacentLotPlanRefs(): string {
    const lots = this.data.adjacentLots
    if (!lots || lots.length === 0) return ''
    const parcelCentroid = centroid(this.data.parcel.boundaryPoints)
    let svg = ''
    for (const lot of lots) {
      const pts = lot.boundaryPoints
      if (pts.length < 2) continue
      const [ce, cn] = centroid(pts)
      const px = this.toSvgX(ce)
      const py = this.toSvgY(cn)
      const ref = lot.planReference || ''
      if (!ref) continue
      const isLeft = ce < parcelCentroid[0]
      const isTop = cn > parcelCentroid[1]
      let transform = ''
      if (isLeft) transform = `transform="translate(${px},${py}) rotate(-90)"`
      else if (!isTop) transform = `transform="translate(${px},${py}) rotate(90)"`
      svg += `<text ${transform} x="${px}" y="${py}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="8" font-weight="bold" fill="${C_BLACK}" opacity="0.4">${escapeXml(ref)}</text>`
    }
    return svg
  }

  private drawFenceOffsets(): string {
    const fenceOffsets = this.data.fenceOffsets
    if (!fenceOffsets || fenceOffsets.length === 0) return ''
    const pts = this.rotatedPoints
    if (pts.length < 2) return ''
    let svg = ''
    const renderedTypes = new Set<string>()
    const ptsRaw = this.data.parcel.boundaryPoints

    for (const fo of fenceOffsets) {
      if (fo.segmentIndex < 0 || fo.segmentIndex >= pts.length) continue
      const from = pts[fo.segmentIndex]
      const to = pts[(fo.segmentIndex + 1) % pts.length]
      const fenceType = fo.type as 'fence_on_boundary' | 'chain_link' | 'board_fence' | 'iron_fence' | 'galv_iron' | 'no_fence' | 'end_of_fence' | 'end_of_bf'
      renderedTypes.add(fo.type)

      if (fo.type === 'end_of_fence' || fo.type === 'end_of_bf') {
        const cx = this.toSvgX((from.easting + to.easting) / 2)
        const cy = this.toSvgY((from.northing + to.northing) / 2)
        svg += `<line x1="${cx - 4}" y1="${cy - 4}" x2="${cx + 4}" y2="${cy + 4}" stroke="#666666" stroke-width="0.5"/>`
        svg += `<line x1="${cx + 4}" y1="${cy - 4}" x2="${cx - 4}" y2="${cy + 4}" stroke="#666666" stroke-width="0.5"/>`
        continue
      }

      const fencePts = [
        offsetPointPerpendicular(from, to, fo.offsetMetres),
        offsetPointPerpendicular(to, pts[(fo.segmentIndex + 1) % pts.length], fo.offsetMetres),
      ]
      svg += svgFenceLine(fencePts, this.toSvgX.bind(this), this.toSvgY.bind(this), fenceType)

      if (fo.offsetMetres > 0) {
        const midE = (from.easting + to.easting) / 2
        const midN = (from.northing + to.northing) / 2
        const sx = this.toSvgX(midE)
        const sy = this.toSvgY(midN)
        const offPt = offsetPointPerpendicular(from, to, fo.offsetMetres)
        const ex = this.toSvgX(offPt.easting)
        const ey = this.toSvgY(offPt.northing)
        svg += svgFenceCallout(sx, sy, ex, ey, fo.offsetMetres)
      }
    }

    if (renderedTypes.size > 0) {
      svg += this.drawFenceLegend(Array.from(renderedTypes))
    }
    return svg
  }

  private drawFenceLegend(types: string[]): string {
    const x = this.drawingX + this.drawingAreaW - mmToPx(32)
    const y = this.drawingY + mmToPx(5)
    let svg = `<rect x="${x - mmToPx(1)}" y="${y - mmToPx(3)}" width="${mmToPx(30)}" height="${mmToPx(4 + types.length * 4.5)}" fill="white" fill-opacity="0.9" stroke="${C_BLACK}" stroke-width="0.3"/>`
    svg += `<text x="${x}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">FENCE TYPES</text>`
    types.forEach((t, i) => {
      svg += `<text x="${x}" y="${y + (i + 1) * mmToPx(4)}" font-family="Share Tech Mono, Courier New" font-size="4.5" fill="#555">${t.replace(/_/g, ' ')}</text>`
    })
    return svg
  }

  private drawRightPanel(): string {
    const p = this.data.project
    const leftPad = this.panelX + mmToPx(3)
    const rightPad = this.panelX + this.panelW - mmToPx(3)
    const panelInnerW = this.panelW - mmToPx(6)
    const svgParts: string[] = []
    svgParts.push(this.drawReportHeader(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawMetricNote(leftPad, rightPad))
    svgParts.push(this.drawPlanInfoBox(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawBearingSchedule(leftPad, panelInnerW))
    svgParts.push(this.drawLegend(leftPad, panelInnerW))
    svgParts.push(this.drawWarningBox(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawRevisionBlock(leftPad, panelInnerW))
    svgParts.push(this.drawSurveyorCertificate(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawCompanyFooter(leftPad, rightPad))
    return svgParts.join('')
  }

  private drawReportHeader(leftPad: number, rightPad: number, panelInnerW: number): string {
    const p = this.data.project
    const hasMun = !!p.municipality
    let y = this.margin + mmToPx(4)
    let svg = ''
    const text = (content: string, yPos: number, size: number, weight = 'normal', color = C_BLACK) =>
      `<text x="${leftPad}" y="${yPos}" font-family="Share Tech Mono, Courier New" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(content)}</text>`
    const hline = (y1: number) =>
      `<line x1="${leftPad}" y1="${y1}" x2="${rightPad}" y2="${y1}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += text('SURVEYOR\'S REAL PROPERTY REPORT', y, 5)
    svg += text(p.plan_title || 'BOUNDARY IDENTIFICATION PLAN', y + mmToPx(6), 9, 'bold')
    if (hasMun) svg += text(p.municipality!, y + mmToPx(11), 16, 'bold')
    svg += text(`SCALE ${calcScaleLabel(this.scale)}`, y + mmToPx(hasMun ? 18 : 12), 8, 'bold')
    svg += hline(y + mmToPx(hasMun ? 21 : 15))
    svg += text(p.firm_name || '', y + mmToPx(hasMun ? 25 : 19), 8, 'bold')
    svg += text(`\u00A9 ${new Date().getFullYear()}`, y + mmToPx(hasMun ? 28.5 : 22.5), 6)
    svg += text('Distances shown are in metres.', y + mmToPx(hasMun ? 33 : 27), 7, 'normal', '#555')
    svg += text('Divide by 0.3048 for feet.', y + mmToPx(hasMun ? 36 : 30), 7, 'italic', '#555')
    return svg
  }

  private drawPlanInfoBox(leftPad: number, rightPad: number, panelInnerW: number): string {
    const p = this.data.project
    const hasMun = !!p.municipality
    const startY = this.margin + mmToPx(hasMun ? 40 : 34)
    let y = startY
    let svg = ''
    const box = (yPos: number, h: number) =>
      `<rect x="${leftPad}" y="${yPos}" width="${panelInnerW}" height="${h}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    const row = (label: string, value: string) =>
      `<text x="${leftPad}" y="${y += mmToPx(4)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="#555">${escapeXml(label)}</text><text x="${leftPad + mmToPx(22)}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">${escapeXml(value)}</text>`
    svg += box(y, mmToPx(4))
    svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">PLAN INFORMATION</text>`
    y += mmToPx(4)
    const info: Array<[string, string]> = [
      ['Title Ref:', p.reference || '\u2014'],
      ['Datum:', p.datum || 'WGS84'],
      ['UTM Zone:', `${p.utm_zone}${p.hemisphere}`],
      ['Area:', p.area_sqm ? `${p.area_sqm.toFixed(2)} m\u00B2` : '\u2014'],
      ['Council:', p.municipality || '\u2014'],
      ['Client:', p.client_name || '\u2014'],
      ['Drawing No:', p.drawing_no || `MD-${Date.now().toString().slice(-6)}`],
    ]
    for (const [label, value] of info) svg += row(label, value)
    return svg
  }

  private drawLegend(leftPad: number, panelInnerW: number): string {
    const hasMun = !!this.data.project.municipality
    const afterInfo = this.margin + mmToPx(hasMun ? 40 : 34) + mmToPx(7 * 4 + 4 + 6)
    let y = afterInfo
    let svg = ''
    const box = (yPos: number, h: number) =>
      `<rect x="${leftPad}" y="${yPos}" width="${panelInnerW}" height="${h}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += box(y, mmToPx(4))
    svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">LEGEND</text>`
    const items = [
      { label: 'Subject boundary', symbol: `<line x1="0" y1="0" x2="20" y2="0" stroke="${C_BLACK}" stroke-width="2.5"/>` },
      { label: 'Adjacent boundary', symbol: `<line x1="0" y1="0" x2="20" y2="0" stroke="${C_BLACK}" stroke-width="1"/>` },
      { label: 'Found monument', symbol: `<rect x="0" y="-3" width="6" height="6" fill="${C_GREEN}" stroke="${C_BLACK}" stroke-width="0.5"/>` },
      { label: 'Set monument', symbol: `<circle cx="3" cy="0" r="3" fill="none" stroke="${C_GREEN}" stroke-width="1.5"/>` },
      { label: 'Masonry Nail', symbol: `<circle cx="3" cy="0" r="2.5" fill="${C_RED}"/>` },
      { label: 'Iron Pin', symbol: `<circle cx="3" cy="0" r="2" fill="${C_RED}" stroke="${C_BLACK}" stroke-width="0.4"/>` },
    ]
    for (const item of items) {
      svg += `<g transform="translate(${leftPad}, ${y += mmToPx(4)})">${item.symbol}</g>`
      svg += `<text x="${leftPad + mmToPx(10)}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(item.label)}</text>`
    }
    return svg
  }

  private drawWarningBox(leftPad: number, rightPad: number, panelInnerW: number): string {
    const hasMun = !!this.data.project.municipality
    const afterLegend = this.margin + mmToPx(hasMun ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(6 * 4 + 6)
    const y = afterLegend
    let svg = ''
    svg += `<rect x="${leftPad}" y="${y}" width="${panelInnerW}" height="${mmToPx(12)}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<rect x="${leftPad + 0.5}" y="${y + 0.5}" width="${panelInnerW - 1}" height="${mmToPx(12) - 1}" fill="${C_WARNING_BG}"/>`
    const lines = ['WARNING: Fence set-out pegs', 'must be verified on site.', 'Dimensions subject to', 'survey verification.']
    lines.forEach((line, i) => {
      svg += `<text x="${leftPad + mmToPx(2)}" y="${y + mmToPx(3) + i * mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" font-weight="${i === 0 ? 'bold' : 'normal'}" fill="${C_BLACK}">${escapeXml(line)}</text>`
    })
    return svg
  }

  private drawCompanyFooter(leftPad: number, rightPad: number): string {
    const hasMun = !!this.data.project.municipality
    const afterCert = this.margin + mmToPx(hasMun ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(6 * 4 + 6) + mmToPx(12 + 4) + mmToPx(20)
    const y = afterCert
    const p = this.data.project
    let svg = `<line x1="${leftPad}" y1="${y}" x2="${rightPad}" y2="${y}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    if (p.firm_phone) svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(p.firm_phone)}</text>`
    if (p.firm_email) svg += `<text x="${leftPad}" y="${y + mmToPx(6)}" font-family="Share Tech Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(p.firm_email)}</text>`
    if (p.iskRegNo) svg += `<text x="${leftPad}" y="${y + mmToPx(9)}" font-family="Share Tech Mono, Courier New" font-size="4.5" fill="${C_BLACK}">ISK (Chapter of Land Surveyors) Membership No. ${escapeXml(p.iskRegNo)}</text>`
    return svg
  }

  private drawSheetFooter(): string {
    const footerY = this.pageH - this.titleBlockH
    const footerH = this.titleBlockH
    const p = this.data.project
    const cols = 8
    const colW = (this.pageW - this.margin * 2) / cols
    let svg = `<rect x="${this.margin}" y="${footerY}" width="${this.pageW - this.margin * 2}" height="${footerH}" fill="#F8F8F8"/>`
    svg += `<line x1="${this.margin}" y1="${footerY}" x2="${this.pageW - this.margin}" y2="${footerY}" stroke="${C_BLACK}" stroke-width="2"/>`
    const fields: Array<[string, string]> = [
      ['Field', ''],
      ['Drawing', p.drawing_no || `MD-${Date.now().toString().slice(-6)}`],
      ['Checked', ''],
      ['Address', p.firm_address || ''],
      ['Date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
      ['Work Order', ''],
      ['Job No.', p.reference || ''],
      [p.firm_name || 'METARDU', ''],
    ]
    let x = this.margin
    for (let i = 0; i < cols; i++) {
      const [label, value] = fields[i] || ['', '']
      const cx = x + colW / 2
      svg += `<line x1="${x}" y1="${footerY}" x2="${x}" y2="${footerY + footerH}" stroke="${C_BLACK}" stroke-width="0.5"/>`
      if (i === cols - 1) {
        svg += `<rect x="${x}" y="${footerY}" width="${colW}" height="${footerH}" fill="${C_BLACK}"/>`
        svg += `<text x="${cx}" y="${footerY + footerH / 2 + 4}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="11" font-weight="bold" fill="white">${escapeXml(label)}</text>`
      } else {
        svg += `<text x="${cx}" y="${footerY + mmToPx(4)}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="5" fill="#555">${escapeXml(label)}</text>`
        svg += `<text x="${cx}" y="${footerY + mmToPx(10)}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="7" font-weight="bold" fill="${C_BLACK}">${escapeXml(value)}</text>`
      }
      x += colW
    }
    return svg
  }

  private drawLegalReferenceLine(): string {
    const y = this.pageH - mmToPx(6)
    const ref = 'Prepared in accordance with: Survey Act Cap. 299 | Survey Regulations 1994 | RDM 1.1 (2025) | RDM 1.3 (2023) | Ministry of Roads and Transport, Republic of Kenya'
    return `<text x="${this.margin}" y="${y}" font-family="Share Tech Mono, Courier New" font-size="4" fill="#555">${escapeXml(ref)}</text>`
  }

  render(): string {
    const totalSheets = parseInt(this.data.project.totalSheets || '1', 10)
    if (totalSheets > 1) return this.renderMultiSheet()

    const layers: string[] = []
    layers.push(this.drawBackground())
    layers.push(this.drawSheetBorder())
    if (this.opts.includePanel) layers.push(this.drawPanelDivider())
    if (this.opts.includeGrid) layers.push(this.drawGrid())
    layers.push(this.drawLotFill())
    layers.push(this.drawAdjacentLots())
    layers.push(this.drawStreetInfo())
    layers.push(this.drawBoundary())
    layers.push(this.drawBoundaryLabels())
    layers.push(this.drawMonuments())
    layers.push(this.drawAdjacentLotPlanRefs())
    layers.push(this.drawFenceOffsets())
    layers.push(this.drawLotNumber())
    layers.push(this.drawPinLabel())
    layers.push(this.drawPartLabels())
    layers.push(this.drawAreaLabel())
    layers.push(this.drawAdjacentLabels())
    layers.push(this.drawBuildings())
    layers.push(this.drawNorthArrow())
    layers.push(this.drawScaleBar())
    layers.push(this.drawAssociationStamp())
    if (this.opts.includePanel) layers.push(this.drawRightPanel())
    layers.push(this.drawSheetFooter())
    layers.push(this.drawLegalReferenceLine())
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.pageW} ${this.pageH}" width="${this.pageW}" height="${this.pageH}" style="font-family: 'Share Tech Mono', 'Courier New', monospace;">${layers.join('\n')}</svg>`
  }

  private renderMultiSheet(): string {
    const totalSheets = parseInt(this.data.project.totalSheets || '1', 10)
    if (totalSheets <= 1) return this.render()

    const cols = Math.ceil(Math.sqrt(totalSheets))
    const rows = Math.ceil(totalSheets / cols)
    const sheetW = this.pageW * cols
    const sheetH = this.pageH * rows

    const sheets: string[] = []
    for (let i = 0; i < totalSheets; i++) {
      const sheetCol = i % cols
      const sheetRow = Math.floor(i / cols)
      const originX = sheetCol * this.pageW
      const originY = sheetRow * this.pageH
      const sheetNum = i + 1
      const label = `Sheet ${sheetNum} of ${totalSheets}`

      const layers: string[] = []
      layers.push(`<g transform="translate(${originX},${originY})">`)
      layers.push(this.drawBackground())
      layers.push(this.drawSheetBorder())
      if (this.opts.includePanel) layers.push(this.drawPanelDivider())
      if (this.opts.includeGrid) layers.push(this.drawGrid())
      layers.push(this.drawLotFill())
      layers.push(this.drawAdjacentLots())
      layers.push(this.drawStreetInfo())
      layers.push(this.drawBoundary())
      layers.push(this.drawBoundaryLabels())
      layers.push(this.drawMonuments())
      layers.push(this.drawAdjacentLotPlanRefs())
      layers.push(this.drawFenceOffsets())
      layers.push(this.drawLotNumber())
      layers.push(this.drawPinLabel())
      layers.push(this.drawPartLabels())
      layers.push(this.drawAreaLabel())
      layers.push(this.drawAdjacentLabels())
      layers.push(this.drawBuildings())
      layers.push(this.drawNorthArrow())
      layers.push(this.drawScaleBar())
      layers.push(this.drawAssociationStamp())
      if (this.opts.includePanel) layers.push(this.drawRightPanel())
      layers.push(this.drawSheetFooter())
      layers.push(this.drawLegalReferenceLine())
      layers.push(`<text x="${this.drawingX + this.drawingAreaW / 2}" y="${this.margin + mmToPx(3)}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="10" font-weight="bold" fill="${C_BLACK}">${escapeXml(label)}</text>`)
      layers.push('</g>')
      sheets.push(layers.join('\n'))
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" style="font-family: 'Share Tech Mono', 'Courier New', monospace; background: white;">${sheets.join('\n')}</svg>`
  }

  getScale(): number { return this.scale }

  exportToCSV(): string {
    return generateBearingScheduleCSV(this.data)
  }
}
