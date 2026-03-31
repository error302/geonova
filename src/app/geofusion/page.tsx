'use client'

import { useState } from 'react'
import { Layers, GitMerge, Map, Settings, Plus, ChevronRight } from 'lucide-react'
import dynamic from 'next/dynamic'

const DataIntegrator = dynamic(
  () => import('@/components/geofusion/DataIntegrator'),
  { ssr: false, loading: () => <div className="animate-pulse bg-[var(--bg-secondary)] rounded-lg h-64" /> }
)

const LayerManager = dynamic(
  () => import('@/components/geofusion/LayerManager'),
  { ssr: false, loading: () => <div className="animate-pulse bg-[var(--bg-secondary)] rounded-lg h-64" /> }
)

const CrossAnalyzer = dynamic(
  () => import('@/components/geofusion/CrossAnalyzer'),
  { ssr: false, loading: () => <div className="animate-pulse bg-[var(--bg-secondary)] rounded-lg h-64" /> }
)

interface LayerSummary {
  id: string
  layer_name: string
  layer_type: string
  geometry_type?: string
  visibility: boolean
  opacity: number
}

const DEMO_LAYERS: LayerSummary[] = [
  { id: '1', layer_name: 'Survey Points', layer_type: 'vector', geometry_type: 'point', visibility: true, opacity: 1 },
  { id: '2', layer_name: 'Cadastral Boundaries', layer_type: 'vector', geometry_type: 'polygon', visibility: true, opacity: 0.8 },
  { id: '3', layer_name: 'Topographic Contours', layer_type: 'raster', geometry_type: 'line', visibility: true, opacity: 0.7 },
  { id: '4', layer_name: 'Infrastructure Lines', layer_type: 'vector', geometry_type: 'line', visibility: false, opacity: 1 },
]

export default function GeoFusionHubPage() {
  const [activeTab, setActiveTab] = useState<'integrate' | 'layers' | 'analyze'>('integrate')
  const [layers, setLayers] = useState<LayerSummary[]>(DEMO_LAYERS)

  const tabs = [
    { id: 'integrate', label: 'Data Integrator', icon: GitMerge },
    { id: 'layers', label: 'Layer Manager', icon: Layers },
    { id: 'analyze', label: 'Cross-Analyzer', icon: Map },
  ]

  const handleIntegrationComplete = (result: any) => {
    setLayers(prev => [
      ...prev,
      {
        id: `integration-${Date.now()}`,
        layer_name: `Integrated ${result.layer_count} layers`,
        layer_type: 'vector',
        geometry_type: 'multi',
        visibility: true,
        opacity: 0.9,
      },
    ])
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-1">
                <span>Tools</span>
                <ChevronRight className="h-4 w-4" />
                <span>GeoFusion Hub</span>
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">GeoFusion Hub</h1>
              <p className="text-sm text-[var(--text-muted)]">Align, integrate, and analyze spatial data from multiple sources</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg transition-colors">
              <Plus className="h-4 w-4" />
              New Project
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <div className="w-64 shrink-0">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Project Settings
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Source CRS</label>
                  <select className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm">
                    <option value="4326">WGS84 (EPSG:4326)</option>
                    <option value="32636">UTM Zone 36S</option>
                    <option value="32637">UTM Zone 37S</option>
                    <option value="32736">Arc 1960 / UTM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Target CRS</label>
                  <select className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm">
                    <option value="4326">WGS84 (EPSG:4326)</option>
                    <option value="32636">UTM Zone 36S</option>
                    <option value="32637">UTM Zone 37S</option>
                    <option value="32736">Arc 1960 / UTM</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Alignment Method</label>
                  <select className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm">
                    <option value="affine">Affine Transform</option>
                    <option value="similarity">Similarity Transform</option>
                    <option value="projective">Projective Transform</option>
                    <option value="helmert">Helmert Transform</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 bg-[var(--bg-primary)] rounded">
                  <p className="text-lg font-bold text-[var(--accent)]">{layers.length}</p>
                  <p className="text-xs text-[var(--text-muted)]">Layers</p>
                </div>
                <div className="p-2 bg-[var(--bg-primary)] rounded">
                  <p className="text-lg font-bold text-[var(--accent)]">{layers.filter(l => l.visibility).length}</p>
                  <p className="text-xs text-[var(--text-muted)]">Visible</p>
                </div>
                <div className="p-2 bg-[var(--bg-primary)] rounded">
                  <p className="text-lg font-bold text-[var(--accent)]">0</p>
                  <p className="text-xs text-[var(--text-muted)]">Alignments</p>
                </div>
                <div className="p-2 bg-[var(--bg-primary)] rounded">
                  <p className="text-lg font-bold text-[var(--accent)]">0</p>
                  <p className="text-xs text-[var(--text-muted)]">Integrations</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex gap-2 mb-4 border-b border-[var(--border-color)]">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activeTab === 'integrate' && (
                <DataIntegrator
                  projectId="default"
                  layers={layers}
                  onIntegrationComplete={handleIntegrationComplete}
                />
              )}
              
              {activeTab === 'layers' && (
                <LayerManager
                  projectId="default"
                  layers={layers}
                  onLayersChange={(newLayers) => setLayers(newLayers)}
                />
              )}
              
              {activeTab === 'analyze' && (
                <CrossAnalyzer
                  projectId="default"
                  layers={layers}
                />
              )}

              {activeTab !== 'layers' && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Map className="h-4 w-4" />
                    Preview
                  </h3>
                  <div className="aspect-video bg-[var(--bg-primary)] rounded-lg flex items-center justify-center">
                    <div className="text-center text-[var(--text-muted)]">
                      <Map className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Map preview will appear here</p>
                      <p className="text-xs">Configure layers to visualize data</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
