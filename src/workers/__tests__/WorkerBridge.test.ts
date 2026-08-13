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
