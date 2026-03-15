'use client'

import { useState } from 'react'

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

const mockData: AnalyticsData = {
  totalProjects: 47,
  activeProjects: 12,
  completedSurveys: 234,
  totalPoints: 15680,
  storageUsed: 2.4,
  apiCalls: 12450,
  userActivity: [
    { date: '2024-01-01', count: 45 },
    { date: '2024-01-02', count: 52 },
    { date: '2024-01-03', count: 38 },
    { date: '2024-01-04', count: 61 },
    { date: '2024-01-05', count: 55 },
    { date: '2024-01-06', count: 48 },
    { date: '2024-01-07', count: 42 },
  ],
  projectTypes: [
    { type: 'Boundary', count: 18 },
    { type: 'Topographic', count: 12 },
    { type: 'Engineering', count: 8 },
    { type: 'Control Network', count: 5 },
    { type: 'Mining', count: 4 },
  ],
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('7d')
  const data = mockData

  const maxActivity = Math.max(...data.userActivity.map(d => d.count))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600">Track your GeoNova usage</p>
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
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500 mb-1">Total Projects</p>
            <p className="text-3xl font-bold">{data.totalProjects}</p>
            <p className="text-xs text-green-600 mt-1">↑ 12% from last month</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500 mb-1">Active Projects</p>
            <p className="text-3xl font-bold">{data.activeProjects}</p>
            <p className="text-xs text-green-600 mt-1">↑ 5% from last month</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500 mb-1">Completed Surveys</p>
            <p className="text-3xl font-bold">{data.completedSurveys}</p>
            <p className="text-xs text-green-600 mt-1">↑ 23% from last month</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500 mb-1">API Calls</p>
            <p className="text-3xl font-bold">{(data.apiCalls / 1000).toFixed(1)}K</p>
            <p className="text-xs text-green-600 mt-1">↑ 18% from last month</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">User Activity</h2>
            <div className="flex items-end gap-1 h-40">
              {data.userActivity.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-500 rounded-t"
                    style={{ height: `${(d.count / maxActivity) * 100}%` }}
                  />
                  <span className="text-xs text-gray-400 mt-1">
                    {new Date(d.date).getDate()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Projects by Type</h2>
            <div className="space-y-3">
              {data.projectTypes.map((pt, i) => {
                const percentage = (pt.count / data.totalProjects) * 100
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{pt.type}</span>
                      <span className="text-gray-500">{pt.count}</span>
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
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-2">Storage</h2>
            <div className="relative pt-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-500 h-4 rounded-full"
                  style={{ width: `${(data.storageUsed / 5) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {data.storageUsed} GB of 5 GB used
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-2">API Usage</h2>
            <div className="relative pt-4">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-500 h-4 rounded-full"
                  style={{ width: `${(data.apiCalls / 50000) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {data.apiCalls.toLocaleString()} of 50,000 calls
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-2">Team Members</h2>
            <p className="text-3xl font-bold">5</p>
            <p className="text-sm text-gray-600">of 10 seats used</p>
            <button className="mt-4 text-sm text-blue-600 hover:underline">
              Manage team →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
