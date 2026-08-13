/**
 * @module cadastralEditing
 * @description Cadastral parcel editing interactions for the Metardu surveying platform.
 *
 * Provides the core snap → modify → draw interaction chain used by surveyors for
 * boundary digitization and parcel subdivision on OpenLayers maps.
 *
 * Public API:
 *   - {@link createEditingInteractionStack} — full editing interaction stack
 *   - {@link createSubdivisionInteraction} — parcel split-line interaction
 *   - {@link createMeasureWhileDraw}     — real-time distance / bearing annotations
 *   - {@link createHistoryManager}       — standalone undo / redo manager
 *
 * OpenLayers classes are imported as values (for `new`) and types (for annotations)
 * from `ol/*` — the library ships its own `.d.ts` files. Next.js code-splits these
 * automatically. The async function signatures are retained for backward
 * compatibility with callers that `await` the factories.
 */

// ---------------------------------------------------------------------------
// Typed imports — values (for `new`) and types (for annotations)
// ---------------------------------------------------------------------------

import Map from 'ol/Map'
import Feature from 'ol/Feature'
import Polygon from 'ol/geom/Polygon'
import Point from 'ol/geom/Point'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import Snap from 'ol/interaction/Snap'
import Modify from 'ol/interaction/Modify'
import Draw from 'ol/interaction/Draw'
import Select from 'ol/interaction/Select'
import Style from 'ol/style/Style'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Text from 'ol/style/Text'
import { transform } from 'ol/proj'
import { unByKey } from 'ol/Observable'
import proj4 from 'proj4'

import type Geometry from 'ol/geom/Geometry'
import type SimpleGeometry from 'ol/geom/SimpleGeometry'
import type LineString from 'ol/geom/LineString'
import type { FeatureLike } from 'ol/Feature'
import type { EventsKey } from 'ol/events'
import type { ModifyEvent } from 'ol/interaction/Modify'
import type { DrawEvent } from 'ol/interaction/Draw'
import type { GeometryFunction as DrawGeometryFunction } from 'ol/interaction/Draw'
import type { Options as SnapOptions } from 'ol/interaction/Snap'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

/**
 * Minimal source contract used by {@link HistoryManager} — a structural subset
 * of `ol/source/Vector` so that mocks (without every VectorSource method) can
 * satisfy the type in tests.
 */
export interface HistorySource {
  getFeatureById(id: string | number): Feature | null;
  getFeatures(): Feature[];
  addFeature(feature: Feature): void;
  removeFeature(feature: Feature): void;
}

/** Options for {@link createEditingInteractionStack}. */
export interface EditingOptions {
  /** OL VectorSource containing features to edit. */
  source: VectorSource<Feature>;
  /** Additional OL VectorSource to snap to (e.g. existing parcel boundaries). */
  snapSource?: VectorSource<Feature>;
  /** Snap tolerance in pixels (default: 10). */
  snapTolerance?: number;
  /** Constrain new edges to right angles relative to the previous edge (default: true). */
  orthogonalConstraint?: boolean;
  /** Callback fired when a new feature is added to the source. */
  onFeatureAdded?: (feature: Feature) => void;
  /** Callback fired when an existing feature geometry is modified. */
  onFeatureModified?: (feature: Feature) => void;
  /** Callback fired when a feature is deleted (receives the feature id). */
  onFeatureDeleted?: (featureId: string) => void;
}

/** The full editing interaction stack returned by {@link createEditingInteractionStack}. */
export interface InteractionStack {
  /** OL Snap interaction. */
  snap: Snap;
  /** OL Modify interaction. */
  modify: Modify;
  /** OL Draw interaction. */
  draw: Draw;
  /** History manager for undo / redo of all editing operations. */
  history: HistoryManager;
  /** Removes all keyboard listeners and clears history. Does NOT remove interactions from the map. */
  removeAll: () => void;
}

/** Options for {@link createSubdivisionInteraction}. */
export interface SubdivisionOptions {
  /** OL VectorSource containing parcel features. */
  source: VectorSource<Feature>;
  /** The OL Feature (polygon) to subdivide. */
  targetFeature: Feature;
  /** Snap tolerance in pixels (default: 10). */
  snapTolerance?: number;
  /** EPSG code of the source geometry coordinates (default: 'EPSG:3857'). */
  sourceProjection?: string;
  /** Callback with the two resulting polygon features after subdivision. */
  onComplete: (polygonA: Feature, polygonB: Feature) => void;
  /** Callback if subdivision fails (e.g. split line does not cross the parcel). */
  onError?: (error: Error) => void;
}

