/**
 * Placeholder-equals-name sweep — pass 4 (2026-08-04).
 *
 * Handles the remaining classes:
 *
 *  A′. Same-line label association: a <label htmlFor="X"> and <input id="X">
 *      on the SAME line as the violation → remove the redundant aria-label
 *      (label already names it).
 *  C′. Header/FieldGroup-derived names (HEADER_MAP) — replaces the aria-label
 *      value, keeps placeholder as the sample hint.
 *  B′. Descriptive labels (default): the aria-label is a genuine description
 *      that merely duplicates the placeholder → keep aria-label, drop the
 *      duplicated placeholder attribute.
 */
const { readFileSync, writeFileSync } = require('fs')

const HEADER_MAP = {
  // topology-check — custom minimum area input
  'src/app/tools/topology-check/page.tsx|177': 'Custom minimum area (m²)',
  // white-label — FieldGroup-wrapped (labels visible but not htmlFor-associated)
  'src/app/white-label/page.tsx|304': 'Organization name',
  'src/app/white-label/page.tsx|442': 'Primary color (hex)',
  'src/app/white-label/page.tsx|468': 'Custom domain',
  // PileGridPanel — FormField-wrapped (label text derived from FormField label)
  'src/components/engineering/PileGridPanel.tsx|188': 'Grid name',
  'src/components/engineering/PileGridPanel.tsx|213': 'Coordinate system',
  'src/components/engineering/PileGridPanel.tsx|224': 'Start label',
  'src/components/engineering/PileGridPanel.tsx|551': 'Station easting (m)',
  'src/components/engineering/PileGridPanel.tsx|561': 'Station northing (m)',
  'src/components/engineering/PileGridPanel.tsx|571': 'Station RL (m)',
  'src/components/engineering/PileGridPanel.tsx|581': 'Height of instrument (m)',
  // TraverseFieldBook — station column (header-derived)
  'src/components/TraverseFieldBook.tsx|562': 'Station',
  // coordinates — lat/lon/dms if same-line label logic misses
  'src/app/tools/coordinates/page.tsx|79': 'UTM zone',
  'src/app/tools/coordinates/page.tsx|95': 'Latitude (decimal degrees)',
  'src/app/tools/coordinates/page.tsx|96': 'Longitude (decimal degrees)',
}

function main() {
  const d = JSON.parse(readFileSync(process.argv[2] || 'aria-violations.json', 'utf8'))
  const filesToWrite = new Map()
  let fixedA = 0, fixedC = 0, fixedB = 0, skipped = 0
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

    const tag = lines.slice(tagStartIdx, tagEndIdx + 1).join(' ')
    const idMatch = tag.match(/\bid="([^"]+)"/)
    const id = idMatch ? idMatch[1] : null

    // Rule A′: label htmlFor on the SAME line (or the line above) matching id.
    let labelId = null
    for (let i = Math.max(0, v.line - 2); i < v.line; i++) {
      const m = lines[i].match(/htmlFor="([^"]+)"/)
      if (m) { labelId = m[1]; break }
    }

    let changed = false
    if (labelId && id === labelId) {
      const attrRe = /\s+aria-label="[^"]*"/
      for (let i = tagStartIdx; i <= tagEndIdx; i++) {
        if (attrRe.test(lines[i])) { lines[i] = lines[i].replace(attrRe, ''); changed = true; fixedA++; break }
      }
    } else {
      const headerName = HEADER_MAP[`${file}|${v.line}`]
      if (headerName) {
        const attrRe = /aria-label="[^"]*"/
        for (let i = tagStartIdx; i <= tagEndIdx; i++) {
          if (attrRe.test(lines[i])) {
            lines[i] = lines[i].replace(attrRe, `aria-label="${headerName}"`)
            changed = true; fixedC++; break
          }
        }
      } else {
        // Rule B′: descriptive label — drop duplicated placeholder, keep name.
        const phRe = /\s+placeholder="[^"]*"/
        let removed = false
        for (let i = tagStartIdx; i <= tagEndIdx; i++) {
          if (phRe.test(lines[i])) { lines[i] = lines[i].replace(phRe, ''); removed = true; break }
        }
        if (removed) { changed = true; fixedB++ } else { skipped++ }
      }
    }
    if (changed) filesToWrite.set(file, lines.join('\r\n'))
  }

  let files = 0
  for (const [file, content] of filesToWrite) {
    writeFileSync(file, content, 'utf8'); files++
    console.log('fixed', file)
  }
  console.log(`\nRule A′: ${fixedA} | Rule C′: ${fixedC} | Rule B′: ${fixedB} | skipped: ${skipped} | files: ${files}`)
}

main()
