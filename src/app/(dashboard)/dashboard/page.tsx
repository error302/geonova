export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import SubscriptionStatus from '@/components/SubscriptionStatus'
import UpgradePrompt from '@/components/UpgradePrompt'
import { getServerTranslator } from '@/lib/i18n/server'
import { log } from '@/lib/logger'
import { getAuthUser, isAdmin as checkIsAdmin } from '@/lib/auth/session'
import { createClient } from '@/lib/api-client/server'

import ProjectCard, { type ProjectCardProject } from '@/components/ProjectCard'
import { ConnectivityIndicator } from '@/components/shared/ConnectivityIndicator'
import OnboardingWrapper from '@/components/shared/OnboardingWrapper'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import DashboardSearch from '@/components/dashboard/DashboardSearch'

function StepIcon({ name }: { name: string }) {
  const cls = 'w-5 h-5 text-current'
  switch (name) {
    case 'search':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
    case 'ruler':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l-3-3m3 3l6-6m-6 6l3-3m-3 3l-3-3m3 3l3-3m-6-6l3-3m-3 3l-3-3m3 3l6-6m-6 6l3-3m-6 6l-3-3m3 3l3-3m-3-9l3-3m-3 3l-3-3m3 3l6-6m-6-3l3-3m-3 3l-3-3m3 3l3-3"/></svg>
    case 'calculator':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"/></svg>
    case 'file-text':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
    case 'upload':
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
    default:
      return null
  }
}

export default async function DashboardPage() {
  let t = (k: string) => k
  try { t = await getServerTranslator() } catch {}

  // Auth check — OUTSIDE try/catch so redirect() works properly
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const userIsAdmin = await checkIsAdmin()

  // ponytail: Phase 6 — was `any[]`; now typed via query builder default
  let projects: ProjectCardProject[] = []
  let subscription: Record<string, unknown> | null = null

  try {
    const dbClient = await createClient()

    if (userIsAdmin) {
      subscription = { plan_id: 'enterprise', status: 'active', trial_ends_at: null }
      const { data, error } = await dbClient.from('projects').select('*').order('created_at', { ascending: false })
      if (!error) projects = (data as unknown as ProjectCardProject[]) ?? []
    } else {
      const [pRes, sRes] = await Promise.all([
        dbClient.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        dbClient.from('user_subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      if (!pRes.error) projects = (pRes.data as unknown as ProjectCardProject[]) ?? []
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
        <div className="animate-in fade-in duration-700 space-y-8">
          {/* Hero welcome */}
          <div className="flex flex-col items-center text-center py-12 pb-6">
            <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center mb-5 ring-1 ring-amber-500/20">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Welcome to METARDU</h1>
            <p className="text-[var(--text-secondary)] max-w-lg">Your complete cadastral survey platform. Create a project, record field observations, compute adjustments, and generate submission-ready plans.</p>
          </div>

          {/* Survey workflow steps */}
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[
                { step: '1', title: 'Primary Investigation', desc: 'Define project scope, location, and control points', icon: 'search', color: 'from-blue-500/20 to-cyan-500/20', link: '/project/new', cta: 'Create Project' },
                { step: '2', title: 'Field Survey', desc: 'Record traverse/level observations in the field book', icon: 'ruler', color: 'from-emerald-500/20 to-teal-500/20', link: '/fieldbook', cta: 'Open Field Book' },
                { step: '3', title: 'Compute & Adjust', desc: 'Run traverse adjustments, level loops, area calcs', icon: 'calculator', color: 'from-violet-500/20 to-purple-500/20', link: '/tools/traverse', cta: 'Open Calculator' },
                { step: '4', title: 'Prepare Plan', desc: 'Generate deed plans, survey reports, beacon certs', icon: 'file-text', color: 'from-amber-500/20 to-orange-500/20', link: '/tools/survey-report-builder', cta: 'Build Report' },
                { step: '5', title: 'Submit', desc: 'Export shapefiles, field books, PDF for Director', icon: 'upload', color: 'from-rose-500/20 to-pink-500/20', link: '/project/new', cta: 'Start Project' },
              ].map((item) => (
                <Link key={item.step} href={item.link} prefetch={false}
                  className="group relative flex flex-col items-center text-center p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-tertiary)] transition-all duration-200"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 ring-1 ring-inset ring-white/5 group-hover:scale-110 transition-transform`}>
                    <StepIcon name={item.icon} />
                  </div>
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {item.step}
                  </div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-1">{item.title}</h3>
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{item.desc}</p>
                  <span className="mt-2 text-[10px] font-medium text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.cta} →
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick actions + AI assistant card */}
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Getting started checklist */}
            <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Getting Started</h3>
              <ul className="space-y-2.5">
                {[
                  { done: false, text: 'Create your first project', href: '/project/new', label: 'Create' },
                  { done: false, text: 'Learn the survey workflow', href: '/docs/first-plan', label: 'Read guide' },
                  { done: false, text: 'Explore survey tools', href: '/tools', label: 'Browse tools' },
                  { done: false, text: 'Try the AI Assistant', href: '/assistant', label: 'Ask AI' },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-md border-2 border-[var(--border-color)] flex items-center justify-center shrink-0">
                      {item.done && (
                        <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <span className="flex-1 text-xs text-[var(--text-secondary)]">{item.text}</span>
                    <Link href={item.href} className="text-[10px] font-medium text-[var(--accent)] hover:underline shrink-0">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: AI Assistant card */}
            <Link href="/assistant" className="group p-5 rounded-xl bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-rose-500/5 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-amber-500 transition-colors">Survey Assistant</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                    Ask questions about Survey Act Cap 299, traverse tolerances, submission standards, or any cadastral procedure. Runs offline via WebGPU — no data leaves your device.
                  </p>
                  <span className="inline-block mt-2 text-xs font-medium text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Assistant →
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Bottom quick-links */}
          <div className="max-w-3xl mx-auto flex flex-wrap justify-center gap-3 pt-4 border-t border-[var(--border-color)]">
            <Link href="/process" prefetch={false} className="px-4 py-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent)] transition-colors">
              Process Field Notes
            </Link>
            <Link href="/docs/first-plan" prefetch={false} className="px-4 py-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent)] transition-colors">
              Survey Guide
            </Link>
            <Link href="/pricing" prefetch={false} className="px-4 py-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent)] transition-colors">
              Pricing
            </Link>
            <Link href="/docs" prefetch={false} className="px-4 py-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent)] transition-colors">
              Knowledge Base
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[minmax(180px,auto)]">
          {projectsWithCounts.map((project, i: number) => {
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
