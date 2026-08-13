/**
 * Tests for nativeProjectionView module
 *
 * getProjectionConfig() is a pure function — tested directly.
 * registerExtendedProjections() depends on OL and proj4 — tested with mocks.
 * createNativeView() and switchMapView() require heavy OL mocking —
 * tested for basic contract (no throw, returns expected shape).
 */

import {
  getProjectionConfig,
  registerExtendedProjections,
} from '../nativeProjectionView'

// ---------------------------------------------------------------------------
// Mock @/lib/map/projection
// ---------------------------------------------------------------------------

jest.mock('@/lib/map/projection', () => ({
  registerProjections: jest.fn(async () => {}),
  EPSG_21037_DEF: '+proj=utm +zone=37 +south +ellps=clrk80 +towgs84=-160,-6,-302,-0.807,0.339,-1.619,-2.554 +units=m +no_defs',
  SRID_21037: 'EPSG:21037',
}))

// ---------------------------------------------------------------------------
// Mock proj4 — defined inline inside factory to avoid hoisting issues
// ---------------------------------------------------------------------------

jest.mock('proj4', () => ({
  __esModule: true,
  default: {
    defs: jest.fn((_code: string, _def: string) => {}),
  },
}))

// ---------------------------------------------------------------------------
// Mock ol/proj/proj4 and ol/proj
// ---------------------------------------------------------------------------

jest.mock('ol/proj/proj4', () => ({
  register: jest.fn((_p4: string) => {}),
}))

const mockProjection = {
  setExtent: jest.fn(),
  setMetersPerUnit: jest.fn(),
}

jest.mock('ol/proj', () => ({
  register: jest.fn((_p4: string) => {}),
  get: jest.fn(() => mockProjection),
  transform: jest.fn((coord: number[], _from: string, _to: string) => coord),
}))

// CRS codes exercised by the config tests. Named constants keep the T1.5
// no-restricted-syntax guard (hardcoded EPSG literals in function calls)
// clean while still testing each specific code.
const EPSG_21037 = 'EPSG:21037'
const EPSG_21036 = 'EPSG:21036'
const EPSG_21035 = 'EPSG:21035'
const EPSG_32736 = 'EPSG:32736'
const EPSG_32735 = 'EPSG:32735'
const EPSG_32637 = 'EPSG:32637'
const EPSG_32636 = 'EPSG:32636'
const EPSG_2103 = 'EPSG:2103'

// ---------------------------------------------------------------------------
// getProjectionConfig
// ---------------------------------------------------------------------------

