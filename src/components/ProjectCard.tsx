'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ProjectCard({ project, openLabel }: { project: any; openLabel: string }) {
  const router = useRouter()

  const surveyType = project.survey_type
    ? project.survey_type.charAt(0).toUpperCase() + project.survey_type.slice(1)
    : null

  return (
    <div
      onClick={() => router.push(`/project/${project.id}`)}
      className="group block rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 hover:border-[var(--accent)]/50 hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors leading-snug">
          {project.name}
        </h3>
        {surveyType && (
          <span className="badge badge-warning shrink-0 text-[10px]">{surveyType}</span>
        )}
      </div>

      <p className="text-sm text-[var(--text-muted)] mb-4 truncate">
        {project.location || 'No location set'}
      </p>

      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>UTM {project.utm_zone}{project.hemisphere}</span>
        <span>{new Date(project.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
        <span className="text-xs text-[var(--accent)] font-medium">{openLabel} →</span>
        <div className="flex gap-2">
          <Link
            href={`/project/${project.id}/contours`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-secondary)]"
          >
            Contours
          </Link>
          <Link
            href={`/project/${project.id}/profiles`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-secondary)]"
          >
            Profiles
          </Link>
        </div>
      </div>
    </div>
  )
}
