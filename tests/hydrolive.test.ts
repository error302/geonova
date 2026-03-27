import { processBathymetry } from '@/lib/compute/bathymetry'

describe('HydroLive Mapper', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        contours: [{ elevation: 1, coordinates: [] }],
        volume_delta: { volume_change: 100, area_change: 50 },
        hazards: [{ id: '1', type: 'shallow', location: { easting: 0, northing: 0 }, depth: 1, severity: 'high', description: 'test' }],
        summary: { min_depth: 1, max_depth: 10, avg_depth: 5, area: 1000 }
      })
    }) as jest.Mock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
  
  test('processes bathymetry data', async () => {
    const soundings = [
      { id: '1', easting: 0, northing: 0, depth: 5 },
      { id: '2', easting: 10, northing: 10, depth: 8 }
    ]
    
    const result = await processBathymetry('project-1', soundings)
    
    expect(result.contours).toBeDefined()
    expect(result.hazards).toBeDefined()
  })
})
