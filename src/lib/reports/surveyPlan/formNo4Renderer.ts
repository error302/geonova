/**
 * Form No. 4 Survey Plan Renderer Extension
 * Kenya Land Office compliant survey plan rendering
 * Extends base SurveyPlanRenderer with Form No. 4 specific features
 */

import { createHash } from 'crypto'
import { SurveyPlanRenderer } from './renderer'
import type { SurveyPlanData, PlanOptions, CoordinateScheduleEntry } from './types'
import { getRoadReserveWidth } from './types'
import { mmToPx } from './geometry'
import {
  escapeXml,
  C_BLACK, C_GREEN, C_RED,
} from './symbols'

/**
 * Extended SurveyPlanRenderer that produces Form No. 4 compliant output
 */
export class FormNo4Renderer extends SurveyPlanRenderer {
  private formNo4Data: FormNo4Data

  constructor(data: SurveyPlanData, options?: PlanOptions & { submissionNumber?: string }) {
    super(data, options)
    this.formNo4Data = this.extractFormNo4Data(data, options?.submissionNumber)
  }

  private extractFormNo4Data(data: SurveyPlanData, submissionNumber?: string): FormNo4Data {
    const p = data.project
    return {
      folioNumber: p.folioNumber || '',
      registerNumber: p.registerNumber || '',
      lrNumber: p.lrNumber || '',
      plotParcelNumber: p.plotParcelNumber || '',
      refMapRIM: p.refMapRIM || '',
      registrationBlock: p.registrationBlock || '',
      registrationDistrict: p.registrationDistrict || '',
      locality: p.locality || '',
      formNumber: p.formNumber || 'Form No. 4',
      computationsNo: p.computationsNo || '',
      fieldBookNo: p.fieldBookNo || '',
      dateReceived: p.dateReceived || '',
      fileReference: p.fileReference || '',
      scale: p.scale || `1:${this.getScale()}`,
      firNumber: p.firNumber || '',
      submissionNumber: submissionNumber || '',
      // Authentication block
      examinedBy: '',
      examinedDate: '',
      approvedBy: '',
      approvedDate: '',
      authenticatedBy: '',
      authenticatedDate: '',
      // Surveyor declaration — per Survey Act Cap. 299, Form No. 4
      declarationText: `I, ${p.surveyor_name || '[SURVEYOR NAME]'}, a Licensed Surveyor ${p.surveyor_licence ? '(LS/' + p.surveyor_licence + ')' : '(LS/_______________)'}, ${p.iskRegNo ? 'ISK Reg. No. ' + p.iskRegNo + ',' : ''} hereby certify that this survey was carried out under my direct supervision in accordance with the Survey Act Cap. 299 and the Survey Regulations 1994, and that all measurements, computations and beacon placements are correct.`,
      declarationDate: new Date().toLocaleDateString('en-GB'),
      letterNo: '',
      // Surveyor credentials for stamp area
      surveyorName: p.surveyor_name || '',
      surveyorLicence: p.surveyor_licence || '',
      iskRegNo: p.iskRegNo || '',
      firmName: p.firm_name || '',
    }
  }

