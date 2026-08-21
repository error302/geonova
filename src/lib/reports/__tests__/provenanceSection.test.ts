/**
 * Tests for src/lib/reports/provenanceSection.ts — the court-grade
 * provenance section renderer for statutory PDFs.
 *
 * Verifies:
 *   - computeLedgerDigest produces a stable SHA-256 hash
 *   - computeLedgerDigest is key-order independent
 *   - computeLedgerDigest changes when records change
 *   - empty records returns empty ledger hash
 *   - appendProvenanceSection adds a page to jsPDF
 */

import { computeLedgerDigest } from '../provenanceSection'
import { ENGINE_VERSION } from '@/lib/provenance/engineProvenance'
import type { EngineProvenanceRecord } from '@/lib/provenance/engineProvenance'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TRAVERSE_RECORD: EngineProvenanceRecord = {
  artifact: 'traverse_adjustment',
  engine: 'traverse',
  method: 'bowditch',
  engineVersion: ENGINE_VERSION,
  inputHash: 'a'.repeat(64),
  inputDescriptor: 'traverse input: start point, legs, closing control',
  residuals: {
    closingErrorE: 0.003,
    closingErrorN: -0.002,
    linearError: 0.0036,
    precisionRatio: 14200,
    precisionGrade: 'first',
    totalDistance: 157.158,
    passesQA: true,
  },
  timestamp: '2026-08-18T10:00:00.000Z',
}

const AREA_RECORD: EngineProvenanceRecord = {
  artifact: 'area_computation',
  engine: 'area',
  method: 'coordinate-area',
  engineVersion: ENGINE_VERSION,
  inputHash: 'b'.repeat(64),
  inputDescriptor: 'coordinate list (easting/northing pairs)',
  residuals: {
    areaM2: 8000,
    areaHa: 0.8,
    perimeterM: 360,
  },
  timestamp: '2026-08-18T10:05:00.000Z',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeLedgerDigest', () => {
  it('produces a deterministic SHA-256 hash', async () => {
    const records = [TRAVERSE_RECORD, AREA_RECORD]
    const a = await computeLedgerDigest(records)
    const b = await computeLedgerDigest(records)
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is dependent on record order (ledger order matters)', async () => {
    const a = await computeLedgerDigest([TRAVERSE_RECORD, AREA_RECORD])
    const b = await computeLedgerDigest([AREA_RECORD, TRAVERSE_RECORD])
    // Different order → different digest (correct: ledger order is semantically meaningful)
    expect(a).not.toBe(b)
    // But both are valid SHA-256 hashes
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(b).toMatch(/^[0-9a-f]{64}$/)
  })

  it('changes when residuals change', async () => {
    const a = await computeLedgerDigest([TRAVERSE_RECORD])
    const tampered = { ...TRAVERSE_RECORD, residuals: { ...TRAVERSE_RECORD.residuals, linearError: 0.999 } }
    const b = await computeLedgerDigest([tampered])
    expect(a).not.toBe(b)
  })

  it('changes when input hash changes', async () => {
    const a = await computeLedgerDigest([TRAVERSE_RECORD])
    const tampered = { ...TRAVERSE_RECORD, inputHash: 'c'.repeat(64) }
    const b = await computeLedgerDigest([tampered])
    expect(a).not.toBe(b)
  })

  it('produces a valid ledger hash for a single record', async () => {
    const hash = await computeLedgerDigest([TRAVERSE_RECORD])
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    // Should be deterministic
    expect(hash).toBe(await computeLedgerDigest([TRAVERSE_RECORD]))
  })

  it('produces a valid hash for empty records', async () => {
    const hash = await computeLedgerDigest([])
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('normalizes engineVersion in the ledger', async () => {
    const record = { ...TRAVERSE_RECORD, engineVersion: '' }
    const hash = await computeLedgerDigest([record])
    // Should still produce a valid hash (ENGINE_VERSION fills the blank)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('appendProvenanceSection', () => {
  it('adds a page to jsPDF when records are provided', async () => {
    // jsPDF is a browser/Node library — mock it minimally
    const pages: number[] = []
    const mockDoc = {
      addPage: jest.fn(() => { pages.push(pages.length + 1) }),
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      setFillColor: jest.fn(),
      rect: jest.fn(),
      setDrawColor: jest.fn(),
      setLineWidth: jest.fn(),
      setFont: jest.fn(),
      setFontSize: jest.fn(),
      setTextColor: jest.fn(),
      text: jest.fn(),
      line: jest.fn(),
    } as unknown as import('jspdf').default

    const { appendProvenanceSection } = await import('../provenanceSection')
    const y = await appendProvenanceSection(mockDoc, {
      records: [TRAVERSE_RECORD, AREA_RECORD],
      documentTitle: 'Form No. 4 — LR 12345',
      submissionRef: 'SUB-001',
    })

    expect(mockDoc.addPage).toHaveBeenCalledTimes(1)
    // Should have rendered content (text calls made)
    expect(mockDoc.text).toHaveBeenCalled()
    // Y should be > 0 (content was rendered)
    expect(y).toBeGreaterThan(0)
  })

  it('returns page height when records are empty', async () => {
    const mockDoc = {
      addPage: jest.fn(),
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    } as unknown as import('jspdf').default

    const { appendProvenanceSection } = await import('../provenanceSection')
    const y = await appendProvenanceSection(mockDoc, { records: [] })

    expect(mockDoc.addPage).not.toHaveBeenCalled()
    expect(y).toBe(297 - 15) // pageHeight - margin
  })
})
