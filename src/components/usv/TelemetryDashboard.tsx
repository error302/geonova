'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { USVTelemetry } from '@/types/usv'

interface TelemetryDashboardProps {
  data: USVTelemetry[]
  height?: string
}

export default function TelemetryDashboard({ data, height = '300px' }: TelemetryDashboardProps) {
  const chartData = data
    .slice()
    .reverse()
    .map((t) => ({
      time: new Date(t.recorded_at).toLocaleTimeString(),
      speed: t.speed,
      heading: t.heading,
      battery: t.battery_percent,
      signal: t.signal_strength
    }))

  if (data.length === 0) {
    return (
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-8 text-center">
        <p className="text-[var(--text-muted)]">No telemetry data available</p>
      </div>
    )
  }

  const latest = data[data.length - 1]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3">
          <p className="text-xs text-[var(--text-muted)]">Speed</p>
          <p className="text-xl font-semibold">{latest.speed.toFixed(1)} <span className="text-sm font-normal">m/s</span></p>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3">
          <p className="text-xs text-[var(--text-muted)]">Heading</p>
          <p className="text-xl font-semibold">{latest.heading.toFixed(0)}&deg;</p>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3">
          <p className="text-xs text-[var(--text-muted)]">Battery</p>
          <p className={`text-xl font-semibold ${latest.battery_percent < 20 ? 'text-red-500' : ''}`}>
            {latest.battery_percent}%
          </p>
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-3">
          <p className="text-xs text-[var(--text-muted)]">Signal</p>
          <p className="text-xl font-semibold">{latest.signal_strength} <span className="text-sm font-normal">dBm</span></p>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-4">Speed & Heading Over Time</h4>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px'
              }}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="speed" stroke="#3b82f6" name="Speed (m/s)" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="heading" stroke="#10b981" name="Heading (°)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-4">Battery & Signal Strength</h4>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="var(--text-muted)" />
            <YAxis tick={{ fontSize: 10 }} stroke="var(--text-muted)" domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px'
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="battery" stroke="#f59e0b" name="Battery %" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="signal" stroke="#8b5cf6" name="Signal (dBm)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
