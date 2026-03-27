import { createMission } from '@/lib/compute/usv'

describe('USV Survey Orchestrator', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        waypoints: [],
        estimated_distance: 100,
        estimated_duration: 50,
        valid: true
      })
    }) as jest.Mock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
  
  test('creates mission', async () => {
    const mission = await createMission('project-1', {
      mission_name: 'Test Mission',
      usv_ids: ['USV-001'],
      waypoints: [
        { id: '1', lat: 0, lng: 0, order: 0 },
        { id: '2', lat: 0.01, lng: 0.01, order: 1 }
      ],
      pattern_type: 'waypoint'
    })
    
    expect(fetch).toHaveBeenCalled()
  })
})
