/**
 * METARDU — Shared print document builder
 * Every printed computation sheet must include:
 *   - Standard 6-field project header (project, client, date, surveyor, reg, instrument)
 *   - Reference to applicable standards (RDM 1.1, Survey Regulations 1994, Cap 299)
 *   - Surveyor's Certificate block per Survey Regulations 1994, Regulation 3(2)
 *
 * References: RDM 1.1 (2025) Table 5.4 | SRVY2025-1 | Survey Regulations 1994
 */
import { logger } from '@/lib/logger'

export interface PrintMeta {
  /** Document title e.g. "Level Book — Rise & Fall" */
  title: string
  projectName?: string
  clientName?: string
  surveyorName?: string
  /** Surveyor's registration number */
  regNo?: string
  /** ISK membership number */
  iskNo?: string
  /** Survey date (ISO string or formatted) */
  date?: string
  /** Instrument make/model e.g. "Leica Sprinter 250M" */
  instrument?: string
  weather?: string
  observer?: string
  /** Standards reference string shown in footer of header block */
  reference?: string
  sheetNo?: string
  totalSheets?: string
  /** SRVY2025-1 submission number e.g. RS149_2025_001_R00 */
  submissionNo?: string
}

function esc(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildPrintDocument(bodyHtml: string, meta: PrintMeta): string {
  const now = new Date().toLocaleDateString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)} — METARDU</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    color: #000;
    background: #fff;
    padding: 15mm 18mm 15mm 18mm;
  }

  /* ── DOCUMENT HEADER ─────────────────────────────── */
  .doc-header {
    border: 2px solid #000;
    margin-bottom: 14px;
  }
  .doc-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    border-bottom: 1px solid #000;
    background: #111;
    color: #fff;
  }
  .brand { font-size: 13pt; font-weight: bold; letter-spacing: 3px; }
  .doc-title { font-size: 10.5pt; font-weight: bold; text-align: center; letter-spacing: 0.5px; }
  .sheet-info { font-size: 8.5pt; text-align: right; white-space: nowrap; }

  .doc-header-fields {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
  }
  .doc-header-field {
    padding: 4px 8px;
    border-right: 1px solid #ccc;
  }
  .doc-header-field:last-child { border-right: none; }
  .field-label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #666;
    display: block;
    margin-bottom: 2px;
  }
  .field-value { font-weight: bold; font-size: 9pt; }

  .doc-header-ref {
    border-top: 1px solid #ccc;
    padding: 3px 8px;
    font-size: 7.5pt;
    color: #555;
    text-align: center;
  }

  /* ── SECTION HEADINGS ────────────────────────────── */
  h2 {
    font-size: 10pt;
    font-weight: bold;
    margin: 14px 0 5px;
    padding-bottom: 3px;
    border-bottom: 1.5px solid #000;
    letter-spacing: 0.3px;
  }
  h3 { font-size: 9.5pt; font-weight: bold; margin: 8px 0 4px; }

  /* ── TABLES ──────────────────────────────────────── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 10px;
    font-size: 9pt;
  }
  th {
    background: #111;
    color: #fff;
    padding: 4px 6px;
    text-align: left;
    font-size: 8.5pt;
    border: 1px solid #000;
    font-weight: bold;
    letter-spacing: 0.2px;
  }
  th.right { text-align: right; }
  td {
    padding: 3px 6px;
    border: 1px solid #ccc;
    vertical-align: top;
    font-size: 9pt;
  }
  td.right { text-align: right; }
  td.center { text-align: center; }
  td.mono { font-family: 'Courier New', monospace; }
  td.bold { font-weight: bold; }
  tr:nth-child(even) td { background: #f7f7f7; }
  tfoot td { font-weight: bold; background: #e8e8e8 !important; border-top: 1.5px solid #000; }

  /* ── SUMMARY BOX ─────────────────────────────────── */
  .summary-box {
    border: 1px solid #000;
    padding: 8px 12px;
    margin: 8px 0 12px;
    background: #f4f4f4;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    font-size: 9pt;
    border-bottom: 1px solid #ddd;
  }
  .summary-row:last-child { border-bottom: none; }
  .summary-label { color: #333; }
  .summary-value { font-family: 'Courier New', monospace; font-weight: bold; }

  /* ── STATUS CLASSES ──────────────────────────────── */
  .pass { color: #14532d; font-weight: bold; }
  .fail { color: #7f1d1d; font-weight: bold; }
  .warn { color: #78350f; font-weight: bold; }

  /* ── CERTIFICATE BLOCK ───────────────────────────── */
  .certificate-block {
    margin-top: 18px;
    border: 2px solid #000;
    padding: 10px 14px;
    background: #fafafa;
    page-break-inside: avoid;
  }
  .certificate-title {
    font-size: 9pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 6px;
    border-bottom: 1px solid #bbb;
    padding-bottom: 3px;
  }
  .certificate-text {
    font-size: 8.5pt;
    line-height: 1.6;
    margin-bottom: 14px;
    font-style: italic;
  }
  .sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 14px;
    margin-top: 6px;
  }
  .sig-item { margin-bottom: 10px; }
  .sig-line {
    border-bottom: 1px solid #000;
    height: 30px;
    margin-bottom: 4px;
  }
  .sig-label {
    font-size: 7.5pt;
    text-transform: uppercase;
    color: #555;
    letter-spacing: 0.3px;
  }

  /* ── DISCLAIMER FOOTER ──────────────────────────── */
  .disclaimer-footer {
    margin-top: 14px;
    padding: 6px 10px;
    border: 1px solid #bbb;
    background: #f5f5f0;
    font-size: 7pt;
    color: #555;
    line-height: 1.5;
    page-break-inside: avoid;
  }
  .disclaimer-footer strong {
    color: #333;
    font-size: 7pt;
  }

  /* ── PRINT / PAGE ────────────────────────────────── */
  @page { margin: 0; size: A4 portrait; }
  @media print {
    body { padding: 8mm 14mm; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<!-- ╔══════════════════════════════════════════════╗ -->
<!-- ║           STANDARD DOCUMENT HEADER           ║ -->
<!-- ╚══════════════════════════════════════════════╝ -->
<div class="doc-header">
  <div class="doc-header-top">
    <span class="brand">METARDU</span>
    <span class="doc-title">${esc(meta.title.toUpperCase())}</span>
    <span class="sheet-info">Sheet ${esc(meta.sheetNo || '1')} of ${esc(meta.totalSheets || '1')}</span>
  </div>
  <div class="doc-header-fields">
    <div class="doc-header-field">
      <span class="field-label">Project</span>
      <span class="field-value">${meta.projectName ? esc(meta.projectName) : '&mdash;'}</span>
    </div>
    <div class="doc-header-field">
      <span class="field-label">Client</span>
      <span class="field-value">${meta.clientName ? esc(meta.clientName) : '&mdash;'}</span>
    </div>
    <div class="doc-header-field">
      <span class="field-label">Survey Date</span>
      <span class="field-value">${esc(meta.date || now)}</span>
    </div>
    <div class="doc-header-field">
      <span class="field-label">Surveyor</span>
      <span class="field-value">${meta.surveyorName ? esc(meta.surveyorName) : '&mdash;'}</span>
    </div>
    <div class="doc-header-field">
      <span class="field-label">Reg No / ISK No</span>
      <span class="field-value">${meta.regNo ? esc(meta.regNo) : '&mdash;'} / ${meta.iskNo ? esc(meta.iskNo) : '&mdash;'}</span>
    </div>
    <div class="doc-header-field">
      <span class="field-label">Instrument</span>
      <span class="field-value">${meta.instrument ? esc(meta.instrument) : '&mdash;'}</span>
    </div>
  </div>
  ${meta.submissionNo ? `<div class="doc-header-ref"><strong>Submission Ref:</strong> ${esc(meta.submissionNo)} &nbsp;|&nbsp; SRVY2025-1</div>` : ''}
  <div class="doc-header-ref">${meta.reference || 'Survey Regulations 1994 &nbsp;|&nbsp; Survey Act Cap 299 &nbsp;|&nbsp; RDM 1.1 (2025)'}</div>
</div>

<!-- ╔══════════════════════════════════════════════╗ -->
<!-- ║              DOCUMENT BODY                   ║ -->
<!-- ╚══════════════════════════════════════════════╝ -->
${bodyHtml}

<!-- ╔══════════════════════════════════════════════╗ -->
<!-- ║         SURVEYOR'S CERTIFICATE               ║ -->
<!-- ╚══════════════════════════════════════════════╝ -->
<div class="certificate-block">
  <div class="certificate-title">Surveyor's Certificate &mdash; Survey Regulations 1994, Regulation 3(2)</div>
  <div class="certificate-text">
    I certify that this survey computation was carried out under my direct supervision in accordance with
    the Survey Act (Cap. 299), the Survey Regulations 1994, and the Road Design Manual RDM 1.1 (2025).
    All field observations, reductions, and computations contained herein are accurate and correct to the
    best of my knowledge and professional belief.
  </div>
  <div class="sig-grid">
    <div class="sig-item">
      <div class="sig-line"></div>
      <div class="sig-label">Signature</div>
    </div>
    <div class="sig-item">
      <div class="sig-line"></div>
      <div class="sig-label">Full Name &amp; Registration No.</div>
    </div>
    <div class="sig-item">
      <div class="sig-line"></div>
      <div class="sig-label">Date</div>
    </div>
  </div>
  <div class="sig-grid">
    <div class="sig-item">
      <div class="sig-line"></div>
      <div class="sig-label">ISK Membership No.</div>
    </div>
    <div class="sig-item">
      <div class="sig-line"></div>
      <div class="sig-label">Checked By</div>
    </div>
    <div class="sig-item">
      <div class="sig-line"></div>
      <div class="sig-label">Date Checked</div>
    </div>
  </div>
</div>

<!-- ╔══════════════════════════════════════════════╗ -->
<!-- ║          COMPUTATION TOOL DISCLAIMER         ║ -->
<!-- ╚══════════════════════════════════════════════╝ -->
<div class="disclaimer-footer">
  <strong>IMPORTANT:</strong> This document was generated by METARDU, a computation tool.
  All coordinates, areas, bearings, distances, and other computed values must be independently verified
  by a licensed surveyor registered with ISK/EBK before being relied upon for any legal, construction,
  boundary determination, or registration purpose. This output does not constitute a certified survey
  under the Survey Act Cap 299 unless separately certified by a licensed surveyor and authenticated
  by the Survey of Kenya. METARDU is not liable for errors arising from incorrect input data,
  projection parameters, or adjustment assumptions.
</div>

<script>
  // Auto-print after styles load
  window.addEventListener('load', () => {
    setTimeout(() => { window.focus(); window.print(); }, 500)
  })
</script>
</body>
</html>`
}

/**
 * Open a print document in a new window.
 * Call buildPrintDocument() first to get the HTML.
 */
export function openPrint(html: string): void {
  const win = window.open('', '_blank', 'width=960,height=740,scrollbars=yes')
  if (!win) {
    // Fallback: try without window features (popup blocker may strip them)
    const w2 = window.open('', '_blank')
    if (!w2) {
      logger.error('openPrint: popup blocked. Allow popups for this site.')
      return
    }
    w2.document.write(html)
    w2.document.close()
    return
  }
  win.document.write(html)
  win.document.close()
}
