'use client'

import { useEffect, useState } from 'react'
import { Layers, Eye, EyeOff, Trash2, Edit2, Upload, ChevronUp, ChevronDown } from 'lucide-react'
import { updateLayerStyle, type LayerSummary } from '@/lib/compute/geofusion'

interface LayerManagerProps {
  projectId: string
  layers: LayerSummary[]
  onLayersChange?: (layers: LayerSummary[]) => void
}

export default function LayerManager({ projectId, layers, onLayersChange }: LayerManagerProps) {
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [editingLayer, setEditingLayer] = useState<string | null>(null)
  const [localLayers, setLocalLayers] = useState(layers)

  useEffect(() => {
    setLocalLayers(layers)
  }, [layers])

  const applyLayers = (nextLayers: LayerSummary[]) => {
    setLocalLayers(nextLayers)
    onLayersChange?.(nextLayers)
  }

  const toggleVisibility = async (layerId: string, currentVisibility: boolean) => {
    const nextLayers = localLayers.map(layer =>
      layer.id === layerId ? { ...layer, visibility: !currentVisibility } : layer
    )

    if (projectId === 'default') {
      applyLayers(nextLayers)
      return
    }

    try {
      await updateLayerStyle(layerId, { visibility: !currentVisibility })
      applyLayers(nextLayers)
    } catch (err) {
      console.error('Failed to toggle visibility:', err)
    }
  }

  const handleOpacityChange = async (layerId: string, opacity: number) => {
    const nextLayers = localLayers.map(layer =>
      layer.id === layerId ? { ...layer, opacity } : layer
    )

    if (projectId === 'default') {
      applyLayers(nextLayers)
      return
    }

    try {
      await updateLayerStyle(layerId, { opacity })
      applyLayers(nextLayers)
    } catch (err) {
      console.error('Failed to update opacity:', err)
    }
  }

  const handleMoveLayer = (layerId: string, direction: 'up' | 'down') => {
    const index = localLayers.findIndex(layer => layer.id === layerId)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= localLayers.length) return

    const newLayers = [...localLayers]
    ;[newLayers[index], newLayers[newIndex]] = [newLayers[newIndex], newLayers[index]]
    applyLayers(newLayers)
  }

  const handleDeleteLayer = (layerId: string) => {
    if (!confirm('Are you sure you want to delete this layer?')) return
    applyLayers(localLayers.filter(layer => layer.id !== layerId))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const geojson = JSON.parse(event.target?.result as string)
          const newLayer: LayerSummary = {
            id: `temp-${Date.now()}-${Math.random()}`,
            layer_name: file.name.replace(/\.[^/.]+$/, ''),
            layer_type: 'vector',
            geometry_type: geojson.type === 'FeatureCollection'
              ? 'multi'
              : geojson.type === 'Point'
                ? 'point'
                : geojson.type === 'LineString'
                  ? 'line'
                  : geojson.type === 'Polygon'
                    ? 'polygon'
                    : undefined,
            visibility: true,
            opacity: 1
          }
          applyLayers([...localLayers, newLayer])
        } catch (err) {
          console.error('Invalid GeoJSON:', err)
        } finally {
          setIsUploading(false)
        }
      }
      reader.readAsText(file)
    })
  }

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[var(--accent)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Layer Manager</h3>
        </div>
        <label className="flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black text-sm font-medium rounded-lg cursor-pointer transition-colors">
          <Upload className="h-4 w-4" />
          <span>{isUploading ? 'Uploading...' : 'Add Layer'}</span>
          <input
            type="file"
            accept=".json,.geojson,.gml,.shp,.zip"
            onChange={handleFileUpload}
            multiple
            className="hidden"
          />
        </label>
      </div>

      <div className="space-y-2">
        {localLayers.map((layer, index) => (
          <div
            key={layer.id}
            className={`p-3 rounded-lg border transition-colors ${
              selectedLayer === layer.id
                ? 'bg-[var(--bg-primary)] border-[var(--accent)]'
                : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--text-muted)]'
            }`}
            onClick={() => setSelectedLayer(layer.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleVisibility(layer.id, layer.visibility)
                  }}
                  className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
                >
                  {layer.visibility ? (
                    <Eye className="h-4 w-4 text-[var(--text-secondary)]" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-[var(--text-muted)]" />
                  )}
                </button>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{layer.layer_name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {layer.layer_type}{layer.geometry_type ? ` - ${layer.geometry_type}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveLayer(layer.id, 'up')
                  }}
                  disabled={index === 0}
                  className="p-1 hover:bg-[var(--bg-tertiary)] rounded disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveLayer(layer.id, 'down')
                  }}
                  disabled={index === localLayers.length - 1}
                  className="p-1 hover:bg-[var(--bg-tertiary)] rounded disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingLayer(editingLayer === layer.id ? null : layer.id)
                  }}
                  className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteLayer(layer.id)
                  }}
                  className="p-1 hover:bg-red-500/20 rounded text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {editingLayer === layer.id && (
              <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                  Opacity: {Math.round(layer.opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={layer.opacity * 100}
                  onChange={(e) => handleOpacityChange(layer.id, Number(e.target.value) / 100)}
                  className="w-full"
                />
              </div>
            )}
          </div>
        ))}

        {localLayers.length === 0 && (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No layers added yet</p>
            <p className="text-xs">Upload GeoJSON or other spatial data</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
        <p className="text-xs text-[var(--text-muted)]">
          {localLayers.length} layer(s) - {localLayers.filter(layer => layer.visibility).length} visible
        </p>
      </div>
    </div>
  )
}
