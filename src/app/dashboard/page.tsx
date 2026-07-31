export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import SubscriptionStatus from '@/components/SubscriptionStatus'
import UpgradePrompt from '@/components/UpgradePrompt'
import { getServerTranslator } from '@/lib/i18n/server'
import { log } from '@/lib/logger'
import { getAuthUser, isAdmin as checkIsAdmin } from '@/lib/auth/session'
import { createClient } from '@/lib/api-client/server'

import ProjectCard from '@/components/ProjectCard'
import { ConnectivityIndicator } from '@/components/shared/ConnectivityIndicator'
import OnboardingWrapper from '@/components/shared/OnboardingWrapper'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import DashboardSearch from '@/components/dashboard/DashboardSearch'

export default async function DashboardPage() {
  let t = (k: string) => k
  try { t = await getServerTranslator() } catch {}

  // Auth check — OUTSIDE try/catch so redirect() works properly
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userIsAdmin = await checkIsAdmin()

  // ponytail: Phase 6 — was `any[]`; now typed via query builder default
  let projects: Record<string, unknown>[] = []
  let subscription: Record<string, unknown> | null = null

  try {
    const dbClient = await createClient()

    if (userIsAdmin) {
      subscription = { plan_id: 'enterprise', status: 'active', trial_ends_at: null }
      const { data, error } = await dbClient.from('projects').select('*').order('created_at', { ascending: false })
      if (!error) projects = (data as unknown as Record<string, unknown>[]) ?? []
    } else {
      const [pRes, sRes] = await Promise.all([
        dbClient.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        dbClient.from('user_subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      if (!pRes.error) projects = (pRes.data as unknown as Record<string, unknown>[]) ?? []
      if (!sRes.error || sRes.error?.code === 'PGRST116') subscription = (sRes.data as Record<string, unknown>) ?? null
    }
  } catch (err) {
    log({ level: 'error', message: 'Failed to load dashboard data', metadata: { error: err } })
  }

  const canCreateProject = userIsAdmin || subscription?.plan_id !== 'free' || projects.length < 1
  const trialEndsAt = subscription?.trial_ends_at as string | null | undefined
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : null

  /* ── Batch point/parcel counts (avoids N+1 queries) ─────────────── */
  let projectsWithCounts = projects
  if (projects.length > 0) {
    try {
      const dbClient = await createClient()
      const projectIds = projects.map(p => p.id)

      const [pointsRes, parcelsRes] = await Promise.all([
        dbClient.from('survey_points').select('project_id').in('project_id', projectIds),
        dbClient.from('parcels').select('project_id').in('project_id', projectIds),
      ])

      // Aggregate counts in JS (2 queries instead of 2N)
      const pointCounts: Record<string, number> = {}
      for (const row of (pointsRes.data as unknown as Record<string, unknown>[]) ?? []) {
        const pid = String(row.project_id)
        pointCounts[pid] = (pointCounts[pid] ?? 0) + 1
      }
      const parcelCounts: Record<string, number> = {}
      for (const row of (parcelsRes.data as unknown as Record<string, unknown>[]) ?? []) {
        const pid = String(row.project_id)
        parcelCounts[pid] = (parcelCounts[pid] ?? 0) + 1
      }

      projectsWithCounts = projects.map(project => ({
        ...project,
        point_count: pointCounts[String(project.id)] ?? 0,
        parcel_count: parcelCounts[String(project.id)] ?? 0,
      }))
    } catch {
      projectsWithCounts = projects.map(project => ({ ...project, point_count: 0, parcel_count: 0 }))
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
      <div className="flex items-center justify-end mb-4">
        <ConnectivityIndicator />
      </div>
      <OnboardingWrapper />
      <SubscriptionStatus subscription={subscription} />

      {subscription?.status === 'trial' && daysLeft !== null && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-lg border border-green-500/20 bg-green-500/5 text-sm">
          <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-green-400">
            {daysLeft > 0
              ? `Pro trial active — ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining. `
              : 'Your trial has ended. '}
            <Link href="/pricing" className="underline hover:text-green-300">Upgrade to keep Pro access →</Link>
          </p>
        </div>
      )}

      {/* UI-13 (2026-07-24): DashboardSearch — 561 LOC component that was
          built but never imported. Now wired in so surveyors can search
          across projects, submissions, and surveyors from the dashboard. */}
      {projectsWithCounts?.length > 0 && (
        <div className="mb-6">
          <DashboardSearch />
        </div>
      )}

      <div className="mb-8 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)] mb-1">
              {t('dashboard.processFieldNotesTitle')}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('dashboard.processFieldNotesSubtitle')}
            </p>
          </div>
          <Link href="/process" prefetch={false} className="btn btn-primary shrink-0">
            {t('dashboard.startProcessing')}
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
          {t('dashboard.title')}
          {projectsWithCounts?.length ? (
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">({projectsWithCounts.length})</span>
          ) : null}
        </h1>
        {canCreateProject ? (
          <Link href="/project/new" prefetch={false} className="btn btn-primary">
            {t('dashboard.newProject')}
          </Link>
        ) : (
          <Link href="/pricing" className="btn btn-primary">
            {t('dashboard.upgradeToCreateMore')}
          </Link>
        )}
      </div>

      {!canCreateProject && <UpgradePrompt type="projects" />}


      {!projectsWithCounts?.length ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-[var(--border-color)] text-center animate-in fade-in duration-700 slide-in-from-bottom-8">
          <div className="w-16 h-16 rounded-[2rem] bg-[var(--accent)]/10 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"/>
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold font-display text-[var(--text-primary)] mb-2">Welcome to METARDU</h2>
          <p className="text-[var(--text-secondary)] mb-10 max-w-md">Start your first project or jump straight into a tool.</p>
          
          <div className="flex flex-wrap gap-4 justify-center mb-10">
            <Link href="/project/new" prefetch={false} className="btn btn-primary px-8 rounded-full">
              + New Project
            </Link>
            <Link href="/tools/traverse" className="btn btn-secondary px-8 rounded-full">
              Open Traverse Tool
            </Link>
            <Link href="/process" prefetch={false} className="btn btn-secondary px-8 rounded-full">
              Process Field Notes
            </Link>
          </div>
          
          <div className="w-full max-w-sm border-t border-[var(--border-color)] pt-8 mt-4">
            <p className="text-xs font-mono text-[var(--text-muted)] tracking-[0.1em] mb-4">NEW TO METARDU?</p>
            <Link href="/docs/first-plan" className="text-sm text-[var(--accent)] hover:text-[var(--accent-dim)] transition-colors inline-flex items-center gap-1 font-medium">
              View Survey Guide →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[minmax(180px,auto)]">
          {projectsWithCounts.map((project: any, i: number) => {
            // Asymmetrical bento grid logic:
            const pattern = [
              'md:col-span-8', 'md:col-span-4',
              'md:col-span-4', 'md:col-span-4', 'md:col-span-4',
              'md:col-span-6', 'md:col-span-6'
            ];
            const spanClass = pattern[i % pattern.length];
            return (
              <div 
                key={project.id} 
                className={`col-span-1 ${spanClass} animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both`}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <ProjectCard project={project} openLabel={t('project.open')} />
              </div>
            )
          })}
        </div>
      )}

      {/* Activity Feed — recent user actions */}
      <div className="mt-8">
        <ActivityFeed limit={10} />
      </div>
    </div>
  )
}
