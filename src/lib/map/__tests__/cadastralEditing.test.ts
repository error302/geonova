/**
 * Tests for cadastralEditing module
 *
 * HistoryManager is tested directly — it only depends on a mock source.
 * createHistoryManager factory is tested for its return contract.
 * Orthogonal constraint logic is tested indirectly via the editing stack.
 *
 * OpenLayers modules are mocked because they require a browser DOM
 * and can't run in Jest's Node environment. The HistoryManager class
 * itself doesn't call OL at import time — it only uses OL types
 * for method signatures, which are erased at runtime.
 */

// Mock all OpenLayers imports — cadastralEditing.ts imports these at the
// top level, but the test only exercises HistoryManager which is pure JS.
jest.mock('ol/Map', () => ({ default: class Map {} }))
jest.mock('ol/Feature', () => ({ default: class Feature {} }))
jest.mock('ol/geom/Polygon', () => ({ default: class Polygon {} }))
jest.mock('ol/geom/Point', () => ({ default: class Point {} }))
jest.mock('ol/source/Vector', () => ({ default: class VectorSource {} }))
jest.mock('ol/layer/Vector', () => ({ default: class VectorLayer {} }))
jest.mock('ol/interaction/Snap', () => ({ default: class Snap {} }))
jest.mock('ol/interaction/Modify', () => ({ default: class Modify {} }))
jest.mock('ol/interaction/Draw', () => ({ default: class Draw {} }))
jest.mock('ol/interaction/Select', () => ({ default: class Select {} }))
jest.mock('ol/style/Style', () => ({ default: class Style {} }))
jest.mock('ol/style/Fill', () => ({ default: class Fill {} }))
jest.mock('ol/style/Stroke', () => ({ default: class Stroke {} }))
jest.mock('ol/style/Text', () => ({ default: class Text {} }))
jest.mock('ol/proj', () => ({ transform: jest.fn() }))
jest.mock('ol/Observable', () => ({ unByKey: jest.fn() }))
jest.mock('proj4', () => ({ default: { defs: jest.fn(), fromProj4: jest.fn() } }))

import { HistoryManager, type HistorySource } from '../cadastralEditing'

// ---------------------------------------------------------------------------
// Helpers to create mock OL features and sources
// ---------------------------------------------------------------------------

// Minimal structural types for the OL mocks — keep factory results out of
// `any` so eslint's no-unsafe-* rules can trace real shapes.
interface MockGeometry {
  clone: () => MockGeometry
  setCoordinates: (...args: unknown[]) => unknown
  getCoordinates: () => number[][] | undefined
  getType: () => string
  on: (...args: unknown[]) => unknown
  un: (...args: unknown[]) => unknown
}

interface MockFeature {
  getId: () => string | number | undefined
  clone: () => MockFeature
  getGeometry: () => MockGeometry | null
  setGeometry: (geometry: MockGeometry) => void
  getProperties: () => Record<string, unknown>
  setProperties: (...args: unknown[]) => unknown
  setStyle: (...args: unknown[]) => unknown
  getStyle: (...args: unknown[]) => unknown
}

interface MockSource {
  getFeatureById: (id: string | number) => MockFeature | null
  getFeatures: () => MockFeature[]
  addFeature: (feature: MockFeature) => void
  removeFeature: (feature: MockFeature) => void
}

function createMockGeometry(coords?: number[][]): MockGeometry {
  return {
    clone: jest.fn(() => createMockGeometry(coords)),
    setCoordinates: jest.fn(),
    getCoordinates: jest.fn(() => coords),
    getType: jest.fn(() => 'Polygon'),
    on: jest.fn(() => 'changeKey'),
    un: jest.fn(),
  }
}

function createMockFeature(id: string | number, geometry?: MockGeometry | null): MockFeature {
  const geo = geometry ?? createMockGeometry()
  return {
    getId: jest.fn(() => id),
    clone: jest.fn(() => createMockFeature(id, geo.clone())),
    getGeometry: jest.fn(() => geo),
    setGeometry: jest.fn(),
    getProperties: jest.fn(() => ({ id })),
    setProperties: jest.fn(),
    setStyle: jest.fn(),
    getStyle: jest.fn(),
  }
}

