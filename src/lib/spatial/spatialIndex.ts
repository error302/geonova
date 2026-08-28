/**
 * METARDU — High-Performance Spatial Index Engine
 * 
 * Implements:
 * 1. 2D R-Tree with Sort-Tile-Recursive (STR) Bulk-Loading:
 *    Enables O(log N) viewport window queries over 100,000+ points and survey features.
 * 2. 2D K-d Tree:
 *    Enables O(log N) nearest-neighbor snapping and radius searches for beacon selection.
 * 3. Viewport Culler:
 *    Dynamically filters large point clouds down to visible bounds to maintain 60 FPS rendering.
 */

export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface SpatialItem<T = unknown> {
  minX: number
  minY: number
  maxX: number
  maxY: number
  data: T
}

export interface Point2DItem<T = unknown> {
  x: number
  y: number
  data: T
}

// ─── 2D R-TREE IMPLEMENTATION ───────────────────────────────────────────────

interface RTreeNode<T> {
  bbox: BoundingBox
  leaf: boolean
  children: Array<RTreeNode<T> | SpatialItem<T>>
}

export class SpatialRTree<T = unknown> {
  private maxEntries: number
  private root: RTreeNode<T>
  private totalItems: number = 0

  constructor(maxEntries: number = 16) {
    this.maxEntries = Math.max(4, maxEntries)
    this.root = {
      bbox: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      leaf: true,
      children: [],
    }
  }

  public get size(): number {
    return this.totalItems
  }

  /**
   * Sort-Tile-Recursive (STR) bulk loading algorithm.
   * Builds an optimally packed R-Tree in O(N log N) time with zero overlap.
   */
  public load(items: SpatialItem<T>[]): this {
    this.clear()
    if (items.length === 0) return this

    this.totalItems = items.length

    // Sort by X center
    items.sort((a, b) => (a.minX + a.maxX) / 2 - (b.minX + b.maxX) / 2)

    const N = items.length
    const M = this.maxEntries
    const numLeafNodes = Math.ceil(N / M)
    const numVerticalSlices = Math.ceil(Math.sqrt(numLeafNodes))
    const sliceCapacity = numVerticalSlices * M

    const leafNodes: RTreeNode<T>[] = []

    for (let i = 0; i < N; i += sliceCapacity) {
      const slice = items.slice(i, i + sliceCapacity)
      // Sort slice by Y center
      slice.sort((a, b) => (a.minY + a.maxY) / 2 - (b.minY + b.maxY) / 2)

      for (let j = 0; j < slice.length; j += M) {
        const chunk = slice.slice(j, j + M)
        const nodeBbox = this.computeBounds(chunk)
        leafNodes.push({
          bbox: nodeBbox,
          leaf: true,
          children: chunk,
        })
      }
    }

    // Build higher levels
    let currentLevel = leafNodes
    while (currentLevel.length > 1) {
      const parentLevel: RTreeNode<T>[] = []
      for (let i = 0; i < currentLevel.length; i += M) {
        const chunk = currentLevel.slice(i, i + M)
        parentLevel.push({
          bbox: this.computeBounds(chunk),
          leaf: false,
          children: chunk,
        })
      }
      currentLevel = parentLevel
    }

    this.root = currentLevel[0] || {
      bbox: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      leaf: true,
      children: [],
    }

    return this
  }

  /**
   * Searches for all items whose bounding box intersects the query bounding box
   */
  public search(queryBox: BoundingBox): SpatialItem<T>[] {
    const results: SpatialItem<T>[] = []
    if (!this.intersects(this.root.bbox, queryBox)) return results

    const stack: RTreeNode<T>[] = [this.root]

    while (stack.length > 0) {
      const node = stack.pop()!
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]
        if (node.leaf) {
          const item = child as SpatialItem<T>
          if (this.intersects(item, queryBox)) {
            results.push(item)
          }
        } else {
          const childNode = child as RTreeNode<T>
          if (this.intersects(childNode.bbox, queryBox)) {
            stack.push(childNode)
          }
        }
      }
    }

    return results
  }

  public clear(): void {
    this.root = {
      bbox: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      leaf: true,
      children: [],
    }
    this.totalItems = 0
  }

  private intersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY)
  }

  private computeBounds(entries: Array<RTreeNode<T> | SpatialItem<T>>): BoundingBox {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (let i = 0; i < entries.length; i++) {
      const e = 'bbox' in entries[i] ? (entries[i] as RTreeNode<T>).bbox : (entries[i] as SpatialItem<T>)
      if (e.minX < minX) minX = e.minX
      if (e.minY < minY) minY = e.minY
      if (e.maxX > maxX) maxX = e.maxX
      if (e.maxY > maxY) maxY = e.maxY
    }

    return { minX, minY, maxX, maxY }
  }
}

