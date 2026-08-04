/**
 * Placeholder-equals-name sweep — pass 3 (2026-08-04).
 *
 * For each remaining violation, apply the established fix pattern:
 *
 *  A. Label-associated: a <label htmlFor="X"> exists above (within 12 lines)
 *     and is the nearest label. Remove the redundant aria-label; if the input
 *     has no id yet, insert id="X" so the label actually associates.
 *  B. Real-name label: the aria-label value is a genuine description
 *     (letters, not a numeric sample) but equals the placeholder. Keep the
 *     aria-label, drop the duplicated placeholder attribute.
 *  C. Sample-value cell: aria-label is a sample value (numbers, "e.g. …",
 *     station codes like T1/CP1/BM1). Replace with a header-derived name
 *     supplied by the HEADER_MAP (file → line → name); placeholder stays.
 */
const { readFileSync, writeFileSync } = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// Rule C header-derived names, keyed by `${file}|${line}` (forward slashes).
// ---------------------------------------------------------------------------
const HEADER_MAP = {
  // tools/area — point grid (Northing/Easting columns, letters A/B/C)
  'src/app/tools/area/page.tsx|117': 'Northing (m)',
  'src/app/tools/area/page.tsx|118': 'Easting (m)',
  // tools/as-built-deviation — design rows
  'src/app/tools/as-built-deviation/page.tsx|176': 'Chainage (m)',
  'src/app/tools/as-built-deviation/page.tsx|177': 'Design RL (m)',
  // as-built rows
  'src/app/tools/as-built-deviation/page.tsx|197': 'Point ID',
  'src/app/tools/as-built-deviation/page.tsx|198': 'Chainage (m)',
  'src/app/tools/as-built-deviation/page.tsx|199': 'Measured RL (m)',
  'src/app/tools/as-built-deviation/page.tsx|200': 'Description',
  // tools/cogo-reconstruct — leg grid
  'src/app/tools/cogo-reconstruct/page.tsx|161': 'Bearing (deg)',
  'src/app/tools/cogo-reconstruct/page.tsx|162': 'Bearing (min)',
  'src/app/tools/cogo-reconstruct/page.tsx|163': 'Bearing (sec)',
  'src/app/tools/cogo-reconstruct/page.tsx|178': 'Distance (m)',
  'src/app/tools/cogo-reconstruct/page.tsx|179': 'Description',
  // tools/chainage — alignment point rows
  'src/app/tools/chainage/page.tsx|140': 'Easting (m)',
  'src/app/tools/chainage/page.tsx|141': 'Northing (m)',
  'src/app/tools/chainage/page.tsx|159': 'Chainage (m)',
  // tools/lsa — station rows
  'src/app/tools/lsa/page.tsx|223': 'Station name',
  'src/app/tools/lsa/page.tsx|224': 'Easting (m)',
  'src/app/tools/lsa/page.tsx|225': 'Northing (m)',
  // lsa angle rows
  'src/app/tools/lsa/page.tsx|245': 'From station',
  'src/app/tools/lsa/page.tsx|246': 'At station',
  'src/app/tools/lsa/page.tsx|247': 'To station',
  'src/app/tools/lsa/page.tsx|248': 'Angle (deg)',
  'src/app/tools/lsa/page.tsx|249': 'Angle (min)',
  'src/app/tools/lsa/page.tsx|250': 'Angle (sec)',
  'src/app/tools/lsa/page.tsx|251': 'Std dev (arcsec)',
  // lsa distance rows
  'src/app/tools/lsa/page.tsx|270': 'From station',
  'src/app/tools/lsa/page.tsx|271': 'To station',
  'src/app/tools/lsa/page.tsx|272': 'Distance (m)',
  'src/app/tools/lsa/page.tsx|273': 'Std dev (m)',
  // tools/orthometric-height — batch rows
  'src/app/tools/orthometric-height/page.tsx|236': 'Point name',
  'src/app/tools/orthometric-height/page.tsx|237': 'Latitude (deg)',
  'src/app/tools/orthometric-height/page.tsx|238': 'Longitude (deg)',
  'src/app/tools/orthometric-height/page.tsx|239': 'Ellipsoidal height (m)',
  // tools/scale-factor — coord rows
  'src/app/tools/scale-factor/page.tsx|170': 'Easting (m)',
  'src/app/tools/scale-factor/page.tsx|171': 'Northing (m)',
  // tools/site-calibration — points
  'src/app/tools/site-calibration/page.tsx|189': 'Point name',
  'src/app/tools/site-calibration/page.tsx|190': 'Station X',
  'src/app/tools/site-calibration/page.tsx|191': 'Station Y',
  'src/app/tools/site-calibration/page.tsx|192': 'Station Z',
  'src/app/tools/site-calibration/page.tsx|193': 'Target X',
  'src/app/tools/site-calibration/page.tsx|194': 'Target Y',
  'src/app/tools/site-calibration/page.tsx|195': 'Target Z',
  // tools/subdivision-generator — rows
  'src/app/tools/subdivision-generator/page.tsx|142': 'Easting (m)',
  'src/app/tools/subdivision-generator/page.tsx|143': 'Northing (m)',
  // tools/topology-check — rows
  'src/app/tools/topology-check/page.tsx|128': 'Easting (m)',
  'src/app/tools/topology-check/page.tsx|134': 'Northing (m)',
  // tools/tacheometry — vertical angle DMS (no label above)
  'src/app/tools/tacheometry/page.tsx|93': 'Vertical angle (deg)',
  'src/app/tools/tacheometry/page.tsx|94': 'Vertical angle (min)',
  'src/app/tools/tacheometry/page.tsx|95': 'Vertical angle (sec)',
  // tools/height-of-object — angleTop/angleBase DMS triples
  'src/app/tools/height-of-object/page.tsx|61': 'Angle to top (deg)',
  'src/app/tools/height-of-object/page.tsx|62': 'Angle to top (min)',
  'src/app/tools/height-of-object/page.tsx|63': 'Angle to top (sec)',
  'src/app/tools/height-of-object/page.tsx|69': 'Angle to base (deg)',
  'src/app/tools/height-of-object/page.tsx|70': 'Angle to base (min)',
  'src/app/tools/height-of-object/page.tsx|71': 'Angle to base (sec)',
  // tools/leveling — BS/FS readings
  'src/app/tools/leveling/page.tsx|184': 'Backsight (m)',
  'src/app/tools/leveling/page.tsx|185': 'Foresight (m)',
  // tools/coordinates — zone + lat/lon + dms (label exists but id missing)
  'src/app/tools/coordinates/page.tsx|111': 'DMS or decimal',
  // tools/drone — GCP elevation (label "RL")
  'src/app/tools/drone/page.tsx|326': 'Elevation RL (m)',
  // gcp-validation — GCP grid
  'src/app/tools/gcp-validation/GcpTab.tsx|95': 'GCP name',
  'src/app/tools/gcp-validation/GcpTab.tsx|103': 'Easting (m)',
  'src/app/tools/gcp-validation/GcpTab.tsx|111': 'Northing (m)',
  'src/app/tools/gcp-validation/GcpTab.tsx|119': 'Elevation (m)',
  // LevelBook — leveling grid
  'src/components/LevelBook.tsx|163': 'Station',
  'src/components/LevelBook.tsx|168': 'Backsight (m)',
  'src/components/LevelBook.tsx|173': 'Intermediate sight (m)',
  'src/components/LevelBook.tsx|178': 'Foresight (m)',
  'src/components/LevelBook.tsx|183': 'Distance (m)',
  'src/components/LevelBook.tsx|188': 'Remarks',
  // TraverseFieldBook — station col (Bs/Fs already good labels)
  'src/components/TraverseFieldBook.tsx|562': 'Station',
  // CrossSectionInput — Off/RL shot cells
  'src/components/earthworks/CrossSectionInput.tsx|244': 'Left offset (m)',
  'src/components/earthworks/CrossSectionInput.tsx|245': 'Left RL (m)',
  'src/components/earthworks/CrossSectionInput.tsx|250': 'Right offset (m)',
  'src/components/earthworks/CrossSectionInput.tsx|251': 'Right RL (m)',
  // CoordinateTransformer — X/Y/Z grid
  'src/components/geo/CoordinateTransformer.tsx|81': 'X coordinate',
  'src/components/geo/CoordinateTransformer.tsx|82': 'Y coordinate',
  'src/components/geo/CoordinateTransformer.tsx|83': 'Z coordinate (optional)',
  // FieldRecordVault — northing cell
  'src/components/survey/FieldRecordVault.tsx|382': 'Northing (m)',
  // SurveyReportBuilder — submission number
  'src/components/surveyreport/SurveyReportBuilder.tsx|397': 'Submission number',
}

