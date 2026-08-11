'use client';

/**
 * OrthophotoOverlay — renders an orthophoto image as background layer
 * on the topo canvas, under contours and spot heights.
 *
 * The surveyor uploads a GeoTIFF/PNG orthophoto from their drone
 * processing software (Pix4D, DroneDeploy, Agisoft). The image is
 * georeferenced using corner coordinates and rendered as a canvas
 * background layer.
 *
 * The topo canvas then shows:
 *   [orthophoto image] → [contour lines] → [spot heights] → [labels]
 *
 * This gives the surveyor a real-world visual reference for their
 * contour plan — they can see if contours follow the actual terrain.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { logger } from '@/lib/logger'

export interface OrthophotoBounds {
  minEasting: number
  maxEasting: number
  minNorthing: number
  maxNorthing: number
}

interface OrthophotoOverlayProps {
  imageUrl: string | null          // data URL or blob URL
  bounds: OrthophotoBounds | null  // geo bounds of the image
  canvasWidth: number
  canvasHeight: number
  viewBounds: OrthophotoBounds     // current view bounds
  opacity?: number                 // 0-1, default 0.6
}

export function OrthophotoOverlay({
  imageUrl,
  bounds,
  canvasWidth,
  canvasHeight,
  viewBounds,
  opacity = 0.6,
}: OrthophotoOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Load image
  useEffect(() => {
    if (!imageUrl) {
      setImgLoaded(false)
      return
    }

    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
    }
    img.onerror = () => {
      logger.error('[OrthophotoOverlay] Failed to load image')
      setImgLoaded(false)
    }
    img.src = imageUrl
  }, [imageUrl])

  // Render to canvas
  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !bounds || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvasWidth
    canvas.height = canvasHeight

    // Calculate scale: how many pixels per meter
    const viewWidthM = viewBounds.maxEasting - viewBounds.minEasting
    const viewHeightM = viewBounds.maxNorthing - viewBounds.minNorthing
    const scaleX = canvasWidth / viewWidthM
    const scaleY = canvasHeight / viewHeightM

    // Calculate image position on canvas
    const imgMinX = (bounds.minEasting - viewBounds.minEasting) * scaleX
    const imgMaxX = (bounds.maxEasting - viewBounds.minEasting) * scaleX
    // Y is inverted (canvas Y goes down, northing goes up)
    const imgMinY = canvasHeight - (bounds.maxNorthing - viewBounds.minNorthing) * scaleY
    const imgMaxY = canvasHeight - (bounds.minNorthing - viewBounds.minNorthing) * scaleY

    const destX = Math.max(0, imgMinX)
    const destY = Math.max(0, imgMinY)
    const destW = Math.min(canvasWidth, imgMaxX) - destX
    const destH = Math.min(canvasHeight, imgMaxY) - destY

    if (destW <= 0 || destH <= 0) return

    // Source crop (which part of the image is visible)
    const imgW = imgRef.current.width
    const imgH = imgRef.current.height
    const srcMinX = Math.max(0, (viewBounds.minEasting - bounds.minEasting) / (bounds.maxEasting - bounds.minEasting)) * imgW
    const srcMaxX = Math.min(1, (viewBounds.maxEasting - bounds.minEasting) / (bounds.maxEasting - bounds.minEasting)) * imgW
    const srcMinY = Math.max(0, (bounds.maxNorthing - viewBounds.maxNorthing) / (bounds.maxNorthing - bounds.minNorthing)) * imgH
    const srcMaxY = Math.min(1, (bounds.maxNorthing - viewBounds.minNorthing) / (bounds.maxNorthing - bounds.minNorthing)) * imgH

    const srcW = srcMaxX - srcMinX
    const srcH = srcMaxY - srcMinY

    if (srcW <= 0 || srcH <= 0) return

    ctx.globalAlpha = opacity
    ctx.drawImage(imgRef.current, srcMinX, srcMinY, srcW, srcH, destX, destY, destW, destH)
    ctx.globalAlpha = 1
  }, [imgLoaded, bounds, canvasWidth, canvasHeight, viewBounds, opacity])

  if (!imageUrl || !bounds) return null

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  )
}

/**
 * Helper: load a GeoTIFF file and extract bounds + image data.
 * ponytail: uses the browser's built-in Image API for PNG/JPEG.
 * For GeoTIFF, use a library like geotiff.js (not installed yet).
 * For now, the surveyor provides the image + bounds manually.
 */
export async function loadOrthophoto(
  file: File,
  bounds: OrthophotoBounds,
): Promise<{ url: string; bounds: OrthophotoBounds }> {
  const url = URL.createObjectURL(file)
  return { url, bounds }
}
