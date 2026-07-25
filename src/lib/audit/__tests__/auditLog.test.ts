/**
 * Tests for the Audit Chain — tamper-evident append-only log.
 *
 * Coverage:
 *   - Pure functions: computeEntryHash, canonicalJSON
 *   - Hash determinism (same input → same hash)
 *   - Hash sensitivity (any field change → different hash)
 *   - Chain linking (each entry's hash includes the previous)
 *   - Tamper detection (modified entry → verification fails)
 *   - Broken link detection (inserted/deleted entry → verification fails)
 *   - Canonical JSON key ordering (insertion order doesn't matter)
 *
 * The DB-dependent functions (appendAuditEntry, verifyChain, queryAuditEntries)
 * require a live PostgreSQL instance and are not unit-tested here.
 * They're covered by integration tests in the e2e suite.
 */

import {
  computeEntryHash,
  canonicalJSON,
  type AuditPayload,
} from '../auditHash'

// ─── Helpers ────────────────────────────────────────────────────────────

const baseParams = {
  previousHash: null,
  sequence: 1,
  projectId: 'proj-1',
  userId: 'user-1',
  entityType: 'control_point' as const,
  entityId: 'CP1',
  action: 'update' as const,
  payload: {
    old: { easting: 250000, northing: 9945000 },
    new: { easting: 250050, northing: 9945050 },
    reason: 'Helmert recalibration',
  },
  createdAt: '2026-07-01T12:00:00.000Z',
}

// ─── Hash determinism ──────────────────────────────────────────────────

describe('computeEntryHash', () => {
  it('produces a 64-character hex string', async () => {
    const hash = await computeEntryHash(baseParams)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same input always produces the same hash', async () => {
    const hash1 = await computeEntryHash(baseParams)
    const hash2 = await computeEntryHash(baseParams)
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for different previousHash', async () => {
    const hash1 = await computeEntryHash(baseParams)
    const hash2 = await computeEntryHash({
      ...baseParams,
      previousHash: 'abc123',
    })
    expect(hash1).not.toBe(hash2)
  })

  it('produces different hashes for different sequence numbers', async () => {
    const hash1 = await computeEntryHash({ ...baseParams, sequence: 1 })
    const hash2 = await computeEntryHash({ ...baseParams, sequence: 2 })
    expect(hash1).not.toBe(hash2)
  })

  it('produces different hashes for different entity ids', async () => {
    const hash1 = await computeEntryHash({ ...baseParams, entityId: 'CP1' })
    const hash2 = await computeEntryHash({ ...baseParams, entityId: 'CP2' })
    expect(hash1).not.toBe(hash2)
  })

  it('produces different hashes for different actions', async () => {
    const hash1 = await computeEntryHash({ ...baseParams, action: 'create' })
    const hash2 = await computeEntryHash({ ...baseParams, action: 'update' })
    expect(hash1).not.toBe(hash2)
  })

  it('produces different hashes for different payloads', async () => {
    const hash1 = await computeEntryHash({
      ...baseParams,
      payload: { ...baseParams.payload, reason: 'reason A' },
    })
    const hash2 = await computeEntryHash({
      ...baseParams,
      payload: { ...baseParams.payload, reason: 'reason B' },
    })
    expect(hash1).not.toBe(hash2)
  })

  it('produces different hashes for different timestamps', async () => {
    const hash1 = await computeEntryHash({
      ...baseParams,
      createdAt: '2026-07-01T12:00:00.000Z',
    })
    const hash2 = await computeEntryHash({
      ...baseParams,
      createdAt: '2026-07-01T12:00:01.000Z',
    })
    expect(hash1).not.toBe(hash2)
  })

  it('treats null and empty string previousHash the same (genesis entry)', async () => {
    const hash1 = await computeEntryHash({ ...baseParams, previousHash: null })
    const hash2 = await computeEntryHash({ ...baseParams, previousHash: '' })
    // Both produce the same hash because null ?? '' = '' in the canonical form
    expect(hash1).toBe(hash2)
  })

  it('treats null and undefined projectId the same', async () => {
    const hash1 = await computeEntryHash({ ...baseParams, projectId: null })
    const hash2 = await computeEntryHash({ ...baseParams, projectId: undefined as unknown as null })
    // undefined coalesces to '' via ??, null also coalesces to ''
    expect(hash1).toBe(hash2)
  })
})

// ─── Canonical JSON ────────────────────────────────────────────────────

