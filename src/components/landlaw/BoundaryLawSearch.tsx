'use client'

import { useState } from 'react'
import { Search, BookOpen, AlertTriangle, Scale, FileText, Gavel } from 'lucide-react'
import { searchBoundaryLaw, getAllBoundaryLawTopics } from '@/lib/data/boundaryLaw'
import type { BoundaryLawEntry, BoundaryIssueType } from '@/types/landLaw'
import { BOUNDARY_ISSUE_LABELS } from '@/types/landLaw'

export default function BoundaryLawSearch() {
  const [query, setQuery] = useState('')
  const [selectedType, setSelectedType] = useState<BoundaryIssueType | ''>('')
  const [results, setResults] = useState<BoundaryLawEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<BoundaryLawEntry | null>(null)

  const topics = getAllBoundaryLawTopics()

  const handleSearch = () => {
    let entries: BoundaryLawEntry[] = []
    
    if (query.trim()) {
      entries = searchBoundaryLaw(query)
    } else if (selectedType) {
      entries = searchBoundaryLaw(selectedType)
    }
    
    setResults(entries)
    setSelectedEntry(null)
  }

  const handleTypeSelect = (type: BoundaryIssueType) => {
    setSelectedType(type)
    setQuery('')
    const entries = searchBoundaryLaw(type)
    setResults(entries)
    setSelectedEntry(null)
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
        <h3 className="font-semibold text-amber-900 flex items-center gap-2">
          <Scale className="w-5 h-5" />
          Boundary Law Knowledge Base
        </h3>
        <p className="text-sm text-amber-700 mt-1">
          Search Kenyan land law precedents, statutes, and surveyor procedures
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search boundary law topics, cases, statutes..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          Search
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {topics.map(topic => (
          <button
            key={topic.type}
            onClick={() => handleTypeSelect(topic.type)}
            className={`px-3 py-1 text-sm rounded-full ${
              selectedType === topic.type
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {BOUNDARY_ISSUE_LABELS[topic.type]}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">
            {results.length > 0 ? `Results (${results.length})` : 'Browse Topics'}
          </h4>
          
          {results.length === 0 && !selectedType && (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a topic or search to browse</p>
            </div>
          )}

          {results.map(entry => (
            <button
              key={entry.id}
              onClick={() => setSelectedEntry(entry)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedEntry?.id === entry.id
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-amber-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Gavel className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">{entry.title}</h5>
                  <p className="text-sm text-gray-600 line-clamp-2">{entry.description}</p>
                  <div className="flex gap-2 mt-2">
                    {entry.relevantActs.slice(0, 2).map((act: string, i: number) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div>
          {selectedEntry && (
            <div className="sticky top-4 space-y-4">
              <div className="bg-white rounded-lg border p-4">
                <h4 className="font-semibold text-lg text-gray-900">{selectedEntry.title}</h4>
                <p className="text-gray-600 mt-2">{selectedEntry.description}</p>

                {selectedEntry.brownsPrinciple && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <h5 className="font-medium text-blue-900 text-sm">Browns Principle</h5>
                    <p className="text-blue-800 text-sm mt-1">{selectedEntry.brownsPrinciple}</p>
                  </div>
                )}

                <div className="mt-4">
                  <h5 className="font-medium text-gray-700 text-sm">Legal Framework</h5>
                  <ul className="mt-2 space-y-1">
                    {selectedEntry.legalFramework.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                        <FileText className="w-3 h-3" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4">
                  <h5 className="font-medium text-gray-700 text-sm">Relevant Acts</h5>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedEntry.relevantActs.map((act, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                        {act}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <h5 className="font-medium text-gray-700 text-sm">Case Law</h5>
                  <ul className="mt-2 space-y-1">
                    {selectedEntry.caseLaw.map((case_, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                        <Scale className="w-3 h-3 text-amber-500" /> {case_}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4">
                  <h5 className="font-medium text-gray-700 text-sm">Surveyor Role</h5>
                  <p className="text-sm text-gray-600 mt-1">{selectedEntry.surveyorRole}</p>
                </div>

                <div className="mt-4">
                  <h5 className="font-medium text-gray-700 text-sm">Procedure</h5>
                  <div className="mt-2 p-3 bg-gray-50 rounded text-sm text-gray-700 whitespace-pre-line">
                    {selectedEntry.procedure}
                  </div>
                </div>

                <div className="mt-4">
                  <h5 className="font-medium text-gray-700 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Common Pitfalls
                  </h5>
                  <ul className="mt-2 space-y-1">
                    {selectedEntry.commonPitfalls.map((pitfall, i) => (
                      <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                        <span className="text-red-400">•</span> {pitfall}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
