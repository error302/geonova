import { workerBridge } from '@/workers/WorkerBridge'
import type { WorkerMessage } from '@/workers/compute.worker'

/**
 * WorkerBridge protocol tests (2026-08-13).
 *
 * The bridge class is module-private; only the `workerBridge` singleton is
 * exported, and it lazily constructs a `Worker` on first use. jsdom ships no
 * real Worker implementation, so these tests swap in a MockWorker that
 * captures `postMessage` calls and lets the test drive `onmessage` directly —
 * exactly the contract `getWorker()` wires up. This locks in the two ends of
 * the protocol:
 *
 *   - requests are posted with { type, payload, id } and replies are
 *     correlated back to the promise by id;
 *   - a reply of type ERROR rejects the pending promise with the payload
 *     message, while any other type resolves it with the reply payload.
 */
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  postMessage = jest.fn()
  terminate = jest.fn()

  constructor(
    public url: string | URL,
    public options?: WorkerOptions
  ) {}
}

let mockWorker: MockWorker

beforeEach(() => {
  mockWorker = new MockWorker('mock-worker')
  // `new Worker(...)` must return OUR captured instance so postMessage and
  // onmessage calls land on the same object the bridge holds.
  global.Worker = jest.fn(() => mockWorker) as unknown as typeof Worker
})

afterEach(() => {
  // Tear down the bridge's worker reference + idle timers between tests so
  // each test starts from a fresh worker instance.
  workerBridge.dispose()
  jest.useRealTimers()
  // Reset the overridable idle window the fake-timer tests tweak.
  const bridge = workerBridge as unknown as { IDLE_TIMEOUT: number }
  bridge.IDLE_TIMEOUT = 30000
  jest.restoreAllMocks()
})

/**
 * Reply to the request posted by the `callIndex`-th postMessage call. Returns
 * the request id that was correlated.
 */
function reply(type: string, payload: unknown, callIndex = 0): string {
  const [message] = mockWorker.postMessage.mock.calls[callIndex] as unknown as [WorkerMessage]
  mockWorker.onmessage?.({ data: { type, payload, id: message.id } } as MessageEvent)
  return message.id
}

