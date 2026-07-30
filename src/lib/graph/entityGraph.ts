/**
 * Cross-Hub Entity Graph
 * ======================
 *
 * A directed acyclic graph (DAG) of survey entities with deferred dirty
 * propagation. When a source entity (e.g. a geodetic control point)
 * changes, all downstream dependents (adjusted traverse, cadastral
 * polygon, road alignment) are marked dirty. Recomputation is lazy —
 * a node only recomputes when something reads it.
 *
 * Why this exists
 * ---------------
 * Before the graph, Metardu's three workflow hubs (cadastral,
 * engineering, topographic) lived side-by-side but didn't communicate.
 * If a surveyor adjusted a Helmert transformation parameter, the
 * cadastral polygons and road alignments built on top of it didn't
 * know to recompute. The surveyor would discover the stale data at
 * export time, when the statutory gate would reject it.
 *
 * The graph closes that loop. Any change to a source node cascades
 * dirty flags to all transitive dependents. The UI can then show
 * "X needs recomputation" badges and offer a one-click "Recompute
 * all affected" action.
 *
 * Design
 * ------
 * - Pure data structure. No React, no DB, no I/O. The graph is
 *   trivially testable and embeddable in any runtime.
 * - Nodes carry a `compute` function that takes the resolved
 *   dependencies and returns a new payload. The graph caches the
 *   result and a timestamp.
 * - Edges are dependency declarations: "node A depends on node B"
 *   means B's output feeds A's compute function.
 * - No cycles. Adding a dependency that would create a cycle throws
 *   a CycleError. Survey data has directionality — control points
 *   feed traverses feed polygons, never the reverse.
 * - Dirty propagation is eager (immediate cascade through the DAG),
 *   but recomputation is lazy (deferred until a reader requests the
 *   value). This avoids the "500 reactive re-renders" problem.
 *
 * Usage
 * -----
 *   const graph = new EntityGraph()
 *
 *   // Register a source node (no dependencies, payload set directly)
 *   const cp1 = graph.addNode({
 *     id: 'control-point/CP1',
 *     type: 'control_point',
 *     compute: async () => ({ easting: 250000, northing: 9945000, elevation: 1600 }),
 *   })
 *
 *   // Register a dependent node
 *   const trav1 = graph.addNode({
 *     id: 'traverse/T1',
 *     type: 'traverse',
 *     dependencies: ['control-point/CP1'],
 *     compute: async (deps) => {
 *       const cp = deps['control-point/CP1'] as { easting: number; northing: number }
 *       // ... Bowditch adjustment using cp as starting coordinate ...
 *       return { stations: [...], misclosure: 0.005 }
 *     },
 *   })
 *
 *   // Compute initial values
 *   await graph.recomputeAll()
 *
 *   // Later: a control point coordinate changes
 *   graph.markDirty('control-point/CP1')
 *   // → traverse/T1 is now dirty too (cascade)
 *
 *   // Reader requests traverse value → triggers recompute
 *   const trav = await graph.get('traverse/T1')
 *
 * Persistence
 * -----------
 * The graph is in-memory by default. For persistence, serialize via
 * `serialize()` and restore via `deserialize()`. The compute functions
 * themselves are not serialized — they're re-registered on restore.
 */

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * The kind of entity a node represents. Used for filtering and UI badges.
 * Mirrors the major entity types in the survey data model.
 */
export type EntityType =
  | 'control_point'     // Geodetic control (known coordinates)
  | 'traverse'          // Adjusted traverse (Bowditch/Transit/LSQ)
  | 'leveling'          // Level network adjustment
  | 'parcel'            // Cadastral parcel boundary
  | 'alignment'         // Engineering road alignment
  | 'surface'           // Topographic DTM / TIN
  | 'volume'            // Earthwork volume computation
  | 'transformation'    // Helmert / datum transformation
  | 'custom'            // User-defined or extension entity

/**
 * A node in the entity graph. The `compute` function receives a map
 * of dependency payloads keyed by node id and returns a new payload.
 * Compute functions must be pure — no side effects, no I/O.
 */
export interface EntityNode<TPayload = unknown> {
  /** Globally-unique node id, e.g. 'control-point/CP1' */
  id: string
  /** Entity type — used for filtering and UI */
  type: EntityType
  /** Human-readable label for UI display */
  label?: string
  /** Node ids this node depends on (inputs to compute) */
  dependencies?: string[]
  /**
   * Compute function. Receives resolved dependency payloads.
   * Must be pure. Returns the new payload for this node.
   * If omitted, the node is a "source" — set its payload directly
   * via setPayload().
   */
  compute?: (deps: Record<string, unknown>) => Promise<TPayload> | TPayload
}

