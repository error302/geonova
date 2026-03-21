/**
 * Survey Document Package Generator
 * Generates all standard documents a surveyor must deliver per survey type.
 * Uses project data already in GeoNova — surveyor fills remaining fields then prints.
 */

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type SurveyDocType =
  | 'cover_letter'
  | 'field_notes'
  | 'computation_sheet'
  | 'area_certificate'
  | 'beacon_descriptions'
  | 'mutation_form'
  | 'completion_certificate'
  | 'leveling_summary'
  | 'control_submission'
  | 'as_built_certificate'

export interface DocumentDef {
  id: SurveyDocType
  title: string
  description: string
  required: boolean
}

// Which documents are required per survey type
export const DOCS_BY_TYPE: Record<string, DocumentDef[]> = {
  boundary: [
    { id: 'cover_letter',        title: 'Cover letter to client',         description: 'Transmittal letter enclosing the survey documents',             required: true },
    { id: 'field_notes',         title: 'Field notes summary',            description: 'Summary of field observations, beacon descriptions, methods',   required: true },
    { id: 'computation_sheet',   title: 'Computation sheet',              description: 'Traverse adjustment, closure, precision ratio',                 required: true },
    { id: 'area_certificate',    title: 'Area certificate',               description: 'Certified statement of parcel area signed by licensed surveyor', required: true },
    { id: 'beacon_descriptions', title: 'Beacon descriptions',            description: 'Written description and location of each boundary beacon',       required: true },
    { id: 'mutation_form',       title: 'Mutation form (3 copies)',        description: 'Standard mutation form for boundary changes / subdivision',      required: true },
  ],
  traverse: [
    { id: 'cover_letter',      title: 'Cover letter',               description: 'Transmittal letter to client or authority',                      required: true },
    { id: 'field_notes',       title: 'Field notes summary',        description: 'Summary of field observations, instrument settings, methods',    required: true },
    { id: 'computation_sheet', title: 'Computation sheet',          description: 'Full traverse adjustment with Bowditch/Transit method',          required: true },
    { id: 'control_submission','title': 'Control submission (Form C22)', description: 'Submit new control points to Survey of Kenya for registration', required: false },
  ],
  leveling: [
    { id: 'cover_letter',      title: 'Cover letter',               description: 'Transmittal letter to client',                                   required: true },
    { id: 'field_notes',       title: 'Field notes summary',        description: 'Leveling route, BM descriptions, weather, instrument used',     required: true },
    { id: 'leveling_summary',  title: 'Level book summary',         description: 'Reduced levels, arithmetic check, misclosure, correction',      required: true },
    { id: 'computation_sheet', title: 'Misclosure computation',     description: 'Formal misclosure vs allowable, correction applied',             required: true },
  ],
  topographic: [
    { id: 'cover_letter',      title: 'Cover letter',               description: 'Transmittal with description of survey scope and outputs',       required: true },
    { id: 'field_notes',       title: 'Field notes summary',        description: 'Methods, control used, features captured, instrument settings',  required: true },
    { id: 'computation_sheet', title: 'Control computation',        description: 'Traverse/control adjustment supporting the topo survey',         required: true },
  ],
  engineering: [
    { id: 'cover_letter',          title: 'Cover letter',               description: 'Transmittal to engineer / contractor',                           required: true },
    { id: 'computation_sheet',     title: 'Setting out data sheet',     description: 'Computed setout data — coordinates, bearings, distances',        required: true },
    { id: 'completion_certificate','title': 'Completion certificate',   description: 'Surveyor certifies setout is complete and within tolerance',      required: true },
    { id: 'as_built_certificate',  title: 'As-built statement',        description: 'As-built survey confirming constructed positions',                required: false },
  ],
  stakeout: [
    { id: 'cover_letter',          title: 'Cover letter',               description: 'Transmittal to client / contractor',                             required: true },
    { id: 'computation_sheet',     title: 'Setting out data sheet',     description: 'All setout points with design vs measured comparison',           required: true },
    { id: 'completion_certificate','title': 'Completion certificate',   description: 'Surveyor certifies pegs placed within tolerance',                 required: true },
  ],
  gnss_baseline: [
    { id: 'cover_letter',      title: 'Cover letter',               description: 'Transmittal and executive summary',                               required: true },
    { id: 'field_notes',       title: 'Field notes',                description: 'Session log, antenna heights, occupation times, PDOP values',    required: true },
    { id: 'computation_sheet', title: 'Baseline computation',       description: 'Baseline vectors, network adjustment, final coordinates',        required: true },
    { id: 'control_submission','title': 'Control submission',       description: 'Submit new GNSS control to national network (if applicable)',    required: false },
  ],
  mining: [
    { id: 'cover_letter',      title: 'Cover letter to mine manager', description: 'Monthly progress report transmittal',                          required: true },
    { id: 'field_notes',       title: 'Field notes summary',          description: 'Areas surveyed, methods, safety briefing reference',           required: true },
    { id: 'computation_sheet', title: 'Volume computation',           description: 'Volume of material moved, stope dimensions',                  required: true },
  ],
  hydrographic: [
    { id: 'cover_letter',      title: 'Cover letter',               description: 'Transmittal with chart description and datum used',              required: true },
    { id: 'field_notes',       title: 'Field notes',                description: 'Sounding log, tide readings, equipment used, weather',          required: true },
    { id: 'computation_sheet', title: 'Sounding computation',       description: 'Reduced soundings, chart datum corrections',                   required: true },
  ],
}

