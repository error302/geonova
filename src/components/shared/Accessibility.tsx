'use client'

/**
 * AccessibilityAudit — ARIA labels and keyboard navigation for screen readers
 *
 * This component wraps children and provides:
 * - Skip links to main content
 * - ARIA live regions for dynamic updates
 * - Keyboard focus management
 * - Screen reader announcements
 *
 * Per Kenya Constitution Article 54 — persons with disabilities
 * have the right to access information.
 */

import { useEffect, useRef, ReactNode } from 'react'

interface AccessibilityWrapperProps {
  children: ReactNode
  /** Announcements for screen readers */
  announcements?: string[]
}

export function AccessibilityWrapper({ children, announcements = [] }: AccessibilityWrapperProps) {
  const liveRegionRef = useRef<HTMLDivElement>(null)

  // Announce changes to screen readers
  useEffect(() => {
    if (liveRegionRef.current && announcements.length > 0) {
      liveRegionRef.current.textContent = announcements.join('. ')
    }
  }, [announcements])

  return (
    <>
      {children}
      {/* ARIA live region for screen reader announcements */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  )
}

/**
 * Hook for managing focus trap (for modals, drawers)
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    firstElement?.focus()

    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [isActive])

  return containerRef
}

/**
 * Common ARIA props for interactive elements
 */
export const ARIA_PROPS = {
  // Map controls
  mapContainer: {
    role: 'application',
    'aria-label': 'Survey map — use arrow keys to pan, plus/minus to zoom',
  },
  zoomIn: {
    'aria-label': 'Zoom in',
    'aria-keyshortcuts': '+',
  },
  zoomOut: {
    'aria-label': 'Zoom out',
    'aria-keyshortcuts': '-',
  },
  // Tool dock
  toolDock: {
    role: 'toolbar',
    'aria-label': 'Survey tools',
    'aria-orientation': 'vertical',
  },
  // Fieldbook
  fieldbookTable: {
    role: 'grid',
    'aria-label': 'Field book observations',
  },
  fieldbookRow: {
    role: 'row',
  },
  fieldbookCell: {
    role: 'gridcell',
  },
  // Status
  loading: {
    'aria-live': 'polite',
    'aria-busy': 'true',
  },
  error: {
    role: 'alert',
    'aria-live': 'assertive',
  },
  // Navigation
  nav: {
    role: 'navigation',
    'aria-label': 'Main navigation',
  },
  // Buttons
  closeButton: {
    'aria-label': 'Close',
  },
  menuButton: {
    'aria-label': 'Open menu',
    'aria-expanded': false,
  },
}

/**
 * Announce a message to screen readers
 */
export function announce(message: string) {
  const liveRegion = document.createElement('div')
  liveRegion.setAttribute('aria-live', 'polite')
  liveRegion.setAttribute('aria-atomic', 'true')
  liveRegion.className = 'sr-only'
  liveRegion.textContent = message
  document.body.appendChild(liveRegion)

  setTimeout(() => {
    document.body.removeChild(liveRegion)
  }, 1000)
}
