'use client'

/**
 * MapRail — Phase 2 left icon dock with RADIO tool-switching.
 *
 * One active tool at a time; the active tool's context panel renders in
 * the sidebar slot via renderActivePanel. Replaces scattered floating
 * buttons: every control is a rail item, so overlap becomes impossible
 * by construction.
 *
 * Usage (inside the map container):
 *   <MapRail
 *     items={[
 *       { id: 'layers', icon: Layers, label: 'Layers', panel: <LayersPanel /> },
 *       { id: 'stakeout', icon: Target, label: 'Stakeout', onClick: openRadar },
 *     ]}
 *     activeId={active}
 *     onActivate={setActive}
 *   />
 */
import type { ReactNode, ComponentType } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MapRailItem {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  /** Rendered in the context sidebar when this item is active. */
  panel?: ReactNode
  /** Fire-and-forget action (no panel) — e.g. open radar, print. */
  onClick?: () => void
}

interface MapRailProps {
  items: MapRailItem[]
  activeId: string | null
  onActivate: (id: string | null) => void
  className?: string
}

export default function MapRail({ items, activeId, onActivate, className }: MapRailProps) {
  const active = items.find((i) => i.id === activeId && i.panel)

  return (
    <>
      {/* ── Left icon rail ── */}
      <div
        role="toolbar"
        aria-label="Map tools"
        className={cn(
          'absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1 p-1 rounded-xl',
          'bg-[color-mix(in_srgb,var(--bg-secondary)_75%,transparent)] backdrop-blur-xl',
          'border border-[var(--border-color)]/[0.08] shadow-lg',
          className,
        )}
      >
        {items.map(({ id, label, icon: Icon, onClick }) => {
          const isActive = id === activeId
          return (
            <button
              key={id}
              onClick={() => {
                if (onClick) { onClick(); return }
                onActivate(isActive ? null : id)
              }}
              title={label}
              aria-label={label}
              aria-pressed={isActive}
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
                isActive
                  ? 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-white/5',
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          )
        })}
      </div>

      {/* ── Context sidebar for the active tool ── */}
      {active && (
        <div
          role="complementary"
          aria-label={`${active.label} panel`}
          className="absolute left-16 top-1/2 -translate-y-1/2 z-30 w-72 max-h-[70vh] overflow-y-auto rounded-xl bg-[color-mix(in_srgb,var(--bg-secondary)_85%,transparent)] backdrop-blur-xl border border-[var(--border-color)]/[0.08] shadow-xl"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-color)]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">{active.label}</span>
            <button
              onClick={() => onActivate(null)}
              aria-label={`Close ${active.label} panel`}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3">{active.panel}</div>
        </div>
      )}
    </>
  )
}