interface NodeState<TPayload = unknown> {
  node: EntityNode<TPayload>
  /** Last computed payload, or undefined if never computed */
  payload: TPayload | undefined
  /** True if the node's payload is stale and needs recomputation */
  dirty: boolean
  /** ISO timestamp of last successful compute */
  computedAt: string | undefined
  /** Last error thrown by compute, if any. When set, get() rethrows
   *  instead of retrying — caller must call recompute() explicitly. */
  error: Error | undefined
  /** True after a compute attempt has been made (success or failure).
   *  Prevents get() from automatically retrying a failed compute —
   *  the caller must explicitly call recompute() to retry. */
  attempted: boolean
}

// ─── Errors ─────────────────────────────────────────────────────────────

export class CycleError extends Error {
  constructor(
    public readonly fromId: string,
    public readonly toId: string,
    public readonly cyclePath: string[]
  ) {
    super(
      `Cannot add dependency ${fromId} → ${toId}: would create a cycle (${cyclePath.join(' → ')})`
    )
    this.name = 'CycleError'
  }
}

export class NodeNotFoundError extends Error {
  constructor(public readonly nodeId: string) {
    super(`Entity node not found: ${nodeId}`)
    this.name = 'NodeNotFoundError'
  }
}

export class DependencyNotFoundError extends Error {
  constructor(
    public readonly nodeId: string,
    public readonly missingDependencyId: string
  ) {
    super(
      `Node "${nodeId}" depends on unknown node "${missingDependencyId}". Add the dependency node first.`
    )
    this.name = 'DependencyNotFoundError'
  }
}

// ─── EntityGraph ────────────────────────────────────────────────────────

export class EntityGraph {
  private nodes = new Map<string, NodeState>()
  /** Reverse adjacency: for each node id, which nodes depend on it. */
  private dependents = new Map<string, Set<string>>()

  /**
   * Add a node to the graph. If a node with the same id already exists,
   * it's replaced (its payload is reset to undefined and dirty=true).
   *
   * @throws {DependencyNotFoundError} if any declared dependency doesn't exist
   * @throws {CycleError} if adding this node's dependencies would create a cycle
   */
  addNode<TPayload>(node: EntityNode<TPayload>): void {
    // Validate dependencies exist
    if (node.dependencies) {
      for (const depId of node.dependencies) {
        if (!this.nodes.has(depId)) {
          throw new DependencyNotFoundError(node.id, depId)
        }
      }
    }

    // Check for cycles: would adding edges (dep → node) create a cycle?
    // A cycle exists if node is already an ancestor of any of its deps.
    if (node.dependencies) {
      for (const depId of node.dependencies) {
        const cyclePath = this.findPath(node.id, depId)
        if (cyclePath) {
          throw new CycleError(node.id, depId, [...cyclePath, depId])
        }
      }
    }

    // Add the node
    this.nodes.set(node.id, {
      node: node as EntityNode,
      payload: undefined,
      dirty: true,
      computedAt: undefined,
      error: undefined,
      attempted: false,
    })

    // Register reverse edges (dep → this node is a dependent)
    if (node.dependencies) {
      for (const depId of node.dependencies) {
        if (!this.dependents.has(depId)) {
          this.dependents.set(depId, new Set())
        }
        this.dependents.get(depId)!.add(node.id)
      }
    }
  }

