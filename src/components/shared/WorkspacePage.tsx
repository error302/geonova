import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type WorkspacePageProps = {
  children: ReactNode
  className?: string
}

type WorkspaceHeroProps = {
  eyebrow?: string
  title: string
  subtitle: string
  primaryAction?: {
    label: string
    href: string
    icon?: LucideIcon
  }
  secondaryAction?: {
    label: string
    href: string
    icon?: LucideIcon
  }
  aside?: ReactNode
}

type WorkspaceStatProps = {
  icon: LucideIcon
  label: string
  value: string | number
  detail?: string
  loading?: boolean
}

type WorkspaceSectionProps = {
  title: string
  subtitle?: string
  action?: {
    label: string
    href: string
  }
  children: ReactNode
  className?: string
}

type ActivityRowProps = {
  icon: LucideIcon
  title: string
  meta: string
  status?: string
  href?: string
}

export function WorkspacePage({ children, className = '' }: WorkspacePageProps) {
  return (
    <div className={`min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] ${className}`}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {children}
      </div>
    </div>
  )
}

export function WorkspaceHero({
  eyebrow,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  aside,
}: WorkspaceHeroProps) {
  const PrimaryIcon = primaryAction?.icon
  const SecondaryIcon = secondaryAction?.icon

  return (
    <section className="grid gap-6 border-b border-[var(--border-color)] pb-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-normal text-[var(--text-primary)] sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
          {subtitle}
        </p>
        {(primaryAction || secondaryAction) && (
          <div className="mt-6 flex flex-wrap gap-3">
            {primaryAction && (
              <Link href={primaryAction.href} className="btn btn-primary">
                {PrimaryIcon && <PrimaryIcon className="h-4 w-4" />}
                {primaryAction.label}
              </Link>
            )}
            {secondaryAction && (
              <Link href={secondaryAction.href} className="btn btn-secondary">
                {SecondaryIcon && <SecondaryIcon className="h-4 w-4" />}
                {secondaryAction.label}
              </Link>
            )}
          </div>
        )}
      </div>
      {aside && <div className="min-w-0">{aside}</div>}
    </section>
  )
}

export function WorkspaceStats({ children }: { children: ReactNode }) {
  return (
    <section className="grid grid-cols-2 gap-3 py-6 lg:grid-cols-4">
      {children}
    </section>
  )
}

export function WorkspaceStat({ icon: Icon, label, value, detail, loading }: WorkspaceStatProps) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--accent)]">
          <Icon className="h-4 w-4" />
        </div>
        {detail && (
          <span className="truncate text-xs text-[var(--text-muted)]">
            {detail}
          </span>
        )}
      </div>
      <div className="mt-4 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
        {loading ? <span className="block h-7 w-16 animate-pulse rounded bg-[var(--bg-tertiary)]" /> : value}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  )
}

export function WorkspaceSection({ title, subtitle, action, children, className = '' }: WorkspaceSectionProps) {
  return (
    <section className={`py-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] sm:text-xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>}
        </div>
        {action && (
          <Link href={action.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:text-amber-300">
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export function ActivityRow({ icon: Icon, title, meta, status, href }: ActivityRowProps) {
  const content = (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent)]">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="truncate text-xs text-[var(--text-muted)]">{meta}</p>
      </div>
      {status && (
        <span className="shrink-0 rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {status}
        </span>
      )}
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
