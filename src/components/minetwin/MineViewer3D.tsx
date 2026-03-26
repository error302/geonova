'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface MineViewer3DProps {
  mesh: { vertices: number[]; faces: number[] }
  riskZones?: any[]
}

export default function MineViewer3D({ mesh }: MineViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!containerRef.current || !mesh.vertices.length) return
    
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    
    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000)
    camera.position.set(50, 50, 50)
    camera.lookAt(0, 0, 0)
    
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.appendChild(renderer.domElement)
    
    if (mesh.vertices.length >= 9) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3))
      
      if (mesh.faces.length >= 3) {
        geometry.setIndex(mesh.faces)
        geometry.computeVertexNormals()
      }
      
      const material = new THREE.MeshPhongMaterial({ 
        color: 0x4a90e2, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      })
      
      const meshObj = new THREE.Mesh(geometry, material)
      scene.add(meshObj)
    }
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(10, 10, 10)
    scene.add(directionalLight)
    
    const gridHelper = new THREE.GridHelper(100, 20, 0x444444, 0x222222)
    scene.add(gridHelper)
    
    const animate = () => {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()
    
    return () => {
      renderer.dispose()
    }
  }, [mesh])
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">3D Digital Twin</h3>
      <div ref={containerRef} className="h-96 rounded-lg overflow-hidden" />
    </div>
  )
}
