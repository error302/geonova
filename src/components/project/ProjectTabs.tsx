'use client';

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

interface Props {
  id: string
  surveyType?: string
}

export default function ProjectTabs({ id, surveyType }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeStep = searchParams.get('step') ?? '1'
  const baseHref = `/project/${id}`

  const isEngineering = surveyType?.startsWith('engineering')
  const isTopographic = surveyType === 'topographic' ||
                        surveyType === 'topographic_site' ||
                        surveyType === 'topographic_corridor'

  const tabs = [
    { label: 'Setup', href: `${baseHref}?step=1`, active: pathname === baseHref && activeStep === '1' },
    { label: 'Field', href: `${baseHref}?step=2`, active: pathname === baseHref && activeStep === '2' },
    { label: 'Compute', href: `${baseHref}?step=3`, active: pathname === baseHref && activeStep === '3' },
    { label: 'QA', href: `${baseHref}?step=4`, active: pathname === baseHref && activeStep === '4' },
    { label: 'Map', href: `/project/${id}/map` },
    ...(isTopographic ? [{ label: 'Topo', href: `/project/${id}/topo` }] : []),
    ...(isEngineering ? [{ label: 'Engineering', href: `/project/${id}/engineering` }] : []),
    { label: 'Documents', href: `/project/${id}/documents` },
    { label: 'Submit', href: `/project/${id}/submission` },
  ]

  return (
    <div className="border-b border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-card)_80%,transparent)] backdrop-blur">
      <div className="max-w-5xl mx-auto px-4">
        <nav aria-label="Project tabs" className="flex gap-2 overflow-x-auto py-3">
          {tabs.map((tab) => {
            const isActive =
              'active' in tab
                ? Boolean(tab.active)
                : pathname === tab.href ||
                  (tab.href !== baseHref && pathname.startsWith(`${tab.href}/`))

            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={false}
                className={[
                  'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                    : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-orange-500/40 hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
