'use client'

/**
 * MapOverlayManager — Anchor-based overlay positioning system
 *
 * PROBLEM
 * -------
 * The previous approach let every floating overlay component set its own
 * `absolute top-X right-Y z-N` pixels. Result: 28 floating elements across
 * 9 z-index bands with no shared logic. Panels overlapped, a compass rendered
 * behind the Layers panel, a print icon floated orphaned, and every "fix"
 * just relocated the collision.
 *
 * SOLUTION
 * --------
 * A single overlay context that manages anchor zones. Every overlay registers
 * { id, anchor, order, priority } and the manager positions it within its zone
 * using MEASURED heights (not assumed fixed heights) so panels of different
 * sizes stack without overlapping.
 *
 * Anchor zones:
 *   top-left      — panel toggle, hamburger
 *   top-right     — zoom controls, projection switcher, rotation, north arrow, layers panel
 *   top-center    — survey workflow badge, project count
 *   bottom-left   — offline tiles, vertex edit toolbar, GPS badge
 *   bottom-right  — print button, stakeout HUD
 *   bottom-center — coordinate status bar (full width)
 *
 * Z-index layers (shared enum — no component sets its own z):
 *   BASE       = 10   — coordinate bar, watermark
 *   CONTROLS   = 20   — zoom, GPS, rotation, offline tiles, vertex toolbar
 *   PANELS     = 30   — layers panel, scheme panel, snapping options
 *   DOCK       = 40   — tool dock (left sidebar)
 *   STAKEOUT   = 50   — stakeout HUD (above panels when active)
 *   MODAL      = 1000 — loading overlay, error overlay, stakeout radar
 *   TOAST      = 1001 — notifications
 *
 * USAGE
 * -----
 * Wrap the map in <MapOverlayProvider> and render <MapOverlayZone> for each
 * anchor. Each overlay uses <MapOverlaySlot> instead of raw absolute positioning:
 *
 *   <MapOverlaySlot id="layers-panel" anchor="top-right" order={5} layer="PANELS">
 *     <SchemeLayerPanel />
 *   </MapOverlaySlot>
 *
 * The slot measures its rendered height with a ref and reports it to the zone.
 * The zone stacks children with a gap, top-down (for top anchors) or
 * bottom-up (for bottom anchors).
 */

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'

// ─── Z-Index Layers (shared enum) ───────────────────────────────────────────

export const OVERLAY_Z = {
  BASE: 10,
  CONTROLS: 20,
  PANELS: 30,
  DOCK: 40,
  STAKEOUT: 50,
  MODAL: 1000,
  TOAST: 1001,
} as const

export type OverlayLayer = keyof typeof OVERLAY_Z

// ─── Anchor Zones ───────────────────────────────────────────────────────────

export type OverlayAnchor =
  | 'top-left'
  | 'top-right'
  | 'top-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center'

// ─── Registration Types ─────────────────────────────────────────────────────

interface OverlayRegistration {
  id: string
  anchor: OverlayAnchor
  order: number // lower = closer to the anchor edge
  layer: OverlayLayer
  height: number // measured height in px (updated by the slot ref)
}

interface OverlayContextValue {
  /** Register an overlay — returns an unregister function */
  register: (reg: Omit<OverlayRegistration, 'height'>) => () => void
  /** Update the measured height of an overlay (called by the slot ref) */
  setHeight: (id: string, height: number) => void
  /** Get all registrations for a given anchor, sorted by order */
  getZone: (anchor: OverlayAnchor) => OverlayRegistration[]
}

const OverlayContext = createContext<OverlayContextValue | null>(null)

// ─── Provider ───────────────────────────────────────────────────────────────

export function MapOverlayProvider({ children }: { children: ReactNode }) {
  const registrations = useRef<Map<string, OverlayRegistration>>(new Map())
  // T1.5i FIX (2026-07-10): Replace forceUpdate({}) with a version counter.
  // The old pattern caused infinite re-renders: ResizeObserver fires →
  // setHeight → forceUpdate → re-render → layout → ResizeObserver fires again.
  // Now: version only increments on register/unregister (mount/unmount), NOT
  // on every height change. Height changes are read directly from the ref
  // during render — no state update needed.
  const [version, setVersion] = useState(0)
  const heightDirtyRef = useRef(false)

  const register = useCallback((reg: Omit<OverlayRegistration, 'height'>) => {
    registrations.current.set(reg.id, { ...reg, height: 0 })
    setVersion(v => v + 1)
    return () => {
      registrations.current.delete(reg.id)
      setVersion(v => v + 1)
    }
  }, [])

  const setHeight = useCallback((id: string, height: number) => {
    const existing = registrations.current.get(id)
    if (existing && existing.height !== height) {
      existing.height = height
      // Mark dirty but don't force re-render immediately.
      // The next render (triggered by other state changes) will pick up
      // the new height from the ref. This breaks the render loop.
      heightDirtyRef.current = true
    }
  }, [])

  const getZone = useCallback((anchor: OverlayAnchor) => {
    return Array.from(registrations.current.values())
      .filter((r) => r.anchor === anchor)
      .sort((a, b) => a.order - b.order)
  }, [])

  // If heights changed but no other state triggered a re-render, schedule
  // a single deferred re-render via requestAnimationFrame. This prevents
  // the infinite loop while still updating positions after resize.
  React.useEffect(() => {
    if (heightDirtyRef.current) {
      heightDirtyRef.current = false
      const raf = requestAnimationFrame(() => setVersion(v => v + 1))
      return () => cancelAnimationFrame(raf)
    }
  }) // runs on every render — checks if heights need propagation

  const value = useMemo(
    () => ({ register, setHeight, getZone }),
    [register, setHeight, getZone],
  )

  // version is read to trigger re-renders; the actual data is in the ref
  void version

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
}