// Rule-B real-name values: aria-label equals placeholder but the value is a
// genuine description — keep aria-label, drop placeholder. If a label exists
// above, Rule A wins (removes aria-label instead).
const REAL_NAME_HINTS = new Set(['Easting', 'Northing', 'County', 'Locality', 'Date', 'Edition', 'Caption', 'Remarks'])

function main() {
  const raw = readFileSync(process.argv[2] || 'aria-violations.json', 'utf8')
  const d = JSON.parse(raw)

  const filesToWrite = new Map()
  let fixedA = 0, fixedB = 0, fixedC = 0, skipped = 0
  let lastFile = null, lines = null

  for (const v of d.violations) {
    const file = v.file.replace(/\\/g, '/')
    if (file !== lastFile) { lastFile = file; lines = readFileSync(file, 'utf8').split(/\r?\n/) }

    // Find '<input' by scanning backward up to 8 lines.
    let tagStartIdx = -1
    for (let i = v.line - 1; i >= Math.max(0, v.line - 9); i--) {
      if (lines[i].includes('<input')) { tagStartIdx = i; break }
    }
    if (tagStartIdx === -1) { skipped++; continue }

    // Scan forward to the tag's closing '>' tracking quotes + braces.
    let tagEndIdx = -1, quote = null, braceDepth = 0
    for (let i = tagStartIdx; i < lines.length && i < tagStartIdx + 12; i++) {
      const line = lines[i]
      for (const c of line) {
        if (quote) { if (c === quote) quote = null }
        else if (c === '"' || c === "'" || c === '`') quote = c
        else if (c === '{') braceDepth++
        else if (c === '}') { if (braceDepth > 0) braceDepth-- }
        else if (c === '>' && braceDepth === 0) { tagEndIdx = i; break }
      }
      if (tagEndIdx !== -1) break
    }
    if (tagEndIdx === -1) { skipped++; continue }

    const tagLines = lines.slice(tagStartIdx, tagEndIdx + 1)
    const tag = tagLines.join(' ')
    const idMatch = tag.match(/\bid="([^"]+)"/)
    const id = idMatch ? idMatch[1] : null

    // Rule A: label htmlFor association above (nearest label within 12 lines).
    let labelId = null
    for (let i = Math.max(0, v.line - 13); i < v.line - 1; i++) {
      const m = lines[i].match(/htmlFor="([^"]+)"/)
      if (m) { labelId = m[1]; break }
    }

    let changed = false
    if (labelId && (id === labelId || !id)) {
      // Remove aria-label from whichever line holds it.
      const attrRe = /\s+aria-label="[^"]*"/
      for (let i = tagStartIdx; i <= tagEndIdx; i++) {
        if (attrRe.test(lines[i])) { lines[i] = lines[i].replace(attrRe, ''); changed = true; fixedA++; break }
      }
      // Ensure the input carries the label's id.
      if (!id && labelId && !lines[tagStartIdx].includes(' id=')) {
        // Insert id right after '<input' (best-effort).
        lines[tagStartIdx] = lines[tagStartIdx].replace(/<input/, `<input id="${labelId}"`)
        changed = true
      }
    } else {
      const headerName = HEADER_MAP[`${file}|${v.line}`]
      if (headerName) {
        // Rule C: replace aria-label value, keep placeholder.
        const attrRe = /aria-label="[^"]*"/
        for (let i = tagStartIdx; i <= tagEndIdx; i++) {
          if (attrRe.test(lines[i])) {
            lines[i] = lines[i].replace(attrRe, `aria-label="${headerName}"`)
            changed = true; fixedC++; break
          }
        }
      } else if (REAL_NAME_HINTS.has(v.value)) {
        // Rule B: keep aria-label, remove duplicated placeholder.
        const phRe = /\s+placeholder="[^"]*"/
        for (let i = tagStartIdx; i <= tagEndIdx; i++) {
          if (phRe.test(lines[i])) { lines[i] = lines[i].replace(phRe, ''); changed = true; fixedB++; break }
        }
      } else {
        skipped++
      }
    }
    if (changed) filesToWrite.set(file, lines.join('\r\n'))
  }

  let files = 0
  for (const [file, content] of filesToWrite) {
    writeFileSync(file, content, 'utf8'); files++
    console.log('fixed', file)
  }
  console.log(`\nRule A (label): ${fixedA} | Rule B (placeholder dup): ${fixedB} | Rule C (header name): ${fixedC} | skipped: ${skipped} | files: ${files}`)
}

main()
