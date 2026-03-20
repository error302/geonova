'use client'

import { useState, useEffect } from 'react'
import {
  getJobs,
  getJobCategories,
  getCountries,
  searchJobs,
  SurveyJob
} from '@/lib/marketplace/jobMarketplace'

export default function JobMarketplacePage() {
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<SurveyJob[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    setLoading(true)
    setCategories(getJobCategories())
    if (searchQuery) {
      setJobs(searchJobs(searchQuery))
    } else {
      setJobs(getJobs({
        country: selectedCountry || undefined,
        surveyType: selectedType || undefined,
      }))
    }
    setLoading(false)
  }, [searchQuery, selectedCountry, selectedType])

  const formatBudget = (amount: number, currency: string) => {
    if (currency === 'KES') return `KES ${(amount / 1000).toFixed(0)}K`
    if (currency === 'USD') return `$${amount.toLocaleString()}`
    return `${currency} ${amount.toLocaleString()}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-900/30 text-green-400 border border-green-700/30'
      case 'in_progress': return 'bg-blue-900/30 text-blue-400 border border-blue-700/30'
      case 'completed': return 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
      default: return 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-[var(--text-muted)] text-sm animate-pulse">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Survey Job Marketplace</h1>
          <p className="text-[var(--text-muted)]">Find survey jobs or hire professional surveyors</p>
        </div>

        <div className="bg-blue-600 rounded-xl p-6 mb-8 text-white">
          <h2 className="text-xl font-semibold mb-2">Earn with GeoNova</h2>
          <p className="mb-4">Complete surveys through our marketplace. We charge 5% commission on all completed jobs.</p>
          <button className="bg-[var(--bg-secondary)] text-blue-400 px-4 py-2 rounded-lg font-medium hover:bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
            Post a Job
          </button>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-64 p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
          />
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">All Countries</option>
            {getCountries().map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">All Types</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          {categories.slice(0, 4).map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedType(cat.id)}
              className={`p-4 rounded-lg text-left transition ${
                selectedType === cat.id 
                  ? 'bg-blue-900/30 border-2 border-blue-500' 
                  : 'bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-blue-300'
              }`}
            >
              <span className="text-2xl">{cat.icon}</span>
              <p className="font-medium mt-2">{cat.name}</p>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] border p-6 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">{job.title}</h3>
                  <p className="text-sm text-[var(--text-muted)]">{job.clientName} • {job.location}</p>
                </div>
                <span className={`px-3 py-1 text-sm rounded ${getStatusColor(job.status)}`}>
                  {job.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              
              <p className="text-[var(--text-muted)] mb-4 line-clamp-2">{job.description}</p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {job.requiredSkills.map(skill => (
                  <span key={skill} className="text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] px-2 py-1 rounded">
                    {skill}
                  </span>
                ))}
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-green-600">{formatBudget(job.budget, job.currency)}</span>
                  <span className="text-[var(--text-muted)]">📅 {new Date(job.deadline).toLocaleDateString()}</span>
                  <span className="text-[var(--text-muted)]">📂 {job.proposals} proposals</span>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  View Details
                </button>
              </div>
            </div>
          ))}
          
          {jobs.length === 0 && (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <div className="text-4xl mb-3">🔍</div>
              <p>No jobs found matching your criteria</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
