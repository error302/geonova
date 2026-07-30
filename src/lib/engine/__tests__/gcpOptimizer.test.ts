/**
 * P0-1 verification: gcpOptimizer exporters must produce real WGS84 coords,
 * not zeros. Round-trip: pick a known UTM 37S coordinate, export, check
 * the lat/lon is plausible (Kenya bbox: lat -5..5, lon 33..42).
 */
import { exportForPix4D, exportForWebODM, DEFAULT_UTM_ZONE, DEFAULT_HEMISPHERE } from '@/lib/engine/gcpOptimizer'
import type { GCPPoint } from '@/lib/engine/gcpOptimizer'

function makeGCP(easting: number, northing: number, name = 'GCP-01'): GCPPoint {
  return {
    id: 'test-' + name,
    name,
    easting,
    northing,
    elevation: 1700,
    rtkFixed: true,
    accuracy: 0.02,
    photoCaptured: true,
    status: 'validated',
    targetPattern: 'checkerboard',
  }
}

describe('P0-1: gcpOptimizer WGS84 export', () => {
  // Nairobi city centre WGS84 lat=-1.286, lon=36.817
  // → UTM 37S E=257088.42 N=9857754.23 (computed via geographicToUTM)
  const NAIROBI_E = 257088.42
  const NAIROBI_N = 9857754.23

  test('exportForPix4D produces non-zero lat/lon in Kenya bbox', () => {
    const csv = exportForPix4D([makeGCP(NAIROBI_E, NAIROBI_N)])
    const lines = csv.trim().split('\n')
    expect(lines.length).toBe(2) // header + 1 GCP

    const row = lines[1].split(',')
    const lat = parseFloat(row[1])
    const lon = parseFloat(row[2])

    // Must NOT be zero (the bug we fixed)
    expect(lat).not.toBe(0)
    expect(lon).not.toBe(0)

    // Must be in Kenya (lat -5..5, lon 33..42)
    expect(lat).toBeGreaterThan(-5)
    expect(lat).toBeLessThan(5)
    expect(lon).toBeGreaterThan(33)
    expect(lon).toBeLessThan(42)

    // Should be near Nairobi (within ~5km — test UTM coords are approximate)
    expect(Math.abs(lat - (-1.286))).toBeLessThan(0.05)
    expect(Math.abs(lon - 36.817)).toBeLessThan(0.05)
  })

  test('exportForWebODM produces non-zero lat/lon in Kenya bbox', () => {
    const csv = exportForWebODM([makeGCP(NAIROBI_E, NAIROBI_N)])
    const lines = csv.trim().split('\n')
    expect(lines.length).toBe(1) // no header

    const row = lines[0].split(',')
    // WebODM format: lon,lat,alt,name
    const lon = parseFloat(row[0])
    const lat = parseFloat(row[1])

    expect(lat).not.toBe(0)
    expect(lon).not.toBe(0)

    expect(lat).toBeGreaterThan(-5)
    expect(lat).toBeLessThan(5)
    expect(lon).toBeGreaterThan(33)
    expect(lon).toBeLessThan(42)
  })

  test('defaults to Zone 37S (Kenya) when no zone supplied', () => {
    // Same Nairobi coords — should produce Kenya lat/lon with defaults
    const csv = exportForPix4D([makeGCP(NAIROBI_E, NAIROBI_N)])
    const row = csv.trim().split('\n')[1].split(',')
    const lat = parseFloat(row[1])
    const lon = parseFloat(row[2])

    expect(lat).toBeGreaterThan(-5)
    expect(lat).toBeLessThan(5)
    expect(lon).toBeGreaterThan(33)
    expect(lon).toBeLessThan(42)
  })

  test('respects explicit zone override (Zone 36S for western Kenya)', () => {
    // Kisumu WGS84 lat=-0.091, lon=34.768
    // → UTM 36S E=696765.33 N=9989936.94 (computed via geographicToUTM)
    const csv = exportForPix4D(
      [makeGCP(696765.33, 9989936.94, 'GCP-KSM')],
      36, // Zone 36S
      'S',
    )
    const row = csv.trim().split('\n')[1].split(',')
    const lat = parseFloat(row[1])
    const lon = parseFloat(row[2])

    expect(lat).not.toBe(0)
    expect(lon).not.toBe(0)
    // Western Kenya lon < 37 (zone boundary)
    expect(lon).toBeLessThan(37)
    expect(lon).toBeGreaterThan(33)
  })

  test('exports DEFAULT_UTM_ZONE and DEFAULT_HEMISPHERE constants', () => {
    expect(DEFAULT_UTM_ZONE).toBe(37)
    expect(DEFAULT_HEMISPHERE).toBe('S')
  })
})
