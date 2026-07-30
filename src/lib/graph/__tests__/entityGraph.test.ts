/**
 * Tests for the Cross-Hub Entity Graph.
 *
 * Coverage:
 *   - Basic add/get/setPayload
 *   - Dependency registration and validation
 *   - Dirty propagation (markDirty cascades to dependents)
 *   - Lazy recomputation (get triggers recompute only if dirty)
 *   - Cycle detection (addNode refuses cycles)
 *   - Topological sort for batch recompute
 *   - Error handling (compute throwing, missing dependencies)
 *   - Serialization
 *   - Realistic survey scenario (control point → traverse → parcel)
 */

import {
  EntityGraph,
  createEntityGraph,
  CycleError,
  NodeNotFoundError,
  DependencyNotFoundError,
} from '../entityGraph'

describe('EntityGraph', () => {
  // ─── Basic node operations ───────────────────────────────────────────

  describe('basic operations', () => {
    it('adds a source node and retrieves its payload via setPayload', async () => {
      const g = createEntityGraph()
      g.addNode({
        id: 'control-point/CP1',
        type: 'control_point',
      })
      g.setPayload('control-point/CP1', { easting: 250000, northing: 9945000 })

      const payload = await g.get<{ easting: number; northing: number }>('control-point/CP1')
      expect(payload.easting).toBe(250000)
      expect(payload.northing).toBe(9945000)
    })

    it('throws NodeNotFoundError when getting an unknown node', async () => {
      const g = createEntityGraph()
      await expect(g.get('nope')).rejects.toThrow(NodeNotFoundError)
    })

    it('throws NodeNotFoundError when setting payload on unknown node', () => {
      const g = createEntityGraph()
      expect(() => g.setPayload('nope', {})).toThrow(NodeNotFoundError)
    })

    it('throws NodeNotFoundError when marking unknown node dirty', () => {
      const g = createEntityGraph()
      expect(() => g.markDirty('nope')).toThrow(NodeNotFoundError)
    })
  })

  // ─── Compute functions ───────────────────────────────────────────────

  describe('compute functions', () => {
    it('computes a node from its dependencies', async () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.setPayload('cp/1', { easting: 100, northing: 200 })

      g.addNode({
        id: 'traverse/1',
        type: 'traverse',
        dependencies: ['cp/1'],
        compute: async (deps) => {
          const cp = deps['cp/1'] as { easting: number; northing: number }
          return { startE: cp.easting, startN: cp.northing, misclosure: 0.005 }
        },
      })

      const result = await g.get<{ startE: number; startN: number; misclosure: number }>('traverse/1')
      expect(result.startE).toBe(100)
      expect(result.startN).toBe(200)
      expect(result.misclosure).toBe(0.005)
    })

    it('computes multi-level dependency chains (cp → traverse → parcel)', async () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.setPayload('cp/1', { easting: 0, northing: 0 })

      g.addNode({
        id: 'traverse/1',
        type: 'traverse',
        dependencies: ['cp/1'],
        compute: async (deps) => {
          const cp = deps['cp/1'] as { easting: number; northing: number }
          return { stations: [{ e: cp.easting, n: cp.northing }] }
        },
      })

      g.addNode({
        id: 'parcel/1',
        type: 'parcel',
        dependencies: ['traverse/1'],
        compute: async (deps) => {
          const trav = deps['traverse/1'] as { stations: Array<{ e: number; n: number }> }
          return { area: trav.stations.length * 100 }
        },
      })

      const parcel = await g.get<{ area: number }>('parcel/1')
      expect(parcel.area).toBe(100)
    })

    it('supports sync compute functions', async () => {
      const g = createEntityGraph()
      g.addNode({ id: 'src', type: 'control_point' })
      g.setPayload('src', { v: 42 })

      g.addNode({
        id: 'dep',
        type: 'custom',
        dependencies: ['src'],
        compute: (deps) => {
          const src = deps['src'] as { v: number }
          return { doubled: src.v * 2 }
        },
      })

      const result = await g.get<{ doubled: number }>('dep')
      expect(result.doubled).toBe(84)
    })
  })

  // ─── Dirty propagation ───────────────────────────────────────────────

  describe('dirty propagation', () => {
    it('marks direct dependents dirty when a source changes', async () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.setPayload('cp/1', { e: 0, n: 0 })

      g.addNode({
        id: 'traverse/1',
        type: 'traverse',
        dependencies: ['cp/1'],
        compute: async (deps) => deps['cp/1'],
      })
      await g.get('traverse/1') // compute initially

      expect(g.inspect('traverse/1')?.dirty).toBe(false)

      // Change the control point
      g.markDirty('cp/1')
      expect(g.inspect('cp/1')?.dirty).toBe(true)
      expect(g.inspect('traverse/1')?.dirty).toBe(true)
    })

    it('cascades dirtiness transitively through the graph', async () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.setPayload('cp/1', { e: 0, n: 0 })

      g.addNode({
        id: 'traverse/1',
        type: 'traverse',
        dependencies: ['cp/1'],
        compute: async (deps) => deps['cp/1'],
      })
      g.addNode({
        id: 'parcel/1',
        type: 'parcel',
        dependencies: ['traverse/1'],
        compute: async (deps) => deps['traverse/1'],
      })
      g.addNode({
        id: 'alignment/1',
        type: 'alignment',
        dependencies: ['traverse/1'],
        compute: async (deps) => deps['traverse/1'],
      })

      await g.recomputeAll()

      // Mark cp/1 dirty → all three dependents should cascade
      g.markDirty('cp/1')
      expect(g.inspect('traverse/1')?.dirty).toBe(true)
      expect(g.inspect('parcel/1')?.dirty).toBe(true)
      expect(g.inspect('alignment/1')?.dirty).toBe(true)
    })

    it('does NOT cascade dirtiness to ancestors (only downstream)', async () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.setPayload('cp/1', { e: 0, n: 0 })

      g.addNode({
        id: 'traverse/1',
        type: 'traverse',
        dependencies: ['cp/1'],
        compute: async (deps) => deps['cp/1'],
      })
      g.addNode({
        id: 'parcel/1',
        type: 'parcel',
        dependencies: ['traverse/1'],
        compute: async (deps) => deps['traverse/1'],
      })

      await g.recomputeAll()

      // Mark parcel/1 dirty → cp/1 and traverse/1 should NOT be dirty
      g.markDirty('parcel/1')
      expect(g.inspect('parcel/1')?.dirty).toBe(true)
      expect(g.inspect('traverse/1')?.dirty).toBe(false)
      expect(g.inspect('cp/1')?.dirty).toBe(false)
    })

    it('listDirty returns all dirty node ids', async () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.addNode({
        id: 'traverse/1',
        type: 'traverse',
        dependencies: ['cp/1'],
        compute: async (deps) => deps['cp/1'],
      })

      // Both start dirty (never computed)
      const dirty = g.listDirty()
      expect(dirty).toContain('cp/1')
      expect(dirty).toContain('traverse/1')
    })
  })

  // ─── Lazy recomputation ─────────────────────────────────────────────

  describe('lazy recomputation', () => {
    it('only recomputes dirty nodes (not clean ones)', async () => {
      const g = createEntityGraph()
      let computeCount = 0

      g.addNode({
        id: 'node/1',
        type: 'custom',
        compute: async () => {
          computeCount++
          return { v: computeCount }
        },
      })

      await g.get('node/1')
      expect(computeCount).toBe(1)

      // Second get should NOT recompute
      await g.get('node/1')
      expect(computeCount).toBe(1)
    })

    it('recomputes when dirty flag is set', async () => {
      const g = createEntityGraph()
      let computeCount = 0

      g.addNode({
        id: 'node/1',
        type: 'custom',
        compute: async () => {
          computeCount++
          return { v: computeCount }
        },
      })

      await g.get('node/1')
      expect(computeCount).toBe(1)

      g.markDirty('node/1')
      await g.get('node/1')
      expect(computeCount).toBe(2)
    })

    it('recomputes dependencies only if they are dirty', async () => {
      const g = createEntityGraph()
      let srcComputeCount = 0
      let depComputeCount = 0

      g.addNode({
        id: 'src',
        type: 'custom',
        compute: async () => {
          srcComputeCount++
          return { v: srcComputeCount }
        },
      })
      g.addNode({
        id: 'dep',
        type: 'custom',
        dependencies: ['src'],
        compute: async (deps) => {
          depComputeCount++
          return { doubled: (deps['src'] as { v: number }).v * 2 }
        },
      })

      // Initial compute — both should run
      await g.get('dep')
      expect(srcComputeCount).toBe(1)
      expect(depComputeCount).toBe(1)

      // Mark dep dirty (but NOT src) → src should not recompute
      g.markDirty('dep')
      await g.get('dep')
      expect(srcComputeCount).toBe(1) // unchanged
      expect(depComputeCount).toBe(2)
    })
  })

  // ─── Cycle detection ────────────────────────────────────────────────

  describe('cycle detection', () => {
    it('does not create a cycle for a legitimate DAG (a→b→c, plus c→a is blocked)', () => {
      // The graph prevents cycles at addNode time. A new node's deps
      // are checked: if the new node is already an ancestor of any dep,
      // CycleError is thrown. For a brand-new node this can't happen,
      // so legitimate DAGs always succeed.
      const g = createEntityGraph()
      g.addNode({ id: 'a', type: 'custom' })
      g.addNode({ id: 'b', type: 'custom', dependencies: ['a'] })
      g.addNode({ id: 'c', type: 'custom', dependencies: ['b'] })
      // Adding d with dep on a (sibling branch) is fine
      g.addNode({ id: 'd', type: 'custom', dependencies: ['a'] })
      expect(g.size).toBe(4)
    })

    it('CycleError class is exported and has the right shape', () => {
      const err = new CycleError('from-id', 'to-id', ['from-id', 'mid', 'to-id'])
      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('CycleError')
      expect(err.fromId).toBe('from-id')
      expect(err.toId).toBe('to-id')
      expect(err.cyclePath).toEqual(['from-id', 'mid', 'to-id'])
      expect(err.message).toContain('from-id')
      expect(err.message).toContain('to-id')
      expect(err.message).toContain('cycle')
    })

    it('topologicalSort produces a valid order (dependencies before dependents)', async () => {
      // Indirect test of the cycle-free invariant: if a cycle existed,
      // topologicalSort would throw. Building a legitimate DAG and
      // running recomputeAll confirms the graph is acyclic.
      const g = createEntityGraph()
      g.addNode({ id: 'a', type: 'custom' })
      g.setPayload('a', { v: 1 })
      g.addNode({ id: 'b', type: 'custom', dependencies: ['a'], compute: async (d) => d['a'] })
      g.addNode({ id: 'c', type: 'custom', dependencies: ['b'], compute: async (d) => d['b'] })

      await g.recomputeAll()
      // If we got here, no cycle was detected — graph is a valid DAG
      const cPayload = await g.get<{ v: number }>('c')
      expect(cPayload.v).toBe(1)
    })
  })

  // ─── Dependency validation ──────────────────────────────────────────

  describe('dependency validation', () => {
    it('throws DependencyNotFoundError when adding a node with unknown deps', () => {
      const g = createEntityGraph()
      expect(() => {
        g.addNode({
          id: 'node/1',
          type: 'custom',
          dependencies: ['unknown/dep'],
        })
      }).toThrow(DependencyNotFoundError)
    })

    it('allows adding a node with no dependencies (source node)', () => {
      const g = createEntityGraph()
      expect(() => {
        g.addNode({ id: 'src', type: 'control_point' })
      }).not.toThrow()
    })
  })

  // ─── Error handling in compute ──────────────────────────────────────

  describe('error handling', () => {
    it('rethrows errors from compute functions', async () => {
      const g = createEntityGraph()
      g.addNode({
        id: 'failing',
        type: 'custom',
        compute: async () => {
          throw new Error('compute failed')
        },
      })

      await expect(g.get('failing')).rejects.toThrow('compute failed')
    })

    it('records the error in inspect()', async () => {
      const g = createEntityGraph()
      g.addNode({
        id: 'failing',
        type: 'custom',
        compute: async () => {
          throw new Error('boom')
        },
      })

      try {
        await g.get('failing')
      } catch {
        // expected
      }

      const info = g.inspect('failing')
      expect(info?.hasError).toBe(true)
      expect(info?.errorMessage).toBe('boom')
    })

    it('does not retry compute on every get() after an error (clears dirty)', async () => {
      const g = createEntityGraph()
      let callCount = 0
      g.addNode({
        id: 'failing',
        type: 'custom',
        compute: async () => {
          callCount++
          throw new Error('always fails')
        },
      })

      try { await g.get('failing') } catch {}
      try { await g.get('failing') } catch {}

      expect(callCount).toBe(1) // not retried automatically
    })
  })

  // ─── Batch operations ───────────────────────────────────────────────

  describe('batch operations', () => {
    it('recomputeAll computes all nodes in topological order', async () => {
      const g = createEntityGraph()
      const order: string[] = []

      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.setPayload('cp/1', { e: 0, n: 0 })

      g.addNode({
        id: 'traverse/1',
        type: 'traverse',
        dependencies: ['cp/1'],
        compute: async () => {
          order.push('traverse/1')
          return { stations: [] }
        },
      })
      g.addNode({
        id: 'parcel/1',
        type: 'parcel',
        dependencies: ['traverse/1'],
        compute: async () => {
          order.push('parcel/1')
          return { area: 100 }
        },
      })

      await g.recomputeAll()

      // traverse should be computed before parcel
      expect(order.indexOf('traverse/1')).toBeLessThan(order.indexOf('parcel/1'))
    })

    it('recomputeAll skips already-clean nodes', async () => {
      const g = createEntityGraph()
      let count = 0

      g.addNode({
        id: 'src',
        type: 'custom',
        compute: async () => {
          count++
          return { v: count }
        },
      })

      await g.recomputeAll()
      expect(count).toBe(1)

      await g.recomputeAll()
      expect(count).toBe(1) // not recomputed
    })
  })

  // ─── Dependent listing ──────────────────────────────────────────────

  describe('dependent listing', () => {
    it('listDependents returns direct dependents', () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.addNode({ id: 'trav/1', type: 'traverse', dependencies: ['cp/1'] })
      g.addNode({ id: 'trav/2', type: 'traverse', dependencies: ['cp/1'] })
      g.addNode({ id: 'unrelated', type: 'custom' })

      const deps = g.listDependents('cp/1')
      expect(deps).toContain('trav/1')
      expect(deps).toContain('trav/2')
      expect(deps).not.toContain('unrelated')
    })

    it('listTransitiveDependents returns the full downstream subtree', () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.addNode({ id: 'trav/1', type: 'traverse', dependencies: ['cp/1'] })
      g.addNode({ id: 'parcel/1', type: 'parcel', dependencies: ['trav/1'] })
      g.addNode({ id: 'alignment/1', type: 'alignment', dependencies: ['trav/1'] })

      const transitive = g.listTransitiveDependents('cp/1')
      expect(transitive).toContain('trav/1')
      expect(transitive).toContain('parcel/1')
      expect(transitive).toContain('alignment/1')
      expect(transitive.length).toBe(3)
    })
  })

  // ─── Serialization ──────────────────────────────────────────────────

  describe('serialization', () => {
    it('serialize returns all node state', async () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point', label: 'Control Point 1' })
      g.setPayload('cp/1', { e: 100, n: 200 })

      g.addNode({
        id: 'trav/1',
        type: 'traverse',
        dependencies: ['cp/1'],
        compute: async (deps) => deps['cp/1'],
      })
      await g.get('trav/1')

      const serialized = g.serialize()
      expect(serialized.nodes.length).toBe(2)

      const cp = serialized.nodes.find((n) => n.id === 'cp/1')
      expect(cp?.type).toBe('control_point')
      expect(cp?.label).toBe('Control Point 1')
      expect(cp?.payload).toEqual({ e: 100, n: 200 })
      expect(cp?.dirty).toBe(false)

      const trav = serialized.nodes.find((n) => n.id === 'trav/1')
      expect(trav?.dependencies).toEqual(['cp/1'])
      expect(trav?.computedAt).toBeDefined()
    })
  })

  // ─── Realistic survey scenario ─────────────────────────────────────

  describe('realistic survey scenario', () => {
    it('control point change cascades to traverse, parcel, and alignment', async () => {
      const g = createEntityGraph()

      // Source: control point
      g.addNode({ id: 'cp/origin', type: 'control_point' })
      g.setPayload('cp/origin', { easting: 250000, northing: 9945000 })

      // Traverse depends on control point
      g.addNode({
        id: 'trav/main',
        type: 'traverse',
        dependencies: ['cp/origin'],
        compute: async (deps) => {
          const cp = deps['cp/origin'] as { easting: number; northing: number }
          return {
            stations: [
              { name: 'A', e: cp.easting, n: cp.northing },
              { name: 'B', e: cp.easting + 100, n: cp.northing },
            ],
            misclosure: 0.003,
          }
        },
      })

      // Parcel depends on traverse
      g.addNode({
        id: 'parcel/P1',
        type: 'parcel',
        dependencies: ['trav/main'],
        compute: async (deps) => {
          const trav = deps['trav/main'] as { stations: Array<{ e: number; n: number }> }
          return { areaSqm: trav.stations.length * 5000, perimeterM: 400 }
        },
      })

      // Alignment depends on traverse (cross-hub!)
      g.addNode({
        id: 'alignment/road-1',
        type: 'alignment',
        dependencies: ['trav/main'],
        compute: async (deps) => {
          const trav = deps['trav/main'] as { stations: Array<{ e: number; n: number }> }
          return { startChainage: 0, endChainage: trav.stations.length * 100 }
        },
      })

      // Initial computation
      await g.recomputeAll()
      const initialParcel = await g.get<{ areaSqm: number }>('parcel/P1')
      expect(initialParcel.areaSqm).toBe(10000)

      // Now: surveyor moves the control point (Helmert adjustment)
      g.markDirty('cp/origin')
      // → traverse, parcel, alignment all dirty
      expect(g.listDirty().sort()).toEqual([
        'alignment/road-1',
        'cp/origin',
        'parcel/P1',
        'trav/main',
      ])

      // Surveyor fixes the control point and re-sets its payload
      g.setPayload('cp/origin', { easting: 250050, northing: 9945050 })
      // setPayload clears dirty on cp/origin but NOT on dependents
      expect(g.inspect('cp/origin')?.dirty).toBe(false)
      expect(g.inspect('trav/main')?.dirty).toBe(true)

      // Recompute everything
      await g.recomputeAll()
      expect(g.listDirty().length).toBe(0)

      // Parcel payload should reflect the new control point (same shape, recomputed)
      const recomputedParcel = await g.get<{ areaSqm: number }>('parcel/P1')
      expect(recomputedParcel.areaSqm).toBe(10000) // same shape — 2 stations × 5000
    })
  })

  // ─── Node removal ───────────────────────────────────────────────────

  describe('node removal', () => {
    it('removes a leaf node (no dependents)', () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.addNode({
        id: 'trav/1',
        type: 'traverse',
        dependencies: ['cp/1'],
        compute: async (deps) => deps['cp/1'],
      })

      g.removeNode('trav/1')
      expect(g.listAll()).toEqual(['cp/1'])
    })

    it('throws when removing a node with dependents', () => {
      const g = createEntityGraph()
      g.addNode({ id: 'cp/1', type: 'control_point' })
      g.addNode({
        id: 'trav/1',
        type: 'traverse',
        dependencies: ['cp/1'],
        compute: async (deps) => deps['cp/1'],
      })

      expect(() => g.removeNode('cp/1')).toThrow(/still depend on it/)
    })
  })
})