// ─── useOverlay hook ────────────────────────────────────────────────────────

export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext)
  if (!ctx) {
    throw new Error('useOverlay must be used within <MapOverlayProvider>')
  }
  return ctx
}

// ─── MapOverlaySlot — wraps an overlay and positions it in a zone ───────────

interface MapOverlaySlotProps {
  id: string
  anchor: OverlayAnchor
  /** Lower order = closer to the anchor edge. Defaults to the registration order. */
  order: number
  /** Z-index layer from the shared enum */
  layer: OverlayLayer
  /** Gap between this slot and its neighbors in the zone (px). Default 8. */
  gap?: number
  /** Margin from the viewport edge (px). Default 12. */
  edgeMargin?: number
  children: ReactNode
  /** Extra className for the slot wrapper */
  className?: string
}

/**
 * Wraps an overlay component and positions it within its anchor zone.
 * Measures its own height with a ref and reports it to the manager so
 * siblings can stack without overlapping.
 */
export function MapOverlaySlot({
  id,
  anchor,
  order,
  layer,
  gap = 8,
  edgeMargin = 12,
  children,
  className = '',
}: MapOverlaySlotProps) {
  const { register, setHeight, getZone } = useOverlay()
  const ref = useRef<HTMLDivElement>(null)

  // Register on mount, unregister on unmount
  React.useEffect(() => {
    const unregister = register({ id, anchor, order, layer })
    return unregister
  }, [id, anchor, order, layer, register])

  // Measure height and report to the manager
  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const h = el.offsetHeight
      setHeight(id, h)
    }
    measure()

    // Re-measure on resize (panel content may change)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [id, setHeight])

  // Compute the position based on anchor and the measured heights of siblings
  const zoneSiblings = getZone(anchor)
  const myIndex = zoneSiblings.findIndex((r) => r.id === id)
  const zIndex = OVERLAY_Z[layer]

  // Calculate the offset from the anchor edge.
  // For top anchors: stack downward (sum heights of siblings with lower order)
  // For bottom anchors: stack upward (sum heights of siblings with higher order)
  let offset = edgeMargin
  if (anchor.startsWith('top')) {
    for (let i = 0; i < myIndex; i++) {
      offset += zoneSiblings[i].height + gap
    }
  } else if (anchor.startsWith('bottom')) {
    for (let i = myIndex + 1; i < zoneSiblings.length; i++) {
      offset += zoneSiblings[i].height + gap
    }
  }

  // Build the positioning style
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex,
  }

  // Edge margin constants (match the old values for visual continuity)
  const smEdgeMargin = 16 // sm: right-4 / left-4

  if (anchor === 'top-left') {
    positionStyle.top = `${offset}px`
    positionStyle.left = `${edgeMargin}px`
  } else if (anchor === 'top-right') {
    positionStyle.top = `${offset}px`
    positionStyle.right = `${edgeMargin}px`
  } else if (anchor === 'top-center') {
    positionStyle.top = `${offset}px`
    positionStyle.left = '50%'
    positionStyle.transform = 'translateX(-50%)'
  } else if (anchor === 'bottom-left') {
    positionStyle.bottom = `${offset}px`
    positionStyle.left = `${edgeMargin}px`
  } else if (anchor === 'bottom-right') {
    positionStyle.bottom = `${offset}px`
    positionStyle.right = `${edgeMargin}px`
  } else if (anchor === 'bottom-center') {
    positionStyle.bottom = `${offset}px`
    positionStyle.left = `${edgeMargin}px`
    positionStyle.right = `${edgeMargin}px`
  }

  return (
    <div ref={ref} style={positionStyle} className={className}>
      {children}
    </div>
  )
}

// ─── Convenience: MapOverlayZone (renders all slots in a zone) ──────────────
//
// This is optional — components can use MapOverlaySlot directly. But if you
// want to render a whole zone in one place (useful for the bottom-center
// coordinate bar which is a single full-width element), this helps.

export function MapOverlayZone({
  anchor,
  children,
}: {
  anchor: OverlayAnchor
  children: ReactNode
}) {
  // This is just a semantic wrapper — the actual positioning is done by
  // MapOverlaySlot instances. This component exists so the MapClient render
  // tree reads clearly: <MapOverlayZone anchor="top-right">...</MapOverlayZone>
  return <>{children}</>
}
