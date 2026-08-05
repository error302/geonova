'use client'

/**
 * LoadingScreen — Branded full-screen loading for METARDU
 *
 * Features densely compact black and orange topographic contour lines
 * matching the METARDU brand theme.
 */

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

interface LoadingScreenProps {
  /** Show the loading screen */
  visible?: boolean
  /** Progress 0-100 (null = indeterminate) */
  progress?: number | null
  /** Status message */
  message?: string
  /** Sub-message (smaller text) */
  subMessage?: string
  /** Auto-dismiss after this many ms (0 = manual) */
  autoDismiss?: number
  /** Called when dismissed */
  onDismiss?: () => void
  /** Called when loading complete animation finishes */
  onComplete?: () => void
}

export function LoadingScreen({
  visible = true,
  progress = null,
  message = 'Loading METARDU workspace...',
  subMessage,
  autoDismiss = 0,
  onDismiss,
  onComplete,
}: LoadingScreenProps) {
  const [internalVisible, setInternalVisible] = useState(visible)

  useEffect(() => {
    setInternalVisible(visible)
  }, [visible])

  useEffect(() => {
    if (autoDismiss > 0 && visible) {
      const timer = setTimeout(() => {
        setInternalVisible(false)
        onDismiss?.()
        onComplete?.()
      }, autoDismiss)
      return () => clearTimeout(timer)
    }
  }, [autoDismiss, visible, onDismiss, onComplete])

  if (!internalVisible) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050b14] flex items-center justify-center overflow-hidden animate-in fade-in duration-300">
      {/* ── Topo Background Image ── */}
      <div className="absolute inset-0 bg-[url('/landing/hero-topo.webp')] bg-cover bg-center filter brightness-[0.22] contrast-[1.4] hue-rotate-[-10deg] opacity-90" aria-hidden />

      {/* ── Densely Compact Orange Contour Lines Overlay (SVG) ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-90" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g stroke="rgba(209, 123, 71, 0.28)" strokeWidth="1.2" fill="none">
          {/* Dense concentric undulating topographic contours */}
          {Array.from({ length: 28 }).map((_, i) => {
            const r = 40 + i * 28
            const d = `M ${500 - r} 500 
                       C ${500 - r * 0.8} ${500 - r * 0.9}, ${500 + r * 0.3} ${500 - r * 1.1}, ${500 + r} 500 
                       C ${500 + r * 1.1} ${500 + r * 0.8}, ${500 - r * 0.4} ${500 + r * 1.2}, ${500 - r} 500 Z`
            return (
              <path
                key={i}
                d={d}
                style={{
                  stroke: i % 4 === 0 ? 'rgba(255, 120, 30, 0.45)' : 'rgba(209, 123, 71, 0.22)',
                  strokeWidth: i % 4 === 0 ? '1.8' : '1.1',
                }}
              />
            )
          })}
          {/* Second offset topographic elevation cluster */}
          {Array.from({ length: 20 }).map((_, i) => {
            const r = 30 + i * 32
            const cx = 820
            const cy = 250
            const d = `M ${cx - r} ${cy} 
                       C ${cx - r * 0.85} ${cy - r * 0.95}, ${cx + r * 0.4} ${cy - r * 1.05}, ${cx + r} ${cy} Z`
            return (
              <path
                key={`sec-${i}`}
                d={d}
                style={{
                  stroke: i % 3 === 0 ? 'rgba(209, 123, 71, 0.35)' : 'rgba(209, 123, 71, 0.18)',
                  strokeWidth: '1.2',
                }}
              />
            )
          })}
        </g>
      </svg>

      {/* ── Dark Radial Vignette ── */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(5,11,20,0.65)_0%,_rgba(5,11,20,0.95)_85%,_#050b14_100%)] pointer-events-none" aria-hidden />

      {/* ── Center Content ── */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Logo with Orange Contour Glow */}
        <div className="relative p-1 rounded-2xl bg-gradient-to-br from-[#D17B47] via-[#FF8C00] to-[#B85C24] shadow-[0_0_40px_8px_rgba(209,123,71,0.45)]">
          <Image
            src="/metardu-icon.png"
            alt="METARDU"
            width={60}
            height={60}
            className="rounded-xl bg-[#050b14] block"
            priority
          />
        </div>

        {/* Brand name */}
        <div className="text-center">
          <span className="font-mono text-xs tracking-[0.38em] font-bold text-[#D17B47] uppercase block">
            METARDU
          </span>
          <p className="text-[9px] text-gray-400 uppercase tracking-[0.25em] mt-0.5">
            Survey Engine
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-56 mt-2">
          {progress !== null ? (
            <div className="space-y-2">
              <div className="h-1 bg-[#D17B47]/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#D17B47] to-[#FF8C00] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>{message}</span>
                <span className="font-mono">{Math.round(progress)}%</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="h-1 bg-[#D17B47]/15 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-gradient-to-r from-[#D17B47] to-[#FF8C00] rounded-full animate-[progress-slide_1.4s_ease-in-out_infinite]" />
              </div>
              <div className="text-center text-[10px] text-gray-400 font-mono tracking-wider">{message}</div>
            </div>
          )}
        </div>

        {subMessage && (
          <p className="text-[9px] text-gray-500 max-w-xs text-center">
            {subMessage}
          </p>
        )}
      </div>

      <style jsx>{`
        @keyframes progress-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  )
}

/**
 * ProgressBar — Inline progress bar component
 */
export function ProgressBar({
  progress,
  message,
  variant = 'default',
}: {
  progress: number
  message?: string
  variant?: 'default' | 'success' | 'warning' | 'error'
}) {
  const colors = {
    default: 'from-[#D17B47] to-[#FFB84D]',
    success: 'from-emerald-500 to-emerald-400',
    warning: 'from-amber-500 to-amber-400',
    error: 'from-red-500 to-red-400',
  }

  return (
    <div className="space-y-1">
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colors[variant]} rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {message && (
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>{message}</span>
          <span className="font-mono">{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  )
}

/**
 * Spinner — Small inline spinner
 */
export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.2"
      />
      <path
        d="M 12 2 A 10 10 0 0 1 22 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * useLoading hook — Manage loading state
 */
export function useLoading() {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState('')

  const start = useCallback((msg?: string) => {
    setIsLoading(true)
    setProgress(null)
    setMessage(msg || 'Loading...')
  }, [])

  const update = useCallback((progress: number, msg?: string) => {
    setProgress(progress)
    if (msg) setMessage(msg)
  }, [])

  const done = useCallback(() => {
    setProgress(100)
    setTimeout(() => {
      setIsLoading(false)
      setProgress(null)
    }, 300)
  }, [])

  return { isLoading, progress, message, start, update, done }
}