// ─── 2D K-D TREE IMPLEMENTATION ─────────────────────────────────────────────

interface KdNode<T> {
  point: Point2DItem<T>
  left: KdNode<T> | null
  right: KdNode<T> | null
}

export class SpatialKdTree<T = unknown> {
  private root: KdNode<T> | null = null
  private count: number = 0

  constructor(points?: Point2DItem<T>[]) {
    if (points && points.length > 0) {
      this.build(points)
    }
  }

  public get size(): number {
    return this.count
  }

  public build(points: Point2DItem<T>[]): void {
    this.count = points.length
    this.root = this.buildRecursive(points.slice(), 0)
  }

  private buildRecursive(pts: Point2DItem<T>[], depth: number): KdNode<T> | null {
    if (pts.length === 0) return null

    const axis = depth % 2 // 0 for X, 1 for Y
    pts.sort((a, b) => (axis === 0 ? a.x - b.x : a.y - b.y))

    const median = Math.floor(pts.length / 2)
    return {
      point: pts[median],
      left: this.buildRecursive(pts.slice(0, median), depth + 1),
      right: this.buildRecursive(pts.slice(median + 1), depth + 1),
    }
  }

  /**
   * Finds the nearest neighbor to (x, y) in O(log N) time
   */
  public nearest(x: number, y: number, maxDistance: number = Infinity): { item: Point2DItem<T>; distance: number } | null {
    if (!this.root) return null

    let bestPoint: Point2DItem<T> | null = null
    let bestDistSq = maxDistance * maxDistance

    const searchNode = (node: KdNode<T> | null, depth: number) => {
      if (!node) return

      const dx = node.point.x - x
      const dy = node.point.y - y
      const dSq = dx * dx + dy * dy

      if (dSq < bestDistSq) {
        bestDistSq = dSq
        bestPoint = node.point
      }

      const axis = depth % 2
      const axisDist = axis === 0 ? x - node.point.x : y - node.point.y

      const first = axisDist < 0 ? node.left : node.right
      const second = axisDist < 0 ? node.right : node.left

      searchNode(first, depth + 1)

      // Only search second branch if it could contain a closer point
      if (axisDist * axisDist < bestDistSq) {
        searchNode(second, depth + 1)
      }
    }

    searchNode(this.root, 0)

    if (!bestPoint) return null
    return { item: bestPoint, distance: Math.sqrt(bestDistSq) }
  }

  /**
   * Finds all points within radius R of (x, y)
   */
  public withinRadius(x: number, y: number, radius: number): Array<{ item: Point2DItem<T>; distance: number }> {
    const results: Array<{ item: Point2DItem<T>; distance: number }> = []
    if (!this.root) return results

    const radiusSq = radius * radius

    const searchNode = (node: KdNode<T> | null, depth: number) => {
      if (!node) return

      const dx = node.point.x - x
      const dy = node.point.y - y
      const dSq = dx * dx + dy * dy

      if (dSq <= radiusSq) {
        results.push({ item: node.point, distance: Math.sqrt(dSq) })
      }

      const axis = depth % 2
      const axisDist = axis === 0 ? x - node.point.x : y - node.point.y

      const first = axisDist < 0 ? node.left : node.right
      const second = axisDist < 0 ? node.right : node.left

      searchNode(first, depth + 1)
      if (axisDist * axisDist <= radiusSq) {
        searchNode(second, depth + 1)
      }
    }

    searchNode(this.root, 0)
    return results
  }
}

// ─── VIEWPORT CULLER HELPER ─────────────────────────────────────────────────

export function cullToViewport<T>(
  spatialTree: SpatialRTree<T>,
  viewportBounds: { minE: number; minN: number; maxE: number; maxN: number },
  bufferRatio: number = 0.1
): T[] {
  const width = viewportBounds.maxE - viewportBounds.minE
  const height = viewportBounds.maxN - viewportBounds.minN
  const bufferE = width * bufferRatio
  const bufferN = height * bufferRatio

  const queryBox: BoundingBox = {
    minX: viewportBounds.minE - bufferE,
    minY: viewportBounds.minN - bufferN,
    maxX: viewportBounds.maxE + bufferE,
    maxY: viewportBounds.maxN + bufferN,
  }

  const items = spatialTree.search(queryBox)
  return items.map(item => item.data)
}
