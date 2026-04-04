'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AnalyticsData {
  totalProjects: number
  activeProjects: number
  completedSurveys: number
  totalPoints: number
  storageUsed: number
  apiCalls: number
  userActivity: { date: string; count: number }[]
  projectTypes: { type: string; count: number }[]
}

const emptyData: AnalyticsData = {
  totalProjects: 0,
  activeProjects: 0,
  completedSurveys: 0,
  totalPoints: 0,
  storageUsed: 0,
  apiCalls: 0,
  userActivity: [],
  projectTypes: [],
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('7d')
  const [data, setData] = useState<AnalyticsData>(emptyData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAnalytics() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      const userId = session.user.id

      const [projectsRes, pointsRes] = await Promise.all([
        supabase.from('projects').select('id, survey_type, created_at').eq('user_id', userId),
        supabase.from('survey_points').select('id, created_at').eq('user_id', userId)
      ])

      const projects = projectsRes.data || []
      const points = pointsRes.data || []

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const last7Days: { date: string; count: number }[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const count = projects.filter((p: any) => p.created_at?.startsWith(dateStr)).length
        last7Days.push({ date: dateStr, count })
      }

      const projectTypesMap: Record<string, number> = {}
      projects.forEach((p: any) => {
        const type = p.survey_type || 'Other'
        projectTypesMap[type] = (projectTypesMap[type] || 0) + 1
      })

      setData({
        totalProjects: projects.length,
        activeProjects: projects.length,
        completedSurveys: projects.filter((p: any) => p.survey_type).length,
        totalPoints: points.length,
        storageUsed: Math.round((points.length * 0.001) * 100) / 100,
        apiCalls: 0,
        userActivity: last7Days,
        projectTypes: Object.entries(projectTypesMap).map(([type, count]) => ({ type, count })),
      })
      setLoading(false)
    }

    fetchAnalytics()
  }, [period])

  const maxActivity = data.userActivity.length > 0 ? Math.max(...data.userActivity.map((d: any) => d.count)) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Analytics</h1>
            <p className="text-[var(--text-muted)]">Track your METARDU usage</p>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="p-2 border rounded-lg"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <p className="text-sm text-[var(--text-muted)] mb-1">Total Projects</p>
            <p className="text-3xl font-bold">{data.totalProjects}</p>
            <p className="text-xs text-green-600 mt-1">↑ 12% from last month</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <p className="text-sm text-[var(--text-muted)] mb-1">Active Projects</p>
            <p className="text-3xl font-bold">{data.activeProjects}</p>
            <p className="text-xs text-green-600 mt-1">↑ 5% from last month</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <p className="text-sm text-[var(--text-muted)] mb-1">Completed Surveys</p>
            <p className="text-3xl font-bold">{data.completedSurveys}</p>
            <p className="text-xs text-green-600 mt-1">↑ 23% from last month</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <p className="text-sm text-[var(--text-muted)] mb-1">API Calls</p>
            <p className="text-3xl font-bold">{(data.apiCalls / 1000).toFixed(1)}K</p>
            <p className="text-xs text-green-600 mt-1">↑ 18% from last month</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold mb-4">User Activity</h2>
            <div className="flex items-end gap-1 h-40">
              {data.userActivity.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${(d.count / maxActivity) * 100}%` }}
                  />
                  <span className="text-xs text-[var(--text-secondary)] mt-1">
                    {new Date(d.date).getDate()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold mb-4">Projects by Type</h2>
            <div className="space-y-3">
              {data.projectTypes.map((pt, i) => {
                const percentage = (pt.count / data.totalProjects) * 100
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{pt.type}</span>
                      <span className="text-[var(--text-muted)]">{pt.count}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold mb-2">Storage</h2>
            <div className="relative pt-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-500 h-4 rounded-full"
                  style={{ width: `${(data.storageUsed / 5) * 100}%` }}
                />
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-2">
                {data.storageUsed} GB of 5 GB used
              </p>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold mb-2">API Usage</h2>
            <div className="relative pt-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-500 h-4 rounded-full"
                  style={{ width: `${(data.apiCalls / 50000) * 100}%` }}
                />
              </div>
              <p className="text-sm text-[var(--text-muted)] mt-2">
                {data.apiCalls.toLocaleString()} of 50,000 calls
              </p>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
            <h2 className="text-lg font-semibold mb-2">Team Members</h2>
            <p className="text-3xl font-bold">5</p>
            <p className="text-sm text-[var(--text-muted)]">of 10 seats used</p>
            <button className="mt-4 text-sm text-blue-600 hover:underline">
              Manage team →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
