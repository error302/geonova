'use client'

import { useState, useEffect } from 'react'
import { 
  getTemplates, 
  getTopTemplates, 
  searchTemplates, 
  getCategories,
  getSurveyors,
  searchSurveyors,
  getSpecialties,
  SurveyTemplate,
  SurveyorProfile
} from '@/lib/marketplace'

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<'templates' | 'surveyors'>('templates')
  const [templates, setTemplates] = useState<SurveyTemplate[]>([])
  const [surveyors, setSurveyors] = useState<SurveyorProfile[]>([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (activeTab === 'templates') {
      if (searchQuery) {
        setTemplates(searchTemplates(searchQuery))
      } else {
        setTemplates(getTemplates(selectedCategory))
      }
    } else {
      if (searchQuery) {
        setSurveyors(searchSurveyors(searchQuery))
      } else {
        setSurveyors(getSurveyors())
      }
    }
  }, [activeTab, selectedCategory, searchQuery])

  const categories = getCategories()
  const specialties = getSpecialties()

  const formatPrice = (price: number, currency: string) => {
    if (currency === 'KES') return `KES ${price.toLocaleString()}`
    if (currency === 'UGX') return `UGX ${price.toLocaleString()}`
    if (currency === 'TZS') return `TZS ${price.toLocaleString()}`
    return `$${price}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Surveyor Marketplace</h1>
          <p className="text-gray-600">Templates, tools, and professional services for surveyors</p>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'templates' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 border'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => setActiveTab('surveyors')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'surveyors' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 border'
            }`}
          >
            Find Surveyors
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder={activeTab === 'templates' ? 'Search templates...' : 'Search surveyors...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 p-3 border rounded-lg"
          />
          {activeTab === 'templates' && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="p-3 border rounded-lg"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          )}
        </div>

        {activeTab === 'templates' && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Popular Templates</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {getTopTemplates(3).map(tpl => (
                  <div key={tpl.id} className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {tpl.category}
                      </span>
                      <span className="font-bold text-green-600">{formatPrice(tpl.price, tpl.currency)}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{tpl.name}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{tpl.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{tpl.downloads} downloads</span>
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-500">★</span>
                        <span>{tpl.rating}</span>
                        <span className="text-gray-400">({tpl.reviews})</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">All Templates</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(tpl => (
                  <div key={tpl.id} className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {tpl.category}
                      </span>
                      <span className="font-bold text-green-600">{formatPrice(tpl.price, tpl.currency)}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{tpl.name}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{tpl.description}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tpl.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm border-t pt-3">
                      <div className="flex items-center gap-1">
                        {tpl.author.verified && <span className="text-blue-500">✓</span>}
                        <span className="text-gray-600">{tpl.author.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-500">★</span>
                        <span>{tpl.rating}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'surveyors' && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Featured Surveyors</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {surveyors.slice(0, 2).map(surveyor => (
                  <div key={surveyor.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{surveyor.name}</h3>
                          {surveyor.verified && <span className="text-blue-500 text-sm">✓ Verified</span>}
                        </div>
                        <p className="text-sm text-gray-600">{surveyor.title}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        surveyor.availability === 'available' ? 'bg-green-100 text-green-800' :
                        surveyor.availability === 'busy' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {surveyor.availability}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{surveyor.bio}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {surveyor.specialties.map(sp => (
                        <span key={sp} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {sp}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t pt-3">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>📁 {surveyor.projects} projects</span>
                        <span className="flex items-center gap-1">
                          <span className="text-yellow-500">★</span> {surveyor.rating}
                        </span>
                      </div>
                      <span className="font-semibold text-green-600">${surveyor.hourlyRate}/hr</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">All Surveyors</h2>
              <div className="space-y-4">
                {surveyors.map(surveyor => (
                  <div key={surveyor.id} className="bg-white rounded-lg shadow-sm border p-4 flex gap-4 hover:shadow-md transition">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-2xl">
                      👷
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{surveyor.name}</h3>
                        {surveyor.verified && <span className="text-blue-500 text-sm">✓</span>}
                        <span className="text-sm text-gray-500">• {surveyor.country}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{surveyor.title} • License: {surveyor.license}</p>
                      <div className="flex flex-wrap gap-1">
                        {surveyor.specialties.map(sp => (
                          <span key={sp} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {sp}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end mb-1">
                        <span className="text-yellow-500">★</span>
                        <span className="font-medium">{surveyor.rating}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{surveyor.projects} projects</p>
                      <p className="font-semibold text-green-600">${surveyor.hourlyRate}/hr</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
