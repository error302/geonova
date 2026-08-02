'use client'

/**
 * MapInteractionToggle — Mobile gesture lock for the OpenLayers map
 *
 * Problem: On mobile, single-finger drag pans the map, which hijacks page scroll.
 * Solution: Require two-finger drag to pan/zoom the map on touch devices.
 *
 * T1.5g FIX (2026-07-10): Migrated from raw absolute positioning to
 * MapOverlaySlot. The gesture-lock button was at 'absolute bottom-20 left-3
 * z-[1000]' which collided with other bottom-left overlays. Now uses
 * bottom-left anchor with order=50 (above other controls).
 */

import { useEffect, useState, useCallback } from 'react'
import { Lock, Unlock, Hand } from 'lucide-react'
import { MapOverlaySlot } from '@/app/map/components/MapOverlayManager'

type LockState = 'locked' | 'unlocked'
const STORAGE_KEY = 'metardu:map-gesture-lock'

export function MapInteractionToggle({ mapInstance }: { mapInstance: React.MutableRefObject<any> }) {
  const [lockState, setLockState] = useState<LockState>('locked')
  const [isMobile, setIsMobile] = useState(false)
  const [showHint, setShowHint] = useState(true)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.matchMedia('(max-width: 1023px)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0
      setIsMobile(mobile)
      if (!mobile) setLockState('unlocked')
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    const saved = localStorage.getItem(STORAGE_KEY) as LockState | null
    if (saved) setLockState(saved)
    const hintTimer = setTimeout(() => setShowHint(false), 5000)
    return () => {
      window.removeEventListener('resize', checkMobile)
      clearTimeout(hintTimer)
    }
  }, [])

  const applyLock = useCallback(async (locked: boolean) => {
    if (!mapInstance.current) return
    try {
      const map = mapInstance.current
      const interactions = map.getInteractions()
      const { default: DragPan } = await import('ol/interaction/DragPan')
      const { platformModifierKeyOnly } = await import('ol/events/condition')
      let dragPan: any = null
      interactions.forEach((interaction: any) => {
        if (interaction instanceof DragPan) dragPan = interaction
      })
      if (!dragPan) return
      if (locked) {
        dragPan.setCondition((event: any) => {
          if (event.originalEvent && event.originalEvent.touches) {
            return event.originalEvent.touches.length >= 2
          }
          if (event.originalEvent && event.originalEvent.ctrlKey) return true
          if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return true
          return false
        })
      } else {
        dragPan.setCondition(platformModifierKeyOnly)
      }
    } catch (err) {
      console.warn('[MapInteractionToggle] Failed to apply lock:', err)
    }
  }, [mapInstance])

  useEffect(() => {
    if (isMobile) applyLock(lockState === 'locked')
  }, [lockState, isMobile, applyLock])

  useEffect(() => {
    if (!isMobile) return
    const interval = setInterval(() => {
      if (mapInstance.current && lockState === 'locked') applyLock(true)
    }, 2000)
    return () => clearInterval(interval)
  }, [isMobile, lockState, mapInstance, applyLock])

  const toggleLock = useCallback(() => {
    setLockState(prev => {
      const next = prev === 'locked' ? 'unlocked' : 'locked'
      localStorage.setItem(STORAGE_KEY, next)
      setShowHint(true)
      setTimeout(() => setShowHint(false), 3000)
      return next
    })
  }, [])

  if (!isMobile) return null

  return (
    <>
      <MapOverlaySlot id="gesture-lock" anchor="bottom-left" order={50} layer="STAKEOUT">
        <button
          onClick={toggleLock}
          className={`flex items-center justify-center w-12 h-12 rounded-xl  border transition-all duration-200 shadow-lg ${
            lockState === 'locked'
              ? 'bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)]'
              : 'bg-[var(--bg-secondary)] border-[var(--border-color)]/[0.06] text-[var(--text-secondary)]'
          }`}
          title={lockState === 'locked' ? 'Map locked — tap to unlock single-finger pan' : 'Map unlocked — tap to lock'}
          aria-label={lockState === 'locked' ? 'Unlock map gestures' : 'Lock map gestures'}
        >
          {lockState === 'locked' ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
        </button>
      </MapOverlaySlot>
      {lockState === 'locked' && showHint && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[999] pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)]  border border-[var(--accent)]/20 shadow-2xl animate-in fade-in duration-300">
            <Hand className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs text-[var(--text-primary)] font-medium">Use two fingers to pan the map</span>
          </div>
        </div>
      )}
    </>
  )
}
