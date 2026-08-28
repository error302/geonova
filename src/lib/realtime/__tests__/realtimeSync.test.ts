import { realtimeService } from '../index'

describe('Yjs CRDT Real-Time Collaboration Mesh', () => {
  const projectId = 'test-proj-sync-001'

  afterEach(async () => {
    await realtimeService.unsubscribeAll()
  })

  test('creates Y.Doc for project and persists points in CRDT map', () => {
    const doc = realtimeService.getDoc(projectId)
    expect(doc).toBeDefined()

    // Broadcast a test beacon point
    realtimeService.broadcastPoint(projectId, {
      id: 'BP_101',
      easting: 254100.5,
      northing: 9860200.3,
      elevation: 1650.2,
      code: 'FENCE_START',
    })

    const livePoints = realtimeService.getLivePoints(projectId)
    expect(livePoints.length).toBe(1)
    expect(livePoints[0].id).toBe('BP_101')
    expect(livePoints[0].easting).toBe(254100.5)
    expect(livePoints[0].code).toBe('FENCE_START')
  })

  test('handles concurrent point insertions without collision', () => {
    const doc = realtimeService.getDoc(projectId)

    // Simulate Field Crew Tablet
    realtimeService.broadcastPoint(projectId, {
      id: 'P1',
      easting: 100,
      northing: 100,
      code: 'ROAD_EDGE',
    })

    // Simulate Office Workstation
    realtimeService.broadcastPoint(projectId, {
      id: 'P2',
      easting: 200,
      northing: 200,
      code: 'WALL',
    })

    const livePoints = realtimeService.getLivePoints(projectId)
    expect(livePoints.length).toBe(2)
    const ids = livePoints.map(p => p.id)
    expect(ids).toContain('P1')
    expect(ids).toContain('P2')
  })
})
