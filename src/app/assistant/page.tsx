'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Wifi, AlertTriangle } from 'lucide-react'

const SurveyAssistant = dynamic(() => import('@/components/ai/SurveyAssistant'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="text-sm text-[var(--text-muted)] animate-pulse">Loading Survey Assistant...</div>
    </div>
  ),
})

export default function AssistantPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-6">
        <Link href="/dashboard" className="hover:text-[var(--accent)] transition-colors">Dashboard</Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[var(--text-primary)]">Survey Assistant</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Survey Assistant</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Ask questions about Kenyan cadastral surveying, the Survey Act Cap 299, regulations, or submission standards.
        </p>
      </div>

      <div className="h-[600px]">
        <SurveyAssistant />
      </div>

      <div className="mt-6 p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">About the Assistant</h3>
        <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
          <li className="flex items-start gap-2">
            <Cpu className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
            Powered by <strong>Phi-3-mini (3B)</strong> running fully offline via WebGPU — no data leaves your device.
          </li>
          <li className="flex items-start gap-2">
            <Wifi className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-500" />
            When online, queries route through the <strong>NVIDIA NIM cloud AI</strong> for higher quality, with automatic fallback to offline WebGPU.
          </li>
          <li className="flex items-start gap-2">
            <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
            Knowledge base: Survey Act Cap 299, Survey Regulations LN 168/1994, SRVY2025-1 Submission Standards, RIM procedures.
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
            Always verify against the official regulations. The Director of Surveys is the final authority.
          </li>
        </ul>
      </div>
    </div>
  )
}

function Cpu(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    </svg>
  )
}

function BookOpen(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  )
}