  /**
   * Render Form No. 4 compliant survey plan
   */
  renderFormNo4(): string {
    const layers: string[] = []
    
    // Base layers
    layers.push(this.drawBackground())
    layers.push(this.drawSheetBorder())
    layers.push(this.drawPanelDivider())
    layers.push(this.drawGrid())
    layers.push(this.drawLotFill())
    
    // Form No. 4 specific layers
    layers.push(this.drawCoordinateTables())
    layers.push(this.drawLRNumbersOnParcels())
    layers.push(this.drawRoadAnnotations())
    
    // Standard layers
    layers.push(this.drawAdjacentLots())
    layers.push(this.drawRoadTruncationLines())
    layers.push(this.drawBoundary())
    layers.push(this.drawBoundaryLabels())
    layers.push(this.drawBoundaryAdjacentLRNumbers())
    layers.push(this.drawMonuments())
    layers.push(this.drawNorthArrow())
    layers.push(this.drawScaleBar())
    
    // Form No. 4 panels and footer
    layers.push(this.drawFormNo4RightPanel())
    layers.push(this.drawFormNo4TitleBlock())
    layers.push(this.drawSubmissionNumberHeader())
    layers.push(this.drawLegalReferenceLine())
    layers.push(this.drawPrintVerification())
    
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.pageW} ${this.pageH}" width="${this.pageW}" height="${this.pageH}" style="font-family: 'JetBrains Mono', 'Courier New', monospace;">${layers.join('\n')}</svg>`
  }

  /**
   * Draw coordinate tables (Form No. 4 Rule 1)
   * Split into left and right tables
   */
  private drawCoordinateTables(): string {
    const controlPts = this.getControlPoints()
    if (controlPts.length === 0) return ''

    // Split beacons: P/K-series on left, N/D-series on right
const leftSideBeacons = controlPts.filter(p =>
  p.station.startsWith('P') || p.station.startsWith('K')
)
const rightSideBeacons = controlPts.filter(p =>
  p.station.startsWith('N') || p.station.startsWith('D')
)

    let svg = ''
    
    // Left table
    if (leftSideBeacons.length > 0) {
      svg += this.drawCoordinateTable(leftSideBeacons, 'left', mmToPx(15), mmToPx(25))
    }
    
    // Right table
    if (rightSideBeacons.length > 0) {
svg += this.drawCoordinateTable(rightSideBeacons, 'right',
      this.pageW - mmToPx(15) - mmToPx(65), mmToPx(25))
    }

    return svg
  }

  private drawCoordinateTable(
    beacons: CoordinateScheduleEntry[],
    side: 'left' | 'right',
    x: number,
    y: number
  ): string {
    const colWidths = [mmToPx(15), mmToPx(18), mmToPx(18), mmToPx(12), mmToPx(12)]
    const rowHeight = mmToPx(6)
    const tableWidth = colWidths.reduce((a, b) => a + b, 0)
    const tableHeight = rowHeight * (beacons.length + 1)

    let svg = `<g class="coordinate-table-${side}">`
    
    // Table border
    svg += `<rect x="${x}" y="${y}" width="${tableWidth}" height="${tableHeight}" fill="white" stroke="${C_BLACK}" stroke-width="0.5"/>`
    
    // Header
    const headers = ['Station', 'Northings', 'Eastings', 'Heights', 'Class']
    let hx = x
    headers.forEach((h, i) => {
      svg += `<rect x="${hx}" y="${y}" width="${colWidths[i]}" height="${rowHeight}" fill="#f0f0f0" stroke="${C_BLACK}" stroke-width="0.3"/>`
      svg += `<text x="${hx + colWidths[i]/2}" y="${y + rowHeight/2 + 2}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="6" font-weight="bold" fill="${C_BLACK}">${h}</text>`
      hx += colWidths[i]
    })

    // Data rows
    beacons.forEach((beacon, rowIdx) => {
      const rowY = y + rowHeight * (rowIdx + 1)
      hx = x
      
      const cells = [
        beacon.station,
        beacon.northing.toFixed(4),
        beacon.easting.toFixed(4),
        beacon.height?.toFixed(3) || '—',
        this.formatBeaconClass(beacon.beaconClass)
      ]
      
      cells.forEach((cell, i) => {
        svg += `<rect x="${hx}" y="${rowY}" width="${colWidths[i]}" height="${rowHeight}" fill="white" stroke="${C_BLACK}" stroke-width="0.3"/>`
        svg += `<text x="${hx + (i < 1 ? 2 : colWidths[i]/2)}" y="${rowY + rowHeight/2 + 2}" text-anchor="${i < 1 ? 'start' : 'middle'}" font-family="JetBrains Mono, Courier New" font-size="5.5" fill="${C_BLACK}">${escapeXml(cell)}</text>`
        hx += colWidths[i]
      })
    })

    svg += '</g>'
    return svg
  }

  private formatBeaconClass(cls: string): string {
    const map: Record<string, string> = {
      'new': 'New',
      'old': 'Old',
      'theoretical': 'Theoretical',
      'IPCU': 'I.P.C.U.'
    }
    return map[cls] || cls
  }

  /**
   * Draw LR numbers on parcels (Form No. 4 Rule 4)
   */
