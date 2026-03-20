'use client'

import { useState, useEffect } from 'react'
import {
  getReviewers,
  getReviewCategories,
  submitForReview,
  ReviewerProfile,
  ReviewRequest
} from '@/lib/marketplace/peerReview'

export default function PeerReviewPage() {
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'browse' | 'submit'>('browse')
  const [reviewers, setReviewers] = useState<ReviewerProfile[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = useState('')
  const [submitForm, setSubmitForm] = useState({
    projectName: '',
    surveyType: 'traverse' as ReviewRequest['surveyType'],
  })
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    setLoading(true)
    if (selectedSpecialty) {
      setReviewers(getReviewers(selectedSpecialty))
    } else {
      setReviewers(getReviewers())
    }
    setCategories(getReviewCategories())
    setLoading(false)
  }, [selectedSpecialty])

  const handleSubmit = () => {
    if (!submitForm.projectName) return
    submitForReview('proj-001', submitForm.projectName, submitForm.surveyType, 'user-001')
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setSubmitForm({ projectName: '', surveyType: 'traverse' })
    }, 3000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-[var(--text-muted)] text-sm animate-pulse">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Peer Review Network</h1>
        <p className="text-[var(--text-muted)] mb-8">Get your survey plans reviewed by certified professionals</p>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'browse' ? 'bg-blue-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-color)]'
            }`}
          >
            Browse Reviewers
          </button>
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'submit' ? 'bg-blue-600 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-color)]'
            }`}
          >
            Submit for Review
          </button>
        </div>

        {activeTab === 'browse' && (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Filter by Specialty</label>
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="p-2 border rounded-lg w-64"
              >
                <option value="">All Specialties</option>
                <option value="Cadastral">Cadastral</option>
                <option value="Geodetic">Geodetic</option>
                <option value="Boundary">Boundary</option>
                <option value="Mining">Mining</option>
                <option value="Engineering">Engineering</option>
              </select>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reviewers.map(reviewer => (
                <div key={reviewer.id} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-[var(--text-primary)]">{reviewer.name}</h3>
                      <p className="text-sm text-[var(--text-muted)]">{reviewer.title}</p>
                    </div>
                    {reviewer.verified && (
                      <span className="text-blue-500 text-sm">✓ Verified</span>
                    )}
                  </div>
                  
                  <p className="text-sm text-[var(--text-muted)] mb-2">📍 {reviewer.country}</p>
                  <p className="text-xs text-[var(--text-secondary)] mb-3">License: {reviewer.license}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {reviewer.specializations.map(sp => (
                      <span key={sp} className="text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] px-2 py-1 rounded">
                        {sp}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm border-t pt-3">
                    <div className="flex items-center gap-3">
                      <span className="text-yellow-500">★</span>
                      <span className="font-medium">{reviewer.averageRating}</span>
                      <span className="text-[var(--text-secondary)]">({reviewer.reviewsCompleted} reviews)</span>
                    </div>
                    <span className="text-[var(--text-muted)]">{reviewer.responseTime}</span>
                  </div>
                  
                  <button className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Request Review
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'submit' && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 max-w-xl">
            <h2 className="text-lg font-semibold mb-4">Submit Survey for Review</h2>
            
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">✓</div>
                <p className="text-green-800 font-medium">Survey submitted successfully!</p>
                <p className="text-sm text-green-600">Reviewers will be notified</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Project Name</label>
                  <input
                    type="text"
                    value={submitForm.projectName}
                    onChange={(e) => setSubmitForm({ ...submitForm, projectName: e.target.value })}
                    placeholder="Enter project name"
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Survey Type</label>
                  <select
                    value={submitForm.surveyType}
                    onChange={(e) => setSubmitForm({ ...submitForm, surveyType: e.target.value as any })}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="traverse">Traverse</option>
                    <option value="leveling">Leveling</option>
                    <option value="boundary">Boundary</option>
                    <option value="topographic">Topographic</option>
                    <option value="engineering">Engineering</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">Review Categories</label>
                  <div className="space-y-2">
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-start gap-2">
                        <input type="checkbox" className="mt-1" />
                        <div>
                          <p className="text-sm font-medium">{cat.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{cat.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <button
                  onClick={handleSubmit}
                  disabled={!submitForm.projectName}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  Submit for Review
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