/** Options for {@link createMeasureWhileDraw}. */
export interface MeasureWhileDrawOptions {
  /** OL Map instance. */
  map: Map;
  /** The OL Draw interaction to monitor. */
  drawInteraction: Draw;
  /** Projection of the source geometry (default: 'EPSG:3857'). */
  projection?: string;
  /** Whether to show per-edge bearing labels (default: true). */
  showBearing?: boolean;
  /** Whether to show cumulative distance (default: true). */
  showCumulativeDistance?: boolean;
  /** Whether to show per-edge distance (default: true). */
  showEdgeDistance?: boolean;
}

/** Handle returned by {@link createMeasureWhileDraw} for cleanup. */
export interface MeasureHandle {
  /** Remove all measurement features, event listeners, and the annotation layer from the map. */
  cleanup: () => void;
  /** The temporary OL VectorLayer containing measurement annotation features. */
  layer: VectorLayer;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of operations retained in the undo / redo history stacks. */
const MAX_HISTORY_DEPTH = 50;

/** Feature id prefix for auto-generated ids. */
const FEAT_ID_PREFIX = 'ce_';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

let _idCounter = 0;

/** Generate a unique feature id. */
function generateFeatureId(): string {
  _idCounter++;
  return `${FEAT_ID_PREFIX}${Date.now()}_${_idCounter}`;
}

/**
 * Calculate planar distance between two coordinates (for projected CRS).
 * @param c1 - First coordinate [x, y].
 * @param c2 - Second coordinate [x, y].
 * @returns Distance in map units (metres for EPSG:21037 / EPSG:3857).
 */
function planarDistance(c1: number[], c2: number[]): number {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate bearing between two points (whole-circle bearing, 0 = North, 90 = East).
 * Works correctly for projected CRS where the Y axis points north.
 * @param from - Start coordinate [x, y].
 * @param to - End coordinate [x, y].
 * @returns Bearing in degrees 0–360.
 */
function calculateBearingDeg(from: number[], to: number[]): number {
  const dE = to[0] - from[0];
  const dN = to[1] - from[1];
  let bearing = (Math.atan2(dE, dN) * 180) / Math.PI;
  if (bearing < 0) bearing += 360;
  return bearing;
}

/**
 * Midpoint of two coordinates.
 * @param c1 - First coordinate.
 * @param c2 - Second coordinate.
 */
function midpoint(c1: number[], c2: number[]): number[] {
  return [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
}

/**
 * Format a distance with appropriate units.
 * @param metres - Distance in metres.
 * @returns Formatted string, e.g. "12.34 m" or "1.234 km".
 */
function formatDistance(metres: number): string {
  if (metres >= 1000) {
    return `${(metres / 1000).toFixed(3)} km`;
  }
  return `${metres.toFixed(2)} m`;
}

/**
 * Format a bearing as a cardinal direction with degrees.
 * @param deg - Whole-circle bearing in degrees (0–360).
 * @returns String like "45.0\u00b0 NE".
 */
function formatBearingCardinal(deg: number): string {
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(deg / 45) % 8;
  return `${deg.toFixed(1)}\u00b0 ${cardinals[idx]}`;
}

/**
 * Calculate cumulative planar distance along a polyline.
 * @param coords - Array of coordinates [[x,y], ...].
 * @returns Total distance in map units.
 */
// ---------------------------------------------------------------------------
// HistoryManager — undo / redo for editing operations
// ---------------------------------------------------------------------------

/** Types of operations that can be recorded. */
type HistoryOpType = 'add' | 'modify' | 'delete';

/**
 * A single recorded history entry — discriminated union so TypeScript can
 * narrow `before` / `after` correctly in {@link HistoryManager.undo} / `redo`.
 */
type HistoryEntry =
  | {
      op: 'add';
      /** Always null for 'add' (nothing existed before). */
      before: null;
      /** Cloned feature to re-add on redo. */
      after: Feature;
      featureId: string | number | undefined;
    }
  | {
      op: 'modify';
      /** Geometry snapshot before the modification (for undo). */
      before: Geometry | null;
      /** Geometry snapshot after the modification (for redo). */
      after: Geometry | null;
      featureId: string | number | undefined;
    }
  | {
      op: 'delete';
      /** Cloned feature to re-add on undo. */
      before: Feature;
      /** Always null for 'delete' (nothing exists after). */
      after: null;
      featureId: string | number | undefined;
    };

/**
 * Undo / redo history manager for OL VectorSource editing operations.
 *
 * Tracks add, modify, and delete operations up to {@link MAX_HISTORY_DEPTH}
 * entries. Call {@link undo} or {@link redo} to revert or replay operations.
 *
 * @example
 * ```ts
 * const history = new HistoryManager(vectorSource);
 *
 * // Record operations as they happen:
 * history.record('add', newFeature);
 * history.record('modify', changedFeature, originalGeometry);
 * history.record('delete', removedFeature);
 *
 * // Undo the last operation:
 * history.undo();
 *
 * // Redo it:
 * history.redo();
 * ```
 */
export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private source: HistorySource;

  /**
   * @param source - The OL VectorSource whose operations are being tracked.
   *                  Accepts a {@link HistorySource} (structural subset of VectorSource,
   *                  so mocks and fakes satisfy the type in tests).
   */
  constructor(source: HistorySource) {
    this.source = source;
  }

  /**
   * Record an operation for later undo / redo.
   *
   * @param op        - Operation type.
   * @param feature   - The OL Feature involved.
   * @param beforeGeo - Geometry snapshot *before* the operation (for 'modify' and 'delete').
   */
  record(op: HistoryOpType, feature: Feature, beforeGeo?: Geometry | null): void {
    const featureId = feature.getId() ?? generateFeatureId();

    if (op === 'add') {
      this.undoStack.push({ op: 'add', before: null, after: feature.clone(), featureId });
    } else if (op === 'modify') {
      const currentGeom = feature.getGeometry();
      this.undoStack.push({
        op: 'modify',
        before: beforeGeo ? beforeGeo.clone() : null,
        after: currentGeom ? currentGeom.clone() : null,
        featureId,
      });
    } else if (op === 'delete') {
      this.undoStack.push({ op: 'delete', before: feature.clone(), after: null, featureId });
    }

    // Enforce max depth — discard oldest entry
    if (this.undoStack.length > MAX_HISTORY_DEPTH) {
      this.undoStack.shift();
    }

    // Any new operation clears the redo branch
    this.redoStack = [];
  }

  /**
   * Undo the most recent operation.
   * @returns `true` if an operation was undone, `false` if nothing to undo.
   */
  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;

    if (entry.op === 'add') {
      // Undo add → remove the feature from the source
      const feature = this.findFeature(entry.featureId);
      if (feature) this.source.removeFeature(feature);
    } else if (entry.op === 'modify') {
      // Undo modify → restore the original geometry
      const feature = this.findFeature(entry.featureId);
      if (feature && entry.before) feature.setGeometry(entry.before);
    } else if (entry.op === 'delete') {
      // Undo delete → re-add the feature
      this.source.addFeature(entry.before);
    }

    this.redoStack.push(entry);
    return true;
  }

  /**
   * Redo the most recently undone operation.
   * @returns `true` if an operation was redone, `false` if nothing to redo.
   */
  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;

    if (entry.op === 'add') {
      // Redo add → re-add the feature
      this.source.addFeature(entry.after);
    } else if (entry.op === 'modify') {
      // Redo modify → restore the modified geometry
      const feature = this.findFeature(entry.featureId);
      if (feature && entry.after) feature.setGeometry(entry.after);
    } else if (entry.op === 'delete') {
      // Redo delete → remove the feature again
      const feature = this.findFeature(entry.featureId);
      if (feature) this.source.removeFeature(feature);
    }

    this.undoStack.push(entry);
    return true;
  }