  /**
   * Remove a node from the graph. Also removes all dependency edges
   * pointing to it. Throws if any other node still depends on it —
   * caller must remove dependents first.
   */
  removeNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) return
    // Check no one depends on this node
    const deps = this.dependents.get(nodeId)
    if (deps && deps.size > 0) {
      throw new Error(
        `Cannot remove node "${nodeId}": ${deps.size} node(s) still depend on it (${Array.from(deps).join(', ')}). Remove dependents first.`
      )
    }
    // Remove forward edges (this node's dependencies)
    const node = this.nodes.get(nodeId)!.node
    if (node.dependencies) {
      for (const depId of node.dependencies) {
        this.dependents.get(depId)?.delete(nodeId)
      }
    }
    this.nodes.delete(nodeId)
    this.dependents.delete(nodeId)
  }

  /**
   * Get a node's current payload. If the node is dirty, it is
   * recomputed first (along with any dirty dependencies, recursively).
   *
   * @throws {NodeNotFoundError} if the node doesn't exist
   * @throws {Error} re-throws any error from the node's compute function
   */
  async get<TPayload = unknown>(nodeId: string): Promise<TPayload> {
    const state = this.nodes.get(nodeId)
    if (!state) throw new NodeNotFoundError(nodeId)

    // If previously attempted and errored, rethrow the cached error
    // instead of retrying automatically. Caller must call recompute()
    // to retry.
    if (state.attempted && state.error) {
      throw state.error
    }

    if (!state.dirty && state.payload !== undefined) {
      return state.payload as TPayload
    }

    // Recompute (this also recomputes dirty dependencies)
    await this.recompute(nodeId)
    return state.payload as TPayload
  }

  /**
   * Set a source node's payload directly. Marks the node and all
   * transitive dependents as dirty.
   *
   * Use this for source nodes (no compute function) whose payload
   * is set externally — e.g. a control point coordinate loaded from
   * a GNSS observation.
   *
   * @throws {NodeNotFoundError} if the node doesn't exist
   */
  setPayload<TPayload = unknown>(nodeId: string, payload: TPayload): void {
    const state = this.nodes.get(nodeId)
    if (!state) throw new NodeNotFoundError(nodeId)

    state.payload = payload
    state.dirty = false
    state.computedAt = new Date().toISOString()
    state.error = undefined
    state.attempted = true

    // Cascade dirtiness to all dependents
    this.markDirtyDependents(nodeId)
  }

  /**
   * Mark a node as dirty (its payload is stale). Also cascades
   * dirtiness to all transitive dependents.
   *
   * Use this when a node's underlying data source changes externally
   * (e.g. surveyor edits a field book entry that feeds a traverse).
   *
   * @throws {NodeNotFoundError} if the node doesn't exist
   */
  markDirty(nodeId: string): void {
    const state = this.nodes.get(nodeId)
    if (!state) throw new NodeNotFoundError(nodeId)

    state.dirty = true
    // Clearing attempted allows recompute() to retry after a prior error
    state.attempted = false
    state.error = undefined
    this.markDirtyDependents(nodeId)
  }

  /**
   * Recompute a single node and all its dirty dependencies.
   * Recursive — dependencies are recomputed first (topological order).
   *
   * After this call, the node's payload is fresh and dirty=false.
   *
   * @throws {NodeNotFoundError} if the node doesn't exist
   * @throws {Error} re-throws any error from a compute function
   */
  async recompute(nodeId: string): Promise<void> {
    const state = this.nodes.get(nodeId)
    if (!state) throw new NodeNotFoundError(nodeId)

    if (!state.dirty && state.payload !== undefined) return

    // First, recompute any dirty dependencies
    const deps = state.node.dependencies ?? []
    const depPayloads: Record<string, unknown> = {}
    for (const depId of deps) {
      const depState = this.nodes.get(depId)
      if (!depState) throw new DependencyNotFoundError(nodeId, depId)
      if (depState.dirty || depState.payload === undefined) {
        await this.recompute(depId)
      }
      depPayloads[depId] = depState.payload
    }

    // If this is a source node (no compute fn), just clear dirty
    if (!state.node.compute) {
      if (state.payload === undefined) {
        throw new Error(
          `Source node "${nodeId}" has no payload and no compute function. Call setPayload() first.`
        )
      }
      state.dirty = false
      state.attempted = true
      return
    }

    // Run the compute function
    try {
      const payload = await state.node.compute(depPayloads)
      state.payload = payload
      state.dirty = false
      state.computedAt = new Date().toISOString()
      state.error = undefined
      state.attempted = true
    } catch (err) {
      state.error = err instanceof Error ? err : new Error(String(err))
      state.dirty = false // don't keep retrying on every get()
      state.attempted = true
      throw state.error
    }
  }

  /**
   * Recompute all dirty nodes in topological order.
   * Useful for batch refreshes after bulk data loads.
   */
  async recomputeAll(): Promise<void> {
    const order = this.topologicalSort()
    for (const nodeId of order) {
      const state = this.nodes.get(nodeId)!
      if (state.dirty || state.payload === undefined) {
        await this.recompute(nodeId)
      }
    }
  }

  /**
   * List all nodes currently marked dirty.
   * Useful for UI: "5 entities need recomputation".
   */
  listDirty(): string[] {
    const dirty: string[] = []
    for (const [id, state] of this.nodes) {
      if (state.dirty) dirty.push(id)
    }
    return dirty
  }

  /**
   * Get a node's metadata (without triggering recompute).
   * Returns undefined if the node doesn't exist.
   */
  inspect(nodeId: string): {
    id: string
    type: EntityType
    label?: string
    dirty: boolean
    computedAt?: string
    hasError: boolean
    errorMessage?: string
  } | undefined {
    const state = this.nodes.get(nodeId)
    if (!state) return undefined
    return {
      id: state.node.id,
      type: state.node.type,
      label: state.node.label,
      dirty: state.dirty,
      computedAt: state.computedAt,
      hasError: state.error !== undefined,
      errorMessage: state.error?.message,
    }
  }

  /**
   * List all direct dependents of a node (nodes that depend on it).
   * Useful for UI: "Changing CP1 will affect: Traverse/T1, Parcel/P1".
   */
  listDependents(nodeId: string): string[] {
    return Array.from(this.dependents.get(nodeId) ?? [])
  }

  /**
   * List all transitive dependents (the full downstream subtree).
   */
  listTransitiveDependents(nodeId: string): string[] {
    const result = new Set<string>()
    const queue = [nodeId]
    while (queue.length > 0) {
      const current = queue.shift()!
      const deps = this.dependents.get(current) ?? new Set()
      for (const d of deps) {
        if (!result.has(d)) {
          result.add(d)
          queue.push(d)
        }
      }
    }
    return Array.from(result)
  }

  /**
   * List all nodes in the graph.
   */
  listAll(): string[] {
    return Array.from(this.nodes.keys())
  }

  /**
   * Get the total node count.
   */
  get size(): number {
    return this.nodes.size
  }

  // ─── Internal helpers ────────────────────────────────────────────────

  /**
   * Cascade dirty=true to all transitive dependents of nodeId.
   * Internal — does not mark nodeId itself dirty (caller does that).
   */
  private markDirtyDependents(nodeId: string): void {
    const deps = this.dependents.get(nodeId)
    if (!deps) return
    for (const depId of deps) {
      const state = this.nodes.get(depId)
      if (state && !state.dirty) {
        state.dirty = true
        this.markDirtyDependents(depId)
      }
    }
  }

  /**
   * Find a path from `fromId` to `toId` following dependency edges.
   * Returns the path as an array of node ids, or null if no path.
   * Used for cycle detection.
   */
  private findPath(fromId: string, toId: string): string[] | null {
    if (fromId === toId) return [fromId]
    const visited = new Set<string>()
    const queue: Array<{ id: string; path: string[] }> = [{ id: fromId, path: [fromId] }]
    while (queue.length > 0) {
      const { id, path } = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      const state = this.nodes.get(id)
      if (!state) continue
      for (const depId of state.node.dependencies ?? []) {
        if (depId === toId) return [...path, toId]
        if (!visited.has(depId)) {
          queue.push({ id: depId, path: [...path, depId] })
        }
      }
    }
    return null
  }

  /**
   * Topological sort of all nodes (dependencies before dependents).
   * Uses Kahn's algorithm. Throws if a cycle is detected (shouldn't
   * happen since addNode prevents cycles, but defensive).
   */
  private topologicalSort(): string[] {
    const inDegree = new Map<string, number>()
    for (const [id, state] of this.nodes) {
      inDegree.set(id, state.node.dependencies?.length ?? 0)
    }

    const queue: string[] = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id)
    }

    const result: string[] = []
    while (queue.length > 0) {
      const id = queue.shift()!
      result.push(id)
      const deps = this.dependents.get(id) ?? new Set()
      for (const depId of deps) {
        const newDeg = (inDegree.get(depId) ?? 0) - 1
        inDegree.set(depId, newDeg)
        if (newDeg === 0) queue.push(depId)
      }
    }

    if (result.length !== this.nodes.size) {
      throw new Error('Cycle detected during topological sort (should be impossible — addNode prevents cycles)')
    }

    return result
  }

  // ─── Serialization ──────────────────────────────────────────────────

  /**
   * Serialize the graph state (nodes, edges, payloads, dirty flags)
   * to a plain object. Compute functions are NOT serialized — they
   * must be re-registered on restore.
   *
   * Useful for:
   *   - Persisting graph state to DB between sessions
   *   - Sending graph state to a worker for parallel recomputation
   *   - Debugging (dump the graph to inspect its current state)
   */
  serialize(): {
    nodes: Array<{
      id: string
      type: EntityType
      label?: string
      dependencies?: string[]
      payload: unknown
      dirty: boolean
      computedAt?: string
      errorMessage?: string
    }>
  } {
    return {
      nodes: Array.from(this.nodes.values()).map((s) => ({
        id: s.node.id,
        type: s.node.type,
        label: s.node.label,
        dependencies: s.node.dependencies,
        payload: s.payload,
        dirty: s.dirty,
        computedAt: s.computedAt,
        errorMessage: s.error?.message,
      })),
    }
  }
}

// ─── Factory helper ────────────────────────────────────────────────────

/**
 * Create a new empty EntityGraph. Convenience function — equivalent
 * to `new EntityGraph()`.
 */
export function createEntityGraph(): EntityGraph {
  return new EntityGraph()
}
