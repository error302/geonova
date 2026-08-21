/**
 * Court-grade provenance section for statutory PDFs.
 *
 * Appends a dedicated page to Form No. 4, computation workbook, and other
 * statutory documents containing:
 *
 *   1. Title — "PROVENANCE LEDGER — ENGINE COMPUTATION EVIDENCE"
 *   2. Ledger metadata — engine version, generation timestamp, record count
 *   3. Per-record table — artifact, engine, method, input hash (truncated),
 *      key residuals, timestamp
 *   4. Ledger SHA-256 digest — the cryptographic hash of the full ledger JSON,
 *      recomputed and embedded so the document is self-certifying
 *   5. Verification instructions — how a reviewer can re-run the computation
 *      and confirm the residuals match
 *
 * This makes the statutory package court-grade provable: the evidence
 * travels with each document, and the ledger hash anchors the PDF content
 * to the exact engine inputs and outputs at computation time.
 *
 * Uses jsPDF directly (no React, no DOM). Compatible with the existing
 * jsPDF-based PDF generators in formNo4PDF.ts and generateReport.ts.
 *
 * @module provenanceSection
 */

import type jsPDF from 'jspdf'
import type { EngineProvenanceRecord, EngineProvenanceLedger } from '@/lib/provenance/engineProvenance'
import { ENGINE_VERSION } from '@/lib/provenance/engineProvenance'
import { canonicalJSON, sha256 } from '@/lib/audit/auditHash'

// ─── Constants ───────────────────────────────────────────────────────────────

const MARGIN = 15
const HEADER_COLOR: [number, number, number] = [15, 15, 20]
const AMBER_COLOR: [number, number, number] = [209, 123, 71]
const GRAY: [number, number, number] = [100, 100, 100]
const LIGHT_GRAY: [number, number, number] = [245, 245, 245]
const BLACK: [number, number, number] = [0, 0, 0]

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProvenanceSectionOptions {
  /** The provenance ledger records to render. */
  records: EngineProvenanceRecord[]
  /** When provided, used instead of recomputing. */
  ledgerHash?: string
  /** Document context for the header. */
  documentTitle?: string
  /** Submission reference number. */
  submissionRef?: string
  /** Computation timestamp. */
  generatedAt?: string
}

// ─── Hash computation ────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 digest of the provenance ledger for embedding.
 * Uses the same canonical JSON serialization as the audit trail.
 */
export async function computeLedgerDigest(records: EngineProvenanceRecord[]): Promise<string> {
  const ledger = {
    engineVersion: ENGINE_VERSION,
    records: records.map((r) => ({
      ...r,
      engineVersion: r.engineVersion || ENGINE_VERSION,
    })),
  }
  return sha256(canonicalJSON(ledger))
}

// ─── Rendering ───────────────────────────────────────────────────────────────

type jsPDFWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } }

/**
 * Append a provenance evidence page to an existing jsPDF document.
 *
 * Call this after the main document content is rendered (after the last
 * page of the survey plan or computation workbook). It adds a new page
 * with the full provenance ledger.
 *
 * @param doc - The jsPDF document to append to
 * @param options - Provenance data and context
 * @returns The Y position after rendering (for chaining)
 */