describe('WorkerBridge (mocked Worker protocol)', () => {
  it('constructs the worker lazily and posts the request message', async () => {
    const p = workerBridge.parseCSVPoints('point,north,east\nP1,100,200\n')

    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1)
    const [message] = mockWorker.postMessage.mock.calls[0] as unknown as [WorkerMessage]
    expect(message.type).toBe('PARSE_CSV_POINTS')
    expect(message.payload).toEqual({ csvText: 'point,north,east\nP1,100,200\n', delimiter: ',' })
    expect(message.id).toMatch(/^req_/)

    reply('PARSE_COMPLETE', { points: [], count: 0 })
    await p
  })

  it('resolves parseCSVPoints with the PARSE_COMPLETE payload', async () => {
    const p = workerBridge.parseCSVPoints('point,north,east\nP1,100,200\n')

    const payload = {
      points: [{ pointName: 'P1', northing: 100, easting: 200, latitude: -1.286, longitude: 36.817 }],
      count: 1,
    }
    reply('PARSE_COMPLETE', payload)

    await expect(p).resolves.toEqual(payload)
  })

  it('resolves computeBearingDistance with the COMPUTE_COMPLETE payload', async () => {
    const p = workerBridge.computeBearingDistance(
      { northing: 0, easting: 0 },
      { northing: 1000, easting: 0 }
    )

    const payload = { bearing: 0, distance: 1000, dEasting: 0, dNorthing: 1000 }
    reply('COMPUTE_COMPLETE', payload)

    await expect(p).resolves.toEqual(payload)
  })

  it('rejects parseCSVPoints when the worker replies ERROR', async () => {
    const p = workerBridge.parseCSVPoints('broken')

    reply('ERROR', 'CSV parse failed: no header row')

    await expect(p).rejects.toThrow('CSV parse failed: no header row')
  })

  it('rejects computeBearingDistance when the worker replies ERROR', async () => {
    const p = workerBridge.computeBearingDistance(
      { northing: 0, easting: 0 },
      { northing: 1, easting: 1 }
    )

    reply('ERROR', 'COMPUTE_BEARING_DISTANCE: invalid coordinates')

    await expect(p).rejects.toThrow('COMPUTE_BEARING_DISTANCE: invalid coordinates')
  })

  it('correlates concurrent requests by id (each reply reaches its own promise)', async () => {
    const csvP = workerBridge.parseCSVPoints('csv A')
    const bdP = workerBridge.computeBearingDistance(
      { northing: 0, easting: 0 },
      { northing: 5, easting: 0 }
    )

    expect(mockWorker.postMessage).toHaveBeenCalledTimes(2)
    const [firstArgs, secondArgs] = mockWorker.postMessage.mock.calls as unknown as [WorkerMessage[], WorkerMessage[]]
    const [first, second] = [firstArgs[0], secondArgs[0]]
    expect(first.id).not.toBe(second.id)

    // Reply out of order — the bridge must route by id, not by arrival.
    reply('COMPUTE_COMPLETE', { bearing: 0, distance: 5, dEasting: 0, dNorthing: 5 }, 1)
    reply('PARSE_COMPLETE', { points: [{ pointName: 'A' }], count: 1 }, 0)

    await expect(bdP).resolves.toEqual({ bearing: 0, distance: 5, dEasting: 0, dNorthing: 5 })
    await expect(csvP).resolves.toEqual({ points: [{ pointName: 'A' }], count: 1 })
  })

  it('rejects all pending promises and terminates the worker on a worker crash', async () => {
    const p = workerBridge.parseCSVPoints('crash me')

    mockWorker.onerror?.({ message: 'boom' } as ErrorEvent)

    await expect(p).rejects.toThrow('Worker crashed')
    expect(mockWorker.terminate).toHaveBeenCalled()
  })
})
  it('resolves transformCoordinates with the TRANSFORM_COMPLETE payload', async () => {
    const p = workerBridge.transformCoordinates({
      fromEpsg: 4326,
      toEpsg: 21037,
      coordinates: [
        { lat: -1.286389, lng: 36.817223 },
        { northing: 9858214.65, easting: 219404.4 },
      ],
    })

    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1)
    const [message] = mockWorker.postMessage.mock.calls[0] as unknown as [WorkerMessage]
    expect(message.type).toBe('TRANSFORM_COORDINATES')
    expect(message.payload).toEqual({
      fromEpsg: 4326,
      toEpsg: 21037,
      coordinates: [
        { lat: -1.286389, lng: 36.817223 },
        { northing: 9858214.65, easting: 219404.4 },
      ],
    })

    const payload = {
      coordinates: [
        { northing: 9858214.65, easting: 219404.4 },
        { lat: -1.286389, lng: 36.817223 },
      ],
      count: 2,
    }
    reply('TRANSFORM_COMPLETE', payload)

    await expect(p).resolves.toEqual(payload)
  })

  it('resolves computeArea with the COMPUTE_COMPLETE payload', async () => {
    const p = workerBridge.computeArea([
      { northing: 0, easting: 0 },
      { northing: 0, easting: 100 },
      { northing: 100, easting: 100 },
      { northing: 100, easting: 0 },
    ])

    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1)
    const [message] = mockWorker.postMessage.mock.calls[0] as unknown as [WorkerMessage]
    expect(message.type).toBe('COMPUTE_AREA')
    expect(message.payload).toEqual({
      coordinates: [
        { northing: 0, easting: 0 },
        { northing: 0, easting: 100 },
        { northing: 100, easting: 100 },
        { northing: 100, easting: 0 },
      ],
    })

    // 100 m x 100 m square - the worker's computeArea rounds to 2 decimals.
    const payload = { areaSqM: 10000, areaHa: 1, areaAc: 2.47 }
    reply('COMPUTE_COMPLETE', payload)

    await expect(p).resolves.toEqual(payload)
  })

  it('resolves computeTraverseAdjustment with the COMPUTE_COMPLETE payload', async () => {
    const p = workerBridge.computeTraverseAdjustment({
      legs: [
        { fromStation: 'A', toStation: 'B', angle: 90, distance: 100 },
        { fromStation: 'B', toStation: 'C', angle: 90, distance: 100 },
      ],
      startCoordinates: { northing: 0, easting: 0 },
      startBearing: 0,
      closed: false,
    })

    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1)
    const [message] = mockWorker.postMessage.mock.calls[0] as unknown as [WorkerMessage]
    expect(message.type).toBe('COMPUTE_TRAVERSE_ADJUSTMENT')

    // Shape matches the worker's Bowditch output (leg fields + adjusted
    // fields + misclosure), which is what WorkerBridge.send<T> promises.
    const payload = {
      adjustedLegs: [
        {
          fromStation: 'A',
          toStation: 'B',
          angle: 90,
          distance: 100,
          computedBearing: 0,
          dLatitude: 100,
          dDeparture: 0,
          adjustedBearing: 0,
          adjustedDistance: 100,
          adjustedDLatitude: 100,
          adjustedDDeparture: 0,
        },
      ],
      misclosure: { linear: 0, angular: 0, bearing: 0, ratio: 'Perfect' },
    }
    reply('COMPUTE_COMPLETE', payload)

    await expect(p).resolves.toEqual(payload)
  })

  it('resolves generateIDWGrid with the COMPUTE_COMPLETE payload', async () => {
    const p = workerBridge.generateIDWGrid({
      points: [
        { x: 0, y: 0, value: 100 },
        { x: 100, y: 100, value: 200 },
      ],
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      resolution: 50,
    })

    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1)
    const [message] = mockWorker.postMessage.mock.calls[0] as unknown as [WorkerMessage]
    expect(message.type).toBe('GENERATE_IDW_GRID')
    expect(message.payload).toEqual({
      points: [
        { x: 0, y: 0, value: 100 },
        { x: 100, y: 100, value: 200 },
      ],
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      resolution: 50,
    })

    // rows/cols derive from bounds + resolution in the worker (2 x 3 here).
    const payload = {
      grid: [
        [100, 150, 200],
        [150, 150, 150],
      ],
      rows: 2,
      cols: 3,
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    }
    reply('COMPUTE_COMPLETE', payload)

    await expect(p).resolves.toEqual(payload)
  })
  it('resolves parseCSVObservations with the PARSE_COMPLETE payload', async () => {
    const csvText = 'station,north,east,code\nS1,100,200,PIN\nS2,300,400,PIN\n'
    const p = workerBridge.parseCSVObservations(csvText)

    expect(mockWorker.postMessage).toHaveBeenCalledTimes(1)
    const [message] = mockWorker.postMessage.mock.calls[0] as unknown as [WorkerMessage]
    expect(message.type).toBe('PARSE_CSV_OBSERVATIONS')
    expect(message.payload).toEqual({ csvText, delimiter: ',' })

    // Shape matches the worker's parseCSVObservations: the point subset of
    // parseCSVPoints without the derived WGS84 lat/lng.
    const payload = {
      observations: [
        { pointName: 'S1', northing: 100, easting: 200, elevation: null, code: 'PIN' },
        { pointName: 'S2', northing: 300, easting: 400, elevation: null, code: 'PIN' },
      ],
      count: 2,
    }
    reply('PARSE_COMPLETE', payload)

    await expect(p).resolves.toEqual(payload)
  })

  it('resolves parseCSVLeveling with the PARSE_COMPLETE payload', async () => {
    const csvText = 'station,bs,is,fs,rl\nBM1,1.234,,,\nTP1,,,0.987,\n'
    const p = workerBridge.parseCSVLeveling(csvText)

    const [message] = mockWorker.postMessage.mock.calls[0] as unknown as [WorkerMessage]
    expect(message.type).toBe('PARSE_CSV_LEVELING')
    expect(message.payload).toEqual({ csvText, delimiter: ',' })

    // Shape matches the worker's parseCSVLeveling (BS/IS/FS + optional RL).
    const payload = {
      readings: [
        { pointName: 'BM1', bs: 1.234, is: null, fs: null, elevation: null },
        { pointName: 'TP1', bs: null, is: null, fs: 0.987, elevation: null },
      ],
      count: 2,
    }
    reply('PARSE_COMPLETE', payload)

    await expect(p).resolves.toEqual(payload)
  })

  it('resolves validateFieldBook with the VALIDATION_COMPLETE payload', async () => {
    const entries = [
      { pointName: 'A', distance: -5, bearing: 45 },
      { pointName: 'B', distance: 10, bearing: 400 },
      { pointName: 'C', distance: 10, bearing: 45 },
    ]
    const p = workerBridge.validateFieldBook(entries, 'cadastral')

    const [message] = mockWorker.postMessage.mock.calls[0] as unknown as [WorkerMessage]
    expect(message.type).toBe('VALIDATE_FIELD_BOOK')
    expect(message.payload).toEqual({ entries, surveyType: 'cadastral' })

    // Real validateFieldBook output for these rows (verified against the
    // autoCalculate implementation: distance -5 and bearing 400 are errors).
    const payload = {
      errors: [
        { rowIndex: 0, column: 'distance', message: 'Distance must be > 0', severity: 'error' },
        { rowIndex: 1, column: 'bearing', message: 'Bearing must be 0-360\u00b0', severity: 'error' },
      ],
      warnings: [
        { rowIndex: 0, column: 'distance', message: 'Distance must be > 0', severity: 'error' },
        { rowIndex: 1, column: 'bearing', message: 'Bearing must be 0-360\u00b0', severity: 'error' },
      ],
    }
    reply('VALIDATION_COMPLETE', payload)

    await expect(p).resolves.toEqual(payload)
  })

  it('resolves computeLevelNetwork with the COMPUTE_COMPLETE payload', async () => {
    const p = workerBridge.computeLevelNetwork({
      observations: [
        { fromId: 'A', toId: 'B', heightDifference: 1.5, distance: 100, weight: 1 },
        { fromId: 'B', toId: 'C', heightDifference: -0.5, distance: 100, weight: 1 },
      ],
      controlPoints: [
        { id: 'A', rl: 100, isFixed: true },
        { id: 'C', rl: 101, isFixed: true },
      ],
      order: 'third',
    })

    const [message] = mockWorker.postMessage.mock.calls[0] as unknown as [WorkerMessage]
    expect(message.type).toBe('COMPUTE_LEVEL_NETWORK')
    expect(message.payload).toEqual({
      observations: [
        { fromId: 'A', toId: 'B', heightDifference: 1.5, distance: 100, weight: 1 },
        { fromId: 'B', toId: 'C', heightDifference: -0.5, distance: 100, weight: 1 },
      ],
      controlPoints: [
        { id: 'A', rl: 100, isFixed: true },
        { id: 'C', rl: 101, isFixed: true },
      ],
      order: 'third',
    })

    // Real adjustLevelNetwork output for this A-B-C run (verified against
    // the levelNetworkAdjustment implementation via a live probe).
    const payload = {
      adjustedLevels: [
        { id: 'A', rl: 100, sigmaRL: 0 },
        { id: 'B', rl: 101.5, sigmaRL: 0 },
        { id: 'C', rl: 101, sigmaRL: 0 },
      ],
      residuals: [
        { from: 'A', to: 'B', residual: 0, standardized: 0 },
        { from: 'B', to: 'C', residual: 0, standardized: 0 },
      ],
      misclosure: 0,
      allowableMisclosure: 4.47213595499958,
      misclosurePerKm: 0,
      totalDistance: 0.2,
      referenceVariance: 0,
      degreesOfFreedom: 1,
      passed: true,
      order: 'third',
    }
    reply('COMPUTE_COMPLETE', payload)

    await expect(p).resolves.toEqual(payload)
  })

  it('resolves ping() to true when the worker replies PONG', async () => {
    const p = workerBridge.ping()

    const [message] = mockWorker.postMessage.mock.calls[0] as unknown as [WorkerMessage]
    expect(message.type).toBe('PING')
    expect(message.payload).toBeNull()

    reply('PONG', null)

    await expect(p).resolves.toBe(true)
  })

  it('resolves ping() to false when the worker replies ERROR', async () => {
    const p = workerBridge.ping()

    reply('ERROR', 'worker unavailable')

    await expect(p).resolves.toBe(false)
  })
  it('rejects a request that exceeds the 60s default timeout (fake timers)', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] })
    // The 30s idle timer would otherwise tear the worker down and reject
    // the request with "Worker terminated" first - lengthen it so only the
    // per-request 60s timer can fire.
    const bridge = workerBridge as unknown as { IDLE_TIMEOUT: number }
    bridge.IDLE_TIMEOUT = 60 * 60 * 1000
    const p = workerBridge.parseCSVPoints('never answered')

    const assertion = expect(p).rejects.toThrow("Worker request 'PARSE_CSV_POINTS' timed out after 60000ms")

    jest.advanceTimersByTime(60001)

    await assertion
  })

  it('terminates the worker after the 30s idle timeout (fake timers)', async () => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] })
    const p = workerBridge.parseCSVPoints('data')
    reply('PARSE_COMPLETE', { points: [], count: 0 })
    await p

    // The worker must stay alive while requests are in flight / recently answered.
    expect(mockWorker.terminate).not.toHaveBeenCalled()

    // Advance past the 30s idle window - the bridge should tear the worker down.
    jest.advanceTimersByTime(30001)
    expect(mockWorker.terminate).toHaveBeenCalledTimes(1)

    // A subsequent call lazily constructs a fresh worker - reply to the
    // SECOND postMessage (the first id was already consumed).
    const p2 = workerBridge.parseCSVPoints('data2')
    expect(mockWorker.postMessage).toHaveBeenCalledTimes(2)
    reply('PARSE_COMPLETE', { points: [], count: 0 }, 1)
    await p2
  })
