'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Briefcase, Users, Award, Building2, Search, Star, CheckCircle, Clock, ArrowRight } from 'lucide-react'

interface CommunityStats {
  stats: {
    totalSurveyors: number
    totalJobsPosted: number
    totalReviewsCompleted: number
    totalCPDPointsAwarded: number
  }
  openPeerReviews: number
  surveyorsCount: number
}

export default function CommunityPage() {
  const [stats, setStats] = useState<CommunityStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/community/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const features = [
    {
      icon: Briefcase,
      title: 'Job Marketplace',
      description: 'Find survey work or hire licensed surveyors',
      links: [
        { label: 'Browse Jobs', href: '/jobs?tab=browse' },
        { label: 'Post a Job', href: '/jobs?tab=post' }
      ],
      color: 'bg-blue-500'
    },
    {
      icon: Users,
      title: 'Peer Review',
      description: 'Get your plans reviewed by fellow professionals',
      links: [
        { label: 'Submit for Review', href: '/peer-review?tab=submit' },
        { label: 'Review Others', href: '/peer-review?tab=open' }
      ],
      color: 'bg-purple-500'
    },
    {
      icon: Award,
      title: 'CPD Tracker',
      description: 'Track your professional development points',
      links: [
        { label: 'View My CPD', href: '/cpd' },
        { label: 'Generate Certificate', href: '/cpd?action=generate' }
      ],
      color: 'bg-green-500'
    },
    {
      icon: Building2,
      title: 'Professional Bodies',
      description: 'Verify your ISK membership',
      links: [
        { label: 'Manage Memberships', href: '/profile?tab=bodies' },
        { label: 'Find Surveyors', href: '/jobs?tab=surveyors' }
      ],
      color: 'bg-amber-500'
    }
  ]

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Community Hub</h1>
        <p className="text-[var(--text-muted)] mb-8">
          Connect with East African surveyors, find work, and grow professionally
        </p>

        {/* Stats Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold">{loading ? '...' : stats?.stats.totalSurveyors || 0}</span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">Surveyors</p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold">{loading ? '...' : stats?.stats.totalJobsPosted || 0}</span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">Jobs Posted</p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-5 h-5 text-purple-500" />
              <span className="text-2xl font-bold">{loading ? '...' : stats?.stats.totalReviewsCompleted || 0}</span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">Reviews Done</p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-amber-500" />
              <span className="text-2xl font-bold">{loading ? '...' : stats?.stats.totalCPDPointsAwarded || 0}</span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">CPD Points</p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature: any) => (
            <div key={feature.title} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className={`${feature.color} p-3 rounded-lg`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">{feature.title}</h3>
                  <p className="text-sm text-[var(--text-muted)] mb-4">{feature.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {feature.links.map((link: any) => (
                      <Link
                        key={link.label}
                        href={link.href}
                        className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700"
                      >
                        {link.label}
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/jobs" className="p-4 border rounded-lg hover:bg-[var(--bg-secondary)] transition">
              <Search className="w-5 h-5 text-blue-500 mb-2" />
              <p className="font-medium">Find Survey Work</p>
              <p className="text-sm text-[var(--text-muted)]">Browse open jobs</p>
            </Link>
            <Link href="/cpd" className="p-4 border rounded-lg hover:bg-[var(--bg-secondary)] transition">
              <Clock className="w-5 h-5 text-green-500 mb-2" />
              <p className="font-medium">Track CPD Points</p>
              <p className="text-sm text-[var(--text-muted)]">ISK renewal requires 20 points/year</p>
            </Link>
            <Link href="/peer-review" className="p-4 border rounded-lg hover:bg-[var(--bg-secondary)] transition">
              <Star className="w-5 h-5 text-purple-500 mb-2" />
              <p className="font-medium">Get Peer Review</p>
              <p className="text-sm text-[var(--text-muted)]">Before submitting to registry</p>
            </Link>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>ISK CPD Requirement:</strong> Institution of Surveyors of Kenya requires 20 CPD points 
            per year for license renewal. GeoNova automatically awards points for completed jobs, 
            peer reviews, and document signatures.
          </p>
        </div>
      </div>
    </div>
  )
}
