// tests/minetwin.test.ts

import { processMineTwin } from '@/lib/compute/mineTwin'

describe('MineTwin 3D', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mesh: { vertices: [0,0,0, 1,0,0, 1,1,0, 0,1,0], faces: [0,1,2, 0,2,3], bounds: { min: [0,0,0], max: [1,1,0] } },
        volumes: { ore_volume: 3000, waste_volume: 7000, total_volume: 10000, area: 100, method: 'prismoidal' },
        convergence: [{ point_id: '1', x_shift: 0, y_shift: 0, z_shift: 0, total_shift: 0, timestamp: '' }],
        risk_zones: []
      })
    }) as jest.Mock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
  
  test('processes mine twin and returns mesh', async () => {
    const points = [
      { id: '1', easting: 0, northing: 0, elevation: 0 },
      { id: '2', easting: 10, northing: 0, elevation: 5 },
      { id: '3', easting: 10, northing: 10, elevation: 5 },
      { id: '4', easting: 0, northing: 10, elevation: 0 }
    ]
    
    const result = await processMineTwin('project-1', points)
    
    expect(result.mesh).toBeDefined()
    expect(result.volumes).toBeDefined()
    expect(result.volumes!.total_volume).toBeGreaterThan(0)
  })
  
  test('returns volume calculations', async () => {
    const points = [
      { id: '1', easting: 0, northing: 0, elevation: 0 },
      { id: '2', easting: 10, northing: 0, elevation: 5 },
      { id: '3', easting: 10, northing: 10, elevation: 5 },
      { id: '4', easting: 0, northing: 10, elevation: 0 }
    ]
    
    const result = await processMineTwin('project-1', points)
    
    expect(result.volumes).toHaveProperty('ore_volume')
    expect(result.volumes).toHaveProperty('waste_volume')
    expect(result.volumes).toHaveProperty('total_volume')
    expect(result.volumes).toHaveProperty('area')
  })
})