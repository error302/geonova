'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button' // Assume shadcn/ui or replace with native button

interface SubmissionStepPanelProps {
  projectId: string
}

export function SubmissionStepPanel({ projectId }: SubmissionStepPanelProps) {
  const [profile, setProfile] = useState(null)
  const [submission, setSubmission] = useState(null)
  const [validation, setValidation] = useState({ ready: false, blockers: [], warnings: [] })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Submission Package</h3>
        <p className="text-zinc-400 text-sm">Assemble benchmark-compliant Kenya land submission package (Form No. 4 + computations + attachments).</p>
      </div>

      <div className="rounded-lg border border-zinc-700 p-4">
        <h4 className="text-sm font-medium text-white mb-3">Quick Status</h4>
        {validation.ready ? (
          <div className="flex items-center gap-2 text-green-400">
            <span>✓</span> Package READY — click Generate
          </div>
        ) : (
          <div className="space-y-1">
            {validation.blockers.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-red-400 text-xs">
                <span>•</span> {b}
              </div>
            ))}
            {validation.warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-amber-400 text-xs">
                <span>⚠</span> {w}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href={`/project/${projectId}/submission`} className="block p-4 rounded-lg border border-zinc-700 bg-zinc-900 text-center hover:bg-zinc-800 transition-colors">
          <div className="text-2xl mb-2">📦</div>
          <div className="font-semibold text-white">Full Package</div>
          <div className="text-xs text-zinc-400">ZIP with all documents</div>
        </Link>
        <Button className="bg-[#f59e0b] hover:bg-[#f59e0b]/90 text-black font-semibold" disabled={!validation.ready}>
          Generate Package
        </Button>
      </div>

      <div className="text-xs text-zinc-500 text-center">
        Powered by Phase 13 Submission System — 8 benchmark sections + validation
      </div>
    </div>
  )
}

