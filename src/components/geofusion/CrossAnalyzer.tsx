'use client'

import { useState } from 'react'
import { GitCompare, Map, Ruler, Activity, Play, AlertCircle, CheckCircle } from 'lucide-react'
import { getCrossAnalysis, type LayerSummary } from '@/lib/compute/geofusion'

interface CrossAnalyzerProps {
  projectId: string
  layers: LayerSummary[]
}

export default function CrossAnalyzer({ projectId, layers }: CrossAnalyzerProps) {
  const [selectedLayers, setSelectedLayers] = useState<string[]>([])
  const [analysisType, setAnalysisType] = useState<'overlay' | 'buffer' | 'distance'>('overlay')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const toggleLayer = (layerId: string) => {
    setSelectedLayers(prev => 
      prev.includes(layerId) 
        ? prev.filter((id: any) => id !== layerId)
        : [...prev, layerId]
    )
  }

  const handleAnalyze = async () => {
    if (selectedLayers.length < 2) {
      setError('Select at least 2 layers for cross analysis')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = projectId === 'default'
        ? {
            results: {
              selected_layers: selectedLayers,
              analysis_type: analysisType,
            },
            summary: {
              layer_count: selectedLayers.length,
              analysis_type: analysisType,
            },
          }
        : await getCrossAnalysis({
            project_id: projectId,
            layer_ids: selectedLayers,
            analysis_type: analysisType
          })
      setResults(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const analysisTypes = [
    { 
      value: 'overlay', 
      label: 'Overlay', 
      icon: Map,
      description: 'Find geometric intersections and unions'
    },
    { 
      value: 'buffer', 
      label: 'Buffer', 
      icon: Ruler,
      description: 'Create zones around features'
    },
    { 
      value: 'distance', 
      label: 'Distance', 
      icon: Activity,
      description: 'Calculate distances between layers'
    }
  ]

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare className="h-5 w-5 text-[var(--accent)]" />
        <h3 className="font-semibold text-[var(--text-primary)]">Cross-Analyzer</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Analysis Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {analysisTypes.map((type: any) => (
              <button
                key={type.value}
                onClick={() => setAnalysisType(type.value as any)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  analysisType === type.value
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                    : 'bg-[var(--bg-primary)] border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <type.icon className="h-5 w-5 mb-1" />
                <p className="font-medium text-sm">{type.label}</p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {analysisTypes.find((t: any) => t.value === analysisType)?.description}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Compare Layers ({selectedLayers.length} selected)
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
            {layers.length < 2 && (
              <p className="text-sm text-[var(--text-muted)] py-2">
                Add at least 2 layers to perform cross analysis
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-500">{error}</span>
          </div>
        )}

        {results && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium text-sm text-green-500">Analysis Complete</span>
            </div>
            <pre className="text-xs text-[var(--text-secondary)] overflow-x-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || selectedLayers.length < 2}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
        >
          {isAnalyzing ? (
            <span>Analyzing...</span>
          ) : (
            <>
              <Play className="h-4 w-4" />
              <span>Run Cross-Analysis</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
