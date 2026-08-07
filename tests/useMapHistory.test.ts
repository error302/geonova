/**
 * Regression tests for useMapHistory (draw-source undo/redo).
 *
 * These run against the REAL OpenLayers ESM modules (ol 10.8), loaded via the
 * babel-jest transform registered in jest.config.js. Before that transform
 * existed, any test importing `ol/...` crashed at the import line — this file
 * is what keeps real-OL testing alive.
 *
 * The null-guard cases lock in the fix that hoists the draw source behind a
 * null check in pushHistory/restoreEntry (the ref is null until the map is
 * ready), and the round-trip cases pin down the explicit per-geometry
 * serialization added when it turned out OL 10.8 geometries expose no
 * toJSON(): the previous `geom?.toJSON?.()` silently serialized nothing, so
 * undo/redo cleared the source without restoring any geometry.
 */
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import Circle from 'ol/geom/Circle'
import { useMapHistory } from '../src/hooks/useMapHistory'
import type { MapContext } from '../src/hooks/useMapTypes'

function ref<T>(current: T): { current: T } {
  return { current }
}

function makeCtx(source: VectorSource | null) {
  const setFeatureCount = jest.fn()
  const ctx: MapContext = {
    mapInstance: ref<import('ol/Map').default | null>(null),
    drawSourceRef: ref<VectorSource | null>(source),
    drawLayerRef: ref<import('ol/layer/Vector').default | null>(null),
    measureSourceRef: ref<VectorSource | null>(null),
    measureLayerRef: ref<import('ol/layer/Vector').default | null>(null),
    drawInteractionRef: ref<import('ol/interaction').Interaction | null>(null),
    selectInteractionRef: ref<import('ol/interaction/Select').default | null>(null),
    modifyInteractionRef: ref<import('ol/interaction').Interaction | null>(null),
    measureInteractionRef: ref<import('ol/interaction').Interaction | null>(null),
    popupRef: ref<HTMLDivElement | null>(null),
    setDrawMode: () => {},
    setEditMode: () => {},
    setMeasureMode: () => {},
    setMeasureResult: () => {},
    setFeatureCount,
    setSelectedFeature: () => {},
    setFeatureName: () => {},
    pushHistory: () => {},
  }
  return { ctx, setFeatureCount }
}

// Minimal hook harness built on react-dom/client + act — the repo's
// @testing-library/react can't load (missing @testing-library/dom peer dep),
// so we render a null component directly.
function renderHistory(ctx: MapContext) {
  let api: ReturnType<typeof useMapHistory> | null = null
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  function Harness() {
    api = useMapHistory(ctx)
    return null
  }
  act(() => {
    root.render(createElement(Harness))
  })
  return {
    api: () => {
      if (!api) throw new Error('useMapHistory was not rendered')
      return api
    },
    unmount: async () => {
      await act(async () => {
        root.unmount()
      })
      container.remove()
    },
  }
}

describe('useMapHistory', () => {
  it('round-trips push/undo/redo, restoring geometry and properties exactly', async () => {
    const source = new VectorSource()
    const { ctx, setFeatureCount } = makeCtx(source)
    const h = renderHistory(ctx)
    try {
      const a = new Feature({ geometry: new Point([10, 20]) })
      a.set('label', 'A')
      source.addFeature(a)

      act(() => h.api().pushHistory())
      expect(h.api().canUndo).toBe(false) // single snapshot — nothing to undo to yet
      expect(source.getFeatures()).toHaveLength(1)

      source.clear()
      const b = new Feature({ geometry: new Point([30, 40]) })
      b.set('label', 'B')
      source.addFeature(b)
      act(() => h.api().pushHistory())
      expect(h.api().canUndo).toBe(true)
      expect(setFeatureCount).not.toHaveBeenCalled() // pushHistory never touches the count

      await act(async () => {
        await h.api().undo()
      })
      expect(setFeatureCount).toHaveBeenLastCalledWith(1)
      let feats = source.getFeatures()
      expect(feats).toHaveLength(1)
      expect(feats[0].get('label')).toBe('A')
      const geom1 = feats[0].getGeometry()
      expect(geom1?.getType()).toBe('Point')
      expect((geom1 as Point).getCoordinates()).toEqual([10, 20])
      expect(h.api().canRedo).toBe(true)

      await act(async () => {
        await h.api().redo()
      })
      feats = source.getFeatures()
      expect(feats).toHaveLength(1)
      expect(feats[0].get('label')).toBe('B')
      expect((feats[0].getGeometry() as Point).getCoordinates()).toEqual([30, 40])
      expect(h.api().canUndo).toBe(true)
      expect(h.api().canRedo).toBe(false)
    } finally {
      await h.unmount()
    }
  })

  it('restores every supported draw geometry type (Point, LineString, Circle)', async () => {
    const source = new VectorSource()
    const { ctx } = makeCtx(source)
    const h = renderHistory(ctx)
    try {
      const line = new Feature({ geometry: new LineString([[0, 0], [5, 5]]) })
      line.set('label', 'line')
      const circle = new Feature({ geometry: new Circle([50, 60], 12.5) })
      circle.set('label', 'circle')
      source.addFeature(line)
      source.addFeature(circle)
      act(() => h.api().pushHistory())

      source.clear()
      source.addFeature(new Feature({ geometry: new Point([99, 99]) }))
      act(() => h.api().pushHistory())

      await act(async () => {
        await h.api().undo()
      })
      const byLabel = new Map(
        source.getFeatures().map((f) => [f.get('label') as string, f])
      )
      const restoredLine = byLabel.get('line')
      const restoredCircle = byLabel.get('circle')
      expect(restoredLine).toBeDefined()
      expect(restoredCircle).toBeDefined()
      const lineGeom = restoredLine ? (restoredLine.getGeometry() as LineString) : null
      const circleGeom = restoredCircle ? (restoredCircle.getGeometry() as Circle) : null
      expect(lineGeom?.getCoordinates()).toEqual([[0, 0], [5, 5]])
      expect(circleGeom?.getCenter()).toEqual([50, 60])
      expect(circleGeom?.getRadius()).toBeCloseTo(12.5)
    } finally {
      await h.unmount()
    }
  })

  it('no-ops instead of crashing when the draw source is null (the guard)', async () => {
    const source = new VectorSource()
    const { ctx, setFeatureCount } = makeCtx(source)
    const h = renderHistory(ctx)
    try {
      source.addFeature(new Feature({ geometry: new Point([1, 2]) }))
      act(() => h.api().pushHistory())
      source.addFeature(new Feature({ geometry: new Point([3, 4]) }))
      act(() => h.api().pushHistory())
      expect(h.api().canUndo).toBe(true)

      // simulate map teardown — the draw source ref goes null mid-session
      ctx.drawSourceRef.current = null
      setFeatureCount.mockClear()

      // pre-fix, restoreEntry dereferenced ctx.drawSourceRef.current.clear()
      // without a check — all of these must no-op rather than throw
      await act(async () => {
        await expect(h.api().undo()).resolves.toBeUndefined()
      })
      await act(async () => {
        await expect(h.api().redo()).resolves.toBeUndefined()
      })
      act(() => h.api().pushHistory())
      expect(setFeatureCount).not.toHaveBeenCalled()

      // the early-return fires before any mutation — history state is untouched
      expect(h.api().historyRef.current).toHaveLength(2)
      expect(h.api().historyIndexRef.current).toBe(1)
      expect(h.api().canUndo).toBe(true)
      expect(h.api().canRedo).toBe(false)
    } finally {
      await h.unmount()
    }
  })
})
