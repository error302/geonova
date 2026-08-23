'use client'

/**
 * HydrationSafeTime — locale/timezone-dependent text that is safe to render
 * during Next.js SSR.
 *
 * Background: any 'use client' component is still server-rendered by Next 14.
 * If it calls `toLocaleTimeString`/`toLocaleDateString` during a render pass,
 * the server (container, usually UTC) and the client (browser, e.g. EAT)
 * emit different strings → React hydration errors #418 / #423 on every row.
 *
 * This helper keeps the friendly locale format but only after mount:
 *   - server pass            → renders a fixed ASCII placeholder
 *   - client hydration pass  → still the placeholder (identical → no mismatch)
 *   - a tick later           → swaps to the real locale string
 */

import { useId } from 'react'
import { useEffect, useState } from 'react'

interface HydrationSafeTimeProps {
  /** Milliseconds since epoch. */
  ms: number
  variant: 'time' | 'date'
}

export function HydrationSafeTime({ ms, variant = 'time' }: HydrationSafeTimeProps) {
  const uid = useId()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Server + first client render share this exact placeholder, so the
  // hydration dataset always matches regardless of timezone.
  if (!mounted) {
    return (
      <span data-hydration-time={uid} className="tabular-nums" aria-hidden="true">
        --:--
      </span>
    )
  }

  const d = new Date(ms)
  const label =
    variant === 'date'
      ? d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })
      : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <span data-hydration-time={uid} className="tabular-nums" aria-label={variant === 'date' ? `date ${label}` : `time ${label}`}>
      {label}
    </span>
  )
}