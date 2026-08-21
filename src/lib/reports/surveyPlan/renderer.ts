import { createHash } from 'crypto'
import type { SurveyPlanData, PlanOptions } from './types'
import { getRoadReserveWidth } from './types'
import { generateBearingScheduleCSV } from '../bearingScheduleCSV'
import { computeTraverseAccuracy } from '../traverseAccuracy'
import {
  PX_PER_M,
  PAGE_WIDTH_MM, PAGE_HEIGHT_MM,
  STANDARD_SCALES, mmToPx,
  bearingFromDelta, distance,
  segmentAngle, offsetFromMidpoint,
  centroid, boundingBox, calcScaleLabel, calcScaleBarMetres,
  formatBearingDegMinSec,
  calculateGridInterval,
  offsetPointPerpendicular, rotatePoints,
  formatChainage, computeChainageAlongAlignment,
} from './geometry'
import {
  svgFoundMonument, svgSetMonument, svgMasonryNail, svgIronPin,
  svgCornerDot, svgNorthArrow, svgScaleBar,
  svgSheetBorder, svgPanelDivider,
  svgFenceLine, svgFenceCallout,
  svgIndicatoryBeaconCallout,
  escapeXml, polylineFromPoints,
  C_BLACK, C_GREEN, C_RED, C_GRID_MINOR, C_GRID_MAJOR,
  C_LOT_FILL, C_WARNING_BG,
} from './symbols'
import { solveAndRenderBoundaryLabels } from './labelPlacement'

export class SurveyPlanRenderer {
  protected data: SurveyPlanData
  protected opts: Required<PlanOptions>
  protected pageW: number
  protected pageH: number
  protected drawingAreaW: number
  protected drawingAreaH: number
  protected drawingX: number
  protected drawingY: number
  protected panelX: number
  protected panelW: number
  protected margin = mmToPx(10)
  protected titleBlockH = mmToPx(44)
  protected scale = 500
  protected mPerPx = 1
  protected toSvgX!: (m: number) => number
  protected toSvgY!: (m: number) => number
  protected rotatedPoints: Array<{ easting: number; northing: number }> = []