// Default to boundary docs for unknown types
export function getDocsForType(surveyType?: string): DocumentDef[] {
  const type = (surveyType || 'boundary').toLowerCase()
  return DOCS_BY_TYPE[type] ?? DOCS_BY_TYPE.boundary
}

// ── HTML template generators ──────────────────────────────────────────────────
// Each returns a complete HTML string ready to print/save as PDF via browser

export interface ProjectData {
  name: string
  location: string
  utm_zone: number
  hemisphere: string
  survey_type?: string
  client_name?: string | null
  surveyor_name?: string | null
  created_at: string
}

export interface PointData {
  name: string
  easting: number
  northing: number
  elevation?: number
  is_control: boolean
}

export interface TraverseData {
  totalDistance: number
  closingErrorE: number
  closingErrorN: number
  linearError: number
  precisionRatio: number
  precisionGrade: string
  legs: Array<{
    fromName: string
    toName: string
    distance: number
    rawBearing?: number
    adjEasting?: number
    adjNorthing?: number
  }>
}

export interface AreaData {
  squareMeters: number
  hectares: number
  acres: number
  perimeter: number
}

function docHeader(title: string, project: ProjectData, surveyorDetails: Record<string,string>): string {
  const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
  return `
  <div style="border-bottom:2px solid #E8841A;padding-bottom:12px;margin-bottom:20px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-size:22px;font-weight:700;color:#E8841A;letter-spacing:1px;">GEONOVA</div>
        <div style="font-size:11px;color:#666;margin-top:2px;">Professional Surveying Platform</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#444;">
        <div style="font-weight:600;">${esc(surveyorDetails.firm || surveyorDetails.name || '')}</div>
        ${surveyorDetails.licence ? `<div>Licence: ${esc(surveyorDetails.licence)}</div>` : ''}
        ${surveyorDetails.phone ? `<div>${esc(surveyorDetails.phone)}</div>` : ''}
        ${surveyorDetails.email ? `<div>${esc(surveyorDetails.email)}</div>` : ''}
      </div>
    </div>
    <div style="margin-top:16px;">
      <div style="font-size:16px;font-weight:700;color:#111;">${esc(title)}</div>
      <div style="font-size:11px;color:#555;margin-top:4px;">
        Project: <strong>${esc(project.name)}</strong> &nbsp;|&nbsp;
        Date: ${today} &nbsp;|&nbsp;
        UTM: Zone ${project.utm_zone}${project.hemisphere}
      </div>
    </div>
  </div>`
}

function signatureBlock(surveyorName: string, licenceNo: string, role: string = 'Licensed Surveyor'): string {
  return `
  <div style="margin-top:40px;display:flex;gap:60px;">
    <div style="flex:1;">
      <div style="border-bottom:1px solid #333;margin-bottom:6px;height:36px;"></div>
      <div style="font-size:11px;font-weight:600;">${esc(surveyorName || 'Surveyor Name')}</div>
      <div style="font-size:10px;color:#555;">${esc(role)}</div>
      ${licenceNo ? `<div style="font-size:10px;color:#555;">Licence No: ${esc(licenceNo)}</div>` : ''}
    </div>
    <div style="flex:1;">
      <div style="border-bottom:1px solid #333;margin-bottom:6px;height:36px;"></div>
      <div style="font-size:11px;font-weight:600;">Date</div>
    </div>
    <div style="flex:1;">
      <div style="border-bottom:1px solid #333;margin-bottom:6px;height:36px;"></div>
      <div style="font-size:11px;font-weight:600;">Seal / Stamp</div>
    </div>
  </div>`
}

function pageStyles(): string {
  return `<style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 24px 32px; max-width: 800px; }
    h2 { font-size: 13px; font-weight: 700; color: #111; margin: 20px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 8px 0; }
    th { background: #f0f0f0; padding: 6px 8px; text-align: left; font-weight: 600; border: 1px solid #ccc; }
    td { padding: 5px 8px; border: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .label { font-size: 11px; color: #555; margin-bottom: 2px; }
    .value { font-size: 12px; font-weight: 600; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
    .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin: 12px 0; }
    .box { border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; }
    .highlight { background: #fff8f0; border-left: 3px solid #E8841A; padding: 8px 12px; margin: 10px 0; font-size: 11px; }
    .pass { color: #16a34a; font-weight: 700; }
    .fail { color: #dc2626; font-weight: 700; }
    @media print { body { padding: 10px; } }
  </style>`
}