private drawLRNumbersOnParcels(): string {
  const p = this.data.project
    if (!p.lrNumber) return ''

    const boundaryPts = this.rotatedPoints
    if (boundaryPts.length < 3) return ''

    // Calculate centroid of parcel
    const centroid = this.calculateCentroid(boundaryPts)
  const cx = this.toSvgX(centroid.easting)
  const cy = this.toSvgY(centroid.northing)

  const parcelArea = this.data.parcel.area_sqm || 0
    const areaHa = (parcelArea / 10000).toFixed(4)

    let svg = ''
    
    // LR Number label
    svg += `<text x="${cx}" y="${cy - 10}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="11" font-weight="bold" fill="${C_BLACK}">LR No. ${escapeXml(p.lrNumber)}</text>`
    
    // Area label
    svg += `<text x="${cx}" y="${cy + 2}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="9" fill="${C_BLACK}">A=co=${areaHa} Ha</text>`
    
    // DP Number if available
    if (p.plotParcelNumber) {
      svg += `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="8" fill="${C_BLACK}">D.P No. ${escapeXml(p.plotParcelNumber)}</text>`
    }

    return svg
  }

  /**
   * Draw road annotations for Form No. 4.
   * Shows road reserve width annotation and truncation note using actual
   * road class data. The base class drawRoadTruncationLines() provides
   * the actual tick marks along road boundaries.
   */
  private drawRoadAnnotations(): string {
  const p = this.data.project

  const minE = Math.min(...this.rotatedPoints.map(pt => pt.easting))
  const maxE = Math.max(...this.rotatedPoints.map(pt => pt.easting))
  const minN = Math.min(...this.rotatedPoints.map(pt => pt.northing))
    
    const cx = this.toSvgX((minE + maxE) / 2)
    const cy = this.toSvgY(minN) + mmToPx(15)

    let svg = ''

    // Compute actual road reserve width from project road_class
    const roadClass = p.road_class
    const roadWidth = roadClass ? getRoadReserveWidth(roadClass) : 0
    const widthText = roadWidth > 0 ? `All new roads are ${roadWidth.toFixed(2)}m Wide` : 'All new roads are 12.00m Wide'
    
    // Road width note with actual width value
    svg += `<text x="${cx}" y="${cy}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="7" fill="${C_BLACK}">${widthText}</text>`
    
    // Road truncation note
    svg += `<text x="${cx}" y="${cy + mmToPx(5)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="7" fill="${C_BLACK}">All road truncations ±6mm</text>`

    return svg
  }

  /**
   * Draw Form No. 4 right panel
   */