  constructor(data: SurveyPlanData, options?: PlanOptions) {
    this.data = data
    this.opts = {
      paperSize: options?.paperSize ?? 'a3',
      scale: options?.scale ?? 0,
      includeGrid: options?.includeGrid ?? true,
      includePanel: options?.includePanel ?? true,
      language: options?.language ?? 'en',
      watermarkPlan: options?.watermarkPlan ?? 'free',
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

  protected computeScale(): void {
    const parcel = this.data.parcel
    const bb = boundingBox(parcel.boundaryPoints)
    const drawW = this.drawingAreaW - mmToPx(20)
    const drawH = this.drawingAreaH - mmToPx(20)
    
    if (this.opts.scale > 0) {
      this.scale = this.opts.scale
    } else {
      const actualPxPerM = Math.min(drawW / bb.rangeE, drawH / bb.rangeN)
      const rawScale = PX_PER_M / actualPxPerM
      this.scale = STANDARD_SCALES.find((s: number) => s >= rawScale) || 500
    }
    
    const pxPerM = PX_PER_M / this.scale
    this.mPerPx = 1 / pxPerM

    const offsetX = (drawW - bb.rangeE * pxPerM) / 2
    const offsetY = (drawH - bb.rangeN * pxPerM) / 2
    
    this.toSvgX = (m) => this.drawingX + mmToPx(10) + offsetX + (m - bb.minE) * pxPerM
    this.toSvgY = (m) => this.drawingY + mmToPx(10) + offsetY + (bb.maxN - m) * pxPerM
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

  protected drawBackground(): string {
    return `<rect x="0" y="0" width="${this.pageW}" height="${this.pageH}" fill="white"/>`
  }

  protected drawSheetBorder(): string {
    return svgSheetBorder(this.pageW, this.pageH)
  }

  protected drawPanelDivider(): string {
    return svgPanelDivider(this.panelX, this.pageH, this.margin, this.titleBlockH + this.margin)
  }

  protected drawGrid(): string {
    const parcel = this.data.parcel
    const bb = boundingBox(parcel.boundaryPoints)

    // Scale-aware grid interval — keeps line density readable at any scale
    // (was a hardcoded 50 m, which is sparse on small plans and dense on large).
    const interval = calculateGridInterval(this.scale)
    const majorEvery = 2

    const gridMinE = Math.floor(bb.minE / interval) * interval
    const gridMaxE = Math.ceil(bb.maxE / interval) * interval
    const gridMinN = Math.floor(bb.minN / interval) * interval
    const gridMaxN = Math.ceil(bb.maxN / interval) * interval
    
    let svg = ''
    
    // Vertical lines (Easting)
    for (let e = gridMinE; e <= gridMaxE; e += interval) {
      const x = this.toSvgX(e)
      const y1 = this.toSvgY(gridMinN)
      const y2 = this.toSvgY(gridMaxN)
      const isMajor = (Math.round(e / interval) % majorEvery) === 0
      const stroke = isMajor ? C_GRID_MAJOR : C_GRID_MINOR
      const width = isMajor ? 0.8 : 0.4
      const dash = isMajor ? 'none' : '2,4'
      
      svg += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${dash}" opacity="0.7"/>`
      
      if (isMajor) {
        const ly = this.drawingY + this.drawingAreaH + 12
        svg += `<text x="${x}" y="${ly}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="8" fill="${C_BLACK}" opacity="0.6">${e}</text>`
      }
    }
    
    // Horizontal lines (Northing)
    for (let n = gridMinN; n <= gridMaxN; n += interval) {
      const y = this.toSvgY(n)
      const x1 = this.toSvgX(gridMinE)
      const x2 = this.toSvgX(gridMaxE)
      const isMajor = (Math.round(n / interval) % majorEvery) === 0
      const stroke = isMajor ? C_GRID_MAJOR : C_GRID_MINOR
      const width = isMajor ? 0.8 : 0.4
      const dash = isMajor ? 'none' : '2,4'
      
      svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${stroke}" stroke-width="${width}" stroke-dasharray="${dash}" opacity="0.7"/>`
      
      if (isMajor) {
        const lx = this.drawingX - 4
        svg += `<text x="${lx}" y="${y + 3}" text-anchor="end" font-family="JetBrains Mono, Courier New" font-size="8" fill="${C_BLACK}" opacity="0.6">${n}</text>`
      }
    }
    
    return svg
  }


  protected drawLotFill(): string {
    const pts = this.data.parcel.boundaryPoints
    if (pts.length < 3) return ''
    const coords: string[] = []
    for (const p of pts) coords.push(`${this.toSvgX(p.easting)},${this.toSvgY(p.northing)}`)
    coords.push(`${this.toSvgX(pts[0].easting)},${this.toSvgY(pts[0].northing)}`)
    return `<polygon points="${coords.join(' ')}" fill="${C_LOT_FILL}" stroke="none"/>`
  }

  protected drawAdjacentLots(): string {
    const lots = this.data.adjacentLots
    if (!lots || lots.length === 0) return ''
    let svg = ''
    for (const lot of lots) {
      if (lot.boundaryPoints.length < 2) continue
      svg += polylineFromPoints(lot.boundaryPoints, this.toSvgX, this.toSvgY, true)
    }
    return svg
  }

  protected drawBoundary(): string {
    const pts = this.data.parcel.boundaryPoints
    if (pts.length < 2) return ''
    return polylineFromPoints(pts, this.toSvgX, this.toSvgY, true).replace('stroke-width="1"', 'stroke-width="2.5"')
  }

  protected drawBoundaryLabels(): string {
    return solveAndRenderBoundaryLabels(this.rotatedPoints, this.toSvgX, this.toSvgY)
  }

  protected drawMonuments(): string {
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
        case 'indicatory_beacon': {
          const cornerX = this.toSvgX(rotPt.easting)
          const cornerY = this.toSvgY(rotPt.northing)
          const offsetPx = 20
          const ibx = cornerX + offsetPx
          const iby = cornerY + offsetPx
          svg += svgIndicatoryBeaconCallout(ibx, iby, cornerX, cornerY, this.scale)
          break
        }
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
      if (b.label) svg += `<text x="0" y="3" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="7.5" font-weight="bold" fill="${C_BLACK}">${escapeXml(b.label)}</text>`
      svg += '</g>'
    }
    return svg
  }

  private drawLotNumber(): string {
    const pts = this.rotatedPoints
    const [ce, cn] = centroid(pts)
    const id = this.data.project.parcel_id || this.data.project.name || 'LOT'
    return `<text x="${this.toSvgX(ce)}" y="${this.toSvgY(cn)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="28" font-weight="bold" fill="${C_BLACK}" opacity="0.12">${escapeXml(id)}</text>`
  }

  private drawAreaLabel(): string {
    const pts = this.rotatedPoints
    const [ax, ay] = offsetFromMidpoint(pts[0].easting, pts[0].northing, pts[1].easting, pts[1].northing, 0.4)
    const area = this.data.parcel.area_sqm
    const ha = area / 10000
    return [
      `<text x="${ax}" y="${ay}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="11" fill="${C_BLACK}">${area.toFixed(2)} m\u00B2</text>`,
      `<text x="${ax}" y="${ay + 4.5}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="9" fill="${C_BLACK}">${ha.toFixed(4)} ha</text>`,
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
    svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="8" font-weight="bold" fill="${C_BLACK}">PIN: ${escapeXml(pin)}</text>`
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
      svg += `<text x="${cx}" y="${cy + offset}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="10" font-weight="bold" fill="${C_BLACK}" opacity="0.5">${escapeXml(part)}</text>`
    })
    return svg
  }

  private drawAssociationStamp(): string {
    const p = this.data.project
    const firmName = p.firm_name || ''
    const surveyorName = p.surveyor_name || ''
    const lsNo = p.surveyor_licence || ''
    const iskRegNo = p.iskRegNo || ''
    const x = this.drawingX + mmToPx(3)
    const y = this.drawingY + this.drawingAreaH - mmToPx(3)
    const w = mmToPx(52) // Wider to accommodate ISK stamp + surveyor seal side by side
    const h = mmToPx(24) // Taller for dual areas

    let svg = ''

    // Outer rectangle for combined stamp area
    svg += `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<line x1="${x}" y1="${y - h + mmToPx(4)}" x2="${x + w}" y2="${y - h + mmToPx(4)}" stroke="${C_BLACK}" stroke-width="0.3"/>`
    svg += `<text x="${x + w/2}" y="${y - h + mmToPx(2.8)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="4" font-weight="bold" fill="${C_BLACK}">STAMP & SEAL AREA</text>`

    // Left side: ISK Association Rubber Stamp area
    const iskX = x + mmToPx(1)
    const iskY = y - h + mmToPx(5)
    const iskW = mmToPx(28)
    const iskH = mmToPx(12)
    svg += `<rect x="${iskX}" y="${iskY}" width="${iskW}" height="${iskH}" fill="none" stroke="#999" stroke-width="0.3" stroke-dasharray="2,1"/>`
    svg += `<text x="${iskX + iskW/2}" y="${iskY + mmToPx(3)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#aaa">ISK ASSOCIATION</text>`
    svg += `<text x="${iskX + iskW/2}" y="${iskY + mmToPx(5.5)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#aaa">RUBBER STAMP</text>`
    if (firmName) {
      svg += `<text x="${iskX + iskW/2}" y="${iskY + mmToPx(8)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="2.5" fill="#bbb">${escapeXml(firmName)}</text>`
    }
    svg += `<text x="${iskX + iskW/2}" y="${iskY + mmToPx(10.5)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="2.5" fill="#ccc">Approved: ____________</text>`

    // Right side: Surveyor's Corporate Seal area
    const sealX = x + mmToPx(31)
    const sealY = y - h + mmToPx(5)
    const sealW = mmToPx(20)
    const sealH = mmToPx(12)
    svg += `<rect x="${sealX}" y="${sealY}" width="${sealW}" height="${sealH}" fill="none" stroke="#999" stroke-width="0.3" stroke-dasharray="2,1"/>`
    svg += `<circle cx="${sealX + sealW/2}" cy="${sealY + sealH/2}" r="${mmToPx(4)}" fill="none" stroke="#ccc" stroke-width="0.3" stroke-dasharray="1.5,1"/>`
    svg += `<text x="${sealX + sealW/2}" y="${sealY + sealH/2 - 1}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#aaa">SURVEYOR</text>`
    svg += `<text x="${sealX + sealW/2}" y="${sealY + sealH/2 + 2}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#aaa">SEAL</text>`

    // Signature line above surveyor credentials
    const sigY = y - h + mmToPx(17)
    svg += `<line x1="${x + mmToPx(1)}" y1="${sigY}" x2="${x + w - mmToPx(1)}" y2="${sigY}" stroke="${C_BLACK}" stroke-width="0.3"/>`

    // Surveyor credentials below stamp area
    const credY = y - h + mmToPx(19)
    if (surveyorName) {
      svg += `<text x="${x + mmToPx(1)}" y="${credY}" font-family="JetBrains Mono, Courier New" font-size="3.5" font-weight="bold" fill="${C_BLACK}">${escapeXml(surveyorName)}</text>`
    }
    if (lsNo) {
      svg += `<text x="${x + mmToPx(1)}" y="${credY + mmToPx(2.5)}" font-family="JetBrains Mono, Courier New" font-size="3" fill="#555">LS/${escapeXml(lsNo)}</text>`
    }
    if (iskRegNo) {
      svg += `<text x="${x + mmToPx(1)}" y="${credY + mmToPx(5)}" font-family="JetBrains Mono, Courier New" font-size="3" fill="#555">ISK Reg. ${escapeXml(iskRegNo)}</text>`
    }

    // Date line below surveyor credentials
    const dateY = credY + mmToPx(7)
    svg += `<text x="${x + mmToPx(1)}" y="${dateY}" font-family="JetBrains Mono, Courier New" font-size="3" fill="#555">Date: ___________</text>`

    return svg
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
      svg += `<text ${transform} x="${px}" y="${py}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="11" font-weight="bold" fill="${C_BLACK}" opacity="0.45">${escapeXml(lot.id)}</text>`
    }
    return svg
  }

