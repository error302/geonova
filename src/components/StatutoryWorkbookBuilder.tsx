'use client';

import { useState } from 'react'
import { Search, BookOpen, FileDown, ChevronDown, ChevronRight, Scale, Landmark, FileText } from 'lucide-react'

const surveyTypes = ['cadastral', 'engineering', 'topographic', 'leveling', 'control', 'drone', 'gnss'] as const

// ── Kenya Survey Regulations Reference Data ─────────────────────────────────────

interface RegulationSection {
  id: string
  act: string
  section: string
  title: string
  content: string
  keywords: string[]
}

const REGULATIONS: RegulationSection[] = [
  // Land Act
  {
    id: 'la-2',
    act: 'Land Act',
    section: 'Section 2',
    title: 'Interpretation',
    content: 'Defines key terms: "public land", "private land", "community land", "lease", "license", "easement". The Land Act 2012 governs the management and administration of all land in Kenya.',
    keywords: ['definition', 'land types', 'public land', 'private land', 'community land'],
  },
  {
    id: 'la-12',
    act: 'Land Act',
    section: 'Section 12',
    title: 'Allocation of Public Land',
    content: 'The Commission may allocate public land by public auction, tender, or direct allocation. All allocations must be done in accordance with the Constitution and the Land Act.',
    keywords: ['allocation', 'public land', 'auction', 'tender'],
  },
  {
    id: 'la-13',
    act: 'Land Act',
    section: 'Section 13',
    title: 'Requirements for Allocation',
    content: 'Allocation must consider: (a) the needs of the persons to be allocated, (b) the public interest, (c) the principle of equitable distribution, (d) the need for sustainable land use.',
    keywords: ['allocation', 'requirements', 'public interest', 'equitable'],
  },
  {
    id: 'la-38',
    act: 'Land Act',
    section: 'Section 38',
    title: 'Easements',
    content: 'An easement may be created by agreement, by statute, by prescription, or by implication. Right-of-way easements are common in cadastral surveys.',
    keywords: ['easement', 'right of way', 'servitude', 'agreement'],
  },
  // Survey Act (Cap 299)
  {
    id: 'sa-3',
    act: 'Survey Act',
    section: 'Section 3',
    title: 'Director of Surveys',
    content: 'The Director of Surveys is responsible for the direction and control of all surveys in Kenya. No survey of land shall be made except under the authority of a licensed surveyor.',
    keywords: ['director', 'control', 'licensed surveyor', 'authority'],
  },
  {
    id: 'sa-5',
    act: 'Survey Act',
    section: 'Section 5',
    title: 'Licensing of Surveyors',
    content: 'The Surveyors Licensing Board examines and licenses surveyors. A license is required to conduct cadastral surveys. The Board maintains the register of licensed surveyors.',
    keywords: ['license', 'board', 'examination', 'registration', 'ISK'],
  },
  {
    id: 'sa-11',
    act: 'Survey Act',
    section: 'Section 11',
    title: 'Surveys of Land',
    content: 'The Director may cause surveys to be made of any land in Kenya. All cadastral surveys must be conducted by a licensed surveyor and be in accordance with the Survey Regulations.',
    keywords: ['survey', 'cadastral', 'director', 'regulations'],
  },
  {
    id: 'sa-22',
    act: 'Survey Act',
    section: 'Section 22',
    title: 'Beacon Descriptions',
    content: 'Every surveyor shall, at the time of making any survey, describe in the prescribed manner all beacons set or found during such survey. Beacon descriptions form part of the survey records.',
    keywords: ['beacon', 'description', 'set', 'found', 'monument'],
  },
  {
    id: 'sa-28',
    act: 'Survey Act',
    section: 'Section 28',
    title: 'Survey Records',
    content: 'All field records, computation sheets, plans, and other documents relating to a survey shall be submitted to the Director of Surveys. Records must be preserved and maintained.',
    keywords: ['records', 'field book', 'computation', 'submission', 'director'],
  },
  // Survey Regulations 1994
  {
    id: 'sr-3',
    act: 'Survey Regulations',
    section: 'Regulation 3',
    title: "Surveyor's Certificate",
    content: "Every survey plan shall bear a certificate signed by the surveyor stating that the survey was carried out under their direct supervision. The certificate shall state compliance with the Survey Act and Regulations.",
    keywords: ['certificate', 'signature', 'supervision', 'compliance'],
  },
  {
    id: 'sr-5',
    act: 'Survey Regulations',
    section: 'Regulation 5',
    title: 'Accuracy Standards',
    content: 'Cadastral traverse: angular misclosure ≤ 30″√n, linear misclosure precision ≥ 1:5000. Leveling: allowable misclosure ≤ 10√K mm (K in km). Coordinate accuracy: ±0.015m in urban areas.',
    keywords: ['accuracy', 'misclosure', 'precision', 'tolerance', 'standard'],
  },
  {
    id: 'sr-6',
    act: 'Survey Regulations',
    section: 'Regulation 6',
    title: 'Control Surveys',
    content: 'All cadastral surveys shall be connected to the national control network. Control points shall be established using approved methods and instruments. GPS/GNSS control is accepted under ISK guidelines.',
    keywords: ['control', 'network', 'GPS', 'GNSS', 'reference frame'],
  },
  {
    id: 'sr-20',
    act: 'Survey Regulations',
    section: 'Regulation 20',
    title: 'Beacon Descriptions and Conditions',
    content: 'Beacon conditions: SET (new), FOUND (existing verified), DISTURBED (moved), DESTROYED (not found). Each beacon must have a complete description including type, size, setting, and adjacent features.',
    keywords: ['beacon', 'set', 'found', 'disturbed', 'destroyed', 'condition'],
  },
  {
    id: 'sr-21',
    act: 'Survey Regulations',
    section: 'Regulation 21',
    title: 'Instrument Records',
    content: 'All instruments used shall be recorded with make, model, and serial number. Calibration certificates shall be maintained. GNSS equipment must comply with ISO 17123-8.',
    keywords: ['instrument', 'calibration', 'GNSS', 'equipment', 'record'],
  },
  {
    id: 'sr-24',
    act: 'Survey Regulations',
    section: 'Regulation 24',
    title: 'Coordinate System',
    content: 'The coordinate system for Kenya is UTM (Arc 1960) on the Clarke 1880 ellipsoid. Zone 36S (30°E–36°E) and Zone 37S (36°E–42°E). SRID 21037 for Zone 37S.',
    keywords: ['coordinate', 'UTM', 'Arc 1960', 'Clarke 1880', 'zone', 'projection'],
  },
  // Registration Act
  {
    id: 'ra-2',
    act: 'Registration Act',
    section: 'Section 2',
    title: 'Interpretation — Land Registration',
    content: 'The Land Registration Act 2012 provides for the registration of land interests. The register is the definitive record of land ownership. All registered interests are protected by law.',
    keywords: ['registration', 'title', 'ownership', 'register', 'interest'],
  },
  {
    id: 'ra-7',
    act: 'Registration Act',
    section: 'Section 7',
    title: 'Land Registry',
    content: 'The Chief Land Registration Officer maintains the land registry. Survey plans must be lodged with the registry before registration of title can proceed.',
    keywords: ['registry', 'registration', 'plan', 'title', 'lodgement'],
  },
  {
    id: 'ra-14',
    act: 'Registration Act',
    section: 'Section 14',
    title: 'First Registration',
    content: 'First registration requires: (a) a survey plan authenticated by the Director of Surveys, (b) a surveyor\'s certificate, (c) beacon descriptions, (d) a deed plan. All documents must be originals or certified copies.',
    keywords: ['first registration', 'plan', 'certificate', 'deed plan', 'authentication'],
  },
  {
    id: 'ra-25',
    act: 'Registration Act',
    section: 'Section 25',
    title: 'Subdivision and Amalgamation',
    content: 'Any subdivision or amalgamation of registered land requires: (a) a licensed surveyor\'s plan, (b) Director of Surveys\' approval, (c) county government consent, (d) registration of new titles.',
    keywords: ['subdivision', 'amalgamation', 'mutation', 'consent', 'approval'],
  },
]