  /** Whether at least one undo operation is available. */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /** Whether at least one redo operation is available. */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Number of undoable operations. */
  getUndoCount(): number {
    return this.undoStack.length;
  }

  /** Number of redoable operations. */
  getRedoCount(): number {
    return this.redoStack.length;
  }

  /** Clear all history (both undo and redo stacks). */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /** Look up a feature in the source by its id (supports string, number, or undefined). */
  private findFeature(id: string | number | undefined): Feature | null {
    if (id == null) return null;
    const byId = this.source.getFeatureById(id);
    if (byId) return byId;
    const features = this.source.getFeatures();
    for (let i = 0; i < features.length; i++) {
      if (features[i].getId() === id) return features[i];
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Orthogonal constraint — geometryFunction factory for OL Draw (Polygon)
// ---------------------------------------------------------------------------

/**
 * A geometry function that may carry an optional `_cleanupListeners` hook
 * (used to tear down global keyboard listeners attached by the factory).
 */
interface GeomFnWithCleanup {
  (coordinates: number[][], geometry: SimpleGeometry | undefined): SimpleGeometry;
  _cleanupListeners?: () => void;
}

/**
 * Creates an orthogonal geometry function for OL Draw (Polygon type).
 *
 * While the user draws a parcel polygon, each new edge is constrained to be at
 * exactly 90 degrees to the previous edge — the standard cadastral CAD behaviour.
 *
 * The constraint is active when the `enabled()` callback returns `true`.
 * Holding **Shift** temporarily disables the constraint for free-form drawing.
 *
 * The returned geometry function should be passed as the `geometryFunction`
 * option to the `ol/interaction/Draw` constructor.
 *
 * Attach a cleanup call later via the `_cleanupListeners` property on the
 * returned function to remove global keyboard listeners.
 *
 * @param enabled - Callback returning whether the orthogonal constraint is active.
 * @returns A geometry function compatible with OL Draw's `geometryFunction` option.
 */
function createOrthogonalGeometryFunction(
  enabled: () => boolean,
): GeomFnWithCleanup {
  let shiftHeld = false;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Shift') shiftHeld = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') shiftHeld = false;
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  const geomFn = ((coordinates: number[][], geometry: SimpleGeometry | undefined): SimpleGeometry => {
    // The wrapper (see createEditingInteractionStack) always supplies a geometry,
    // but be defensive: OL's DrawEvent calls geometryFunction with `undefined`
    // on the very first invocation of a sketch.
    if (!geometry) {
      // Returning a fresh empty Polygon is safe — the wrapper will overwrite
      // this on the next call. We can't construct one here without a circular
      // import, so fall back to returning the input (defensive no-op).
      throw new Error('createOrthogonalGeometryFunction: geometry must be supplied by the wrapper');
    }

    const constrained = enabled() && !shiftHeld;

    // Need at least 3 coordinates to establish a previous edge: [pN-1, pN, rubberBand]
    if (!constrained || coordinates.length < 3) {
      geometry.setCoordinates([coordinates.slice()] as unknown as number[][][]);
      return geometry;
    }

    // Work on a copy so we don't mutate the input
    const pts = coordinates.map((c) => c.slice());

    // Index of the second-to-last fixed point
    const prevIdx = pts.length - 3;
    const lastFixedIdx = pts.length - 2;
    const prevPt = pts[prevIdx];
    const lastFixed = pts[lastFixedIdx];
    const mousePos = pts[pts.length - 1];

    if (!prevPt || !lastFixed || !mousePos) {
      geometry.setCoordinates([pts] as unknown as number[][][]);
      return geometry;
    }

    // Direction vector of the previous edge: lastFixed - prevPt
    const dx = lastFixed[0] - prevPt[0];
    const dy = lastFixed[1] - prevPt[1];
    const lenSq = dx * dx + dy * dy;

    if (lenSq < 1e-12) {
      // Degenerate previous edge — pass through unconstrained
      geometry.setCoordinates([pts] as unknown as number[][][]);
      return geometry;
    }

    // Vector from lastFixed to mousePos
    const ex = mousePos[0] - lastFixed[0];
    const ey = mousePos[1] - lastFixed[1];

    // Scalar projection onto the previous edge direction
    const dot = (ex * dx + ey * dy) / lenSq;

    // Parallel projection (same direction as previous edge)
    const parX = lastFixed[0] + dot * dx;
    const parY = lastFixed[1] + dot * dy;

    // Perpendicular projection (90 degrees from previous edge)
    const perpX = lastFixed[0] + ex - dot * dx;
    const perpY = lastFixed[1] + ey - dot * dy;

    // Choose the projection closer to the actual mouse position
    const distPar = (mousePos[0] - parX) ** 2 + (mousePos[1] - parY) ** 2;
    const distPerp = (mousePos[0] - perpX) ** 2 + (mousePos[1] - perpY) ** 2;

    const snapped = distPar < distPerp ? [parX, parY] : [perpX, perpY];
    pts[pts.length - 1] = snapped;

    geometry.setCoordinates([pts] as unknown as number[][][]);
    return geometry;
  }) as GeomFnWithCleanup;

  // Expose cleanup so the caller can remove keyboard listeners on teardown
  geomFn._cleanupListeners = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }
  };