export async function appendProvenanceSection(
  doc: jsPDF,
  options: ProvenanceSectionOptions,
): Promise<number> {
  const { records, documentTitle, submissionRef, generatedAt } = options

  if (records.length === 0) return doc.internal.pageSize.getHeight() - 15

  // Compute ledger digest
  const ledgerDigest = options.ledgerHash ?? (await computeLedgerDigest(records))

  // Add new page
  doc.addPage()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN * 2

  let y = MARGIN

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(...HEADER_COLOR)
  doc.rect(0, 0, pageWidth, 22, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('PROVENANCE LEDGER — ENGINE COMPUTATION EVIDENCE', MARGIN, 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    `METARDU Compute Engine v${ENGINE_VERSION}  |  Court-Grade Reproducibility Record`,
    MARGIN,
    16,
  )

  if (submissionRef) {
    doc.text(`Ref: ${submissionRef}`, pageWidth - MARGIN, 10, { align: 'right' })
  }

  y = 30

  // ── Document context ─────────────────────────────────────────────────────
  if (documentTitle) {
    doc.setTextColor(...BLACK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`Document: ${documentTitle}`, MARGIN, y)
    y += 5
  }

  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(
    `Generated: ${generatedAt ?? new Date().toISOString()}  |  Records: ${records.length}  |  Engine: v${ENGINE_VERSION}`,
    MARGIN,
    y,
  )
  y += 8

  // ── Ledger summary ───────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_GRAY)
  doc.rect(MARGIN, y, contentWidth, 12, 'F')
  doc.setDrawColor(...AMBER_COLOR)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, y, contentWidth, 12, 'S')

  doc.setTextColor(...BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('LEDGER DIGEST (SHA-256)', MARGIN + 4, y + 5)

  doc.setFont('courier', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(209, 123, 71)
  doc.text(ledgerDigest, MARGIN + 4, y + 10)

  y += 18

  // ── Per-record table ──────────────────────────────────────────────────────
  // Using autoTable if available, otherwise manual rendering
  const autoTable = (doc as unknown as { autoTable?: Function }).autoTable

  if (autoTable) {
    // Dynamic import to avoid hard dependency
    try {
      const autoTableModule = await import('jspdf-autotable')
      const at = autoTableModule.default

      at(doc, {
        startY: y,
        head: [['#', 'Artifact', 'Engine', 'Method', 'Input Hash (prefix)', 'Key Residuals', 'Timestamp']],
        body: records.map((r, i) => [
          String(i + 1),
          truncate(r.artifact, 22),
          truncate(r.engine, 14),
          truncate(r.method, 14),
          r.inputHash.slice(0, 16) + '…',
          formatResidualsCompact(r.residuals),
          r.timestamp ? new Date(r.timestamp).toLocaleDateString('en-GB') : '—',
        ]),
        margin: { left: MARGIN, right: MARGIN },
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          overflow: 'linebreak',
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: HEADER_COLOR,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7,
        },
        bodyStyles: {
          fontSize: 6.5,
          textColor: [30, 30, 30],
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 30 },
          2: { cellWidth: 22 },
          3: { cellWidth: 22 },
          4: { cellWidth: 30, fontStyle: 'bold', font: 'courier' },
          5: { cellWidth: 'auto' },
          6: { cellWidth: 22, halign: 'right' },
        },
      })

      y = (doc as jsPDFWithAutoTable).lastAutoTable?.finalY ?? y + 30
    } catch {
      // Fall through to manual rendering
      y = renderManualTable(doc, records, y, contentWidth)
    }
  } else {
    y = renderManualTable(doc, records, y, contentWidth)
  }

  y += 8

  // ── Full input hashes (one per record) ───────────────────────────────────
  y = ensurePageRoom(doc, y, 30, pageWidth)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BLACK)
  doc.text('INPUT HASHES (full SHA-256)', MARGIN, y)
  y += 5

  doc.setFont('courier', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...GRAY)

  for (let i = 0; i < records.length; i++) {
    y = ensurePageRoom(doc, y, 5, pageWidth)
    doc.text(`[${i + 1}] ${records[i].artifact}: ${records[i].inputHash}`, MARGIN, y)
    y += 4
  }

  y += 6

  // ── Verification instructions ────────────────────────────────────────────
  y = ensurePageRoom(doc, y, 40, pageWidth)

  doc.setFillColor(255, 248, 240)
  doc.setDrawColor(...AMBER_COLOR)
  doc.setLineWidth(0.4)
  doc.rect(MARGIN, y, contentWidth, 32, 'FD')

  doc.setTextColor(...BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('VERIFICATION INSTRUCTIONS', MARGIN + 4, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(60, 60, 60)

  const instructions = [
    '1. Re-run the engine computation using the original field inputs (observations, coordinates, baselines).',
    '2. Compute SHA-256 of the canonical JSON of the engine input.',
    '3. Compare the recomputed input hash against the hashes listed in this ledger.',
    `4. If hashes match, compare the engine residuals (misclosure, area, precision ratio) against this ledger.`,
    `5. The ledger digest above (${ledgerDigest.slice(0, 16)}…) anchors this document to the exact engine state.`,
    `6. Engine version: ${ENGINE_VERSION}. Any version drift is informational — verify the math independently.`,
  ]

  let instrY = y + 11
  for (const line of instructions) {
    doc.text(line, MARGIN + 4, instrY)
    instrY += 4
  }

  y += 38

  // ── Footer ───────────────────────────────────────────────────────────────
  y = ensurePageRoom(doc, y, 10, pageWidth)
  doc.setDrawColor(...AMBER_COLOR)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  y += 5

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6)
  doc.setTextColor(...GRAY)
  doc.text(
    'This provenance ledger is an integral part of the statutory submission package. '
    + 'It certifies that the engine computations embedded in this document were produced '
    + `by METARDU compute engine v${ENGINE_VERSION} and are reproducible from the hashed inputs above.`,
    MARGIN,
    y,
  )

  return y
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function formatResidualsCompact(residuals?: Record<string, number | string | boolean | null>): string {
  if (!residuals) return '—'
  const keys = Object.keys(residuals).slice(0, 3)
  return keys
    .map((k) => {
      const v = residuals[k]
      if (typeof v === 'number') return `${k}=${v.toFixed(4)}`
      return `${k}=${String(v).slice(0, 8)}`
    })
    .join(', ')
}

function renderManualTable(
  doc: jsPDF,
  records: EngineProvenanceRecord[],
  startY: number,
  contentWidth: number,
): number {
  let y = startY

  // Table header
  doc.setFillColor(...HEADER_COLOR)
  doc.rect(MARGIN, y, contentWidth, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)

  const cols = [MARGIN + 2, MARGIN + 10, MARGIN + 35, MARGIN + 55, MARGIN + 78, MARGIN + 110, MARGIN + 145]
  const headers = ['#', 'Artifact', 'Engine', 'Method', 'Input Hash', 'Key Residuals', 'Timestamp']

  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cols[i], y + 4)
  }
  y += 6

  // Table rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)

  for (let i = 0; i < records.length; i++) {
    const r = records[i]
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250)
      doc.rect(MARGIN, y, contentWidth, 6, 'F')
    }

    doc.setTextColor(30, 30, 30)
    doc.text(String(i + 1), cols[0], y + 4)
    doc.text(truncate(r.artifact, 18), cols[1], y + 4)
    doc.text(truncate(r.engine, 14), cols[2], y + 4)
    doc.text(truncate(r.method, 16), cols[3], y + 4)
    doc.setFont('courier', 'normal')
    doc.text(r.inputHash.slice(0, 14) + '…', cols[4], y + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(formatResidualsCompact(r.residuals).slice(0, 28), cols[5], y + 4)
    doc.text(r.timestamp ? new Date(r.timestamp).toLocaleDateString('en-GB') : '—', cols[6], y + 4)

    y += 6
  }

  // Table border
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.1)
  doc.rect(MARGIN, startY, contentWidth, y - startY, 'S')

  return y
}

function ensurePageRoom(doc: jsPDF, y: number, neededMm: number, pageWidth: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  const bottom = pageHeight - 15
  if (y + neededMm > bottom) {
    doc.addPage()
    return MARGIN
  }
  return y
}
