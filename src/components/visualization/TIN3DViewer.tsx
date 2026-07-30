'use client';

/**
 * TIN3DViewer — 3D terrain visualization using Three.js
 *
 * AUDIT FIX (2026-07-03): The main map is 2D (OpenLayers). This component
 * adds a 3D perspective for TIN surfaces and point clouds — critical for
 * engineering and drone surveys where the surveyor needs to see terrain
 * shape, not just planimetric position.
 *
 * Features:
 *   - Renders a TIN surface as a 3D wireframe + filled mesh
 *   - Orbit controls (rotate, zoom, pan)
 *   - Color-coded elevation (blue=low → red=high)
 *   - Grid helper for scale reference
 *   - Auto-fit camera to data bounds
 *
 * Dependencies: three (already in package.json)
 *
 * Usage:
 *   <TIN3DViewer surface={tinSurface} />
 *   <TIN3DViewer points={spotHeights} />
 */

import { useEffect, useRef } from 'react'
import type * as THREE from 'three'
import type { TINSurface, SpotHeight } from '@/lib/engine/contours'

interface TIN3DViewerProps {
  surface?: TINSurface | null
  points?: SpotHeight[]
  width?: number
  height?: number
}

export function TIN3DViewer({ surface, points, width = 800, height = 500 }: TIN3DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || (!surface && !points)) return

    let cleanup = () => {}

    // Dynamic import Three.js (keeps the main bundle smaller)
    import('three').then((THREE) => {
      import('three/examples/jsm/controls/OrbitControls.js').then(({ OrbitControls }) => {
        const container = containerRef.current
        if (!container) return

        // ─── Scene setup ──────────────────────────────────────────────────
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0a0e14)

        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100000)
        camera.position.set(100, 100, 100)

        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(window.devicePixelRatio)
        container.innerHTML = ''
        container.appendChild(renderer.domElement)

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.1

        // ─── Compute bounds ────────────────────────────────────────────────
        const pts = surface?.points || points || []
        if (pts.length === 0) return

        const minE = Math.min(...pts.map(p => p.easting))
        const maxE = Math.max(...pts.map(p => p.easting))
        const minN = Math.min(...pts.map(p => p.northing))
        const maxN = Math.max(...pts.map(p => p.northing))
        const minZ = Math.min(...pts.map(p => p.elevation || 0))
        const maxZ = Math.max(...pts.map(p => p.elevation || 0))
        const centerE = (minE + maxE) / 2
        const centerN = (minN + maxN) / 2
        const centerZ = (minZ + maxZ) / 2
        const rangeE = maxE - minE || 1
        const rangeN = maxN - minN || 1
        const rangeZ = maxZ - minZ || 1
        const maxRange = Math.max(rangeE, rangeN)

        // ─── Color function (blue→green→yellow→red by elevation) ──────────
        const colorForElevation = (z: number): THREE.Color => {
          const t = (z - minZ) / (maxZ - minZ || 1)
          const hue = (1 - t) * 0.67  // 0.67=blue → 0=red
          return new THREE.Color().setHSL(hue, 0.8, 0.5)
        }

        // ─── Render TIN surface as mesh ────────────────────────────────────
        let geometry: any
        if (surface && surface.triangles.length > 0) {
          geometry = new THREE.BufferGeometry()
          const vertices: number[] = []
          const colors: number[] = []

          for (const tri of surface.triangles) {
            for (const p of [tri.p1, tri.p2, tri.p3]) {
              vertices.push(
                p.easting - centerE,
                p.elevation - centerZ,
                p.northing - centerN,
              )
              const c = colorForElevation(p.elevation || 0)
              colors.push(c.r, c.g, c.b)
            }
          }

          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
          geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
          geometry.computeVertexNormals()

          const material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7,
          })
          scene.add(new THREE.Mesh(geometry, material))

          // Wireframe overlay
          const wireframe = new THREE.LineSegments(
            new THREE.WireframeGeometry(geometry),
            new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 1 })
          )
          scene.add(wireframe)
        }

        // ─── Render points (if no TIN, or as overlay) ─────────────────────
        if (points && points.length > 0 && !surface) {
          const pointGeom = new THREE.BufferGeometry()
          const pointVerts: number[] = []
          const pointColors: number[] = []

          for (const p of points) {
            pointVerts.push(p.easting - centerE, (p.elevation || 0) - centerZ, p.northing - centerN)
            const c = colorForElevation(p.elevation || 0)
            pointColors.push(c.r, c.g, c.b)
          }

          pointGeom.setAttribute('position', new THREE.Float32BufferAttribute(pointVerts, 3))
          pointGeom.setAttribute('color', new THREE.Float32BufferAttribute(pointColors, 3))

          scene.add(new THREE.Points(pointGeom, new THREE.PointsMaterial({
            size: maxRange * 0.003,
            vertexColors: true,
            sizeAttenuation: true,
          })))
        }

        // ─── Grid helper ───────────────────────────────────────────────────
        const gridSize = Math.ceil(maxRange * 1.2)
        const grid = new THREE.GridHelper(gridSize, 10, 0x444444, 0x222222)
        grid.rotation.x = Math.PI / 2
        scene.add(grid)

        // ─── Camera position (auto-fit) ────────────────────────────────────
        const dist = maxRange * 1.5
        camera.position.set(dist, dist * 0.7, dist)
        camera.lookAt(0, 0, 0)
        controls.target.set(0, 0, 0)
        controls.update()

        // ─── Animate ───────────────────────────────────────────────────────
        let frameId = 0
        const animate = () => {
          frameId = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        // ─── Cleanup ───────────────────────────────────────────────────────
        cleanup = () => {
          cancelAnimationFrame(frameId)
          controls.dispose()
          renderer.dispose()
          geometry?.dispose?.()
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
          }
        }
      })
    }).catch(() => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '<div class="p-8 text-center text-zinc-500 text-sm">3D viewer requires Three.js. Run <code class="bg-zinc-800 px-1 rounded">npm install</code> to install dependencies.</div>'
      }
    })

    return () => cleanup()
  }, [surface, points, width, height])

  return (
    <div className="relative">
      <div ref={containerRef} className="rounded-lg overflow-hidden border border-[var(--border-color)]" style={{ width, height }} />
      <div className="absolute bottom-2 left-2 text-[10px] text-zinc-500 bg-black/50 px-2 py-1 rounded">
        Drag: rotate · Scroll: zoom · Right-drag: pan
      </div>
    </div>
  )
}
