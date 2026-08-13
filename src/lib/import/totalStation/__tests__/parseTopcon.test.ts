/**
 * Tests for Topcon RC-232 ASCII Format Parser
 * Covers: basic parsing, coordinate extraction, code handling,
 *         edge cases, invalid data, empty input, etc.
 */

import { parseTopcon } from '@/lib/import/totalStation/parseTopcon'
import { defined } from '@/test-utils/defined'

// ─── Sample Data ────────────────────────────────────────────────────────────

/** Standard Topcon CSV: PointID,Northing,Easting,Elevation,Code */
const TOPCON_BASIC = `1,9876543.210,298432.100,1542.300,CONTROL
2,9876678.450,298543.200,1653.400,TREE
3,9876800.100,298654.300,1600.500,BMARK`

/** Data without code field */
const TOPCON_NO_CODE = `1,9876543.210,298432.100,1542.300
2,9876678.450,298543.200,1653.400`

/** Data with extra columns */
const TOPCON_EXTRA_COLS = `1,9876543.210,298432.100,1542.300,CTRL,extra1,extra2`

/** Single record */
const TOPCON_SINGLE = `100,5000000.000,300000.000,1500.000`

/** Mixed valid and invalid rows */
const TOPCON_MIXED = `1,9876543.210,298432.100,1542.300,OK
INVALID_ROW
2,not_a_number,298543.200,1653.400,BAD
3,9876800.100,298654.300,1600.500,OK`

/** Empty string */
const TOPCON_EMPTY = ``

/** Whitespace only */
const TOPCON_WHITESPACE = `   \n  \n  `

/** Row with too few columns */
const TOPCON_SHORT = `1,9876543.210`

/** Row with missing point ID */
const TOPCON_NO_POINTID = `,9876543.210,298432.100,1542.300`

/** Negative coordinates */
const TOPCON_NEGATIVE = `1,-9876543.210,-298432.100,-1542.300,NEG`

/** Large numbers (UTM coordinates) */
const TOPCON_UTM = `A1,9876543.210,376543.210,1895.432,PILLAR`

/** Multiple lines with trailing newline */
const TOPCON_TRAILING_NEWLINE = `1,9876543.210,298432.100,1542.300,A\n2,9876678.450,298543.200,1653.400,B\n`

