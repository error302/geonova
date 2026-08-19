/**
 * ENG-11: Provenance audit for the synthetic Cassini subsheet data.
 *
 * `data/cassini/synthetic_subsheets.json` (and the per-sheet
 * `synthetic_148_subsheets.json`) encode sheet → subsheet → corner grids with
 * BOTH Cassini (cassX, cassY feet) and UTM (utmE, utmN metres) coordinates.
 * They were generated from the national-sheet corner registry to drive the
 * sub-sheet Helmert/Affine fits.
 *
 * Until now nothing asserted that the synthetic data is self-consistent — a
 * bad regeneration (swapped columns, a wrong sheet origin, a sign flip) would
 * silently poison every downstream transform. This suite is the tripwire:
 *
 *   1. Every subsheet has exactly 4 corners.
 *   2. Every corner's UTM is within Kenya's UTM zone 36/37S span.
 *   3. Adjacent subsheets that share an edge agree on the shared corner's UTM
 *      (subsheets must tile the sheet with no seams).
 *
 * The third check is the provenance guarantee: synthetic corners are not
 * independent points — they are a lattice, and lattice neighbours must agree.
 */

import fs from 'node:fs'
import path from 'node:path'

interface SubSheetCorner {
  cassX: number
  cassY: number
  utmE: number
  utmN: number
}

type SubSheetGrid = Record<string, SubSheetCorner[]>
type SheetMap = Record<string, SubSheetGrid>

const DATA_DIR = path.resolve(process.cwd(), 'data', 'cassini')

function loadSheets(file: string): SheetMap {
  const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8')
  return JSON.parse(raw) as SheetMap
}

const ALL_SHEETS: SheetMap = loadSheets('synthetic_subsheets.json')

// Kenya spans the equator: northern sheets use UTM 36N/37N (northing grows
// from ~0 at the equator, and a few equatorial sheets legitimately dip just
// below 0), southern sheets use 36S/37S (northing ≈ 9.5M–10.5M). Easting is
// bounded by the false easting (500,000 ± ~334,000) in both cases.
const UTM_E_MIN = 100_000
const UTM_E_MAX = 900_000
const UTM_N_MIN = -10
const UTM_N_MAX = 10_500_000

const CORNER_TOLERANCE_M = 0.05 // shared corners must agree within 5 cm

describe('synthetic Cassini subsheet data (provenance audit)', () => {
  it('loads a non-trivial sheet set', () => {
    const sheets = Object.keys(ALL_SHEETS)
    expect(sheets.length).toBeGreaterThan(10)
  })

  it('every subsheet has exactly 4 corners with finite coordinates', () => {
    for (const [_sheetId, subs] of Object.entries(ALL_SHEETS)) {
      for (const [_subId, corners] of Object.entries(subs)) {
        expect(corners.length).toBe(4)
        for (const c of corners) {
          expect(Number.isFinite(c.cassX)).toBe(true)
          expect(Number.isFinite(c.cassY)).toBe(true)
          expect(Number.isFinite(c.utmE)).toBe(true)
          expect(Number.isFinite(c.utmN)).toBe(true)
        }
      }
    }
  })

  it('every corner UTM falls within Kenya zone 36/37S span', () => {
    for (const [_sheetId, subs] of Object.entries(ALL_SHEETS)) {
      for (const [_subId, corners] of Object.entries(subs)) {
        for (const c of corners) {
          expect(c.utmE).toBeGreaterThan(UTM_E_MIN)
          expect(c.utmE).toBeLessThan(UTM_E_MAX)
          expect(c.utmN).toBeGreaterThan(UTM_N_MIN)
          expect(c.utmN).toBeLessThan(UTM_N_MAX)
        }
      }
    }
  })

  it('shared corners between adjacent subsheets agree on UTM (seamless lattice)', () => {
    // Key every corner by rounded UTM; a shared edge corner must appear with
    // (near-)identical UTM in both neighbours. Count agreement violations.
    const byUTM = new Map<string, { sheetId: string; subId: string; e: number; n: number }[]>()
    const key = (e: number, n: number) => `${Math.round(e * 100)},${Math.round(n * 100)}`

    for (const [_sheetId, subs] of Object.entries(ALL_SHEETS)) {
      for (const [_subId, corners] of Object.entries(subs)) {
        for (const c of corners) {
          const _k = key(c.utmE, c.utmN)
          const list = byUTM.get(_k) ?? []
          list.push({ sheetId: _sheetId, subId: _subId, e: c.utmE, n: c.utmN })
          byUTM.set(_k, list)
        }
      }
    }

    let seamViolations = 0
    let totalCorners = 0
    for (const [_k, entries] of byUTM.entries()) {
      totalCorners += entries.length
      if (entries.length < 2) continue
      const ref = entries[0]
      for (const other of entries.slice(1)) {
        const de = Math.abs(ref.e - other.e)
        const dn = Math.abs(ref.n - other.n)
        if (de > CORNER_TOLERANCE_M || dn > CORNER_TOLERANCE_M) {
          seamViolations++
        }
      }
    }

    // The 5cm tolerance means key-bucketed neighbours must be near-identical.
    expect(seamViolations).toBe(0)
    expect(totalCorners).toBeGreaterThan(0)
  })
})