  return geomFn;
}

// ---------------------------------------------------------------------------
// createEditingInteractionStack
// ---------------------------------------------------------------------------

/**
 * Creates the full editing interaction stack for cadastral parcel editing.
 *
 * Sets up the snap → modify → draw chain with optional orthogonal constraints,
 * automatic history tracking (undo / redo), keyboard shortcuts, and event
 * callbacks.
 *
 * **Keyboard shortcuts:**
 * - `Delete` / `Backspace` — remove the currently selected feature
 * - `Ctrl+Z` — undo the last operation
 * - `Ctrl+Shift+Z` / `Ctrl+Y` — redo
 * - `Shift` (hold while drawing) — temporarily disable orthogonal constraint
 *
 * @param options - Editing configuration. See {@link EditingOptions}.
 * @returns The interaction stack. Add `snap`, `modify`, and `draw` to the map
 *          via `map.addInteraction()`. Call `removeAll()` on teardown.
 *
 * @example
 * ```ts
 * const stack = await createEditingInteractionStack({
 *   source: parcelSource,
 *   snapSource: existingParcelsSource,
 *   snapTolerance: 15,
 *   orthogonalConstraint: true,
 *   onFeatureAdded: (f) => ),
 * });
 *
 * map.addInteraction(stack.snap);
 * map.addInteraction(stack.modify);
 * map.addInteraction(stack.draw);
 *
 * // Undo the last operation:
 * stack.history.undo();
 *
 * // Cleanup on unmount:
 * stack.removeAll();
 * ```
 */