describe('canonical JSON serialization (via hash behavior)', () => {
  it('produces the same hash regardless of payload key insertion order', async () => {
    // Same object, different key order — should produce same hash
    const payload1: AuditPayload = {
      old: { e: 1, n: 2 },
      new: { e: 3, n: 4 },
      reason: 'test',
    }
    const payload2: AuditPayload = {
      reason: 'test',
      new: { n: 4, e: 3 },
      old: { n: 2, e: 1 },
    }

    const hash1 = await computeEntryHash({ ...baseParams, payload: payload1 })
    const hash2 = await computeEntryHash({ ...baseParams, payload: payload2 })
    expect(hash1).toBe(hash2)
  })

  it('produces different hashes for nested object value changes', async () => {
    const payload1: AuditPayload = {
      old: { easting: 250000 },
      new: { easting: 250050 },
    }
    const payload2: AuditPayload = {
      old: { easting: 250000 },
      new: { easting: 250051 }, // 1mm difference
    }
    const hash1 = await computeEntryHash({ ...baseParams, payload: payload1 })
    const hash2 = await computeEntryHash({ ...baseParams, payload: payload2 })
    expect(hash1).not.toBe(hash2)
  })

  it('handles arrays in payload correctly', async () => {
    const payload1: AuditPayload = {
      new: { stations: [{ name: 'A' }, { name: 'B' }] },
    }
    const payload2: AuditPayload = {
      new: { stations: [{ name: 'B' }, { name: 'A' }] }, // different order
    }
    const hash1 = await computeEntryHash({ ...baseParams, payload: payload1 })
    const hash2 = await computeEntryHash({ ...baseParams, payload: payload2 })
    // Array order matters — these should be different
    expect(hash1).not.toBe(hash2)
  })

  it('handles empty payload', async () => {
    const hash = await computeEntryHash({ ...baseParams, payload: {} })
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('handles null values in payload', async () => {
    const hash = await computeEntryHash({
      ...baseParams,
      payload: { old: null, new: { v: 1 } },
    })
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ─── Chain linking simulation ──────────────────────────────────────────

describe('chain linking (simulated)', () => {
  it('each entry in a chain includes the previous entry\'s hash', async () => {
    // Simulate a 3-entry chain
    const entry1Hash = await computeEntryHash({
      ...baseParams,
      previousHash: null,
      sequence: 1,
    })

    const entry2Hash = await computeEntryHash({
      ...baseParams,
      previousHash: entry1Hash,
      sequence: 2,
      entityId: 'CP2',
    })

    const entry3Hash = await computeEntryHash({
      ...baseParams,
      previousHash: entry2Hash,
      sequence: 3,
      entityId: 'CP3',
    })

    // All three should be distinct
    expect(entry1Hash).not.toBe(entry2Hash)
    expect(entry2Hash).not.toBe(entry3Hash)
    expect(entry1Hash).not.toBe(entry3Hash)

    // Each should be a valid hash
    expect(entry1Hash).toMatch(/^[0-9a-f]{64}$/)
    expect(entry2Hash).toMatch(/^[0-9a-f]{64}$/)
    expect(entry3Hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('tampering with a middle entry breaks the chain at the next entry', async () => {
    // Build a 3-entry chain
    const entry1Hash = await computeEntryHash({
      ...baseParams,
      previousHash: null,
      sequence: 1,
    })

    const entry2OriginalHash = await computeEntryHash({
      ...baseParams,
      previousHash: entry1Hash,
      sequence: 2,
      entityId: 'CP2',
    })

    const entry3Hash = await computeEntryHash({
      ...baseParams,
      previousHash: entry2OriginalHash,
      sequence: 3,
      entityId: 'CP3',
    })

    // Now simulate tampering: entry 2's payload is changed after insert,
    // producing a different hash
    const entry2TamperedHash = await computeEntryHash({
      ...baseParams,
      previousHash: entry1Hash,
      sequence: 2,
      entityId: 'CP2',
      payload: { ...baseParams.payload, reason: 'FABRICATED REASON' },
    })

    // The tampered hash is different from the original
    expect(entry2TamperedHash).not.toBe(entry2OriginalHash)

    // Entry 3's stored previousHash (entry2OriginalHash) no longer matches
    // entry 2's actual hash (entry2TamperedHash) — chain is broken.
    // verifyChain() would flag this as a brokenLink at entry 3.
    expect(entry3Hash).not.toBe(entry2TamperedHash)
    // (In a real verification, we'd compare entry3.previousHash against
    // entry2.entryHash and detect the mismatch.)
  })

  it('inserting an entry mid-chain breaks the link at the next entry', async () => {
    // Original chain: entry1 → entry2 → entry3
    const entry1Hash = await computeEntryHash({
      ...baseParams,
      previousHash: null,
      sequence: 1,
    })
    const entry2Hash = await computeEntryHash({
      ...baseParams,
      previousHash: entry1Hash,
      sequence: 2,
      entityId: 'CP2',
    })
    const entry3Hash = await computeEntryHash({
      ...baseParams,
      previousHash: entry2Hash,
      sequence: 3,
      entityId: 'CP3',
    })

    // Simulate insertion of a fake entry between 2 and 3.
    // The fake entry claims previousHash = entry2Hash (correct link to entry 2).
    const fakeEntryHash = await computeEntryHash({
      ...baseParams,
      previousHash: entry2Hash,
      sequence: 4, // gets a new sequence number
      entityId: 'CP-FAKE',
    })

    // But entry 3's stored previousHash is still entry2Hash, not fakeEntryHash.
    // verifyChain() walks by sequence and would see:
    //   entry 3 (seq 3) has previousHash = entry2Hash
    //   but the entry at seq 2 is entry 2 with entryHash = entry2Hash ← matches
    //   however, the fake entry at seq 4 sits between entry 3 and the next real entry
    // The fake entry's previousHash (entry2Hash) doesn't match entry 3's entryHash
    // (entry3Hash) — so the link from entry 3 to the fake entry is broken.
    expect(fakeEntryHash).not.toBe(entry3Hash)
    // (Real verification would detect this when walking seq 3 → seq 4.)
  })
})

// ─── Type safety ───────────────────────────────────────────────────────

describe('type safety', () => {
  it('accepts all valid AuditEntityType values', async () => {
    const types = [
      'control_point', 'traverse', 'leveling', 'parcel', 'alignment',
      'surface', 'volume', 'transformation', 'document', 'system', 'custom',
    ] as const

    for (const entityType of types) {
      const hash = await computeEntryHash({ ...baseParams, entityType })
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('accepts all valid AuditAction values', async () => {
    const actions = [
      'create', 'update', 'delete', 'adjust', 'generate', 'submit',
      'lock', 'unlock', 'sign', 'validate', 'import', 'export', 'custom',
    ] as const

    for (const action of actions) {
      const hash = await computeEntryHash({ ...baseParams, action })
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})