/** Data with spaces around values */
const TOPCON_SPACED = ` 1 , 9876543.210 , 298432.100 , 1542.300 , CONTROL `

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('parseTopcon', () => {
  // ─── 1. Basic Parsing ──────────────────────────────────────────────────

  describe('basic parsing', () => {
    it('parses multiple records correctly', () => {
      const result = parseTopcon(TOPCON_BASIC)
      expect(result.ok).toBe(true)
      expect(result.records).toHaveLength(3)
    })

    it('extracts point IDs', () => {
      const result = parseTopcon(TOPCON_BASIC)
      expect(result.records[0].pointId).toBe('1')
      expect(result.records[1].pointId).toBe('2')
      expect(result.records[2].pointId).toBe('3')
    })

    it('extracts northing (column 1)', () => {
      const result = parseTopcon(TOPCON_BASIC)
      expect(result.records[0].northing).toBeCloseTo(9876543.210, 3)
    })

    it('extracts easting (column 2)', () => {
      const result = parseTopcon(TOPCON_BASIC)
      expect(result.records[0].easting).toBeCloseTo(298432.100, 3)
    })

    it('extracts elevation (column 3)', () => {
      const result = parseTopcon(TOPCON_BASIC)
      expect(result.records[0].elevation).toBeCloseTo(1542.300, 3)
    })

    it('extracts code (column 4, optional)', () => {
      const result = parseTopcon(TOPCON_BASIC)
      expect(result.records[0].code).toBe('CONTROL')
      expect(result.records[1].code).toBe('TREE')
      expect(result.records[2].code).toBe('BMARK')
    })
  })

  // ─── 2. Missing Code Field ─────────────────────────────────────────────

  describe('missing code field', () => {
    it('parses records without a code field', () => {
      const result = parseTopcon(TOPCON_NO_CODE)
      expect(result.records).toHaveLength(2)
      expect(result.records[0].code).toBeUndefined()
    })
  })

  // ─── 3. Extra Columns ──────────────────────────────────────────────────

  describe('extra columns', () => {
    it('ignores extra columns beyond the 5th', () => {
      const result = parseTopcon(TOPCON_EXTRA_COLS)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].pointId).toBe('1')
      expect(result.records[0].code).toBe('CTRL')
    })
  })

  // ─── 4. Single Record ──────────────────────────────────────────────────

  describe('single record', () => {
    it('parses a single record', () => {
      const result = parseTopcon(TOPCON_SINGLE)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].pointId).toBe('100')
      expect(result.records[0].northing).toBeCloseTo(5000000.0, 3)
      expect(result.records[0].easting).toBeCloseTo(300000.0, 3)
      expect(result.records[0].elevation).toBeCloseTo(1500.0, 3)
    })
  })

  // ─── 5. Invalid Data Handling ──────────────────────────────────────────

  describe('invalid data handling', () => {
    it('skips rows with too few columns and adds warnings', () => {
      const result = parseTopcon(TOPCON_SHORT)
      expect(result.records).toHaveLength(0)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('skips rows with non-numeric northing', () => {
      const result = parseTopcon(TOPCON_MIXED)
      // Should have 2 valid records (rows 1 and 3)
      expect(result.records).toHaveLength(2)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('skips rows with missing point ID', () => {
      const result = parseTopcon(TOPCON_NO_POINTID)
      expect(result.records).toHaveLength(0)
    })

    it('returns empty records for empty input', () => {
      const result = parseTopcon(TOPCON_EMPTY)
      expect(result.records).toHaveLength(0)
    })

    it('returns empty records for whitespace-only input', () => {
      const result = parseTopcon(TOPCON_WHITESPACE)
      expect(result.records).toHaveLength(0)
    })
  })

  // ─── 6. Negative Coordinates ───────────────────────────────────────────

  describe('negative coordinates', () => {
    it('handles negative values', () => {
      const result = parseTopcon(TOPCON_NEGATIVE)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].northing).toBeCloseTo(-9876543.210, 3)
      expect(result.records[0].easting).toBeCloseTo(-298432.100, 3)
      expect(result.records[0].elevation).toBeCloseTo(-1542.300, 3)
    })
  })

  // ─── 7. Large UTM Coordinates ──────────────────────────────────────────

  describe('UTM coordinates', () => {
    it('handles large UTM coordinate values', () => {
      const result = parseTopcon(TOPCON_UTM)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].northing).toBeCloseTo(9876543.210, 3)
      expect(result.records[0].easting).toBeCloseTo(376543.210, 3)
      expect(result.records[0].pointId).toBe('A1')
    })
  })

  // ─── 8. Trailing Newline ───────────────────────────────────────────────

  describe('trailing newline', () => {
    it('handles trailing newline without extra records', () => {
      const result = parseTopcon(TOPCON_TRAILING_NEWLINE)
      expect(result.records).toHaveLength(2)
    })
  })

  // ─── 9. Whitespace Around Values ──────────────────────────────────────

  describe('whitespace around values', () => {
    it('trims whitespace from fields', () => {
      const result = parseTopcon(TOPCON_SPACED)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].pointId).toBe('1')
      expect(result.records[0].code).toBe('CONTROL')
    })
  })

  // ─── 10. Return Structure ──────────────────────────────────────────────

  describe('return structure', () => {
    it('always returns ok: true for non-empty valid data', () => {
      const result = parseTopcon(TOPCON_BASIC)
      expect(result.ok).toBe(true)
    })

    it('always includes warnings array', () => {
      const result = parseTopcon(TOPCON_BASIC)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('always includes records array', () => {
      const result = parseTopcon(TOPCON_EMPTY)
      expect(Array.isArray(result.records)).toBe(true)
    })
  })

  // ─── 11. Elevation Optional ────────────────────────────────────────────

  describe('elevation handling', () => {
    it('handles NaN elevation gracefully', () => {
      const data = `1,9876543.210,298432.100,not_a_number`
      const result = parseTopcon(data)
      // The parser checks isNaN(northing) and isNaN(easting), not elevation
      // So NaN elevation is stored as NaN — but the record is still created
      expect(result.records).toHaveLength(1)
      expect(isNaN(defined(result.records[0].elevation))).toBe(true)
    })
  })

  // ─── 12. Code Field Variations ─────────────────────────────────────────

  describe('code field variations', () => {
    it('handles numeric codes', () => {
      const data = `1,9876543.210,298432.100,1542.300,123`
      const result = parseTopcon(data)
      expect(result.records[0].code).toBe('123')
    })

    it('handles empty code field', () => {
      const data = `1,9876543.210,298432.100,1542.300,`
      const result = parseTopcon(data)
      expect(result.records[0].code).toBe('')
    })
  })
})