export async function createEditingInteractionStack(
  options: EditingOptions,
): Promise<InteractionStack> {
  const {
    source,
    snapSource,
    snapTolerance = 10,
    orthogonalConstraint: orthoEnabled = true,
    onFeatureAdded,
    onFeatureModified,
    onFeatureDeleted,
  } = options;

  // ── History ────────────────────────────────────────────────────────────
  const history = new HistoryManager(source);

  // ── Select (required by Modify) ────────────────────────────────────────
  const select = new Select({ hitTolerance: 5 });

  // ── Snap ───────────────────────────────────────────────────────────────
  // OL Snap's option type only declares `source` (singular), but the runtime
  // also accepts a `sources` array. Extend the type locally.
  const snapOptions: SnapOptions & { sources?: VectorSource<Feature>[] } = {
    source,
    pixelTolerance: snapTolerance,
  };
  if (snapSource) {
    snapOptions.sources = [source, snapSource];
  }
  const snap = new Snap(snapOptions);

  // ── Modify ─────────────────────────────────────────────────────────────
  const modify = new Modify({ features: select.getFeatures() });

  // Track original geometries per ModifyEvent using a WeakMap (avoids
  // augmenting the event object with ad-hoc properties).
  const originalGeometriesByEvent = new WeakMap<
    ModifyEvent,
    Array<{ feature: Feature; geometry: Geometry | undefined }>
  >();

  modify.on('modifystart', (event: ModifyEvent) => {
    const features = event.features?.getArray();
    if (!features || features.length === 0) return;
    // Snapshot every feature's geometry before modification
    originalGeometriesByEvent.set(
      event,
      features.map((f) => ({
        feature: f,
        geometry: f.getGeometry()?.clone(),
      })),
    );
  });

  modify.on('modifyend', (event: ModifyEvent) => {
    const originals = originalGeometriesByEvent.get(event) ?? [];
    for (const { feature, geometry } of originals) {
      history.record('modify', feature, geometry);
      if (onFeatureModified) onFeatureModified(feature);
    }
    originalGeometriesByEvent.delete(event);
  });

  // ── Draw with optional orthogonal constraint ───────────────────────────
  const rawGeomFn = createOrthogonalGeometryFunction(() => orthoEnabled);

  // Wrap to lazily create the Polygon the first time OL calls the function.
  // OL's Draw calls geometryFunction with `undefined` on the first invocation
  // (see Draw.js — `this.geometryFunction_(this.sketchCoords_, undefined, projection)`),
  // so we materialise an empty Polygon in that case.
  const wrappedGeomFn: DrawGeometryFunction = (coordinates, geometry) => {
    let geom = geometry;
    if (!geom) {
      geom = new Polygon([]);
    }
    return rawGeomFn(coordinates as number[][], geom);
  };

  const draw = new Draw({
    source,
    type: 'Polygon',
    geometryFunction: wrappedGeomFn,
    snapTolerance: snapTolerance,
  });

  draw.on('drawend', (event: DrawEvent) => {
    const feature = event.feature;
    if (!feature.getId()) {
      feature.setId(generateFeatureId());
    }
    history.record('add', feature);
    if (onFeatureAdded) onFeatureAdded(feature);
  });

  // ── Keyboard shortcuts (Delete, Ctrl+Z, Ctrl+Y) ──────────────────────
  const onKeyDown = (event: KeyboardEvent) => {
    // Delete / Backspace — remove selected features
    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      const selected = select.getFeatures().getArray();
      for (const feature of selected) {
        const fid = feature.getId();
        history.record('delete', feature);
        source.removeFeature(feature);
        select.getFeatures().remove(feature);
        if (onFeatureDeleted && fid != null) onFeatureDeleted(String(fid));
      }
    }

    // Ctrl+Z — undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      history.undo();
    }

    // Ctrl+Shift+Z or Ctrl+Y — redo
    if (
      ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) ||
      ((event.ctrlKey || event.metaKey) && event.key === 'y')
    ) {
      event.preventDefault();
      history.redo();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', onKeyDown);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  const removeAll = () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', onKeyDown);
    }
    const cleanup = rawGeomFn._cleanupListeners;
    if (typeof cleanup === 'function') {
      cleanup();
    }
    history.clear();
  };

  return { snap, modify, draw, history, removeAll };
}

// ---------------------------------------------------------------------------
// createSubdivisionInteraction
// ---------------------------------------------------------------------------

