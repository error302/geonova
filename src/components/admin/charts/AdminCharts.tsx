'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Area, AreaChart,
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

// ---------------------------------------------------------------------------
// Revenue Line Chart
// ---------------------------------------------------------------------------

interface RevenueData {
  month: string
  total: number
}

const revenueChartConfig: ChartConfig = {
  total: {
    label: 'Revenue (KES)',
    color: 'hsl(var(--accent))',
  },
}

export function RevenueLineChart({ data }: { data: RevenueData[] }) {
  const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month))

  return (
    <ChartContainer config={revenueChartConfig} className="min-h-[240px] w-full">
      <AreaChart data={sorted} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickFormatter={(v: string) => {
            const parts = v.split('-')
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            return parts[1] ? months[+parts[1] - 1] : v
          }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="total"
          stroke="hsl(var(--accent))"
          strokeWidth={2}
          fill="url(#revenueGrad)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}

// ---------------------------------------------------------------------------
// Uptime Percentage Chart
// ---------------------------------------------------------------------------

interface UptimeData {
  date: string
  uptime: number
}

const uptimeChartConfig: ChartConfig = {
  uptime: {
    label: 'Uptime %',
    color: '#4ade80',
  },
}

export function UptimeChart({ data }: { data: UptimeData[] }) {
  return (
    <ChartContainer config={uptimeChartConfig} className="min-h-[160px] w-full">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickFormatter={(v: string) => v.split('-').slice(1).join('/')}
        />
        <YAxis
          domain={[99, 100]}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="uptime"
          stroke="#4ade80"
          strokeWidth={2}
          fill="url(#uptimeGrad)"
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

// ---------------------------------------------------------------------------
// Response Time P95/P99 Chart
// ---------------------------------------------------------------------------

interface ResponseTimeData {
  timestamp: string
  p50: number
  p95: number
  p99: number
}

const responseTimeChartConfig: ChartConfig = {
  p50: { label: 'p50', color: '#60a5fa' },
  p95: { label: 'p95', color: '#f59e0b' },
  p99: { label: 'p99', color: '#ef4444' },
}

export function ResponseTimeChart({ data }: { data: ResponseTimeData[] }) {
  return (
    <ChartContainer config={responseTimeChartConfig} className="min-h-[180px] w-full">
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
        <XAxis
          dataKey="timestamp"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickFormatter={(v: string) => {
            const d = new Date(v)
            return `${d.getHours()}:00`
          }}
          interval={3}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickFormatter={(v: number) => `${v}ms`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line type="monotone" dataKey="p50" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
        <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

// ---------------------------------------------------------------------------
// Error Rate Chart
// ---------------------------------------------------------------------------

interface ErrorRateData {
  timestamp: string
  rate: number
  count: number
}

const errorRateChartConfig: ChartConfig = {
  rate: { label: 'Error Rate %', color: '#ef4444' },
  count: { label: 'Error Count', color: '#f97316' },
}

export function ErrorRateChart({ data }: { data: ErrorRateData[] }) {
  return (
    <ChartContainer config={errorRateChartConfig} className="min-h-[160px] w-full">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
        <XAxis
          dataKey="timestamp"
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickFormatter={(v: string) => {
            const d = new Date(v)
            return `${d.getHours()}:00`
          }}
          interval={3}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="rate"
          stroke="#ef4444"
          strokeWidth={1.5}
          fill="url(#errorGrad)"
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}

// ---------------------------------------------------------------------------
// Subscription Donut Chart
// ---------------------------------------------------------------------------

import { PieChart, Pie, Cell } from 'recharts'

interface SubData {
  name: string
  value: number
}

const SUB_COLORS = ['#94a3b8', '#60a5fa', '#a855f7'] // free, pro, enterprise

const subChartConfig: ChartConfig = {
  free: { label: 'Free', color: '#94a3b8' },
  pro: { label: 'Pro', color: '#60a5fa' },
  enterprise: { label: 'Enterprise', color: '#a855f7' },
}

export function SubscriptionDonutChart({ data }: { data: SubData[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="flex items-center gap-4">
      <ChartContainer config={subChartConfig} className="min-h-[160px] w-[160px]">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={65}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={SUB_COLORS[index % SUB_COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent />} />
        </PieChart>
      </ChartContainer>
      <div className="space-y-2 text-sm">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: SUB_COLORS[i % SUB_COLORS.length] }}
            />
            <span className="text-[var(--text-secondary)] capitalize">{d.name}</span>
            <span className="text-[var(--text-primary)] font-medium ml-auto">
              {d.value}
              <span className="text-[var(--text-muted)] text-xs ml-1">
                ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
              </span>
            </span>
          </div>
        ))}
        <div className="border-t border-[var(--border-color)] pt-1 mt-1 flex items-center gap-2">
          <span className="text-[var(--text-muted)]">Total</span>
          <span className="text-[var(--text-primary)] font-medium ml-auto">{total}</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sparkline (for trend indicators in stat cards)
// ---------------------------------------------------------------------------

interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export function Sparkline({ data, color = 'hsl(var(--accent))', width = 80, height = 28 }: SparklineProps) {
  if (!data.length) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
