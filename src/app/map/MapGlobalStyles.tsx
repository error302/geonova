'use client';

import { useEffect } from 'react'

/**
 * Global Styles Injector for the Map page.
 *
 * Injects OpenLayers and custom scrollbar styles via a <style> element.
 * Also includes responsive touch-friendly styles for mobile devices,
 * hardware acceleration hints, and performance-optimized tile rendering.
 */

export default function MapGlobalStyles() {
  useEffect(() => {
    const id = 'metardu-map-global-styles'
    if (document.getElementById(id)) return

    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      /* ── Hide default OL controls (we render our own) ── */
      .ol-mouse-position {
        display: none !important;
      }
      .ol-scale-line {
        display: none !important;
      }

      /* ── Overview map styling ── */
      .ol-overviewmap {
        bottom: 50px !important;
        left: 50% !important;
        right: auto !important;
        transform: translateX(-50%);
        border: 1px solid rgba(209, 123, 71,0.3) !important;
        border-radius: 10px !important;
        overflow: hidden !important;
        background: rgba(13,13,20,0.95) !important;
      }
      .ol-overviewmap .ol-overviewmap-map {
        border: none !important;
      }
      .ol-overviewmap button {
        background: rgba(13,13,20,0.9) !important;
        color: #D17B47 !important;
        border-radius: 6px !important;
      }

      /* ── Zoom slider styling ── */
      .ol-zoomslider {
        background: rgba(13,13,20,0.9) !important;
        border: 1px solid rgba(255,255,255,0.06) !important;
        border-radius: 10px !important;
        left: auto !important;
        right: 8px !important;
        top: 50% !important;
        transform: translateY(-50%);
        height: 120px !important;
      }
      .ol-zoomslider:hover {
        background: rgba(13,13,20,1) !important;
      }
      .ol-zoomslider .ol-zoomslider-thumb {
        background: #D17B47 !important;
        border-radius: 6px !important;
        border: none !important;
      }
      .ol-zoomslider .ol-zoomslider-range {
        background: rgba(209, 123, 71,0.2) !important;
      }

      /* ── Generic OL control buttons ── */
      .ol-control button {
        background: rgba(13,13,20,0.9) !important;
        color: #9ca3af !important;
        border-radius: 8px !important;
        border: 1px solid rgba(255,255,255,0.06) !important;
      }
      .ol-control button:hover {
        background: rgba(13,13,20,1) !important;
        color: #D17B47 !important;
      }

      /* ── Custom scrollbar ── */
      .custom-scrollbar::-webkit-scrollbar {
        width: 3px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.08);
        border-radius: 3px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255,255,255,0.15);
      }

      /* ── Performance: Hardware acceleration for map canvas ── */
      .ol-viewport {
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
        -webkit-perspective: 1000;
        perspective: 1000;
      }

      /* ── Performance: Reduce paint on tile layers ── */
      .ol-layer {
        will-change: transform;
      }

      /* ── Mobile: Larger touch targets for OL controls ── */
      @media (max-width: 768px) {
        .ol-control button {
          min-width: 36px !important;
          min-height: 36px !important;
          font-size: 18px !important;
        }
        .ol-zoomslider {
          display: none !important;
        }
        .ol-overviewmap {
          display: none !important;
        }
      }

      /* ── Mobile: Prevent text selection on map ── */
      .ol-viewport {
        -webkit-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }

      /* ── Mobile: Smoother touch interactions ── */
      .ol-viewport canvas {
        touch-action: none;
      }
      /* FIX (2026-08-30): panning was janky/stuck on mobile because only the
         canvas had touch-action: none — the viewport itself still allowed the
         browser to interpret horizontal drags as scroll gestures. Apply it at
         the viewport level and block overscroll (pull-to-refresh / rubber
         banding) which was also swallowing drag events. */
      .ol-viewport {
        touch-action: none;
        overscroll-behavior: none;
      }

      /* ── Attribution collapse on mobile ── */
      @media (max-width: 640px) {
        .ol-attribution {
          display: none !important;
        }
      }

      /* ── Slide in animation ── */
      @keyframes slideInLeft {
        from {
          opacity: 0;
          transform: translateX(-12px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `
    document.head.appendChild(style)

    return () => {
      document.getElementById(id)?.remove()
    }
  }, [])

  return null
}