/**
 * Creates a subdivision interaction that lets the surveyor draw a split line
 * across an existing parcel, dividing it into two new parcels.
 *
 * The split line snaps to the parcel edges. On completion, the parcel is split
 * using `@turf/turf`'s `lineSplit` and the two resulting polygon features
 * are delivered via the `onComplete` callback.
 *
 * **Coordinate handling:** Source geometries are transformed to WGS84 for the
 * turf split, then the results are transformed back to the source projection.
 *
 * @param options - Subdivision configuration. See {@link SubdivisionOptions}.
 * @returns An object with the draw and snap interactions plus a cleanup function.
 *
 * @example
 * ```ts
 * const { draw, snap, cleanup } = await createSubdivisionInteraction({
 *   source: parcelSource,
 *   targetFeature: selectedParcel,
 *   sourceProjection: 'EPSG:3857',
 *   onComplete: (polyA, polyB) => {
 *     parcelSource.removeFeature(selectedParcel);
 *     parcelSource.addFeature(polyA);
 *     parcelSource.addFeature(polyB);
 *   },
 * });
 *
 * map.addInteraction(snap);
 * map.addInteraction(draw);
 * ```
 */
export async function createSubdivisionInteraction(
  options: SubdivisionOptions,
): Promise<{
  /** The OL Draw interaction for the split line (LineString type). */
  draw: Draw;
  /** The OL Snap interaction that snaps the split line to parcel edges. */
  snap: Snap;
  /** Remove event listeners and clean up temporary sources. */
  cleanup: () => void;
}> {
  const {
    targetFeature,
    snapTolerance = 10,
    sourceProjection = 'EPSG:3857',
    onComplete,
    onError,
  } = options;

  // ── Lazy-load turf ────────────────────────────────────────────────────
  let turf: typeof import('@turf/turf');
  try {
    turf = await import('@turf/turf');
  } catch {
    throw new Error(
      '[cadastralEditing] @turf/turf is required for parcel subdivision. ' +
        'Install it with: npm install @turf/turf',
    );
  }

  // ── Temporary sources ─────────────────────────────────────────────────
  const splitSource = new VectorSource();
  const targetSource = new VectorSource({ features: [targetFeature] });

  // ── Snap interaction ───────────────────────────────────────────────────
  // OL Snap runtime supports a `sources` array but the v10.8 types only
  // declare `source` (singular). Extend the type locally.
  const snap = new Snap({
    sources: [splitSource, targetSource],
    pixelTolerance: snapTolerance,
  } as SnapOptions & { sources?: VectorSource<Feature>[] });

  // ── Draw interaction (split line) ─────────────────────────────────────
  const draw = new Draw({
    source: splitSource,
    type: 'LineString',
    snapTolerance: snapTolerance,
    minPoints: 2,
  });

  let cleanedUp = false;

  draw.on('drawend', async (event: DrawEvent) => {
    if (cleanedUp) return;

    const splitLineFeature = event.feature;
    const splitLineGeom = splitLineFeature.getGeometry();

    try {
      // ── Validate target geometry ───────────────────────────────────────
      const parcelGeom = targetFeature.getGeometry();
      if (!parcelGeom) {
        throw new Error('Target feature has no geometry.');
      }

      // ── Transform to WGS84 for turf ───────────────────────────────────
      const parcelRings = (parcelGeom as Polygon).getCoordinates();
      const lineCoords = (splitLineGeom as LineString | null)?.getCoordinates() ?? [];

      const parcelRingsWgs84 = parcelRings.map((ring: number[][]) =>
        ring.map((c: number[]) => transform(c, sourceProjection, 'EPSG:4326')),
      );
      const lineCoordsWgs84 = lineCoords.map((c: number[]) =>
        transform(c, sourceProjection, 'EPSG:4326'),
      );

      // ── Build turf geometries ─────────────────────────────────────────
      const parcelGeoJSON = turf.polygon(parcelRingsWgs84);
      const lineGeoJSON = turf.lineString(lineCoordsWgs84);

      // ── Split ─────────────────────────────────────────────────────────
      // NOTE: turf's `lineSplit(line, splitter)` types require the first arg to
      // be a LineString, but the legacy call here passes a polygon first. The
      // types reject this; we cast to preserve the existing runtime behaviour.
      // (Pre-existing shape mismatch that was hidden by `any` — preserved per
      // the type-hygiene migration recipe's "don't fix unrelated bugs" rule.)
      const splitResult = turf.lineSplit(
        parcelGeoJSON as unknown as Parameters<typeof turf.lineSplit>[0],
        lineGeoJSON,
      ) as unknown as { features: Array<{ geometry: { coordinates: number[][][] } }> };

      if (
        !splitResult ||
        !splitResult.features ||
        splitResult.features.length < 2
      ) {
        throw new Error(
          'The split line does not fully cross the parcel. ' +
            'Draw a line from one edge of the parcel to another.',
        );
      }

      if (splitResult.features.length > 2) {
        throw new Error(
          `Split produced ${splitResult.features.length} polygons (expected 2). ` +
            'The split line may cross a parcel vertex — try a different line.',
        );
      }

      // ── Convert results back to source projection ─────────────────────
      const feature0 = splitResult.features[0];
      const feature1 = splitResult.features[1];
      const coordsA = feature0.geometry.coordinates.map(
        (ring: number[][]) =>
          ring.map((c: number[]) => transform(c, 'EPSG:4326', sourceProjection)),
      );
      const coordsB = feature1.geometry.coordinates.map(
        (ring: number[][]) =>
          ring.map((c: number[]) => transform(c, 'EPSG:4326', sourceProjection)),
      );

      const polyA = new Feature({ geometry: new Polygon(coordsA) });
      polyA.setId(generateFeatureId());

      const polyB = new Feature({ geometry: new Polygon(coordsB) });
      polyB.setId(generateFeatureId());

      // ── Propagate properties from the original parcel ─────────────────
      const props = { ...targetFeature.getProperties() };
      delete props.geometry;
      const parentId = targetFeature.getId();
      polyA.setProperties({ ...props, subdivided_from: parentId });
      polyB.setProperties({ ...props, subdivided_from: parentId });

      // Copy the original feature's style if present
      const origStyle = targetFeature.getStyle();
      if (origStyle) {
        polyA.setStyle(origStyle);
        polyB.setStyle(origStyle);
      }

      onComplete(polyA, polyB);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (onError) {
        onError(error);
      } else {
        logger.error('[cadastralEditing] Subdivision failed:', { error: error.message });
      }
    } finally {
      splitSource.clear();
      cleanup();
    }
  });

  const cleanup = () => {
    cleanedUp = true;
    splitSource.clear();
  };

  return { draw, snap, cleanup };
}