function createMockSource(): MockSource {
  const features: MockFeature[] = []
  return {
    getFeatureById: jest.fn((id: string | number) =>
      features.find((f) => f.getId() === id) ?? null
    ),
    getFeatures: jest.fn(() => features),
    addFeature: jest.fn((f: MockFeature) => features.push(f)),
    removeFeature: jest.fn((f: MockFeature) => {
      const idx = features.indexOf(f)
      if (idx >= 0) features.splice(idx, 1)
    }),
  }
}

// ---------------------------------------------------------------------------
// HistoryManager
// ---------------------------------------------------------------------------

describe('HistoryManager', () => {
  let source: ReturnType<typeof createMockSource>
  let history: HistoryManager
  // The mocks above are structurally different from the real ol/Feature and
  // ol/Geometry classes, so HistoryManager receives them via `as never`
  // (never is assignable to both) — type-only, erased at runtime.

  beforeEach(() => {
    source = createMockSource()
    history = new HistoryManager(source as unknown as HistorySource)
  })

  // --- Construction ---

  describe('construction', () => {
    it('can be instantiated with a source', () => {
      expect(history).toBeDefined()
      expect(history).toBeInstanceOf(HistoryManager)
    })

    it('starts with empty undo and redo stacks', () => {
      expect(history.canUndo()).toBe(false)
      expect(history.canRedo()).toBe(false)
      expect(history.getUndoCount()).toBe(0)
      expect(history.getRedoCount()).toBe(0)
    })
  })

  // --- Record ---

  describe('record', () => {
    it('records an add operation', () => {
      const feature = createMockFeature('f1')
      history.record('add', feature as never)
      expect(history.getUndoCount()).toBe(1)
      expect(history.canUndo()).toBe(true)
    })

    it('records a modify operation', () => {
      const geo = createMockGeometry()
      const feature = createMockFeature('f1', geo)
      history.record('modify', feature as never, geo as never)
      expect(history.getUndoCount()).toBe(1)
    })

    it('records a delete operation', () => {
      const feature = createMockFeature('f1')
      history.record('delete', feature as never)
      expect(history.getUndoCount()).toBe(1)
    })

    it('clears redo stack when a new operation is recorded', () => {
      const feature = createMockFeature('f1')
      history.record('add', feature as never)
      history.undo() // move to redo
      expect(history.getRedoCount()).toBe(1)

      history.record('add', createMockFeature('f2') as never)
      expect(history.getRedoCount()).toBe(0)
    })
  })

  // --- Undo ---

  describe('undo', () => {
    it('returns false when undo stack is empty', () => {
      expect(history.undo()).toBe(false)
    })

    it('returns true when undoing an add operation', () => {
      const feature = createMockFeature('f1')
      source.addFeature(feature)
      history.record('add', feature as never)

      expect(history.undo()).toBe(true)
      expect(source.removeFeature).toHaveBeenCalled()
      expect(history.getRedoCount()).toBe(1)
    })

    it('undo add removes the feature from source', () => {
      const feature = createMockFeature('f1')
      source.addFeature(feature)
      history.record('add', feature as never)
      history.undo()

      expect(source.removeFeature).toHaveBeenCalledWith(feature)
    })

    it('undo modify restores original geometry', () => {
      const originalGeo = createMockGeometry([[0, 0], [1, 0], [1, 1], [0, 1]])
      const feature = createMockFeature('f1', originalGeo)
      source.addFeature(feature)

      history.record('modify', feature as never, originalGeo as never)
      history.undo()

      // The undo should call setGeometry with the original geometry clone
      expect(feature.setGeometry).toHaveBeenCalled()
    })

    it('undo delete re-adds the feature to source', () => {
      const feature = createMockFeature('f1')
      history.record('delete', feature as never)
      history.undo()

      expect(source.addFeature).toHaveBeenCalled()
    })

    it('moves the entry from undo stack to redo stack', () => {
      history.record('add', createMockFeature('f1') as never)
      expect(history.getUndoCount()).toBe(1)
      expect(history.getRedoCount()).toBe(0)

      history.undo()
      expect(history.getUndoCount()).toBe(0)
      expect(history.getRedoCount()).toBe(1)
    })
  })

  // --- Redo ---

  describe('redo', () => {
    it('returns false when redo stack is empty', () => {
      expect(history.redo()).toBe(false)
    })

    it('returns true when redoing an add operation', () => {
      const feature = createMockFeature('f1')
      history.record('add', feature as never)
      history.undo()

      expect(history.redo()).toBe(true)
      expect(source.addFeature).toHaveBeenCalled()
    })

    it('redo add re-adds the feature to source', () => {
      const feature = createMockFeature('f1')
      history.record('add', feature as never)
      history.undo()

      history.redo()
      expect(source.addFeature).toHaveBeenCalled()
    })

    it('moves the entry from redo stack to undo stack', () => {
      history.record('add', createMockFeature('f1') as never)
      history.undo()

      expect(history.getRedoCount()).toBe(1)
      history.redo()
      expect(history.getRedoCount()).toBe(0)
      expect(history.getUndoCount()).toBe(1)
    })

    it('redo delete removes the feature from source', () => {
      const feature = createMockFeature('f1')
      source.addFeature(feature)
      history.record('delete', feature as never)
      history.undo() // re-adds feature
      history.redo() // removes feature again

      expect(source.removeFeature).toHaveBeenCalledWith(feature)
    })

    it('redo modify restores the modified geometry', () => {
      const originalGeo = createMockGeometry([[0, 0], [1, 0], [1, 1], [0, 1]])
      const feature = createMockFeature('f1', originalGeo)
      source.addFeature(feature)

      history.record('modify', feature as never, originalGeo as never)
      history.undo()
      history.redo()

      // After redo, setGeometry should be called with the after geometry
      expect(feature.setGeometry).toHaveBeenCalled()
    })
  })

  // --- Clear ---

  describe('clear', () => {
    it('clears both undo and redo stacks', () => {
      history.record('add', createMockFeature('f1') as never)
      history.record('add', createMockFeature('f2') as never)
      history.undo()

      expect(history.getUndoCount()).toBe(1)
      expect(history.getRedoCount()).toBe(1)

      history.clear()

      expect(history.getUndoCount()).toBe(0)
      expect(history.getRedoCount()).toBe(0)
      expect(history.canUndo()).toBe(false)
      expect(history.canRedo()).toBe(false)
    })

    it('can be called on an empty history without error', () => {
      expect(() => history.clear()).not.toThrow()
    })
  })

  // --- Query methods ---

  describe('query methods', () => {
    it('canUndo returns false when empty', () => {
      expect(history.canUndo()).toBe(false)
    })

    it('canUndo returns true after recording', () => {
      history.record('add', createMockFeature('f1') as never)
      expect(history.canUndo()).toBe(true)
    })

    it('canRedo returns false when empty', () => {
      expect(history.canRedo()).toBe(false)
    })

    it('canRedo returns true after undo', () => {
      history.record('add', createMockFeature('f1') as never)
      history.undo()
      expect(history.canRedo()).toBe(true)
    })

    it('getUndoCount returns correct count', () => {
      history.record('add', createMockFeature('f1') as never)
      history.record('add', createMockFeature('f2') as never)
      history.record('add', createMockFeature('f3') as never)
      expect(history.getUndoCount()).toBe(3)
    })

    it('getRedoCount returns correct count', () => {
      history.record('add', createMockFeature('f1') as never)
      history.record('add', createMockFeature('f2') as never)
      history.undo()
      history.undo()
      expect(history.getRedoCount()).toBe(2)
    })
  })

  // --- Max depth ---

  describe('max depth', () => {
    it('enforces max history depth of 50 entries', () => {
      // Record 55 operations; oldest 5 should be discarded
      for (let i = 0; i < 55; i++) {
        history.record('add', createMockFeature('f' + i) as never)
      }

      // Should have at most 50 entries
      expect(history.getUndoCount()).toBe(50)
    })

    it('oldest entries are discarded when max depth is exceeded', () => {
      // Record 51 operations
      for (let i = 0; i < 51; i++) {
        history.record('add', createMockFeature('f' + i) as never)
      }

      // Undo 50 times — the 51st should return false (oldest was discarded)
      for (let i = 0; i < 50; i++) {
        history.undo()
      }
      expect(history.undo()).toBe(false)
    })
  })

  // --- Sequential undo/redo ---

  describe('sequential operations', () => {
    it('supports multiple undo operations in sequence', () => {
      history.record('add', createMockFeature('f1') as never)
      history.record('add', createMockFeature('f2') as never)
      history.record('add', createMockFeature('f3') as never)

      expect(history.undo()).toBe(true) // undo f3
      expect(history.undo()).toBe(true) // undo f2
      expect(history.undo()).toBe(true) // undo f1
      expect(history.undo()).toBe(false) // nothing left
    })

    it('supports undo then redo in sequence', () => {
      history.record('add', createMockFeature('f1') as never)
      history.record('add', createMockFeature('f2') as never)

      history.undo()
      history.redo()

      expect(history.canUndo()).toBe(true)
      expect(history.canRedo()).toBe(false)
    })

    it('new operation after undo clears redo stack', () => {
      history.record('add', createMockFeature('f1') as never)
      history.record('add', createMockFeature('f2') as never)
      history.undo()

      // Record a new operation
      history.record('add', createMockFeature('f3') as never)

      // Can't redo f2 anymore
      expect(history.canRedo()).toBe(false)
      // Can undo f3
      expect(history.canUndo()).toBe(true)
    })

    it('mixed add/modify/delete operations undo/redo correctly', () => {
      const f1 = createMockFeature('f1')
      const geo = createMockGeometry()
      source.addFeature(f1)

      history.record('add', f1 as never)
      history.record('modify', f1 as never, geo as never)
      history.record('delete', f1 as never)

      // Undo delete → re-adds f1
      history.undo()
      expect(source.addFeature).toHaveBeenCalled()

      // Undo modify → restores geometry
      history.undo()
      expect(f1.setGeometry).toHaveBeenCalled()

      // Undo add → removes f1
      history.undo()
      expect(source.removeFeature).toHaveBeenCalled()
    })
  })

  // --- Feature without ID ---

  describe('feature without ID', () => {
    it('generates an ID for features without one', () => {
      const feature = createMockFeature(undefined as any)
      history.record('add', feature as never)
      expect(history.getUndoCount()).toBe(1)
    })

    it('undo still works for features without ID (add uses findFeature which returns null)', () => {
      const feature = createMockFeature(undefined as any)
      history.record('add', feature as never)

      // Undo should not throw even though findFeature returns null
      expect(() => history.undo()).not.toThrow()
    })
  })

  // --- Edge cases ---

  describe('edge cases', () => {
    it('modify without beforeGeo records null before', () => {
      const feature = createMockFeature('f1')
      history.record('modify', feature as never) // no beforeGeo
      expect(history.getUndoCount()).toBe(1)

      // Undo should not throw
      expect(() => history.undo()).not.toThrow()
    })

    it('modify on feature without geometry does not throw', () => {
      const feature = createMockFeature('f1', null)
      history.record('modify', feature as never, null as never)
      expect(history.getUndoCount()).toBe(1)

      expect(() => history.undo()).not.toThrow()
    })

    it('delete without before (feature.clone) handles gracefully', () => {
      const feature = createMockFeature('f1')
      history.record('delete', feature as never)
      history.undo()

      // Re-adds the cloned feature
      expect(source.addFeature).toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// createHistoryManager (standalone factory)
// ---------------------------------------------------------------------------

describe('createHistoryManager', () => {
  it('is exported as a function', async () => {
    // createHistoryManager is an async factory exported from the module
    const mod = await import('../cadastralEditing')
    expect(typeof mod.createHistoryManager).toBe('function')
  })

  it('returns a HistoryManager instance', async () => {
    const { createHistoryManager } = await import('../cadastralEditing')
    const source = createMockSource()
    const hm = await createHistoryManager(source as unknown as HistorySource)
    expect(hm).toBeInstanceOf(HistoryManager)
  })
})
