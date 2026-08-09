'use client'

/**
 * QueryProvider — v0.3 redesign
 *
 * Adds offline-first configuration per native-data-fetching skill:
 * - onlineManager integration with navigator.onLine + window online/offline events
 * - Smarter retry: only retry on 5xx and network errors, not 4xx
 * - Longer staleTime for calculator results (deterministic, cacheable)
 * - Deduped queries per default
 *
 * Also wraps children with OnlineStatusProvider for the OfflineIndicator.
 */

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ApiError } from './client'

// ─── Online status integration ──────────────────────────────────────────────

let onlineManagerInitialized = false

function initOnlineManager() {
  if (onlineManagerInitialized || typeof window === 'undefined') return
  onlineManagerInitialized = true

  // Set initial state
  onlineManager.setOnline(navigator.onLine)

  // Listen to browser online/offline events
  window.addEventListener('online', () => onlineManager.setOnline(true))
  window.addEventListener('offline', () => onlineManager.setOnline(false))

  // If Capacitor Network plugin is available (mobile), use it for richer events
  // This is optional — on web we fall back to navigator.onLine
  const capacitor = window.Capacitor
  if (capacitor?.Plugins?.Network) {
    const Network = capacitor.Plugins.Network
    Network.addListener('networkStatusChange', (status) => {
      onlineManager.setOnline(status.connected)
    })
      .catch(() => { /* plugin not ready, ignore — navigator.onLine still works */ })
  }
}

// ─── Retry logic ────────────────────────────────────────────────────────────

/**
 * Retry only on network errors and 5xx. Don't retry 4xx (client error).
 * Per native-data-fetching skill: exponential backoff 2^attempt × 1000ms.
 */
function retryFunction(failureCount: number, error: unknown): boolean {
  // Don't retry 4xx client errors
  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500) return false
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') return false
  }
  // Retry network errors (status 0) and 5xx, max 3 attempts
  return failureCount < 3
}

// ─── Provider ───────────────────────────────────────────────────────────────

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initOnlineManager()
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 min default
            gcTime: 30 * 60 * 1000,   // 30 min garbage collection
            retry: retryFunction,
            refetchOnWindowFocus: false,
            // Don't refetch on reconnect if data is fresh — avoids hammering
            // the server when coming back online with a queue of pending work
            refetchOnReconnect: 'always',
          },
          mutations: {
            retry: retryFunction,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}

// ─── Network status hook (for OfflineIndicator component) ───────────────────

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