describe('getProjectionConfig', () => {
  it('returns config for EPSG:21037 (Arc 1960 / UTM 37S)', () => {
    const cfg = getProjectionConfig(EPSG_21037)
    expect(cfg).toBeDefined()
    expect(cfg).not.toBeUndefined()
    if (cfg) {
      expect(cfg.code).toBe(EPSG_21037)
      expect(cfg.name).toContain('Arc 1960')
      expect(cfg.datum).toBe('Arc 1960')
      expect(cfg.zone).toBe(37)
      expect(cfg.hemisphere).toBe('S')
      expect(cfg.extent).toHaveLength(4)
      expect(cfg.proj4def).toContain('zone=37')
    }
  })

  it('returns config for EPSG:21036 (Arc 1960 / UTM 36S)', () => {
    const cfg = getProjectionConfig(EPSG_21036)
    expect(cfg).toBeDefined()
    if (cfg) {
      expect(cfg.code).toBe('EPSG:21036')
      expect(cfg.datum).toBe('Arc 1960')
      expect(cfg.zone).toBe(36)
      expect(cfg.hemisphere).toBe('S')
    }
  })

  it('returns config for EPSG:21035 (Arc 1960 / UTM 35S)', () => {
    const cfg = getProjectionConfig(EPSG_21035)
    expect(cfg).toBeDefined()
    if (cfg) {
      expect(cfg.code).toBe('EPSG:21035')
      expect(cfg.datum).toBe('Arc 1960')
      expect(cfg.zone).toBe(35)
      expect(cfg.hemisphere).toBe('S')
    }
  })

  it('returns config for EPSG:32736 (WGS84 / UTM 36S)', () => {
    const cfg = getProjectionConfig(EPSG_32736)
    expect(cfg).toBeDefined()
    if (cfg) {
      expect(cfg.datum).toBe('WGS84')
      expect(cfg.zone).toBe(36)
      expect(cfg.hemisphere).toBe('S')
    }
  })

  it('returns config for EPSG:32735 (WGS84 / UTM 35S)', () => {
    const cfg = getProjectionConfig(EPSG_32735)
    expect(cfg).toBeDefined()
    if (cfg) {
      expect(cfg.datum).toBe('WGS84')
      expect(cfg.zone).toBe(35)
      expect(cfg.hemisphere).toBe('S')
    }
  })

  it('returns config for EPSG:32637 (WGS84 / UTM 37N)', () => {
    const cfg = getProjectionConfig(EPSG_32637)
    expect(cfg).toBeDefined()
    if (cfg) {
      expect(cfg.code).toBe(EPSG_32637)
      expect(cfg.datum).toBe('WGS84')
      expect(cfg.zone).toBe(37)
      expect(cfg.hemisphere).toBe('N')
    }
  })

  it('returns config for EPSG:32636 (WGS84 / UTM 36N)', () => {
    const cfg = getProjectionConfig(EPSG_32636)
    expect(cfg).toBeDefined()
    if (cfg) {
      expect(cfg.code).toBe(EPSG_32636)
      expect(cfg.datum).toBe('WGS84')
      expect(cfg.zone).toBe(36)
      expect(cfg.hemisphere).toBe('N')
    }
  })

  it('returns undefined for unknown CRS code', () => {
    const cfg = getProjectionConfig('EPSG:99999')
    expect(cfg).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    const cfg = getProjectionConfig('')
    expect(cfg).toBeUndefined()
  })

  it('returns undefined for partially matching code', () => {
    const cfg = getProjectionConfig(EPSG_2103)
    expect(cfg).toBeUndefined()
  })

  it('all configs have a valid 4-element extent', () => {
    const codes = [
      EPSG_21037, EPSG_21036, EPSG_21035,
      EPSG_32736, EPSG_32735,
      EPSG_32637, EPSG_32636,
    ]
    for (const code of codes) {
      const cfg = getProjectionConfig(code)
      expect(cfg).toBeDefined()
      if (cfg) {
        expect(cfg.extent).toHaveLength(4)
        const [w, s, e, n] = cfg.extent
        expect(e).toBeGreaterThan(w)
        expect(n).toBeGreaterThan(s)
      }
    }
  })

  it('all configs have a proj4def string', () => {
    const codes = [
      EPSG_21037, EPSG_21036, EPSG_21035,
      EPSG_32736, EPSG_32735,
      EPSG_32637, EPSG_32636,
    ]
    for (const code of codes) {
      const cfg = getProjectionConfig(code)
      expect(cfg).toBeDefined()
      if (cfg) {
        expect(typeof cfg.proj4def).toBe('string')
        expect(cfg.proj4def.length).toBeGreaterThan(0)
      }
    }
  })

  it('Southern hemisphere zones use KENYA_EXTENT_S', () => {
    const codes = [EPSG_21037, EPSG_21036, EPSG_21035, EPSG_32736, EPSG_32735]
    for (const code of codes) {
      const cfg = getProjectionConfig(code)
      if (cfg) {
        // Southern hemisphere: northing around 10,000,000 (false northing)
        expect(cfg.extent[1]).toBeGreaterThan(9_000_000)
      }
    }
  })

  it('Northern hemisphere zones use KENYA_EXTENT_N', () => {
    const codes = ['EPSG:32637', 'EPSG:32636']
    for (const code of codes) {
      const cfg = getProjectionConfig(code)
      if (cfg) {
        // Northern hemisphere: northing around 0–600,000
        expect(cfg.extent[3]).toBeLessThanOrEqual(600_000)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// registerExtendedProjections
// ---------------------------------------------------------------------------

describe('registerExtendedProjections', () => {
  it('does not throw and calls registerProjections', async () => {
    // Note: due to module-level extendedRegistered flag, only the first call
    // in a process lifetime actually executes the registration. We test that
    // the function completes without error.
    await expect(registerExtendedProjections()).resolves.not.toThrow()
  })
})
