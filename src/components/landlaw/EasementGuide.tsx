'use client'

import { useState } from 'react'
import { Route, ChevronRight, Plus, X, MapPin } from 'lucide-react'
import { getEasementByType, getAllEasementTypes, searchEasements } from '@/lib/data/easementLaw'
import type { EasementGuidance, EasementType } from '@/types/landLaw'
import { EASEMENT_TYPE_LABELS } from '@/types/landLaw'

export default function EasementGuide() {
  const [selectedType, setSelectedType] = useState<EasementType | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<EasementGuidance[]>([])
  const [showSearch, setShowSearch] = useState(false)

  const easementTypes = getAllEasementTypes()

  const selectedEasement = selectedType ? getEasementByType(selectedType) : null

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setSearchResults(searchEasements(searchQuery))
    }
  }

  const handleSelectEasement = (type: EasementType) => {
    setSelectedType(type)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
        <h3 className="font-semibold text-green-900 flex items-center gap-2">
          <Route className="w-5 h-5" />
          Easement Guidance
        </h3>
        <p className="text-sm text-green-700 mt-1">
          Understand easements and rights of way under Kenyan law
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
        >
          {showSearch ? 'Browse by Type' : 'Search Easements'}
        </button>
      </div>

      {showSearch && (
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search easement topics..."
            className="flex-1 p-2 border rounded-lg"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Search
          </button>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Search results ({searchResults.length})</p>
          {searchResults.map((easement: any) => (
            <button
              key={easement.id}
              onClick={() => handleSelectEasement(easement.easementType)}
              className="w-full text-left p-3 border rounded-lg hover:border-green-300"
            >
              <span className="font-medium">{easement.title}</span>
            </button>
          ))}
        </div>
      )}

      {!showSearch && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {easementTypes.map(({ type }) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`p-3 text-sm rounded-lg border transition-colors ${
                selectedType === type
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              {EASEMENT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      {selectedEasement ? (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-lg border">
            <h4 className="font-semibold text-lg text-gray-900">{selectedEasement.title}</h4>
            <p className="text-gray-600 mt-2">{selectedEasement.description}</p>

            {selectedEasement.kenyaSpecific && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-900">Kenya-Specific Notes</p>
                <p className="text-sm text-amber-800 mt-1">{selectedEasement.kenyaSpecific}</p>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-lg border">
              <h5 className="font-medium text-gray-700 mb-3">Creation Methods</h5>
              <ul className="space-y-2">
                {selectedEasement.creationMethods.map((method, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Plus className="w-4 h-4 text-green-500 mt-0.5" />
                    <span>{method}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-white rounded-lg border">
              <h5 className="font-medium text-gray-700 mb-3">Termination Methods</h5>
              <ul className="space-y-2">
                {selectedEasement.terminationMethods.map((method, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <X className="w-4 h-4 text-red-500 mt-0.5" />
                    <span>{method}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border">
            <h5 className="font-medium text-gray-700 mb-3">Typical Disputes</h5>
            <div className="flex flex-wrap gap-2">
              {selectedEasement.typicalDisputes.map((dispute, index) => (
                <span key={index} className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded-full">
                  {dispute}
                </span>
              ))}
            </div>
          </div>

          <div className="p-4 bg-white rounded-lg border">
            <h5 className="font-medium text-gray-700 mb-3">Surveyor Tasks</h5>
            <ul className="space-y-2">
              {selectedEasement.surveyorTasks.map((task, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-blue-500 mt-0.5" />
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h5 className="font-medium text-gray-700 mb-3">Legal Requirements</h5>
            <ul className="space-y-2">
              {selectedEasement.legalRequirements.map((req, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                  <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Route className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select an easement type to view guidance</p>
        </div>
      )}
    </div>
  )
}
