/**
 * P2-1 Phase 13 Workstream 3: Submission numbering tests
 *
 * Tests the SRVY2025-1 format parsing and revision incrementing.
 * The generateSubmissionNumber function requires a DB connection
 * (tested via integration), so this suite covers the pure functions.
 */

import { incrementRevision, parseSubmissionNumber } from '../numbering'
import { defined } from '@/test-utils/defined'

describe('P2-1: SRVY2025-1 submission numbering', () => {
  describe('parseSubmissionNumber', () => {
    test('parses a valid submission number', () => {
      const result = parseSubmissionNumber('RS149_2025_002_R00')
      expect(result).toEqual({
        registrationNo: 'RS149',
        year: 2025,
        sequence: 2,
        revision: 0,
      })
    })

    test('parses with double-digit revision', () => {
      const result = parseSubmissionNumber('RS149_2025_002_R10')
      expect(result).toEqual({
        registrationNo: 'RS149',
        year: 2025,
        sequence: 2,
        revision: 10,
      })
    })

    test('parses with 3-digit sequence', () => {
      const result = parseSubmissionNumber('ISK/LS/2024/123_2025_099_R03')
      expect(result).toEqual({
        registrationNo: 'ISK/LS/2024/123',
        year: 2025,
        sequence: 99,
        revision: 3,
      })
    })

    test('returns null for invalid format (too few parts)', () => {
      expect(parseSubmissionNumber('RS149_2025_002')).toBeNull()
    })

    test('returns null for invalid format (no R prefix)', () => {
      expect(parseSubmissionNumber('RS149_2025_002_00')).toBeNull()
    })

    test('returns null for non-numeric year', () => {
      expect(parseSubmissionNumber('RS149_XXXX_002_R00')).toBeNull()
    })

    test('returns null for empty string', () => {
      expect(parseSubmissionNumber('')).toBeNull()
    })
  })

  describe('incrementRevision', () => {
    test('R00 → R01', () => {
      expect(incrementRevision('RS149_2025_002_R00')).toBe('RS149_2025_002_R01')
    })

    test('R09 → R10 (zero-padding preserved)', () => {
      expect(incrementRevision('RS149_2025_002_R09')).toBe('RS149_2025_002_R10')
    })

    test('R99 → R100 (expands to 3 digits)', () => {
      expect(incrementRevision('RS149_2025_002_R99')).toBe('RS149_2025_002_R100')
    })

    test('throws for invalid format', () => {
      expect(() => incrementRevision('RS149_2025_002')).toThrow('Invalid')
    })

    test('throws for missing R prefix', () => {
      expect(() => incrementRevision('RS149_2025_002_00')).toThrow('Invalid')
    })
  })

  describe('format consistency', () => {
    test('round-trip: parse → increment → parse', () => {
      const original = 'RS149_2025_007_R02'
      const incremented = incrementRevision(original)
      const parsed = parseSubmissionNumber(incremented)

      expect(parsed).not.toBeNull()
      expect(defined(parsed).revision).toBe(3)
      expect(defined(parsed).sequence).toBe(7)
      expect(defined(parsed).year).toBe(2025)
      expect(defined(parsed).registrationNo).toBe('RS149')
    })
  })
})