const ACT_FILTERS = ['All', 'Land Act', 'Survey Act', 'Survey Regulations', 'Registration Act'] as const
type ActFilter = typeof ACT_FILTERS[number]

export default function StatutoryWorkbookBuilder() {
  const [form, setForm] = useState({
    projectName: '',
    lrNumber: '',
    parcelNumber: '',
    county: '',
    locality: '',
    surveyType: 'cadastral',
    surveyDate: new Date().toISOString().slice(0, 10),
    surveyorName: '',
    iskNumber: '',
    firmName: '',
    referenceNumber: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'workbook' | 'reference'>('workbook')
  const [searchQuery, setSearchQuery] = useState('')
  const [actFilter, setActFilter] = useState<ActFilter>('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const set = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  async function downloadWorkbook() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/tools/statutory-workbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!response.ok) throw new Error('Workbook generation failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${form.referenceNumber || form.projectName || 'metardu'}-statutory-workbook.xlsx`.replace(/[^\w.-]+/g, '-')
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workbook generation failed')
    } finally {
      setBusy(false)
    }
  }

  // ── Search/filter logic ──────────────────────────────────────────────────
  const filteredRegs = REGULATIONS.filter(r => {
    const matchesAct = actFilter === 'All' || r.act === actFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q
      || r.title.toLowerCase().includes(q)
      || r.content.toLowerCase().includes(q)
      || r.section.toLowerCase().includes(q)
      || r.keywords.some(k => k.toLowerCase().includes(q))
    return matchesAct && matchesSearch
  })

  const actIcon = (act: string) => {
    if (act === 'Land Act') return <Landmark className="w-4 h-4 text-amber-500 shrink-0" />
    if (act === 'Survey Act' || act === 'Survey Regulations') return <Scale className="w-4 h-4 text-emerald-500 shrink-0" />
    return <FileText className="w-4 h-4 text-blue-500 shrink-0" />
  }

  return (
    <div className="space-y-6">
      {/* ── TAB BAR ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[var(--border-color)]">
        <button
          onClick={() => setActiveTab('workbook')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'workbook'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileDown className="w-4 h-4 inline mr-1.5" />Generate Workbook
        </button>
        <button
          onClick={() => setActiveTab('reference')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'reference'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <BookOpen className="w-4 h-4 inline mr-1.5" />Regulations Reference
        </button>
      </div>

      {/* ── WORKBOOK TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'workbook' && (
        <>
          {error && (
            <div className="border border-red-800/60 bg-red-950/30 text-red-300 rounded p-3 text-sm">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Workbook Header</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Project Name" value={form.projectName} onChange={v => set('projectName', v)} />
              <Field label="LR Number" value={form.lrNumber} onChange={v => set('lrNumber', v)} />
              <Field label="Parcel Number" value={form.parcelNumber} onChange={v => set('parcelNumber', v)} />
              <Field label="County" value={form.county} onChange={v => set('county', v)} />
              <Field label="Locality" value={form.locality} onChange={v => set('locality', v)} />
              <label className="block">
                <span className="block text-xs text-[var(--text-muted)] mb-1">Survey Type</span>
                <select className="input w-full text-sm" value={form.surveyType} onChange={event => set('surveyType', event.target.value)}>
                  {surveyTypes.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ').toUpperCase()}</option>)}
                </select>
              </label>
              <Field label="Survey Date" type="date" value={form.surveyDate} onChange={v => set('surveyDate', v)} />
              <Field label="Reference Number" value={form.referenceNumber} onChange={v => set('referenceNumber', v)} placeholder="e.g. RS149_2026_001_R00" />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Surveyor</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Surveyor Name" value={form.surveyorName} onChange={v => set('surveyorName', v)} />
              <Field label="ISK Number" value={form.iskNumber} onChange={v => set('iskNumber', v)} />
              <Field label="Firm Name" value={form.firmName} onChange={v => set('firmName', v)} />
            </div>
          </section>

          <div className="p-4 border border-[var(--border-color)] rounded text-xs text-[var(--text-muted)] leading-6">
            The generated workbook contains 9 statutory sheets: project details, field abstract, traverse computation,
            adjusted coordinates, levelling, area computation, bearing and distance schedule, COGO/setting out, and QA summary.
            The current tool ships with a complete compliant sample dataset so the workbook is immediately usable as a template.
          </div>

          <button
            onClick={downloadWorkbook}
            disabled={busy}
            className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] disabled:opacity-50 text-black font-bold rounded text-sm transition-colors"
          >
            {busy ? 'Generating workbook...' : 'Download 9-Sheet Statutory Workbook'}
          </button>
        </>
      )}

      {/* ── REFERENCE TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'reference' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                aria-label="Search regulations, sections, keywords..."
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
              />
            </div>
          </div>

          {/* Act filter chips */}
          <div className="flex gap-2 flex-wrap">
            {ACT_FILTERS.map(act => (
              <button
                key={act}
                onClick={() => setActFilter(act)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  actFilter === act
                    ? 'bg-[var(--accent)] text-black border-[var(--accent)] font-semibold'
                    : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)]'
                }`}
              >
                {act}
              </button>
            ))}
          </div>

          {/* Results count */}
          <p className="text-xs text-[var(--text-muted)]">
            {filteredRegs.length} section{filteredRegs.length !== 1 ? 's' : ''} found
          </p>

          {/* Regulation list */}
          <div className="space-y-2">
            {filteredRegs.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)]">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No matching regulations found.</p>
                <p className="text-xs mt-1">Try adjusting your search or filter.</p>
              </div>
            ) : (
              filteredRegs.map(reg => (
                <div key={reg.id} className="card overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[color-mix(in_srgb,var(--bg-secondary)_50%,transparent)] transition-colors"
                    onClick={() => setExpandedId(expandedId === reg.id ? null : reg.id)}
                  >
                    {actIcon(reg.act)}
                    <span className="text-xs font-mono text-[var(--text-muted)] shrink-0">{reg.section}</span>
                    <span className="text-sm font-medium text-[var(--text-primary)] flex-1">{reg.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] shrink-0 hidden sm:inline">{reg.act}</span>
                    <span className="text-[var(--text-muted)] text-xs shrink-0">
                      {expandedId === reg.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </button>
                  {expandedId === reg.id && (
                    <div className="border-t border-[var(--border-color)] px-4 py-4 space-y-3">
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{reg.content}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {reg.keywords.map(kw => (
                          <span key={kw} className="text-xs px-2 py-0.5 bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { act: 'Land Act', icon: <Landmark className="w-5 h-5" />, count: REGULATIONS.filter(r => r.act === 'Land Act').length, color: 'text-amber-500' },
              { act: 'Survey Act', icon: <Scale className="w-5 h-5" />, count: REGULATIONS.filter(r => r.act === 'Survey Act').length, color: 'text-emerald-500' },
              { act: 'Survey Regulations', icon: <Scale className="w-5 h-5" />, count: REGULATIONS.filter(r => r.act === 'Survey Regulations').length, color: 'text-emerald-500' },
              { act: 'Registration Act', icon: <FileText className="w-5 h-5" />, count: REGULATIONS.filter(r => r.act === 'Registration Act').length, color: 'text-blue-500' },
            ].map(({ act, icon, count, color }) => (
              <div key={act} className="card p-4 text-center">
                <div className={`flex justify-center ${color} mb-2`}>{icon}</div>
                <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">{count}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{act}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="block text-xs text-[var(--text-muted)] mb-1">{label}</span>
      <input
        className="input w-full text-sm"
        type={type}
        value={value}
        placeholder={placeholder || label}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  )
}