  protected drawNorthArrow(): string {
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
        `<text x="${nx}" y="${ny + mmToPx(15) + 8}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="#555">${rotDeg.toFixed(1)}°</text>`,
        `<text x="${nx}" y="${ny + mmToPx(15) + 14}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="9" font-weight="bold" fill="${C_BLACK}">N</text>`,
      ].join('')
    }
    return svg
  }

  protected drawScaleBar(): string {
    const scaleBarPx = mmToPx(40)
    const segmentMetres = calcScaleBarMetres(this.scale)
    const x = this.drawingX + mmToPx(8)
    const y = this.drawingY + this.drawingAreaH - mmToPx(15)
    return svgScaleBar(x, y, scaleBarPx, segmentMetres, 4)
  }

  private drawDatumNote(leftPad: number, _panelInnerW: number): string {
    const p = this.data.project
    const datum = p.datum || 'ARC1960'
    const zone = `${p.utm_zone || 37}${p.hemisphere || 'S'}`
    const note = `Coordinates: UTM Zone ${zone}, ${datum} (Clarke 1880) — Survey Act Cap. 299 | RDM 1.1 §5.2`
    const y = this.margin + mmToPx(25)
    return `<text x="${leftPad}" y="${y}" font-family="JetBrains Mono, Courier New" font-size="4.5" font-style="italic" fill="#555">${escapeXml(note)}</text>`
  }

  private drawCoordinateSchedule(leftPad: number, panelInnerW: number): string {
    const p = this.data.project
    const pts = this.data.parcel.boundaryPoints
    const datum = p.datum || 'ARC1960'
    const zone = `${p.utm_zone || 37}${p.hemisphere || 'S'}`
    const startY = this.margin + mmToPx(42)
    const colW = panelInnerW / 4
    const rowH = mmToPx(3.5)
    const headerH = mmToPx(5)
    const maxRows = Math.min(pts.length, 12)
    const tableH = headerH + maxRows * rowH

    let svg = `<rect x="${leftPad}" y="${startY}" width="${panelInnerW}" height="${tableH}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    // T1.5 FIX (2026-07-09): Derive the EPSG code from the project's actual
    // UTM zone, not a hardcoded 'EPSG:21037'. A Zone 36 project (Kisumu,
    // Mombasa) would show the wrong EPSG in the PDF label.
    const zoneNum = p.utm_zone || 37
    const epsgCode = datum === 'ARC1960'
      ? `EPSG:210${zoneNum < 10 ? '0' + zoneNum : zoneNum}`  // Arc 1960: 21036, 21037
      : `EPSG:327${zoneNum < 10 ? '0' + zoneNum : zoneNum}`   // WGS 84: 32736, 32737
    const label = datum === 'ARC1960' ? `COORDINATE SCHEDULE (${datum} / UTM ${zone} ${epsgCode})` : `COORDINATE SCHEDULE (${datum})`
    svg += `<text x="${leftPad + 2}" y="${startY + mmToPx(3.5)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">${escapeXml(label)}</text>`
    const hY = startY + headerH
    svg += `<line x1="${leftPad}" y1="${hY}" x2="${leftPad + panelInnerW}" y2="${hY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    const headers = ['Point', 'Easting', 'Northing', '']
    headers.forEach((h, i) => {
      svg += `<text x="${leftPad + i * colW + 2}" y="${hY + mmToPx(2.5)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="#555">${h}</text>`
    })
    pts.slice(0, maxRows).forEach((pt, i) => {
      const ry = hY + rowH * (i + 1)
      if (i > 0) svg += `<line x1="${leftPad}" y1="${ry}" x2="${leftPad + panelInnerW}" y2="${ry}" stroke="${C_BLACK}" stroke-width="0.25" opacity="0.3"/>`
      svg += `<text x="${leftPad + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(pt.name)}</text>`
      svg += `<text x="${leftPad + colW + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${pt.easting.toFixed(3)}</text>`
      svg += `<text x="${leftPad + colW * 2 + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${pt.northing.toFixed(3)}</text>`
    })
    return svg
  }

  private drawMetricNote(leftPad: number, _rightPad: number): string {
    const y = this.margin + mmToPx(30)
    return `<text x="${leftPad}" y="${y}" font-family="JetBrains Mono, Courier New" font-size="7" font-style="italic" fill="#555">Distances in metres. Divide by 0.3048 for feet.</text>`
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
    svg += `<text x="${leftPad + 2}" y="${startY + mmToPx(3.5)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">BEARING SCHEDULE</text>`
    const hY = startY + headerH
    svg += `<line x1="${leftPad}" y1="${hY}" x2="${leftPad + panelInnerW}" y2="${hY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    const headers = ['From', 'To', 'Bearing', 'Dist (m)']
    headers.forEach((h, i) => {
      svg += `<text x="${leftPad + i * colW + 2}" y="${hY + mmToPx(2.5)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="#555">${h}</text>`
    })
    const rows = schedule.slice(0, maxRows)
    rows.forEach((row, i) => {
      const ry = hY + rowH * (i + 1)
      if (i > 0) svg += `<line x1="${leftPad}" y1="${ry}" x2="${leftPad + panelInnerW}" y2="${ry}" stroke="${C_BLACK}" stroke-width="0.25" opacity="0.3"/>`
      svg += `<text x="${leftPad + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.from)}</text>`
      svg += `<text x="${leftPad + colW + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.to)}</text>`
      svg += `<text x="${leftPad + colW * 2 + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.bearing)}</text>`
      svg += `<text x="${leftPad + colW * 3 + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${row.distance.toFixed(3)}</text>`
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
    svg += `<text x="${leftPad + 2}" y="${startY + mmToPx(3.5)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">REVISIONS</text>`
    const hY = startY + headerH
    svg += `<line x1="${leftPad}" y1="${hY}" x2="${leftPad + panelInnerW}" y2="${hY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    const headers = ['Rev', 'Date', 'Description', 'By']
    headers.forEach((h, i) => {
      svg += `<text x="${leftPad + i * colW + 2}" y="${hY + mmToPx(2.5)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="#555">${h}</text>`
    })
    const rows = revisions.slice(0, 10)
    if (rows.length === 0) {
      rows.push({ rev: 'A', date: new Date().toLocaleDateString('en-GB'), description: 'Initial issue', by: p.surveyor_name || '' })
    }
    // Column separator lines for better readability
    for (let c = 1; c < 4; c++) {
      const colX = leftPad + colW * c
      svg += `<line x1="${colX}" y1="${hY}" x2="${colX}" y2="${hY + rows.length * rowH}" stroke="${C_BLACK}" stroke-width="0.15" opacity="0.25"/>`
    }
    rows.forEach((row, i) => {
      const ry = hY + rowH * (i + 1)
      if (i > 0) svg += `<line x1="${leftPad}" y1="${ry}" x2="${leftPad + panelInnerW}" y2="${ry}" stroke="${C_BLACK}" stroke-width="0.25" opacity="0.3"/>`
      svg += `<text x="${leftPad + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.rev)}</text>`
      svg += `<text x="${leftPad + colW + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.date)}</text>`
      const desc = row.description.length > 20 ? row.description.slice(0, 18) + '…' : row.description
      svg += `<text x="${leftPad + colW * 2 + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(desc)}</text>`
      svg += `<text x="${leftPad + colW * 3 + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(row.by)}</text>`
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

    const certY = afterRevisions
    let svg = ''

    svg += `<rect x="${leftPad}" y="${certY}" width="${panelInnerW}" height="${mmToPx(2)}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad}" y="${certY + mmToPx(4)}" font-family="JetBrains Mono, Courier New" font-size="5.5" font-weight="bold" fill="${C_BLACK}">CERTIFICATE</text>`

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
      svg += `<text x="${leftPad}" y="${certY + mmToPx(7) + i * lineHeight}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(line)}</text>`
    })

    const authY = certY + mmToPx(7) + lines.length * lineHeight + mmToPx(4)
    const authH = mmToPx(35) // Expanded to include Letter No. and SoK Reference
    svg += `<rect x="${leftPad}" y="${authY}" width="${panelInnerW}" height="${authH}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad + 2}" y="${authY + mmToPx(4)}" font-family="JetBrains Mono, Courier New" font-size="4.5" font-weight="bold" fill="${C_BLACK}">AUTHENTICATION — FOR DIRECTOR OF SURVEYS</text>`
    svg += `<line x1="${leftPad}" y1="${authY + mmToPx(5.5)}" x2="${leftPad + panelInnerW}" y2="${authY + mmToPx(5.5)}" stroke="${C_BLACK}" stroke-width="0.3"/>`

    // Letter No. — reference number for the Director of Surveys' covering letter
    svg += `<text x="${leftPad + 2}" y="${authY + mmToPx(9)}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="${C_BLACK}">Letter No.: __________________________</text>`
    svg += `<text x="${leftPad + panelInnerW - 2}" y="${authY + mmToPx(9)}" text-anchor="end" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">Ref: ${this.data.project.firNumber || '___________'}</text>`

    // Examined by — checks computations and field work
    svg += `<text x="${leftPad + 2}" y="${authY + mmToPx(14)}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="${C_BLACK}">Examined by: ________________________</text>`
    svg += `<text x="${leftPad + panelInnerW - 2}" y="${authY + mmToPx(14)}" text-anchor="end" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">Date: ___________</text>`

    // Approved by — verifies compliance with Survey Act Cap. 299
    svg += `<text x="${leftPad + 2}" y="${authY + mmToPx(19)}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="${C_BLACK}">Approved by: ________________________</text>`
    svg += `<text x="${leftPad + panelInnerW - 2}" y="${authY + mmToPx(19)}" text-anchor="end" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">Date: ___________</text>`

    // Authenticated by — applies the official Survey of Kenya seal
    svg += `<text x="${leftPad + 2}" y="${authY + mmToPx(24)}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="${C_BLACK}">Authenticated by: ____________________</text>`
    svg += `<text x="${leftPad + panelInnerW - 2}" y="${authY + mmToPx(24)}" text-anchor="end" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">Date: ___________</text>`

    // Official SoK Seal area — improved with circle and proper label
    const sealCx = leftPad + panelInnerW - mmToPx(12)
    const sealCy = authY + mmToPx(30)
    const sealR = mmToPx(4.5)
    svg += `<circle cx="${sealCx}" cy="${sealCy}" r="${sealR}" fill="none" stroke="${C_BLACK}" stroke-width="0.4" stroke-dasharray="1.5,1"/>`
    svg += `<text x="${sealCx}" y="${sealCy - 1}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#888">OFFICIAL SEAL</text>`
    svg += `<text x="${sealCx}" y="${sealCy + 2}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#888">SURVEY OF KENYA</text>`

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
    svg += `<text x="${cx}" y="${y1 + mmToPx(2.5)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="12" font-weight="bold" fill="${C_BLACK}">${escapeXml(street.toUpperCase())}</text>`
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
      svg += `<text ${transform} x="${px}" y="${py}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="8" font-weight="bold" fill="${C_BLACK}" opacity="0.4">${escapeXml(ref)}</text>`
    }
    return svg
  }

  /**
   * Draw adjacent LR numbers directly on the boundary lines of the subject parcel.
   * Per Kenya cadastral practice, each shared boundary shows the neighbour's
   * LR number on the OUTSIDE of the subject parcel.
   * Source: Survey Act Cap. 299, Form No. 3 & 4 standard practice
   */
  protected drawBoundaryAdjacentLRNumbers(): string {
    const lots = this.data.adjacentLots
    if (!lots || lots.length === 0) return ''

    const parcelPts = this.rotatedPoints
    if (parcelPts.length < 3) return ''

    const [parcelCe, parcelCn] = centroid(parcelPts)
    let svg = ''

    // For each boundary segment of the subject parcel, find matching adjacent lot
    for (let segIdx = 0; segIdx < parcelPts.length; segIdx++) {
      const segFrom = parcelPts[segIdx]
      const segTo = parcelPts[(segIdx + 1) % parcelPts.length]

      // Find which adjacent lot has a segment matching this one (reversed)
      const matchingLot = lots.find(lot => {
        const lpts = lot.boundaryPoints
        for (let j = 0; j < lpts.length; j++) {
          const lpFrom = lpts[j]
          const lpTo = lpts[(j + 1) % lpts.length]
          // Match if the adjacent lot segment runs in reverse (shared boundary)
          const d1 = Math.abs(lpFrom.easting - segTo.easting) + Math.abs(lpFrom.northing - segTo.northing)
          const d2 = Math.abs(lpTo.easting - segFrom.easting) + Math.abs(lpTo.northing - segFrom.northing)
          if (d1 < 0.5 && d2 < 0.5) return true
        }
        return false
      })

      if (!matchingLot || !matchingLot.id) continue

      // Compute midpoint of the boundary segment
      const midE = (segFrom.easting + segTo.easting) / 2
      const midN = (segFrom.northing + segTo.northing) / 2

      // Offset the label AWAY from the parcel centroid (to the outside)
      // Direction: from parcel centroid toward midpoint, then extend further
      const awayDirE = midE - parcelCe
      const awayDirN = midN - parcelCn
      const awayLen = Math.sqrt(awayDirE * awayDirE + awayDirN * awayDirN)
      const offsetDist = 8 / PX_PER_M // 8mm offset in ground units
      const awayNormE = awayLen > 0 ? awayDirE / awayLen : 0
      const awayNormN = awayLen > 0 ? awayDirN / awayLen : 0

      const labelE = midE + awayNormE * offsetDist
      const labelN = midN + awayNormN * offsetDist

      const px = this.toSvgX(labelE)
      const py = this.toSvgY(labelN)

      // Rotate text to align with boundary direction
      const angleDeg = segmentAngle(segFrom.easting, segFrom.northing, segTo.easting, segTo.northing)
      let textAngle = angleDeg
      if (textAngle > 90 || textAngle < -90) textAngle += 180

      const lrLabel = matchingLot.id
      const planRef = matchingLot.planReference || ''
      const label = planRef ? `${lrLabel} (${planRef})` : lrLabel

      svg += `<g transform="translate(${px},${py})">`
      svg += `<g transform="rotate(${textAngle})">`
      svg += `<rect x="${-label.length * 2.8}" y="${-5}" width="${label.length * 5.6}" height="${10}" fill="white" opacity="0.75" stroke="none"/>`
      svg += `<text x="0" y="3" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="7" font-weight="bold" fill="${C_BLACK}" opacity="0.6">${escapeXml(label)}</text>`
      svg += `</g></g>`
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
    svg += `<text x="${x}" y="${y}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">FENCE TYPES</text>`
    types.forEach((t, i) => {
      svg += `<text x="${x}" y="${y + (i + 1) * mmToPx(4)}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="#555">${t.replace(/_/g, ' ')}</text>`
    })
    return svg
  }

  private drawRightPanel(): string {
    const leftPad = this.panelX + mmToPx(3)
    const rightPad = this.panelX + this.panelW - mmToPx(3)
    const panelInnerW = this.panelW - mmToPx(6)
    const svgParts: string[] = []
    svgParts.push(this.drawReportHeader(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawDatumNote(leftPad, panelInnerW))
    svgParts.push(this.drawMetricNote(leftPad, rightPad))
    svgParts.push(this.drawPlanInfoBox(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawCoordinateSchedule(leftPad, panelInnerW))
    if (this.data.project.roadCenterLine) {
      svgParts.push(this.drawChainageSchedule(leftPad, panelInnerW))
    }
    svgParts.push(this.drawBearingSchedule(leftPad, panelInnerW))
    svgParts.push(this.drawLegend(leftPad, panelInnerW))
    svgParts.push(this.drawWarningBox(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawRevisionBlock(leftPad, panelInnerW))
    svgParts.push(this.drawSurveyorCertificate(leftPad, rightPad, panelInnerW))
    svgParts.push(this.drawCompanyFooter(leftPad, rightPad))
    return svgParts.join('')
  }

  private drawReportHeader(leftPad: number, rightPad: number, _panelInnerW: number): string {
    const p = this.data.project
    const hasMun = !!p.municipality
    const y = this.margin + mmToPx(4)
    let svg = ''
    const text = (content: string, yPos: number, size: number, weight = 'normal', color = C_BLACK) =>
      `<text x="${leftPad}" y="${yPos}" font-family="JetBrains Mono, Courier New" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(content)}</text>`
    const hline = (y1: number) =>
      `<line x1="${leftPad}" y1="${y1}" x2="${rightPad}" y2="${y1}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += text('SURVEYOR\'S REAL PROPERTY REPORT', y, 5)
    svg += text(p.plan_title || 'BOUNDARY IDENTIFICATION PLAN', y + mmToPx(6), 9, 'bold')
    if (p.municipality) svg += text(p.municipality, y + mmToPx(11), 16, 'bold')
    svg += text(`SCALE ${calcScaleLabel(this.scale)}`, y + mmToPx(hasMun ? 18 : 12), 8, 'bold')
    svg += hline(y + mmToPx(hasMun ? 21 : 15))
    svg += text(p.firm_name || '', y + mmToPx(hasMun ? 25 : 19), 8, 'bold')
    if (p.firm_name) {
      svg += text('SURVEYORS ASSOCIATION STAMP', y + mmToPx(hasMun ? 27 : 21), 5, 'normal', '#888')
    }
    svg += text(`\u00A9 ${new Date().getFullYear()}`, y + mmToPx(hasMun ? 28.5 : 22.5), 6)
    svg += text('Survey Act Cap. 299 | Survey Regulations 1994 | RDM 1.3 (2023)', y + mmToPx(hasMun ? 32 : 26), 4.5, 'normal', '#888')
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
      `<text x="${leftPad}" y="${y += mmToPx(4)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="#555">${escapeXml(label)}</text><text x="${leftPad + mmToPx(22)}" y="${y}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">${escapeXml(value)}</text>`
    svg += box(y, mmToPx(4))
    svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">PLAN INFORMATION</text>`
    y += mmToPx(4)
    const info: Array<[string, string]> = [
      ['Title Ref:', p.reference || '\u2014'],
      // T1.5 FIX (2026-07-09): Derive EPSG from the project's actual UTM zone.
      ['Datum:', (() => {
        const z = p.utm_zone
        const epsg = (p.datum || 'ARC1960') === 'ARC1960'
          ? `EPSG:210${z < 10 ? '0' + z : z}`
          : `EPSG:327${z < 10 ? '0' + z : z}`
        return `${p.datum || 'ARC1960'} / UTM Zone ${p.utm_zone}${p.hemisphere} (${epsg})`
      })()],
      ['Area:', p.area_sqm ? `${p.area_sqm.toFixed(2)} m\u00B2` : '\u2014'],
      ['Council:', p.municipality || '\u2014'],
      ['Client:', p.client_name || '\u2014'],
      ['Drawing No:', p.drawing_no || `MD-${Date.now().toString().slice(-6)}`],
    ]
    for (const [label, value] of info) svg += row(label, value)

    const accuracyResult = this.data.traverse?.linearError !== undefined
      ? computeTraverseAccuracy(this.data.traverse.linearError, this.data.parcel.perimeter_m)
      : null
    if (accuracyResult) {
      svg += row('Accuracy:', `${accuracyResult.order} \u2713`)
    }

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
    svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">LEGEND</text>`
    const items = [
      { label: 'Subject boundary', symbol: `<line x1="0" y1="0" x2="20" y2="0" stroke="${C_BLACK}" stroke-width="2.5"/>` },
      { label: 'Adjacent boundary', symbol: `<line x1="0" y1="0" x2="20" y2="0" stroke="${C_BLACK}" stroke-width="1"/>` },
      { label: 'Found monument', symbol: `<rect x="0" y="-3" width="6" height="6" fill="${C_GREEN}" stroke="${C_BLACK}" stroke-width="0.5"/>` },
      { label: 'Set monument', symbol: `<circle cx="3" cy="0" r="3" fill="none" stroke="${C_GREEN}" stroke-width="1.5"/>` },
      { label: 'Masonry Nail', symbol: `<circle cx="3" cy="0" r="2.5" fill="${C_RED}"/>` },
      { label: 'Iron Pin', symbol: `<circle cx="3" cy="0" r="2" fill="${C_RED}" stroke="${C_BLACK}" stroke-width="0.4"/>` },
      { label: '\u25C7 Indicatory Beacon (Cap. 299 Reg. 45)', symbol: `<polygon points="3,0 6,3 3,6 0,3" fill="none" stroke="${C_GREEN}" stroke-width="1.2" transform="scale(0.6) translate(1.5,1.5)"/>` },
    ]
    for (const item of items) {
      svg += `<g transform="translate(${leftPad}, ${y += mmToPx(4)})">${item.symbol}</g>`
      svg += `<text x="${leftPad + mmToPx(10)}" y="${y}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(item.label)}</text>`
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
      svg += `<text x="${leftPad + mmToPx(2)}" y="${y + mmToPx(3) + i * mmToPx(3)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="${i === 0 ? 'bold' : 'normal'}" fill="${C_BLACK}">${escapeXml(line)}</text>`
    })
    return svg
  }

  private drawCompanyFooter(leftPad: number, rightPad: number): string {
    const hasMun = !!this.data.project.municipality
    const afterCert = this.margin + mmToPx(hasMun ? 40 : 34) + mmToPx(7 * 4 + 4 + 6) + mmToPx(6 * 4 + 6) + mmToPx(12 + 4) + mmToPx(20)
    const y = afterCert
    const p = this.data.project
    let svg = `<line x1="${leftPad}" y1="${y}" x2="${rightPad}" y2="${y}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    if (p.firm_phone) svg += `<text x="${leftPad}" y="${y + mmToPx(3)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(p.firm_phone)}</text>`
    if (p.firm_email) svg += `<text x="${leftPad}" y="${y + mmToPx(6)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${escapeXml(p.firm_email)}</text>`
    if (p.iskRegNo) svg += `<text x="${leftPad}" y="${y + mmToPx(9)}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="${C_BLACK}">ISK (Chapter of Land Surveyors) Membership No. ${escapeXml(p.iskRegNo)}</text>`
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
      ['Field', p.location || ''],
      ['Drawing', p.drawing_no || `MD-${Date.now().toString().slice(-6)}`],
      ['Checked', ''],
      ['Address', p.firm_address || ''],
      ['Date', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
      ['Work Order', ''],
      ['Job No.', p.reference || ''],
      [p.firm_name || p.name || 'METARDU', ''],
    ]
    let x = this.margin
    for (let i = 0; i < cols; i++) {
      const [label, value] = fields[i] || ['', '']
      const cx = x + colW / 2
      svg += `<line x1="${x}" y1="${footerY}" x2="${x}" y2="${footerY + footerH}" stroke="${C_BLACK}" stroke-width="0.5"/>`
      if (i === cols - 1) {
        svg += `<rect x="${x}" y="${footerY}" width="${colW}" height="${footerH}" fill="${C_BLACK}"/>`
        svg += `<text x="${cx}" y="${footerY + footerH / 2 + 4}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="11" font-weight="bold" fill="white">${escapeXml(label)}</text>`
      } else {
        svg += `<text x="${cx}" y="${footerY + mmToPx(4)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="5" fill="#555">${escapeXml(label)}</text>`
        svg += `<text x="${cx}" y="${footerY + mmToPx(10)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="7" font-weight="bold" fill="${C_BLACK}">${escapeXml(value)}</text>`
      }
      x += colW
    }
    return svg
  }

  protected drawLegalReferenceLine(): string {
    const p = this.data.project
    const zone = `${p.utm_zone || 37}${p.hemisphere || 'S'}`
    const datum = p.datum || 'ARC1960'
    const y = this.pageH - mmToPx(6)
    const ref = `Prepared: Survey Act Cap. 299 | Survey Regulations 1994 | RDM 1.1 (2025) | RDM 1.3 (2023) | Ministry of Roads and Transport, Republic of Kenya | Coordinates: UTM Zone ${zone}, ${datum}`
    return `<text x="${this.margin}" y="${y}" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">${escapeXml(ref)}</text>`
  }

  /**
   * Draw road truncation lines on boundary segments that abut roads.
   * Per Kenya cadastral practice, road boundaries are shown with short
   * perpendicular tick marks (truncation lines) at regular intervals along
   * the boundary edge, indicating the road reserve extent.
   * Now includes road reserve width annotation labels.
   * Source: Survey Act Cap. 299, Form No. 3 & 4 — Road Truncation Lines
   */
  protected drawRoadTruncationLines(): string {
    const lots = this.data.adjacentLots
    if (!lots || lots.length === 0) return ''

    const parcelPts = this.rotatedPoints
    if (parcelPts.length < 3) return ''

    let svg = ''
    const [parcelCe, parcelCn] = centroid(parcelPts)

    // Compute road reserve width from project road_class
    const roadClass = this.data.project.road_class
    const roadWidth = roadClass ? getRoadReserveWidth(roadClass) : 0

    // For each boundary segment, check if the adjacent lot is a road
    for (let segIdx = 0; segIdx < parcelPts.length; segIdx++) {
      const segFrom = parcelPts[segIdx]
      const segTo = parcelPts[(segIdx + 1) % parcelPts.length]

      // Find adjacent lot for this segment
      const matchingLot = lots.find(lot => {
        const lpts = lot.boundaryPoints
        for (let j = 0; j < lpts.length; j++) {
          const lpFrom = lpts[j]
          const lpTo = lpts[(j + 1) % lpts.length]
          const d1 = Math.abs(lpFrom.easting - segTo.easting) + Math.abs(lpFrom.northing - segTo.northing)
          const d2 = Math.abs(lpTo.easting - segFrom.easting) + Math.abs(lpTo.northing - segFrom.northing)
          if (d1 < 0.5 && d2 < 0.5) return true
        }
        return false
      })

      // Draw truncation ticks if adjacent lot appears to be a road
      // Detection: roadReserveEdge flag, lot id contains road keywords or Rd/RR prefix,
      // project has road_class, or project has street name
      const isRoad = matchingLot && (
        matchingLot.roadReserveEdge === true ||
        /^Rd|^RR/i.test(matchingLot.id) ||
        /road|rd\.?|street|st\.?|reserve|lane|drive|way|avenue|ave/i.test(matchingLot.id) ||
        this.data.project.road_class ||
        this.data.project.street
      )

      if (!isRoad) continue

      // Draw perpendicular tick marks along this boundary segment
      const dE = segTo.easting - segFrom.easting
      const dN = segTo.northing - segFrom.northing
      const segLen = Math.sqrt(dE * dE + dN * dN)
      if (segLen < 0.001) continue

      // Unit perpendicular vector (pointing outward from parcel)
      let perpE = -dN / segLen
      let perpN = dE / segLen
      // Ensure perpendicular points AWAY from parcel centroid
      const midE = (segFrom.easting + segTo.easting) / 2
      const midN = (segFrom.northing + segTo.northing) / 2
      const toMidE = midE - parcelCe
      const toMidN = midN - parcelCn
      if (perpE * toMidE + perpN * toMidN < 0) {
        perpE = -perpE
        perpN = -perpN
      }

      const tickSpacing = 5 / PX_PER_M // 5mm spacing in ground units
      const tickLength = 3 / PX_PER_M   // 3mm tick length in ground units
      const numTicks = Math.max(2, Math.floor(segLen / tickSpacing))

      for (let t = 1; t < numTicks; t++) {
        const frac = t / numTicks
        const tickBaseE = segFrom.easting + dE * frac
        const tickBaseN = segFrom.northing + dN * frac
        const tickEndE = tickBaseE + perpE * tickLength
        const tickEndN = tickBaseN + perpN * tickLength

        const x1 = this.toSvgX(tickBaseE)
        const y1 = this.toSvgY(tickBaseN)
        const x2 = this.toSvgX(tickEndE)
        const y2 = this.toSvgY(tickEndN)

        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C_BLACK}" stroke-width="0.5" opacity="0.7"/>`
      }

      // Road width annotation label along the road segment
      if (roadWidth > 0) {
        const labelOffset = tickLength * 1.5 // Place label beyond tick ends
        const labelE = midE + perpE * labelOffset
        const labelN = midN + perpN * labelOffset
        const lx = this.toSvgX(labelE)
        const ly = this.toSvgY(labelN)
        const widthLabel = `${roadWidth.toFixed(2)}m`

        // Rotate label to align with road segment direction
        const angleDeg = segmentAngle(segFrom.easting, segFrom.northing, segTo.easting, segTo.northing)
        let textAngle = angleDeg
        if (textAngle > 90 || textAngle < -90) textAngle += 180

        svg += `<g transform="translate(${lx},${ly})">`
        svg += `<g transform="rotate(${textAngle})">`
        svg += `<rect x="${-widthLabel.length * 2.5}" y="${-4}" width="${widthLabel.length * 5}" height="8" fill="white" opacity="0.8" stroke="none"/>`
        svg += `<text x="0" y="2" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="6" font-weight="bold" fill="${C_BLACK}" opacity="0.7">${widthLabel}</text>`
        svg += `</g></g>`
      }
    }

    return svg
  }

  /**
   * Draw print verification hash at the bottom of the plan.
   * Generates a deterministic SHA-256 verification code from the plan's key
   * data (coordinates, area, LR number, scale, date, surveyor licence, revisions)
   * and displays it alongside a generation timestamp. This can be used to
   * confirm the plan hasn't been altered.
   * Per Kenya survey practice, plan integrity verification is required
   * for legal admissibility under Survey Act Cap. 299, Sec. 23.
   */
  protected drawPrintVerification(): string {
    const pts = this.rotatedPoints
    const p = this.data.project

    // Build a verification string from key plan data
    const coordString = pts.map(pt => `${pt.easting.toFixed(4)},${pt.northing.toFixed(4)}`).join('|')
    const areaVal = this.data.parcel.area_sqm.toFixed(4)
    const lrNum = p.lrNumber || p.parcel_id || p.name || 'UNKNOWN'
    const scaleVal = this.scale
    const dateStr = new Date().toISOString().split('T')[0]
    const surveyorLicence = p.surveyor_licence || ''
    const revisionsCount = (p.revisions || []).length

    // Deterministic verification code using SHA-256 (cryptographic hash)
    const rawString = `${coordString}|${areaVal}|${lrNum}|${scaleVal}|${dateStr}|${surveyorLicence}|${revisionsCount}`
    const verCode = createHash('sha256').update(rawString).digest('hex').toUpperCase().slice(0, 16)

    const y = this.pageH - mmToPx(2)
    const cx = this.pageW / 2

    let svg = ''
    svg += `<text x="${cx}" y="${y}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3.5" fill="#999">Verification: ${verCode} | Generated: ${escapeXml(dateStr)} | Scale: 1:${scaleVal}</text>`
    svg += `<text x="${cx}" y="${y + mmToPx(1.5)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="2.5" fill="#bbb">Alteration of this plan invalidates verification — Per Survey Act Cap. 299, Sec. 23</text>`

    return svg
  }

  private drawWatermark(): string {
    if (this.opts.watermarkPlan !== 'free') return ''
    const cx = this.drawingX + this.drawingAreaW / 2
    const cy = this.drawingY + this.drawingAreaH / 2
    return [
      `<g transform="translate(${cx},${cy}) rotate(-45)">`,
      `<text x="0" y="-40" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="72" font-weight="bold" fill="#000" opacity="0.04">METARDU</text>`,
      `<text x="0" y="10" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="28" fill="#000" opacity="0.04">Free Plan — Upgrade for Professional Plans</text>`,
      `<text x="0" y="35" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="18" fill="#000" opacity="0.04">metardu.com/pricing</text>`,
      `</g>`,
    ].join('')
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
    layers.push(this.drawWatermark())
    layers.push(this.drawAdjacentLots())
    layers.push(this.drawStreetInfo())
    layers.push(this.drawRoadTruncationLines())
    layers.push(this.drawBoundary())
    layers.push(this.drawBoundaryLabels())
    layers.push(this.drawBoundaryAdjacentLRNumbers())
    layers.push(this.drawMonuments())
    layers.push(this.drawAdjacentLotPlanRefs())
    layers.push(this.drawFenceOffsets())
    layers.push(this.drawLotNumber())
    layers.push(this.drawPinLabel())
    layers.push(this.drawPartLabels())
    layers.push(this.drawAreaLabel())
    layers.push(this.drawAdjacentLabels())
    layers.push(this.drawBuildings())
    layers.push(this.drawRoadReserveBoundaries())
    layers.push(this.drawChainageMarkers())
    layers.push(this.drawNorthArrow())
    layers.push(this.drawScaleBar())
    layers.push(this.drawAssociationStamp())
    if (this.opts.includePanel) layers.push(this.drawRightPanel())
    layers.push(this.drawSheetFooter())
    layers.push(this.drawPrintVerification())
    layers.push(this.drawLegalReferenceLine())
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.pageW} ${this.pageH}" width="${this.pageW}" height="${this.pageH}" style="font-family: 'JetBrains Mono', 'Courier New', monospace;">${layers.join('\n')}</svg>`
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
      layers.push(this.drawWatermark())
      layers.push(this.drawAdjacentLots())
      layers.push(this.drawStreetInfo())
      layers.push(this.drawRoadTruncationLines())
      layers.push(this.drawBoundary())
      layers.push(this.drawBoundaryLabels())
      layers.push(this.drawBoundaryAdjacentLRNumbers())
      layers.push(this.drawMonuments())
      layers.push(this.drawAdjacentLotPlanRefs())
      layers.push(this.drawFenceOffsets())
      layers.push(this.drawLotNumber())
      layers.push(this.drawPinLabel())
      layers.push(this.drawPartLabels())
      layers.push(this.drawAreaLabel())
      layers.push(this.drawAdjacentLabels())
      layers.push(this.drawBuildings())
      layers.push(this.drawRoadReserveBoundaries())
      layers.push(this.drawNorthArrow())
      layers.push(this.drawScaleBar())
      layers.push(this.drawAssociationStamp())
      if (this.opts.includePanel) layers.push(this.drawRightPanel())
      layers.push(this.drawSheetFooter())
      layers.push(this.drawPrintVerification())
      layers.push(this.drawLegalReferenceLine())
      layers.push(`<text x="${this.drawingX + this.drawingAreaW / 2}" y="${this.margin + mmToPx(3)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="10" font-weight="bold" fill="${C_BLACK}">${escapeXml(label)}</text>`)
      layers.push('</g>')
      sheets.push(layers.join('\n'))
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" style="font-family: 'JetBrains Mono', 'Courier New', monospace; background: white;">${sheets.join('\n')}</svg>`
  }

  getScale(): number { return this.scale }

  exportToCSV(): string {
    return generateBearingScheduleCSV(this.data)
  }

  private drawRoadReserveBoundaries(): string {
    const roadClass = this.data.project.road_class
    if (!roadClass) return ''
    const pts = this.rotatedPoints
    if (pts.length < 2) return ''
    const reserveWidth = getRoadReserveWidth(roadClass, true)
    if (reserveWidth <= 0) return ''

    const roadCenter = this.data.project.roadCenterLine
    if (!roadCenter || roadCenter.length < 2) return ''

    const leftPts: Array<{ easting: number; northing: number }> = []
    const rightPts: Array<{ easting: number; northing: number }> = []

    for (let i = 0; i < roadCenter.length; i++) {
      const from = roadCenter[i]
      const to = roadCenter[(i + 1) % roadCenter.length]
      const dx = to.easting - from.easting
      const dy = to.northing - from.northing
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len === 0) continue
      const halfWidth = reserveWidth / 2
      const perpX = -dy / len * halfWidth
      const perpY = dx / len * halfWidth
      leftPts.push({ easting: from.easting + perpX, northing: from.northing + perpY })
      rightPts.push({ easting: from.easting - perpX, northing: from.northing - perpY })
    }

    if (leftPts.length < 2) return ''

    let svg = polylineFromPoints(leftPts, this.toSvgX.bind(this), this.toSvgY.bind(this), true)
      .replace(`stroke="${C_BLACK}"`, `stroke="${C_BLACK}" stroke-width="0.5" stroke-dasharray="8,4"`)
    svg += polylineFromPoints(rightPts, this.toSvgX.bind(this), this.toSvgY.bind(this), true)
      .replace(`stroke="${C_BLACK}"`, `stroke="${C_BLACK}" stroke-width="0.5" stroke-dasharray="8,4"`)

    const leftCentroid = centroid(leftPts)
    const rightCentroid = centroid(rightPts)
    const label = `ROAD RESERVE BOUNDARY (RDM 1.3 TABLE 2-3)`
    svg += `<text x="${this.toSvgX(leftCentroid[0])}" y="${this.toSvgY(leftCentroid[1])}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}" transform="rotate(-45,${this.toSvgX(leftCentroid[0])},${this.toSvgY(leftCentroid[1])})">${escapeXml(label)}</text>`
    svg += `<text x="${this.toSvgX(rightCentroid[0])}" y="${this.toSvgY(rightCentroid[1])}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}" transform="rotate(-45,${this.toSvgX(rightCentroid[0])},${this.toSvgY(rightCentroid[1])})">${escapeXml(label)}</text>`

    return svg
  }

  private drawChainageMarkers(): string {
    const roadCenter = this.data.project.roadCenterLine
    if (!roadCenter || roadCenter.length < 2) return ''

    const startCh = this.data.project.startChainage ?? 0
    const intervalM = 100

    const chainagePoints = computeChainageAlongAlignment(startCh, roadCenter)
    let svg = ''

    for (let i = 0; i < chainagePoints.length - 1; i++) {
      const from = roadCenter[i]
      const to = roadCenter[i + 1]
      const ch0 = chainagePoints[i]
      const ch1 = chainagePoints[i + 1]
      const dx = to.easting - from.easting
      const dy = to.northing - from.northing
      const segLen = Math.sqrt(dx * dx + dy * dy)
      if (segLen === 0) continue

      const steps = Math.floor(segLen / intervalM)
      for (let j = 1; j <= steps; j++) {
        const t = j / steps
        const x = from.easting + dx * t
        const y = from.northing + dy * t
        const chainage = ch0.chainage + (ch1.chainage - ch0.chainage) * t

        const perpX = -dy / segLen
        const perpY = dx / segLen
        const tickLenM = 2
        const x1 = this.toSvgX(x - perpX * tickLenM)
        const y1 = this.toSvgY(y - perpY * tickLenM)
        const x2 = this.toSvgX(x + perpX * tickLenM)
        const y2 = this.toSvgY(y + perpY * tickLenM)
        const svgX = this.toSvgX(x)
        const svgY = this.toSvgY(y)

        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C_BLACK}" stroke-width="0.5"/>`
        svg += `<text x="${svgX}" y="${svgY - 1.5}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="4" fill="${C_BLACK}" font-weight="bold">${formatChainage(chainage)}</text>`
      }
    }

    return svg
  }

  private drawChainageSchedule(leftPad: number, panelInnerW: number): string {
    const roadCenter = this.data.project.roadCenterLine
    if (!roadCenter || roadCenter.length < 2) return ''

    const startCh = this.data.project.startChainage ?? 0
    const chainagePts = computeChainageAlongAlignment(startCh, roadCenter)
    const roadName = this.data.project.roadName || 'Road'

    const colW = panelInnerW / 4
    const rowH = mmToPx(3.5)
    const headerH = mmToPx(5)
    const maxRows = Math.min(chainagePts.length, 20)
    const startY = this.margin + mmToPx(8)
    const tableH = headerH + maxRows * rowH

    let svg = `<rect x="${leftPad}" y="${startY}" width="${panelInnerW}" height="${tableH}" fill="none" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${leftPad + 2}" y="${startY + mmToPx(3.5)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">CHAINAGE SCHEDULE — ${escapeXml(roadName)}</text>`

    const hY = startY + headerH
    svg += `<line x1="${leftPad}" y1="${hY}" x2="${leftPad + panelInnerW}" y2="${hY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    const headers = ['Chainage', 'Easting', 'Northing', 'Label']
    headers.forEach((h, i) => {
      svg += `<text x="${leftPad + i * colW + 2}" y="${hY + mmToPx(2.5)}" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="#555">${h}</text>`
    })

    chainagePts.slice(0, maxRows).forEach((pt, i) => {
      const ry = hY + rowH * (i + 1)
      if (i > 0) svg += `<line x1="${leftPad}" y1="${ry}" x2="${leftPad + panelInnerW}" y2="${ry}" stroke="${C_BLACK}" stroke-width="0.25" opacity="0.3"/>`
      svg += `<text x="${leftPad + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}" font-weight="bold">${formatChainage(pt.chainage)}</text>`
      svg += `<text x="${leftPad + colW + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${pt.easting.toFixed(3)}</text>`
      svg += `<text x="${leftPad + colW * 2 + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="${C_BLACK}">${pt.northing.toFixed(3)}</text>`
      svg += `<text x="${leftPad + colW * 3 + 2}" y="${ry + mmToPx(2)}" font-family="JetBrains Mono, Courier New" font-size="5" fill="#555">km+m</text>`
    })

    svg += `<text x="${leftPad}" y="${startY + tableH + 8}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="#555" font-style="italic">Chainage format: km+m (RDM 1.1 §5.6.4) · Interval: 100m markers</text>`
    return svg
  }
}
