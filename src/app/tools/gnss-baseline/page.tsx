'use client';

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * P2-6 (2026-08-15): The regex-stub GNSS baseline parser that fabricated
 * placeholder results (hardcoded pdop/rms, random processing time) was removed.
 * Real GNSS baseline processing lives at /tools/gnss (geodesic baseline +
 * network adjustment) and /api/gnss/baseline-process (RTKLIB double-difference).
 * Redirect this legacy route to the real tool.
 */
export default function GNSSBaselineRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/tools/gnss')
  }, [router])

  return null
}