// ---------------------------------------------------------------------------
// createMeasureWhileDraw
// ---------------------------------------------------------------------------

/**
 * Displays real-time distance and bearing annotations while the user draws.
 *
 * As the surveyor clicks vertices during an OL Draw interaction, this module
 * renders measurement labels on a temporary overlay layer:
 * - **Per-edge distance** (e.g. "23.45 m") at the midpoint of each edge
 * - **Per-edge bearing** (e.g. "90.0° E") alongside the distance
 * - **Cumulative distance** (e.g. "Total: 67.89 m") at the cursor
 *
 * All measurements use planar distance (accurate for projected CRS such as
 * EPSG:21037 / EPSG:3857). For geographic CRS (EPSG:4326), proj4 is used to
 * project to Kenya UTM 36M before computing distances.
 *
 * @param options - Measurement configuration. See {@link MeasureWhileDrawOptions}.
 * @returns A handle with a `cleanup` function and a reference to the annotation layer.
 *
 * @example
 * ```ts
 * const measure = await createMeasureWhileDraw({
 *   map,
 *   drawInteraction: stack.draw,
 *   projection: 'EPSG:3857',
 * });
 *
 * // When done (e.g. on unmount):
 * measure.cleanup();
 * ```
 */
export async function createMeasureWhileDraw(
  options: MeasureWhileDrawOptions,
): Promise<MeasureHandle> {
  const {
    map,
    drawInteraction,
    projection = 'EPSG:3857',
    showBearing = true,
    showCumulativeDistance = true,
    showEdgeDistance = true,
  } = options;

  // ── Optional proj4 for geographic CRS ─────────────────────────────────
  let toMetric: ((coord: number[]) => number[]) | null = null;

  if (projection === 'EPSG:4326') {
    // proj4 is a hard dependency (declared in package.json). Use it directly
    // to convert WGS84 coordinates to Kenya UTM Zone 36M for metric distance.
    // Default to Kenya UTM Zone 36M for metric conversion
    const utm36m =
      '+proj=utm +zone=36 +south +ellps=WGS84 +datum=WGS84 +units=m +no_defs';
    toMetric = (coord: number[]) => proj4('EPSG:4326', utm36m, coord);
  }

  /**
   * Compute distance between two coordinates, projecting to metric if needed.
   */
  const measureDistance = (c1: number[], c2: number[]): number => {
    if (toMetric) {
      return planarDistance(toMetric(c1), toMetric(c2));
    }
    return planarDistance(c1, c2);
  };

  // ── Annotation layer ──────────────────────────────────────────────────
  const measureSource = new VectorSource();

  const measureLayer = new VectorLayer({
    source: measureSource,
    style: (feature: FeatureLike) => {
      const label = (feature.get('measureLabel') as string) ?? '';
      return new Style({
        text: new Text({
          font: '11px monospace',
          fill: new Fill({ color: '#1a237e' }),
          stroke: new Stroke({ color: '#ffffff', width: 3 }),
          text: label,
          offsetY: -14,
          placement: 'point',
        }),
      });
    },
    zIndex: 100,
  });

  map.addLayer(measureLayer);

  // ── State ─────────────────────────────────────────────────────────────
  let active = false;
  let sketchFeature: Feature | null = null;
  let annotationFeatures: Feature[] = [];
  let geometryChangeKey: EventsKey | null = null;

  /**
   * Remove all annotation features from the measure source.
   */
  function clearAnnotations(): void {
    for (const f of annotationFeatures) {
      measureSource.removeFeature(f);
    }
    annotationFeatures = [];
  }

  /**
   * (Re)build annotation features from the current sketch coordinates.
   */
  function updateAnnotations(coords: number[][]): void {
    clearAnnotations();

    if (coords.length < 2) return;

    let cumulative = 0;

    for (let i = 1; i < coords.length; i++) {
      const from = coords[i - 1];
      const to = coords[i];
      const edgeDist = measureDistance(from, to);
      cumulative += edgeDist;

      const mid = midpoint(from, to);
      const bear = calculateBearingDeg(from, to);

      // Build label text
      const parts: string[] = [];
      if (showEdgeDistance) parts.push(formatDistance(edgeDist));
      if (showBearing) parts.push(formatBearingCardinal(bear));

      const feature = new Feature({ geometry: new Point(mid) });
      feature.set('measureLabel', parts.join('  '));
      feature.set('measureType', 'edge');
      measureSource.addFeature(feature);
      annotationFeatures.push(feature);
    }

    // Cumulative label at the last vertex
    if (showCumulativeDistance && coords.length > 2) {
      const lastCoord = coords[coords.length - 1];
      const totalFeature = new Feature({ geometry: new Point(lastCoord) });
      totalFeature.set('measureLabel', `\u03A3 ${formatDistance(cumulative)}`);
      totalFeature.set('measureType', 'cumulative');
      measureSource.addFeature(totalFeature);
      annotationFeatures.push(totalFeature);
    }
  }

  /**
   * Extract the current sketch ring coordinates from the sketch feature geometry.
   */
  function readSketchCoords(): number[][] | null {
    if (!sketchFeature) return null;
    const geom = sketchFeature.getGeometry();
    if (!geom) return null;

    const type = geom.getType();
    if (type === 'Polygon') {
      const rings = (geom as Polygon).getCoordinates();
      return rings.length > 0 ? rings[0] : null;
    }
    if (type === 'LineString') {
      return (geom as LineString).getCoordinates();
    }
    return null;
  }

  // ── Event handlers ────────────────────────────────────────────────────

  function onDrawStart(event: DrawEvent): void {
    active = true;
    sketchFeature = event.feature;

    // Listen for geometry changes on the sketch feature
    const geom = sketchFeature.getGeometry();
    if (geom) {
      geometryChangeKey = geom.on('change', () => {
        if (!active) return;
        const coords = readSketchCoords();
        if (coords) updateAnnotations(coords);
      }) as EventsKey;
    }

    clearAnnotations();
  }

  function onDrawEnd(): void {
    // Keep annotations visible after draw ends — caller decides when to cleanup
    detachSketchListener();
  }

  function onDrawAbort(): void {
    active = false;
    clearAnnotations();
    detachSketchListener();
  }

  function detachSketchListener(): void {
    if (geometryChangeKey) {
      // unByKey is the correct OL API for removing a listener by its EventsKey
      // (returned from `geom.on(...)`). The previous code passed the key to
      // `geom.un('change', key)` which is a type error and a no-op at runtime.
      unByKey(geometryChangeKey);
    }
    geometryChangeKey = null;
    sketchFeature = null;
    active = false;
  }

  // ── Attach listeners ──────────────────────────────────────────────────
  drawInteraction.on('drawstart', onDrawStart);
  drawInteraction.on('drawend', onDrawEnd);
  drawInteraction.on('drawabort', onDrawAbort);

  // ── Cleanup ───────────────────────────────────────────────────────────

  function cleanup(): void {
    detachSketchListener();
    drawInteraction.un('drawstart', onDrawStart);
    drawInteraction.un('drawend', onDrawEnd);
    drawInteraction.un('drawabort', onDrawAbort);
    clearAnnotations();
    map.removeLayer(measureLayer);
  }

  return { cleanup, layer: measureLayer };
}

// ---------------------------------------------------------------------------
// createHistoryManager — standalone factory
// ---------------------------------------------------------------------------

/**
 * Creates a standalone HistoryManager for a given OL VectorSource.
 *
 * Use this when you need undo / redo support without the full editing
 * interaction stack (e.g. for programmatic feature manipulation).
 *
 * @param source - The OL VectorSource whose operations will be tracked.
 * @returns A new HistoryManager instance.
 *
 * @example
 * ```ts
 * const history = await createHistoryManager(parcelSource);
 *
 * // Manually record a feature addition:
 * parcelSource.addFeature(newParcel);
 * history.record('add', newParcel);
 *
 * // Undo:
 * history.undo();
 * ```
 */
export async function createHistoryManager(
  source: HistorySource,
): Promise<HistoryManager> {
  return new HistoryManager(source);
}
