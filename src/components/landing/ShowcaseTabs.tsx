'use client'

import { useState } from 'react'

type TabId = 'map' | 'workflow' | 'documents'

const TABS: { id: TabId; label: string }[] = [
  { id: 'map', label: 'Interactive Map' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'documents', label: 'Documents' },
]

const LAYERS = [
  { name: 'Parcels', on: true },
  { name: 'RIM Overlay', on: true },
  { name: 'Stakeout', on: false },
  { name: 'Contours', on: true },
  { name: 'Survey Points', on: false },
]

const STEPS = ['Set Up', 'Field Book', 'Compute', 'Review', 'Submit']

const DOCS = [
  { name: 'Form No. 4', meta: 'PDF · Cap 299', seal: true },
  { name: 'Survey Report', meta: 'RDM 1.1', seal: false },
  { name: 'Computation Workbook', meta: 'XLSX', seal: false },
  { name: 'NLIMS Export', meta: 'ArdhiSasa-ready', seal: true },
]

export function ShowcaseTabs() {
  const [tab, setTab] = useState<TabId>('map')

  return (
    <div className="relative mx-auto max-w-5xl">
      {/* glow */}
      <div className="absolute -inset-3 bg-gradient-to-r from-[var(--accent)]/10 via-transparent to-transparent rounded-3xl blur-2xl opacity-60" aria-hidden />

      <div className="relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] shadow-2xl overflow-hidden">
        {/* browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <span className="flex gap-1.5" aria-hidden>
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]/40" />
          </span>
          <div className="flex-1 mx-2 h-7 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] flex items-center px-3 text-xs text-[var(--text-muted)] font-mono truncate">
            metardu.space/project/LR-20904
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]" role="tablist" aria-label="Product preview">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                tab === t.id
                  ? 'bg-[var(--accent)] text-black'
                  : 'text-[var(--text-primary)]/70 hover:bg-[var(--bg-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* content */}
        <div className="p-4 sm:p-6 bg-[var(--bg-primary)]">
          {tab === 'map' && <MapPreview />}
          {tab === 'workflow' && <WorkflowPreview />}
          {tab === 'documents' && <DocumentsPreview />}
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────── */
/*  MAP PREVIEW — vector cadastral map + layer control          */
/* ──────────────────────────────────────────────────────────── */

function MapPreview() {
  return (
    <div className="relative min-h-[320px] sm:min-h-[400px] rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.55" />
          </pattern>
        </defs>

        <rect width="400" height="300" fill="url(#grid)" />

        {/* faint contour curves */}
        <g stroke="var(--accent)" strokeWidth="0.8" fill="none" opacity="0.2">
          <path d="M0 70 Q 110 35 200 80 T 400 60" />
          <path d="M0 110 Q 120 80 210 120 T 400 100" />
          <path d="M0 150 Q 130 120 220 160 T 400 140" />
        </g>

        {/* parcel polygon */}
        <polygon
          points="120,95 300,72 322,182 205,232 88,192"
          fill="var(--accent)"
          fillOpacity="0.08"
          stroke="var(--accent)"
          strokeWidth="2"
        />

        {/* beacons */}
        <g fill="var(--bg-primary)" stroke="var(--accent)" strokeWidth="2">
          <circle cx="120" cy="95" r="4" />
          <circle cx="300" cy="72" r="4" />
          <circle cx="322" cy="182" r="4" />
          <circle cx="205" cy="232" r="4" />
          <circle cx="88" cy="192" r="4" />
        </g>

        {/* dimension line with ticks */}
        <g stroke="var(--text-primary)" strokeWidth="1" opacity="0.6">
          <line x1="120" y1="108" x2="300" y2="85" />
          <line x1="118" y1="103" x2="122" y2="113" />
          <line x1="298" y1="80" x2="302" y2="90" />
        </g>

        {/* north arrow */}
        <g transform="translate(360,46)">
          <path d="M0 14 L6 0 L0 6 L-6 0 Z" fill="var(--accent)" />
          <text x="-4" y="28" fontSize="11" fontWeight="700" fill="var(--text-primary)">N</text>
        </g>

        {/* scale bar */}
        <g transform="translate(20,272)">
          <rect width="64" height="4" fill="var(--accent)" />
          <text x="0" y="-4" fontSize="9" fill="var(--text-primary)" opacity="0.7">0&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;50 m</text>
        </g>
      </svg>

      {/* layer control panel */}
      <div className="absolute top-3 left-3 w-44 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur p-3 text-xs shadow-lg">
        <p className="font-semibold mb-2 text-[var(--text-primary)]">Layers</p>
        <ul className="space-y-1.5 list-none p-0">
          {LAYERS.map((l) => (
            <li key={l.name} className="flex items-center gap-2 text-[var(--text-primary)]/80">
              <span
                className={`inline-flex w-3.5 h-3.5 rounded-[3px] border items-center justify-center ${
                  l.on ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border-color)]'
                }`}
                aria-hidden
              >
                {l.on && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              {l.name}
            </li>
          ))}
        </ul>
      </div>

      {/* coordinate readout */}
      <div className="absolute bottom-3 right-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)]/95 px-2.5 py-1.5 font-mono text-[10px] text-[var(--text-primary)]/80">
        E 4332.60&nbsp;&nbsp;N 114190.94
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────── */
/*  WORKFLOW PREVIEW — guided step pipeline                     */
/* ──────────────────────────────────────────────────────────── */

function WorkflowPreview() {
  return (
    <div className="min-h-[320px] sm:min-h-[400px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 flex flex-col justify-center">
      <ol className="grid grid-cols-2 sm:grid-cols-5 gap-3 list-none p-0">
        {STEPS.map((s, i) => (
          <li key={s} className="relative">
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 text-center h-full">
              <div className="mx-auto mb-2 flex items-center justify-center w-9 h-9 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/40 text-[var(--accent)] font-bold text-sm">
                {i + 1}
              </div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">{s}</p>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className="hidden sm:block absolute top-1/2 -right-2 -translate-y-1/2 text-[var(--accent)]/50"
                aria-hidden
              >
                →
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { k: 'Project', v: 'LR 20904/2 · UTM 37S' },
          { k: 'Closure', v: '1:48,000 · RDM 1.1 Class B' },
          { k: 'Output', v: 'Form No. 4 · SHA-256 seal' },
        ].map((c) => (
          <div key={c.k} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{c.k}</p>
            <p className="text-xs font-medium text-[var(--text-primary)] font-mono truncate">{c.v}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────── */
/*  DOCUMENTS PREVIEW — submission-ready package                */
/* ──────────────────────────────────────────────────────────── */

function DocumentsPreview() {
  return (
    <div className="min-h-[320px] sm:min-h-[400px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0">
        {DOCS.map((d) => (
          <div key={d.name} className="flex items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3">
            <span className="w-9 h-9 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{d.name}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{d.meta}</p>
            </div>
            {d.seal && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 text-[10px] font-bold uppercase">
                Sealed
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/5 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-[var(--text-primary)]">NLIMS-ready package</p>
          <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">SHA-256 · 9f2a…c41e · audit-chained</p>
        </div>
        <span className="shrink-0 text-[var(--accent)]" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </span>
      </div>
    </div>
  )
}
