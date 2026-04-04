'use client'

import { useState } from 'react'
import { Layers, Upload, FileJson, Link, CheckCircle, AlertCircle } from 'lucide-react'
import { integrateLayers, type LayerSummary } from '@/lib/compute/geofusion'

interface DataIntegratorProps {
  projectId: string
  layers: LayerSummary[]
  onIntegrationComplete?: (result: any) => void
}

export default function DataIntegrator({ projectId, layers, onIntegrationComplete }: DataIntegratorProps) {
  const [selectedLayers, setSelectedLayers] = useState<string[]>([])
  const [mergeStrategy, setMergeStrategy] = useState<'overlay' | 'union' | 'intersection'>('union')
  const [isIntegrating, setIsIntegrating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleLayer = (layerId: string) => {
    setSelectedLayers(prev => 
      prev.includes(layerId) 
        ? prev.filter((id: any) => id !== layerId)
        : [...prev, layerId]
    )
  }

  const handleIntegrate = async () => {
    if (selectedLayers.length < 2) {
      setError('Select at least 2 layers to integrate')
      return
    }

    setIsIntegrating(true)
    setError(null)

    try {
      const response = projectId === 'default'
        ? {
            integrated_data: {
              type: 'FeatureCollection',
              features: [],
              merge_strategy: mergeStrategy,
            },
            layer_count: selectedLayers.length,
            features_created: selectedLayers.length,
          }
        : await integrateLayers({
            project_id: projectId,
            layer_ids: selectedLayers,
            merge_strategy: mergeStrategy
          })
      setResult(response)
      onIntegrationComplete?.(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Integration failed')
    } finally {
      setIsIntegrating(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const geojson = JSON.parse(event.target?.result as string)
        setResult({
          integrated_data: geojson,
          layer_count: selectedLayers.length,
          features_created: Array.isArray(geojson?.features) ? geojson.features.length : 0,
        })
      } catch (err) {
        setError('Invalid JSON file')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="h-5 w-5 text-[var(--accent)]" />
        <h3 className="font-semibold text-[var(--text-primary)]">Data Integrator</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Upload Data Source
          </label>
          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors">
              <Upload className="h-4 w-4" />
              <span className="text-sm">Upload File</span>
              <input 
                type="file" 
                accept=".json,.geojson,.gml" 
                onChange={handleFileUpload}
                className="hidden" 
              />
            </label>
            <label className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors">
              <FileJson className="h-4 w-4" />
              <span className="text-sm">Paste GeoJSON</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Select Layers ({selectedLayers.length} selected)
          </label>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {layers.map((layer: any) => (
              <label 
                key={layer.id}
                className="flex items-center gap-2 p-2 rounded hover:bg-[var(--bg-primary)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedLayers.includes(layer.id)}
                  onChange={() => toggleLayer(layer.id)}
                  className="rounded border-[var(--border-color)]"
                />
                <span className="text-sm text-[var(--text-primary)]">{layer.layer_name}</span>
                <span className="text-xs text-[var(--text-muted)]">({layer.layer_type})</span>
              </label>
            ))}
            {layers.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] py-2">No layers available</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Merge Strategy
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['overlay', 'union', 'intersection'] as const).map((strategy: any) => (
              <button
                key={strategy}
                onClick={() => setMergeStrategy(strategy)}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  mergeStrategy === strategy
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                    : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                {strategy.charAt(0).toUpperCase() + strategy.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-500">{error}</span>
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-500">
              Integrated {result.features_created} features from {result.layer_count} layers
            </span>
          </div>
        )}

        <button
          onClick={handleIntegrate}
          disabled={isIntegrating || selectedLayers.length < 2}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
        >
          {isIntegrating ? (
            <span>Integrating...</span>
          ) : (
            <>
              <Link className="h-4 w-4" />
              <span>Integrate Layers</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