private drawFormNo4RightPanel(): string {
  const p = this.data.project
  const d = this.formNo4Data
  const panelX = this.panelX
  const panelW = this.panelW
    const margin = mmToPx(10)
    
    let y = margin + mmToPx(5)
    let svg = `<g class="form-no-4-panel">`

    // Title
    svg += `<text x="${panelX + panelW/2}" y="${y}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="10" font-weight="bold" fill="${C_BLACK}">SURVEYOR'S PLAN</text>`
    y += mmToPx(6)
    
    // Form number
    svg += `<text x="${panelX + panelW/2}" y="${y}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="9" fill="${C_BLACK}">${d.formNumber}</text>`
    y += mmToPx(8)

    // Plan info box
    const infoFields = [
      ['Registration District', d.registrationDistrict || p.location?.split(',')[0] || ''],
      ['Locality', d.locality || p.location || ''],
      ['LR Number', d.lrNumber],
      ['Folio Number', d.folioNumber],
      ['Register Number', d.registerNumber],
      ['FIR Number', d.firNumber],
      ['Scale', d.scale],
      ['Datum', p.datum || 'ARC1960'],
      ['UTM Zone', `${p.utm_zone || 37}${p.hemisphere || 'S'}`],
    ]

    svg += `<rect x="${panelX + margin/2}" y="${y}" width="${panelW - margin}" height="${mmToPx(50)}" fill="#f9f9f9" stroke="${C_BLACK}" stroke-width="0.5"/>`
    
    let fieldY = y + mmToPx(5)
    infoFields.forEach(([label, value]) => {
      if (value) {
        svg += `<text x="${panelX + margin}" y="${fieldY}" font-family="JetBrains Mono, Courier New" font-size="6" fill="#555">${escapeXml(label)}:</text>`
        svg += `<text x="${panelX + panelW - margin}" y="${fieldY}" text-anchor="end" font-family="JetBrains Mono, Courier New" font-size="6" font-weight="bold" fill="${C_BLACK}">${escapeXml(value)}</text>`
        fieldY += mmToPx(5)
      }
    })
    
    y += mmToPx(55)

    // Legend
    svg += this.drawFormNo4Legend(panelX + margin/2, y, panelW - margin)
    y += mmToPx(40)

    // Revision history
    svg += this.drawFormNo4RevisionHistory(panelX + margin/2, y, panelW - margin)
    y += mmToPx(22)

    // Surveyor certificate
    svg += this.drawSurveyorCertificateInternal(panelX + margin/2, y, panelW - margin)

    svg += '</g>'
    return svg
  }

  private drawFormNo4Legend(x: number, y: number, w: number): string {
    let svg = `<rect x="${x}" y="${y}" width="${w}" height="${mmToPx(35)}" fill="#fafafa" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${x + w/2}" y="${y + mmToPx(5)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="7" font-weight="bold" fill="${C_BLACK}">LEGEND</text>`
    
    const items = [
      { symbol: '■', color: C_GREEN, label: 'Found Monument' },
      { symbol: '○', color: C_GREEN, label: 'Set Monument' },
      { symbol: '●', color: C_RED, label: 'Masonry Nail' },
      { symbol: '---', color: C_BLACK, label: 'Boundary Line' },
    ]
    
    let itemY = y + mmToPx(10)
    items.forEach(item => {
      svg += `<text x="${x + mmToPx(3)}" y="${itemY}" font-family="JetBrains Mono, Courier New" font-size="10" fill="${item.color}">${item.symbol}</text>`
      svg += `<text x="${x + mmToPx(8)}" y="${itemY}" font-family="JetBrains Mono, Courier New" font-size="6" fill="${C_BLACK}">${item.label}</text>`
      itemY += mmToPx(6)
    })
    
    return svg
  }

  /**
   * Draw revision history table (Form No. 4 Rule 7)
   * Shows all revisions to the plan with date, description, and surveyor.
   * Per Survey Act Cap. 299, every amendment to a registered plan must
   * be recorded with a revision entry.
   */
  private drawFormNo4RevisionHistory(x: number, y: number, w: number): string {
    const p = this.data.project
    const revisions = p.revisions || []
    const h = mmToPx(20)

    let svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${x + w/2}" y="${y + mmToPx(4)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="6" font-weight="bold" fill="${C_BLACK}">REVISION HISTORY</text>`
    svg += `<line x1="${x}" y1="${y + mmToPx(5.5)}" x2="${x + w}" y2="${y + mmToPx(5.5)}" stroke="${C_BLACK}" stroke-width="0.3"/>`

    // Column headers
    const colWidths = [mmToPx(8), mmToPx(18), mmToPx(32), mmToPx(18)]
    const headers = ['Rev', 'Date', 'Description', 'By']
    let hx = x
    headers.forEach((h, i) => {
      svg += `<text x="${hx + 1}" y="${y + mmToPx(8)}" font-family="JetBrains Mono, Courier New" font-size="4.5" font-weight="bold" fill="#555">${h}</text>`
      hx += colWidths[i]
    })

    svg += `<line x1="${x}" y1="${y + mmToPx(9)}" x2="${x + w}" y2="${y + mmToPx(9)}" stroke="${C_BLACK}" stroke-width="0.2"/>`

    // Revision rows — if none, show "Initial Issue"
    const rows = revisions.length > 0 ? revisions.slice(0, 3) : [
      { rev: 'A', date: new Date().toLocaleDateString('en-GB'), description: 'Initial issue', by: p.surveyor_name || '' }
    ]

    let rowY = y + mmToPx(11.5)
    rows.forEach((row) => {
      hx = x
      const cells = [row.rev, row.date, row.description.length > 25 ? row.description.slice(0, 23) + '..' : row.description, row.by]
      cells.forEach((cell, ci) => {
        svg += `<text x="${hx + 1}" y="${rowY}" font-family="JetBrains Mono, Courier New" font-size="4" fill="${C_BLACK}">${escapeXml(cell)}</text>`
        hx += colWidths[ci]
      })
      rowY += mmToPx(3)
    })

    return svg
  }

  private drawSurveyorCertificateInternal(x: number, y: number, w: number): string {
    const d = this.formNo4Data
    const h = mmToPx(105) // Expanded to accommodate declaration + enhanced auth block

    let svg = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white" stroke="${C_BLACK}" stroke-width="0.5"/>`

    // ── DECLARATION ──
    svg += `<text x="${x + w/2}" y="${y + mmToPx(5)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="7" font-weight="bold" fill="${C_BLACK}">DECLARATION</text>`
    svg += `<line x1="${x}" y1="${y + mmToPx(6.5)}" x2="${x + w}" y2="${y + mmToPx(6.5)}" stroke="${C_BLACK}" stroke-width="0.3"/>`

    // Declaration text (wrapped at ~48 chars per line)
    const words = d.declarationText.split(' ')
    const lines: string[] = []
    let currentLine = ''

    words.forEach(word => {
      if ((currentLine + word).length > 48) {
        lines.push(currentLine.trim())
        currentLine = word + ' '
      } else {
        currentLine += word + ' '
      }
    })
    if (currentLine) lines.push(currentLine.trim())

    let textY = y + mmToPx(12)
    lines.slice(0, 6).forEach(line => {
      svg += `<text x="${x + mmToPx(2)}" y="${textY}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="${C_BLACK}">${escapeXml(line)}</text>`
      textY += mmToPx(4)
    })

    // Surveyor signature line with name and licence
    textY += mmToPx(2)
    svg += `<line x1="${x + mmToPx(2)}" y1="${textY}" x2="${x + w * 0.55}" y2="${textY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${x + mmToPx(2)}" y="${textY + mmToPx(3.5)}" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">Signature of Licensed Surveyor</text>`

    // Date on the right side of signature line
    svg += `<line x1="${x + w * 0.6}" y1="${textY}" x2="${x + w - mmToPx(2)}" y2="${textY}" stroke="${C_BLACK}" stroke-width="0.5"/>`
    svg += `<text x="${x + w * 0.6}" y="${textY + mmToPx(3.5)}" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">Date: ${escapeXml(d.declarationDate)}</text>`

    // Surveyor credentials below signature
    textY += mmToPx(6)
    if (d.surveyorName) {
      svg += `<text x="${x + mmToPx(2)}" y="${textY}" font-family="JetBrains Mono, Courier New" font-size="4.5" font-weight="bold" fill="${C_BLACK}">${escapeXml(d.surveyorName)}</text>`
      textY += mmToPx(3.5)
    }
    if (d.surveyorLicence) {
      svg += `<text x="${x + mmToPx(2)}" y="${textY}" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">LS/${escapeXml(d.surveyorLicence)}</text>`
      textY += mmToPx(3.5)
    }
    if (d.iskRegNo) {
      svg += `<text x="${x + mmToPx(2)}" y="${textY}" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">ISK Reg. ${escapeXml(d.iskRegNo)}</text>`
      textY += mmToPx(3.5)
    }
    if (d.firmName) {
      svg += `<text x="${x + mmToPx(2)}" y="${textY}" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">${escapeXml(d.firmName)}</text>`
      textY += mmToPx(3.5)
    }

    // ── Surveyor Stamp & Seal Area ──
    // Two areas: ISK rubber stamp (left) and Surveyor's seal (right)
    // Per ISK practice, the surveyor applies their rubber stamp next to the
    // signature. The seal circle represents the surveyor's corporate seal.
    const stampRowY = textY - mmToPx(14)
    
    // ISK Association Stamp area
    const iskStampX = x + mmToPx(2)
    const iskStampW = mmToPx(28)
    const iskStampH = mmToPx(12)
    svg += `<rect x="${iskStampX}" y="${stampRowY}" width="${iskStampW}" height="${iskStampH}" fill="none" stroke="#999" stroke-width="0.3" stroke-dasharray="2,1"/>`
    svg += `<text x="${iskStampX + iskStampW/2}" y="${stampRowY + mmToPx(4)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#aaa">ISK ASSOCIATION</text>`
    svg += `<text x="${iskStampX + iskStampW/2}" y="${stampRowY + mmToPx(7)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#aaa">RUBBER STAMP</text>`
    if (d.firmName) {
      svg += `<text x="${iskStampX + iskStampW/2}" y="${stampRowY + mmToPx(10)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="2.5" fill="#bbb">${escapeXml(d.firmName)}</text>`
    }

    // Surveyor's Corporate Seal area
    const sealX = x + w - mmToPx(22)
    const sealW = mmToPx(18)
    const sealH = mmToPx(12)
    svg += `<rect x="${sealX}" y="${stampRowY}" width="${sealW}" height="${sealH}" fill="none" stroke="#999" stroke-width="0.3" stroke-dasharray="2,1"/>`
    svg += `<circle cx="${sealX + sealW/2}" cy="${stampRowY + sealH/2}" r="${mmToPx(4)}" fill="none" stroke="#ccc" stroke-width="0.3" stroke-dasharray="1.5,1"/>`
    svg += `<text x="${sealX + sealW/2}" y="${stampRowY + sealH/2 - 1}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#aaa">SURVEYOR</text>`
    svg += `<text x="${sealX + sealW/2}" y="${stampRowY + sealH/2 + 2}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#aaa">SEAL</text>`

    textY += mmToPx(2)

    // ── SoK AUTHENTICATION BLOCK ──
    // Per Survey Act Cap. 299, Form No. 4 — this block is completed by the
    // Director of Surveys office after the plan is submitted for authentication.
    // The three signature lines correspond to: examination (checking computations),
    // approval (verifying compliance), and authentication (official SoK seal).
    const authY = textY + mmToPx(1)
    const authH = mmToPx(36)
    svg += `<rect x="${x}" y="${authY}" width="${w}" height="${authH}" fill="#fafafa" stroke="${C_BLACK}" stroke-width="0.5"/>`

    // Header
    svg += `<text x="${x + w/2}" y="${authY + mmToPx(4)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">FOR DIRECTOR OF SURVEYS</text>`
    svg += `<line x1="${x}" y1="${authY + mmToPx(5.5)}" x2="${x + w}" y2="${authY + mmToPx(5.5)}" stroke="${C_BLACK}" stroke-width="0.3"/>`

    // Letter No. — reference number for the Director of Surveys' covering letter
    svg += `<text x="${x + mmToPx(2)}" y="${authY + mmToPx(9)}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="${C_BLACK}">Letter No.: ${d.letterNo || '________________________'}</text>`
    svg += `<text x="${x + w - mmToPx(2)}" y="${authY + mmToPx(9)}" text-anchor="end" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">Ref: ${d.firNumber || '___________'}</text>`

    // Examined by — checks computations and field work
    svg += `<text x="${x + mmToPx(2)}" y="${authY + mmToPx(14)}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="${C_BLACK}">Examined by: ________________________</text>`
    svg += `<text x="${x + w - mmToPx(2)}" y="${authY + mmToPx(14)}" text-anchor="end" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">Date: ___________</text>`

    // Approved by — verifies compliance with Survey Act Cap. 299
    svg += `<text x="${x + mmToPx(2)}" y="${authY + mmToPx(19)}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="${C_BLACK}">Approved by: ________________________</text>`
    svg += `<text x="${x + w - mmToPx(2)}" y="${authY + mmToPx(19)}" text-anchor="end" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">Date: ___________</text>`

    // Authenticated by — applies the official Survey of Kenya seal
    svg += `<text x="${x + mmToPx(2)}" y="${authY + mmToPx(24)}" font-family="JetBrains Mono, Courier New" font-size="4.5" fill="${C_BLACK}">Authenticated by: ____________________</text>`
    svg += `<text x="${x + w - mmToPx(2)}" y="${authY + mmToPx(24)}" text-anchor="end" font-family="JetBrains Mono, Courier New" font-size="4" fill="#555">Date: ___________</text>`

    // Official SoK Seal area — circle with proper label
    const sealCx = x + w - mmToPx(11)
    const sealCy = authY + mmToPx(30)
    const sealR = mmToPx(5)
    svg += `<circle cx="${sealCx}" cy="${sealCy}" r="${sealR}" fill="none" stroke="${C_BLACK}" stroke-width="0.4" stroke-dasharray="1.5,1"/>`
    svg += `<text x="${sealCx}" y="${sealCy - 1}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#888">OFFICIAL SEAL</text>`
    svg += `<text x="${sealCx}" y="${sealCy + 2}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#888">SURVEY OF KENYA</text>`

    // Legal reference note at bottom of auth block
    svg += `<text x="${x + mmToPx(2)}" y="${authY + mmToPx(33)}" font-family="JetBrains Mono, Courier New" font-size="3" fill="#999">Per Survey Act Cap. 299, Sec. 22 — Authentication by Director of Surveys</text>`

    return svg
  }

  /**
   * Draw Form No. 4 title block at bottom
   */
  private drawFormNo4TitleBlock(): string {
    const d = this.formNo4Data
  const footerY = this.pageH - mmToPx(50)
  const footerH = mmToPx(44)
  const margin = mmToPx(10)
  const cols = 6
  const colW = (this.pageW - margin * 2) / cols

    let svg = `<g class="form-no-4-title-block">`
    
    // Main title block with 6 columns
    const headers = ['Registration', 'Transaction', 'Authentication', 'Date', 'Records', 'Date']
    let x = margin
    
    headers.forEach((header) => {
      svg += `<rect x="${x}" y="${footerY}" width="${colW}" height="${footerH}" fill="#f8f8f8" stroke="${C_BLACK}" stroke-width="0.5"/>`
      svg += `<text x="${x + colW/2}" y="${footerY + mmToPx(4)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="5" font-weight="bold" fill="${C_BLACK}">${header}</text>`
      x += colW
    })

    // Folio and Register numbers (large text below)
    const folioY = footerY + footerH + mmToPx(3)
    
    if (d.folioNumber) {
      svg += `<text x="${this.pageW/2 - mmToPx(40)}" y="${folioY}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="14" font-weight="bold" fill="${C_BLACK}">Folio No. ${escapeXml(d.folioNumber)}</text>`
    }
    
    if (d.registerNumber) {
      svg += `<text x="${this.pageW/2 + mmToPx(40)}" y="${folioY}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="14" font-weight="bold" fill="${C_BLACK}">Register No. ${escapeXml(d.registerNumber)}</text>`
    }
    
    if (d.firNumber) {
      svg += `<text x="${this.pageW/2}" y="${folioY + mmToPx(6)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="10" fill="${C_BLACK}">FIR No. ${escapeXml(d.firNumber)}</text>`
    }

    svg += '</g>'
    return svg
  }

  /**
   * Draw submission number in header
   */
  private drawSubmissionNumberHeader(): string {
    const d = this.formNo4Data
    if (!d.submissionNumber) return ''

  const y = mmToPx(8)
  const cx = this.pageW / 2

    return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="8" font-weight="bold" fill="${C_BLACK}">Submission: ${escapeXml(d.submissionNumber)}</text>`
  }

  // drawRoadTruncationLines() — inherited from SurveyPlanRenderer base class

  /**
   * Draw print verification hash at the bottom of the plan.
   * Overrides base class to include Form No. 4 specific data (folio, register).
   * Uses SHA-256 cryptographic hash for production-grade verification.
   */
  protected drawPrintVerification(): string {
    const d = this.formNo4Data
    const pts = this.rotatedPoints
    const p = this.data.project

    // Build a verification string from key plan data (includes Form No. 4 fields)
    const coordString = pts.map(pt => `${pt.easting.toFixed(4)},${pt.northing.toFixed(4)}`).join('|')
    const areaVal = this.data.parcel.area_sqm.toFixed(4)
    const lrNum = d.lrNumber || 'UNKNOWN'
    const scaleVal = this.scale
    const dateStr = d.declarationDate || new Date().toISOString().split('T')[0]
    const folio = d.folioNumber || ''
    const register = d.registerNumber || ''
    const surveyorLicence = p.surveyor_licence || ''
    const revisionsCount = (p.revisions || []).length

    // SHA-256 cryptographic hash for deterministic verification code
    const rawString = `${coordString}|${areaVal}|${lrNum}|${scaleVal}|${dateStr}|${folio}|${register}|${surveyorLicence}|${revisionsCount}`
    const verCode = createHash('sha256').update(rawString).digest('hex').toUpperCase().slice(0, 16)

    const y = this.pageH - mmToPx(3)
    const cx = this.pageW / 2

    let svg = ''
    svg += `<text x="${cx}" y="${y}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="4" fill="#999">Verification: ${verCode} | Generated: ${escapeXml(dateStr)} | Scale: 1:${scaleVal}</text>`
    svg += `<text x="${cx}" y="${y + mmToPx(2)}" text-anchor="middle" font-family="JetBrains Mono, Courier New" font-size="3" fill="#bbb">Alteration of this plan invalidates verification — Per Survey Act Cap. 299, Sec. 23</text>`

    return svg
  }

private getControlPoints(): CoordinateScheduleEntry[] {
    return this.data.controlPoints.map(cp => ({
      station: cp.name,
      northing: cp.northing,
      easting: cp.easting,
      height: cp.elevation,
      beaconClass: this.mapMonumentTypeToClass(cp.monumentType),
      description: cp.beaconDescription
    }))
  }

  private mapMonumentTypeToClass(mt: string): 'new' | 'old' | 'theoretical' | 'IPCU' {
    if (mt === 'set') return 'new'
    if (mt === 'found') return 'old'
    return 'theoretical'
  }
  
  private calculateCentroid(points: Array<{ easting: number; northing: number }>): { easting: number; northing: number } {
    const sumE = points.reduce((sum, p) => sum + p.easting, 0)
    const sumN = points.reduce((sum, p) => sum + p.northing, 0)
    return {
      easting: sumE / points.length,
      northing: sumN / points.length
    }
  }
}

interface FormNo4Data {
  folioNumber: string
  registerNumber: string
  lrNumber: string
  plotParcelNumber: string
  refMapRIM: string
  registrationBlock: string
  registrationDistrict: string
  locality: string
  formNumber: string
  computationsNo: string
  fieldBookNo: string
  dateReceived: string
  fileReference: string
  scale: string
  firNumber: string
  submissionNumber: string
  // Authentication
  examinedBy: string
  examinedDate: string
  approvedBy: string
  approvedDate: string
  authenticatedBy: string
  authenticatedDate: string
  // Declaration
  declarationText: string
  declarationDate: string
  letterNo: string
  // Surveyor credentials for stamp and certificate
  surveyorName: string
  surveyorLicence: string
  iskRegNo: string
  firmName: string
}

export default FormNo4Renderer
