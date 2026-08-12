'use client';

import { useState, useEffect, useCallback } from 'react'

export function AppUpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // Register SW update detection on mount so the banner actually fires
    registerServiceWorkerUpdateDetector()

    const handler = (event: Event) => {
      setWaitingWorker((event as ServiceWorkerEvent).detail)
      setShowBanner(true)
    }

    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  const updateApp = useCallback(() => {
    if (!waitingWorker) return
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })

    // Wait for the new service worker to take control
    waitingWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })

    // Fallback: reload after 2 seconds regardless
    setTimeout(() => window.location.reload(), 2000)
  }, [waitingWorker])

  if (!showBanner) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[210] bg-[var(--accent)] text-black text-center text-sm font-semibold py-2.5 px-4 flex items-center justify-center gap-3">
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
        />
      </svg>
      <span>A new version of METARDU is available</span>
      <button
        onClick={updateApp}
        className="bg-black text-[var(--accent)] px-3 py-1 rounded font-bold text-xs hover:bg-gray-900 transition-colors"
      >
        Update Now
      </button>
      <button
        onClick={() => setShowBanner(false)}
        className="ml-1 hover:bg-black/10 rounded p-0.5 transition-colors"
        aria-label="Dismiss update banner"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

/** Custom event for service worker updates */
interface ServiceWorkerEvent extends Event {
  detail: ServiceWorker
}

// Register SW update detection — call this once from layout or a provider
let swDetectorRegistered = false

export function registerServiceWorkerUpdateDetector() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  if (swDetectorRegistered) return
  swDetectorRegistered = true

  navigator.serviceWorker?.getRegistration().then((registration) => {
    if (!registration) return

    let stateChangeHandler: (() => void) | null = null

    const updatefoundHandler = () => {
      const newWorker = registration.installing
      if (!newWorker) return

      stateChangeHandler = () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          window.dispatchEvent(
            new CustomEvent('sw-update-available', {
              detail: newWorker,
            }) as ServiceWorkerEvent
          )
        }
      }
      newWorker.addEventListener('statechange', stateChangeHandler)
    }

    registration.addEventListener('updatefound', updatefoundHandler)
  })
}