// ── Individual document generators ────────────────────────────────────────────

export function generateCoverLetter(
  project: ProjectData,
  surveyorDetails: Record<string,string>,
  extraFields: Record<string,string>
): string {
  const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
  const typeLabel = (project.survey_type || 'Survey').charAt(0).toUpperCase() + (project.survey_type || 'survey').slice(1)
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cover Letter</title>${pageStyles()}</head><body>
  ${docHeader('Cover Letter', project, surveyorDetails)}

  <p>${today}</p>
  <p>
    <strong>${esc(project.client_name || extraFields.clientName || '[Client Name]')}</strong><br>
    ${esc(extraFields.clientAddress || '[Client Address]')}
  </p>

  <p>Dear ${esc(project.client_name || extraFields.clientName || 'Sir/Madam')},</p>

  <p><strong>RE: ${typeLabel.toUpperCase()} SURVEY — ${esc(project.name).toUpperCase()}</strong></p>

  <p>We are pleased to submit herewith the survey documents for the above-referenced survey conducted at 
  <strong>${esc(project.location || '[Location]')}</strong>.</p>

  <p>The following documents are enclosed:</p>
  <ol style="font-size:12px;line-height:1.8;">
    ${(extraFields.enclosures || 'Survey plan\nField notes\nComputation sheet').split('\n').map(e => `<li>${e.trim()}</li>`).join('')}
  </ol>

  <p>The survey was carried out in accordance with the applicable national standards and regulations. 
  All computations have been independently checked. ${esc(extraFields.closureNote || '')}</p>

  <p>Should you require any clarification or additional information, please do not hesitate to contact us.</p>

  <p>Yours faithfully,</p>
  ${signatureBlock(project.surveyor_name || surveyorDetails.name || '', surveyorDetails.licence || '')}
  </body></html>`
}

export function generateComputationSheet(
  project: ProjectData,
  surveyorDetails: Record<string,string>,
  points: PointData[],
  traverse?: TraverseData,
  area?: AreaData
): string {
  const typeLabel = (project.survey_type || 'Survey').charAt(0).toUpperCase() + (project.survey_type || 'survey').slice(1)

  const coordTable = `
  <h2>Survey Coordinates — UTM Zone ${project.utm_zone}${project.hemisphere}</h2>
  <table>
    <thead><tr>
      <th>Pt</th><th>Easting (m)</th><th>Northing (m)</th><th>Elevation (m)</th><th>Type</th>
    </tr></thead>
    <tbody>
      ${points.map(p => `<tr>
        <td><strong>${p.name}</strong></td>
        <td style="font-family:monospace">${p.easting.toFixed(4)}</td>
        <td style="font-family:monospace">${p.northing.toFixed(4)}</td>
        <td style="font-family:monospace">${p.elevation != null ? p.elevation.toFixed(3) : '—'}</td>
        <td>${p.is_control ? 'Control' : 'Detail'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`

  const traverseSection = traverse ? `
  <h2>Traverse Adjustment — ${typeLabel}</h2>
  <div class="grid3">
    <div class="box"><div class="label">Total distance</div><div class="value">${traverse.totalDistance.toFixed(4)} m</div></div>
    <div class="box"><div class="label">Linear misclosure</div><div class="value">${traverse.linearError.toFixed(6)} m</div></div>
    <div class="box"><div class="label">Precision ratio</div><div class="value">1 : ${Math.round(1/traverse.precisionRatio).toLocaleString()}</div></div>
    <div class="box"><div class="label">Closing error E</div><div class="value">${traverse.closingErrorE >= 0 ? '+' : ''}${traverse.closingErrorE.toFixed(6)} m</div></div>
    <div class="box"><div class="label">Closing error N</div><div class="value">${traverse.closingErrorN >= 0 ? '+' : ''}${traverse.closingErrorN.toFixed(6)} m</div></div>
    <div class="box"><div class="label">Grade</div><div class="value ${traverse.precisionGrade === 'Excellent' || traverse.precisionGrade === 'Good' ? 'pass' : ''}">${traverse.precisionGrade}</div></div>
  </div>` : ''

  const areaSection = area ? `
  <h2>Area Computation</h2>
  <div class="grid3">
    <div class="box"><div class="label">Area (m²)</div><div class="value">${area.squareMeters.toFixed(2)} m²</div></div>
    <div class="box"><div class="label">Area (ha)</div><div class="value">${area.hectares.toFixed(4)} ha</div></div>
    <div class="box"><div class="label">Area (acres)</div><div class="value">${area.acres.toFixed(4)} ac</div></div>
    <div class="box"><div class="label">Perimeter</div><div class="value">${area.perimeter.toFixed(3)} m</div></div>
  </div>` : ''

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Computation Sheet</title>${pageStyles()}</head><body>
  ${docHeader('Survey Computation Sheet', project, surveyorDetails)}
  <div class="grid2">
    <div>
      <div class="label">Project</div><div class="value">${esc(project.name)}</div>
    </div>
    <div>
      <div class="label">Location</div><div class="value">${esc(project.location || '—')}</div>
    </div>
    <div>
      <div class="label">Survey type</div><div class="value">${typeLabel}</div>
    </div>
    <div>
      <div class="label">Client</div><div class="value">${esc(project.client_name || '—')}</div>
    </div>
  </div>
  ${coordTable}
  ${traverseSection}
  ${areaSection}
  <div class="highlight">
    I certify that the above computations are correct and have been independently checked.
  </div>
  ${signatureBlock(project.surveyor_name || surveyorDetails.name || '', surveyorDetails.licence || '')}
  </body></html>`
}

export function generateAreaCertificate(
  project: ProjectData,
  surveyorDetails: Record<string,string>,
  area?: AreaData,
  extraFields?: Record<string,string>
): string {
  const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Area Certificate</title>${pageStyles()}</head><body>
  ${docHeader('Area Certificate', project, surveyorDetails)}

  <div style="text-align:center;margin:30px 0 20px;">
    <div style="font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Certificate of Area</div>
  </div>

  <p>I, <strong>${esc(project.surveyor_name || surveyorDetails.name || '[Surveyor Name]')}</strong>,
  ${surveyorDetails.licence ? `Licensed Surveyor No. <strong>${surveyorDetails.licence}</strong>,` : ''}
  hereby certify that I have surveyed the land known as:</p>

  <div class="box" style="margin:16px 0;text-align:center;">
    <div style="font-size:14px;font-weight:700;">${esc(project.name)}</div>
    <div style="font-size:12px;color:#555;margin-top:4px;">${esc(project.location || '')}</div>
    ${extraFields?.parcelRef ? `<div style="font-size:11px;color:#555;">Parcel Ref: ${esc(extraFields.parcelRef)}</div>` : ''}
  </div>

  <p>and that the area of the said land, as determined from survey coordinates in UTM Zone 
  <strong>${project.utm_zone}${project.hemisphere}</strong>, is as follows:</p>

  ${area ? `
  <div class="grid3" style="margin:20px 0;">
    <div class="box" style="text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#E8841A;">${area.squareMeters.toFixed(2)}</div>
      <div class="label">Square metres (m²)</div>
    </div>
    <div class="box" style="text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#E8841A;">${area.hectares.toFixed(4)}</div>
      <div class="label">Hectares (ha)</div>
    </div>
    <div class="box" style="text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#E8841A;">${area.acres.toFixed(4)}</div>
      <div class="label">Acres</div>
    </div>
  </div>
  <p>Perimeter: <strong>${area.perimeter.toFixed(3)} m</strong></p>` 
  : '<div class="box" style="text-align:center;padding:24px;">[Area to be computed and entered here]</div>'}

  <p>This certificate is issued on <strong>${today}</strong> and is valid for purposes of 
  property registration, valuation, and legal documentation.</p>

  <div class="highlight">
    This area was computed from survey coordinates obtained by field observation. 
    All measurements were taken in accordance with applicable survey standards.
  </div>

  ${signatureBlock(project.surveyor_name || surveyorDetails.name || '', surveyorDetails.licence || '', 'Licensed Surveyor / Registered Surveyor')}
  </body></html>`
}

export function generateFieldNotes(
  project: ProjectData,
  surveyorDetails: Record<string,string>,
  points: PointData[],
  extraFields: Record<string,string>
): string {
  const typeLabel = (project.survey_type || 'Survey').charAt(0).toUpperCase() + (project.survey_type || 'survey').slice(1)
  const controlPts = points.filter(p => p.is_control)
  const detailPts  = points.filter(p => !p.is_control)

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Field Notes</title>${pageStyles()}</head><body>
  ${docHeader('Field Notes Summary', project, surveyorDetails)}

  <h2>Survey Information</h2>
  <div class="grid2">
    <div class="box"><div class="label">Project</div><div class="value">${esc(project.name)}</div></div>
    <div class="box"><div class="label">Survey type</div><div class="value">${typeLabel}</div></div>
    <div class="box"><div class="label">Location</div><div class="value">${esc(project.location || '—')}</div></div>
    <div class="box"><div class="label">Client</div><div class="value">${esc(project.client_name || '—')}</div></div>
    <div class="box"><div class="label">Field date</div><div class="value">${esc(extraFields.fieldDate || '—')}</div></div>
    <div class="box"><div class="label">Weather</div><div class="value">${esc(extraFields.weather || '—')}</div></div>
    <div class="box"><div class="label">Instrument</div><div class="value">${esc(extraFields.instrument || '—')}</div></div>
    <div class="box"><div class="label">Serial number</div><div class="value">${esc(extraFields.serial || '—')}</div></div>
    <div class="box"><div class="label">Team members</div><div class="value">${esc(extraFields.team || '—')}</div></div>
    <div class="box"><div class="label">UTM zone / Datum</div><div class="value">Zone ${project.utm_zone}${project.hemisphere} / ${esc(extraFields.datum || 'Arc 1960')}</div></div>
  </div>

  <h2>Control Points Used (${controlPts.length})</h2>
  <table>
    <thead><tr><th>Point</th><th>Easting (m)</th><th>Northing (m)</th><th>Description</th></tr></thead>
    <tbody>
      ${controlPts.length > 0
        ? controlPts.map(p => `<tr>
            <td><strong>${p.name}</strong></td>
            <td style="font-family:monospace">${p.easting.toFixed(4)}</td>
            <td style="font-family:monospace">${p.northing.toFixed(4)}</td>
            <td>${esc(extraFields[`beacon_${p.name}`] || 'Existing beacon — found and used')}</td>
          </tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center;color:#888;">No control points recorded</td></tr>'}
    </tbody>
  </table>

  <h2>Detail Points (${detailPts.length})</h2>
  <table>
    <thead><tr><th>Point</th><th>Easting (m)</th><th>Northing (m)</th><th>Elevation (m)</th><th>Remarks</th></tr></thead>
    <tbody>
      ${detailPts.length > 0
        ? detailPts.map(p => `<tr>
            <td>${p.name}</td>
            <td style="font-family:monospace">${p.easting.toFixed(4)}</td>
            <td style="font-family:monospace">${p.northing.toFixed(4)}</td>
            <td style="font-family:monospace">${p.elevation != null ? p.elevation.toFixed(3) : '—'}</td>
            <td>${esc(extraFields[`remark_${p.name}`] || '')}</td>
          </tr>`).join('')
        : '<tr><td colspan="5" style="text-align:center;color:#888;">No detail points recorded</td></tr>'}
    </tbody>
  </table>

  ${extraFields.observations ? `<h2>Observations and Remarks</h2><p>${esc(extraFields.observations)}</p>` : ''}

  ${signatureBlock(project.surveyor_name || surveyorDetails.name || '', surveyorDetails.licence || '', 'Surveyor in Charge')}
  </body></html>`
}

export function generateBeaconDescriptions(
  project: ProjectData,
  surveyorDetails: Record<string,string>,
  points: PointData[],
  extraFields: Record<string,string>
): string {
  const beacons = points.filter(p => p.is_control)
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Beacon Descriptions</title>${pageStyles()}</head><body>
  ${docHeader('Beacon Descriptions', project, surveyorDetails)}

  <p>The following boundary beacons were found and/or placed during the survey of 
  <strong>${esc(project.name)}</strong> at <strong>${esc(project.location || '[Location]')}</strong>.</p>

  ${beacons.length === 0 
    ? '<div class="box" style="text-align:center;padding:24px;color:#888;">No control/boundary points recorded in this project.</div>'
    : beacons.map((pt, i) => `
  <div class="box" style="margin:12px 0;page-break-inside:avoid;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <strong style="font-size:14px;">Beacon ${pt.name}</strong>
      <span style="font-size:11px;color:#555;">Point ${i+1} of ${beacons.length}</span>
    </div>
    <div class="grid2">
      <div><div class="label">Easting</div><div style="font-family:monospace;font-weight:600;">${pt.easting.toFixed(4)} m</div></div>
      <div><div class="label">Northing</div><div style="font-family:monospace;font-weight:600;">${pt.northing.toFixed(4)} m</div></div>
      ${pt.elevation != null ? `<div><div class="label">Elevation</div><div style="font-family:monospace;font-weight:600;">${pt.elevation.toFixed(3)} m</div></div>` : ''}
    </div>
    <div style="margin-top:8px;">
      <div class="label">Beacon type and condition</div>
      <div style="border:1px solid #ddd;min-height:24px;padding:4px 8px;margin-top:2px;font-size:11px;">
        ${esc(extraFields[`beacon_type_${pt.name}`] || 'Concrete beacon with iron pin — [condition]')}
      </div>
    </div>
    <div style="margin-top:8px;">
      <div class="label">Physical description and access</div>
      <div style="border:1px solid #ddd;min-height:40px;padding:4px 8px;margin-top:2px;font-size:11px;">
        ${esc(extraFields[`beacon_desc_${pt.name}`] || '')}
      </div>
    </div>
  </div>`).join('')}

  ${signatureBlock(project.surveyor_name || surveyorDetails.name || '', surveyorDetails.licence || '')}
  </body></html>`
}

export function generateCompletionCertificate(
  project: ProjectData,
  surveyorDetails: Record<string,string>,
  extraFields: Record<string,string>
): string {
  const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
  const typeLabel = (project.survey_type || 'Survey').charAt(0).toUpperCase() + (project.survey_type || 'survey').slice(1)

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Completion Certificate</title>${pageStyles()}</head><body>
  ${docHeader('Certificate of Completion', project, surveyorDetails)}

  <div style="text-align:center;margin:30px 0 20px;">
    <div style="font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">Certificate of Survey Completion</div>
  </div>

  <p>I, <strong>${esc(project.surveyor_name || surveyorDetails.name || '[Surveyor Name]')}</strong>
  ${surveyorDetails.licence ? `, Licensed Surveyor No. <strong>${surveyorDetails.licence}</strong>,` : ''}
  hereby certify that the <strong>${typeLabel} Survey</strong> for the project:</p>

  <div class="box" style="margin:16px 0;text-align:center;">
    <div style="font-size:14px;font-weight:700;">${esc(project.name)}</div>
    <div style="font-size:12px;color:#555;margin-top:4px;">${esc(project.location || '')}</div>
  </div>

  <p>has been completed in accordance with the applicable national survey standards and regulations. 
  The survey was conducted on <strong>${esc(extraFields.fieldDate || '[Field Date]')}</strong> and the following 
  has been verified:</p>

  <div style="margin:16px 0;">
    ${(extraFields.completionItems || 
      'All survey points established and recorded\nField observations independently checked\nComputations verified and within acceptable limits\nSurvey documents prepared and certified').split('\n').map(item => `
    <div style="display:flex;align-items:flex-start;gap:8px;margin:6px 0;">
      <span style="color:#E8841A;font-weight:700;font-size:14px;">✓</span>
      <span>${item.trim()}</span>
    </div>`).join('')}
  </div>

  ${extraFields.notes ? `<div class="highlight">${esc(extraFields.notes)}</div>` : ''}

  <p>This certificate is issued on <strong>${today}</strong>.</p>

  <div style="display:flex;gap:40px;margin-top:40px;">
    <div style="flex:1;">
      ${signatureBlock(project.surveyor_name || surveyorDetails.name || '', surveyorDetails.licence || '', 'Surveyor in Charge')}
    </div>
    ${project.client_name ? `
    <div style="flex:1;">
      ${signatureBlock(esc(project.client_name), '', 'Client / Authorised Representative')}
    </div>` : ''}
  </div>
  </body></html>`
}

// ── Mutation Form ─────────────────────────────────────────────────────────────

export function generateMutationForm(
  project: ProjectData,
  surveyorDetails: Record<string,string>,
  points: PointData[],
  area?: AreaData,
  extraFields?: Record<string,string>
): string {
  const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
  const beacons = points.filter(p => p.is_control)
  const ex = extraFields || {}

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Mutation Form</title>${pageStyles()}</head><body>
  ${docHeader('Mutation Form', project, surveyorDetails)}

  <div style="text-align:center;margin:12px 0 20px;font-size:11px;color:#555;">
    <strong>Note:</strong> This form must be prepared in triplicate. Original to Land Registry, 
    copy to client, copy retained by surveyor.
  </div>

  <h2>Part A — Property Details</h2>
  <div class="grid2">
    <div class="box"><div class="label">Original LR No. / Plot No.</div><div style="border-bottom:1px solid #aaa;min-height:20px;padding:2px 0;">${esc(ex.originalLR || '')}</div></div>
    <div class="box"><div class="label">Registration Section / District</div><div style="border-bottom:1px solid #aaa;min-height:20px;padding:2px 0;">${esc(ex.regSection || '')}</div></div>
    <div class="box"><div class="label">Nature of mutation</div><div style="border-bottom:1px solid #aaa;min-height:20px;padding:2px 0;">${esc(ex.mutationType || 'Boundary survey / subdivision')}</div></div>
    <div class="box"><div class="label">County / Province</div><div style="border-bottom:1px solid #aaa;min-height:20px;padding:2px 0;">${esc(ex.county || '')}</div></div>
  </div>

  <h2>Part B — Area</h2>
  <div class="grid3">
    <div class="box"><div class="label">Area (m²)</div><div style="font-family:monospace;font-size:14px;font-weight:700;">${area ? area.squareMeters.toFixed(2) : '___________'}</div></div>
    <div class="box"><div class="label">Area (ha)</div><div style="font-family:monospace;font-size:14px;font-weight:700;">${area ? area.hectares.toFixed(4) : '___________'}</div></div>
    <div class="box"><div class="label">Perimeter (m)</div><div style="font-family:monospace;font-size:14px;font-weight:700;">${area ? area.perimeter.toFixed(3) : '___________'}</div></div>
  </div>

  <h2>Part C — Boundary Coordinates (UTM Zone ${project.utm_zone}${project.hemisphere})</h2>
  <table>
    <thead><tr><th>Beacon No.</th><th>Easting (m)</th><th>Northing (m)</th><th>Beacon Description</th></tr></thead>
    <tbody>
      ${beacons.map(p => `<tr>
        <td><strong>${p.name}</strong></td>
        <td style="font-family:monospace">${p.easting.toFixed(4)}</td>
        <td style="font-family:monospace">${p.northing.toFixed(4)}</td>
        <td>${ex[`beacon_desc_${p.name}`] || ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>Part D — Declaration by Licensed Surveyor</h2>
  <p style="font-size:11px;">I certify that I am a Licensed Surveyor and that I have surveyed the land described above and 
  that the information contained in this form is correct to the best of my knowledge.</p>
  ${signatureBlock(project.surveyor_name || surveyorDetails.name || '', surveyorDetails.licence || '', 'Licensed Surveyor')}

  <h2 style="margin-top:30px;">Part E — Declaration by Landowner / Applicant</h2>
  <div class="grid2">
    <div class="box"><div class="label">Full name</div><div style="border-bottom:1px solid #aaa;min-height:20px;padding:2px 0;">${esc(project.client_name || '')}</div></div>
    <div class="box"><div class="label">ID / Passport No.</div><div style="border-bottom:1px solid #aaa;min-height:20px;padding:2px 0;">${esc(ex.clientId || '')}</div></div>
  </div>
  <p style="font-size:11px;">I/We confirm that the boundaries shown in this mutation form are correct and accepted.</p>
  ${signatureBlock(project.client_name || 'Landowner', '', 'Landowner / Authorised Representative')}

  <div class="highlight" style="margin-top:24px;">
    <strong>For Land Registry Use Only</strong><br>
    Received: _________________ &nbsp;&nbsp; File No.: _________________ &nbsp;&nbsp; Officer: _________________
  </div>
  </body></html>`
}

// ── Leveling Summary ──────────────────────────────────────────────────────────

export function generateLevelingSummary(
  project: ProjectData,
  surveyorDetails: Record<string,string>,
  points: PointData[],
  extraFields?: Record<string,string>
): string {
  const ex = extraFields || {}
  const elevationPoints = points.filter(p => p.elevation != null)

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Leveling Summary</title>${pageStyles()}</head><body>
  ${docHeader('Leveling Summary / Level Book Abstract', project, surveyorDetails)}

  <h2>Survey Details</h2>
  <div class="grid3">
    <div class="box"><div class="label">Opening BM</div><div class="value">${esc(ex.openingBM || '—')}</div></div>
    <div class="box"><div class="label">Opening RL</div><div class="value">${esc(ex.openingRL || '—')} m</div></div>
    <div class="box"><div class="label">Closing BM</div><div class="value">${esc(ex.closingBM || '—')}</div></div>
    <div class="box"><div class="label">Closing RL (observed)</div><div class="value">${esc(ex.closingRLObs || '—')} m</div></div>
    <div class="box"><div class="label">Closing RL (known)</div><div class="value">${esc(ex.closingRLKnown || '—')} m</div></div>
    <div class="box"><div class="label">Misclosure</div><div class="value ${
      ex.misclosure && Math.abs(parseFloat(ex.misclosure)) < (parseFloat(ex.allowable||'999')) ? 'pass' : ''
    }">${ex.misclosure ? parseFloat(ex.misclosure) >= 0 ? '+' : '' : ''}${ex.misclosure || '—'} m</div></div>
    <div class="box"><div class="label">Distance (km)</div><div class="value">${ex.distanceKm || '—'} km</div></div>
    <div class="box"><div class="label">Allowable misclosure</div><div class="value">±${ex.allowable || '—'} m</div></div>
    <div class="box"><div class="label">Check</div><div class="value ${ex.misclosure && ex.allowable && Math.abs(parseFloat(ex.misclosure)) <= parseFloat(ex.allowable) ? 'pass' : 'fail'}">${
      ex.misclosure && ex.allowable 
        ? Math.abs(parseFloat(ex.misclosure)) <= parseFloat(ex.allowable) ? 'PASS' : 'FAIL'
        : '—'
    }</div></div>
  </div>

  <h2>Reduced Levels</h2>
  <table>
    <thead><tr><th>Station</th><th>Easting (m)</th><th>Northing (m)</th><th>Reduced Level (m)</th><th>Adjusted RL (m)</th><th>Remarks</th></tr></thead>
    <tbody>
      ${elevationPoints.map(p => `<tr>
        <td><strong>${p.name}</strong></td>
        <td style="font-family:monospace">${p.easting.toFixed(4)}</td>
        <td style="font-family:monospace">${p.northing.toFixed(4)}</td>
        <td style="font-family:monospace">${p.elevation!.toFixed(4)}</td>
        <td style="font-family:monospace">${ex[`adj_${p.name}`] || p.elevation!.toFixed(4)}</td>
        <td>${ex[`remark_${p.name}`] || (p.is_control ? 'Control BM' : 'TP')}</td>
      </tr>`).join('')}
      ${elevationPoints.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#888;">No elevation data. Add elevations to survey points in the workspace.</td></tr>' : ''}
    </tbody>
  </table>

  <h2>Arithmetic Check</h2>
  <div class="grid3">
    <div class="box"><div class="label">ΣBS</div><div class="value">${esc(ex.sumBS || '—')} m</div></div>
    <div class="box"><div class="label">ΣFS</div><div class="value">${esc(ex.sumFS || '—')} m</div></div>
    <div class="box"><div class="label">ΣBS − ΣFS</div><div class="value">${ex.sumBS && ex.sumFS ? (parseFloat(ex.sumBS)-parseFloat(ex.sumFS)).toFixed(5) : '—'} m</div></div>
    <div class="box"><div class="label">Last RL − First RL</div><div class="value">${esc(ex.rlDiff || '—')} m</div></div>
    <div class="box"><div class="label">Check</div>
      <div class="value ${ex.sumBS && ex.sumFS && ex.rlDiff && Math.abs((parseFloat(ex.sumBS)-parseFloat(ex.sumFS)) - parseFloat(ex.rlDiff)) < 0.001 ? 'pass' : ''}">
        ${ex.sumBS && ex.sumFS && ex.rlDiff ? Math.abs((parseFloat(ex.sumBS)-parseFloat(ex.sumFS)) - parseFloat(ex.rlDiff)) < 0.001 ? 'PASS' : 'FAIL' : '—'}
      </div>
    </div>
  </div>

  <div class="highlight">
    The arithmetic check verifies that ΣBS − ΣFS = Last RL − First RL. 
    A discrepancy indicates a booking or computation error.
  </div>

  ${signatureBlock(project.surveyor_name || surveyorDetails.name || '', surveyorDetails.licence || '')}
  </body></html>`
}

// ── Control Submission Form ───────────────────────────────────────────────────

export function generateControlSubmission(
  project: ProjectData,
  surveyorDetails: Record<string,string>,
  points: PointData[],
  extraFields?: Record<string,string>
): string {
  const ex = extraFields || {}
  const controlPts = points.filter(p => p.is_control)

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Control Submission</title>${pageStyles()}</head><body>
  ${docHeader('Control Point Submission — Form C22', project, surveyorDetails)}

  <div class="highlight">
    Submit this form with coordinates to the Survey of Kenya / national surveying authority 
    for registration of new control points.
  </div>

  <h2>Submission Details</h2>
  <div class="grid2">
    <div class="box"><div class="label">Network / Order</div><div class="value">${ex.network || 'Third Order'}</div></div>
    <div class="box"><div class="label">Datum</div><div class="value">${ex.datum || 'Arc 1960'}</div></div>
    <div class="box"><div class="label">UTM Zone</div><div class="value">Zone ${project.utm_zone}${project.hemisphere}</div></div>
    <div class="box"><div class="label">Adjustment method</div><div class="value">${ex.method || 'Bowditch Rule'}</div></div>
    <div class="box"><div class="label">Precision achieved</div><div class="value">${ex.precision || '—'}</div></div>
    <div class="box"><div class="label">Date observed</div><div class="value">${ex.dateObserved || '—'}</div></div>
  </div>

  <h2>New Control Points (${controlPts.length})</h2>
  <table>
    <thead><tr>
      <th>Station Name</th><th>Easting (m)</th><th>Northing (m)</th><th>Elevation (m)</th>
      <th>Position Accuracy</th><th>Monument Type</th>
    </tr></thead>
    <tbody>
      ${controlPts.map(p => `<tr>
        <td><strong>${p.name}</strong></td>
        <td style="font-family:monospace">${p.easting.toFixed(4)}</td>
        <td style="font-family:monospace">${p.northing.toFixed(4)}</td>
        <td style="font-family:monospace">${p.elevation != null ? p.elevation.toFixed(3) : '—'}</td>
        <td>${ex[`accuracy_${p.name}`] || ex.accuracy || '±0.05 m'}</td>
        <td>${ex[`monument_${p.name}`] || 'Concrete beacon with iron pin'}</td>
      </tr>`).join('')}
      ${controlPts.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#888;">No control points. Mark points as control in the project workspace.</td></tr>' : ''}
    </tbody>
  </table>

  <h2>Field Observation Details</h2>
  <div class="grid2">
    <div class="box"><div class="label">Instrument used</div><div class="value">${ex.instrument || '—'}</div></div>
    <div class="box"><div class="label">Serial number</div><div class="value">${ex.serial || '—'}</div></div>
    <div class="box"><div class="label">Calibration date</div><div class="value">${ex.calibDate || '—'}</div></div>
    <div class="box"><div class="label">No. of rounds observed</div><div class="value">${ex.rounds || '—'}</div></div>
  </div>

  <p style="font-size:11px;margin-top:16px;">I certify that the above coordinates were observed and computed in accordance with the 
  applicable standards and are correct to the best of my knowledge and belief.</p>

  ${signatureBlock(project.surveyor_name || surveyorDetails.name || '', surveyorDetails.licence || '', 'Licensed Surveyor')}

  <div class="highlight" style="margin-top:24px;">
    <strong>For Survey Authority Use Only</strong><br>
    Received: _________________ &nbsp;&nbsp; Register No.: _________________ &nbsp;&nbsp; Officer: _________________
  </div>
  </body></html>`
}
