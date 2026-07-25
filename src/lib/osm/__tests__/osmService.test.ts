/**
 * Tests for the OSM Service TypeScript client
 *
 * Tests the type definitions and the graceful-fallback behavior when
 * the Python worker is unavailable. The actual OSM queries are tested
 * in the Python worker's test suite.
 */

import {
  getOsmFeatures,
  getOsmStatus,
  getNearbyFeatures,
  autoAbuttals,
  streamExtract,
  getOsmFeaturesViaApi,
  getNearbyFeaturesViaApi,
  autoAbuttalsViaApi,
} from '../osmService'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('OSM Service', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('getOsmStatus', () => {
    it('returns status when worker is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pyrosm_installed: true,
          pbf_file_found: true,
          pbf_path: 'data/kenya-latest.osm.pbf',
          pbf_loaded: true,
          pbf_size_mb: 450.2,
        }),
      })

      const status = await getOsmStatus()

      expect(status).not.toBeNull()
      expect(status?.pyrosm_installed).toBe(true)
      expect(status?.pbf_file_found).toBe(true)
      expect(status?.pbf_loaded).toBe(true)
    })

    it('returns null when worker is offline', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const status = await getOsmStatus()

      expect(status).toBeNull()
    })
  })

  describe('getOsmFeatures', () => {
    it('returns features when worker responds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          bbox: { minlon: 36.8, minlat: -1.3, maxlon: 36.85, maxlat: -1.25 },
          counts: { buildings: 42, roads: 15, pois: 8 },
          features: {
            buildings: { type: 'FeatureCollection', features: [] },
            roads: { type: 'FeatureCollection', features: [] },
            pois: { type: 'FeatureCollection', features: [] },
          },
          pbf_loaded: true,
        }),
      })

      const result = await getOsmFeatures({
        minlon: 36.8, minlat: -1.3, maxlon: 36.85, maxlat: -1.25,
      })

      expect(result).not.toBeNull()
      expect(result?.success).toBe(true)
      expect(result?.counts.buildings).toBe(42)
      expect(result?.pbf_loaded).toBe(true)
    })

    it('returns null on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await getOsmFeatures({
        minlon: 36.8, minlat: -1.3, maxlon: 36.85, maxlat: -1.25,
      })

      expect(result).toBeNull()
    })

    it('returns null on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 })

      const result = await getOsmFeatures({
        minlon: 36.8, minlat: -1.3, maxlon: 36.85, maxlat: -1.25,
      })

      expect(result).toBeNull()
    })

    it('passes types parameter correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, counts: {}, features: {}, pbf_loaded: true }),
      })

      await getOsmFeatures(
        { minlon: 36.8, minlat: -1.3, maxlon: 36.85, maxlat: -1.25 },
        ['buildings', 'natural'],
      )

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain('types=buildings%2Cnatural')
    })
  })

  describe('getNearbyFeatures', () => {
    it('returns nearby features on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lat: -1.2921,
          lon: 36.8219,
          radius: 500,
          osm_tools_available: true,
          roads: [
            { name: 'Mombasa Road', type: 'trunk', distance_m: 120, direction: 'E', osm_id: 123 },
          ],
          schools: [],
          health: [],
        }),
      })

      const result = await getNearbyFeatures(-1.2921, 36.8219, 500)

      expect(result).not.toBeNull()
      expect(result?.roads).toHaveLength(1)
      expect(result?.roads?.[0].name).toBe('Mombasa Road')
    })

    it('returns null on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await getNearbyFeatures(-1.2921, 36.8219)

      expect(result).toBeNull()
    })
  })

  describe('autoAbuttals', () => {
    it('returns abuttals on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          north: 'Mombasa Road (120m NE)',
          south: 'Access road (45m S)',
          east: 'Kitengela Primary (280m E)',
          west: 'River Athi (180m W)',
        }),
      })

      const result = await autoAbuttals(-1.2921, 36.8219, 200)

      expect(result).not.toBeNull()
      expect(result?.north).toContain('Mombasa Road')
      expect(result?.east).toContain('Kitengela')
    })

    it('returns null on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await autoAbuttals(-1.2921, 36.8219)

      expect(result).toBeNull()
    })
  })

  describe('streamExtract', () => {
    it('returns result on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          output_path: 'data/nairobi-buildings.geojson',
          total_features: 1542,
          buildings: 1200,
          roads: 342,
          pois: 0,
        }),
      })

      const result = await streamExtract(
        'data/nairobi-buildings.geojson',
        [36.5, -1.5, 37.0, -1.0],
        { buildings: true },
      )

      expect(result).not.toBeNull()
      expect(result?.total_features).toBe(1542)
      expect(result?.buildings).toBe(1200)
    })
  })

  describe('API proxy functions', () => {
    it('getOsmFeaturesViaApi calls the Next.js API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, counts: {}, features: {}, pbf_loaded: true }),
      })

      await getOsmFeaturesViaApi({
        minlon: 36.8, minlat: -1.3, maxlon: 36.85, maxlat: -1.25,
      })

      const calledUrl = mockFetch.mock.calls[0][0]
      expect(calledUrl).toContain('/api/osm/features?')
      expect(calledUrl).toContain('minlon=36.8')
    })

    it('getNearbyFeaturesViaApi calls the Next.js API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lat: -1.2921, lon: 36.8219, radius: 500,
          osm_tools_available: true, roads: [],
        }),
      })

      await getNearbyFeaturesViaApi(-1.2921, 36.8219, 500)

      expect(mockFetch.mock.calls[0][0]).toContain('/api/osm/nearby-features')
      expect(mockFetch.mock.calls[0][1].method).toBe('POST')
    })

    it('autoAbuttalsViaApi calls the Next.js API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          north: 'Road', south: '', east: '', west: '',
        }),
      })

      await autoAbuttalsViaApi(-1.2921, 36.8219, 200)

      expect(mockFetch.mock.calls[0][0]).toContain('/api/osm/auto-abuttals')
      expect(mockFetch.mock.calls[0][1].method).toBe('POST')
    })
  })
})
