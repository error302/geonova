'use client';

import { useState } from 'react'

interface ChangelogEntry {
  phase: number
  title: string
  date: string
  items: string[]
}

const changelog: ChangelogEntry[] = [
  {
    phase: 40,
    title: 'Final Integration & Polish',
    date: '2025-01',
    items: [
      'Service worker update detection with "Update Available" banner',
      'Centralized environment config & feature flags',
      'App update banner with one-click reload',
      'Offline indicator for all pages',
      'Enhanced PWA meta tags for all platforms',
    ],
  },
  {
    phase: 39,
    title: 'Beta Testing Prep',
    date: '2025-01',
    items: [
      'Beta feedback widget with bug report, feature request & performance forms',
      'Screenshot capture for feedback submissions',
      'Collected error log attachment to feedback',
      'Changelog panel with expandable phase history',
      'Feedback rate-limiting and client-side collection',
    ],
  },
  {
    phase: 38,
    title: 'Performance Optimization',
    date: '2025-01',
    items: [
      'Lazy-loaded heavy components (maps, 3D viewers, reports)',
      'Reusable skeleton loader components for all content types',
      'Enhanced error boundary with retry & error capture',
      'Route-level loading states with skeleton placeholders',
      'Centralized dynamic import registry',
    ],
  },
  {
    phase: 37,
    title: 'PWA Offline Caching',
    date: '2025-01',
    items: [
      'Workbox-based service worker with comprehensive caching strategies',
      'App shell caching with NetworkFirst strategy',
      'Offline fallback page with auto-redirect on reconnection',
      'PWA manifest with icons, shortcuts & categories',
      'Google Fonts caching (webfonts + stylesheets)',
    ],
  },
  {
    phase: 36,
    title: 'Audit & Compliance',
    date: '2025-01',
    items: [
      'Comprehensive audit log system',
      'RS compliance checklist generation',
      'Departure warning system for critical data',
      'Document management with version tracking',
    ],
  },
  {
    phase: 35,
    title: 'Subscription & Payments',
    date: '2024-12',
    items: [
      'Full subscription engine with plan catalog',
      'Stripe, PayPal, M-Pesa payment integration',
      'Feature gating based on subscription tier',
      'Billing management & invoice history',
      'Trial management with expiry warnings',
    ],
  },
  {
    phase: 34,
    title: 'FieldGuard Data Cleaning',
    date: '2024-12',
    items: [
      'Automated data anomaly detection',
      'Cleaning suggestions & bulk fix operations',
      'Error statistics and quality scores',
      'Cleaned dataset export in multiple formats',
    ],
  },
  {
    phase: 32,
    title: 'USV Mission Planning',
    date: '2024-12',
    items: [
      'Unmanned surface vehicle mission planner',
      'Telemetry dashboard with live data',
      'Waypoint management and route optimization',
      'Mission status tracking',
    ],
  },
  {
    phase: 30,
    title: 'Workflow Automator',
    date: '2024-12',
    items: [
      'Visual workflow builder with drag-and-drop canvas',
      'Automated calculation pipelines',
      'Template-based workflow creation',
      'Execution monitoring and reporting',
    ],
  },
  {
    phase: 29,
    title: 'Advanced Engineering Suite',
    date: '2024-11',
    items: [
      'Road design with horizontal/vertical curves',
      'Earthworks mass haul diagrams',
      'Pipeline gradient calculations',
      'Bridge and tunnel engineering panels',
      'Dam and building engineering modules',
      'Railway curve design tools',
    ],
  },
]

function ChangelogItem({ entry }: { entry: ChangelogEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-[var(--border-color)] last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between py-3 px-4 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-bold text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-1.5 py-0.5 rounded flex-shrink-0">
            P{entry.phase}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{entry.title}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{entry.date}</p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--text-muted)] flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-3">
          <ul className="space-y-1.5">
            {entry.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                <span className="text-[var(--accent)] mt-0.5 flex-shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function ChangelogPanel() {
  return (
    <div>
      <div className="p-4 pb-2 border-b border-[var(--border-color)]">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
          What&apos;s New
        </h4>
        <p className="text-[10px] text-[var(--text-muted)]">
          METARDU development phases 29–40
        </p>
      </div>
      <div className="max-h-[50vh] overflow-y-auto">
        {changelog.map((entry) => (
          <ChangelogItem key={entry.phase} entry={entry} />
        ))}
      </div>
    </div>
  )
}
