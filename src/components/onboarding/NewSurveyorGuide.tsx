'use client'

/**
 * NewSurveyorGuide — Onboarding + document checklist for new surveyors.
 *
 * Two components:
 *   1. OnboardingTour: Interactive walkthrough of the 5-step workflow
 *      with sample data and glossary.
 *   2. DocumentChecklist: Per-survey-type document requirements with
 *      upload tracking.
 *
 * Designed for surveyors who just got their ISK license and don't know
 * what documents they need or how the workflow goes.
 */

import { useState } from 'react'
import {
  BookOpen, CheckCircle2, Circle, Upload, FileText,
  ChevronRight, ChevronLeft, X, HelpCircle,
  ClipboardList, FolderOpen, PenTool, Calculator,
  FileCheck, Send,
} from 'lucide-react'

// ─── 1. Onboarding Tour ─────────────────────────────────────────────────────

const TOUR_STEPS = [
  {
    icon: FolderOpen,
    title: 'Step 1: Setup',
    description: 'Create a new project. Enter the project name, LR number, client info, and select the UTM zone (37S for most of Kenya).',
    tip: 'The LR number is on the title deed — it looks like "NAIROBI/BLOCK 72/1234".',
  },
  {
    icon: PenTool,
    title: 'Step 2: Field Book',
    description: 'Record your traverse observations. Connect your total station via USB for automatic readings, or enter them manually. The field book supports traverse, leveling, and control surveys.',
    tip: 'For cadastral surveys, you need a closed traverse (starts and ends at the same point). Minimum precision: 1:5000 per Cap. 299.',
  },
  {
    icon: Calculator,
    title: 'Step 3: Compute',
    description: 'METARDU automatically runs the Bowditch adjustment, computes coordinates, and calculates the parcel area. The real-time QC panel shows your precision ratio as you enter data.',
    tip: 'If the precision ratio is below 1:5000, you will get a notification. Check your bearings and distances for errors before continuing.',
  },
  {
    icon: FileCheck,
    title: 'Step 4: Review',
    description: 'Review the traverse diagram, boundary plan, and computation results. The statutory validation gate checks Cap. 299 compliance and flags any issues before you can export.',
    tip: 'The cross-checks verify your area computation using two independent methods. If they disagree, there is a computation error.',
  },
  {
    icon: Send,
    title: 'Step 5: Submission',
    description: 'Generate the deed plan (Form No. 4), Form C22, and NLIMS-ready export. Download all documents as a package for submission to the Survey of Kenya.',
    tip: 'The statutory gate must pass before you can export. If it blocks, fix the issues in Steps 2-4 first.',
  },
]

const GLOSSARY = [
  { term: 'LR Number', definition: 'Land Reference number — the unique identifier for a parcel on the title deed.' },
  { term: 'Bowditch Adjustment', definition: 'A method of distributing traverse misclosure proportionally to leg distances.' },
  { term: 'Misclosure', definition: 'The difference between the known closing position and the computed position. Should be < 50mm for cadastral.' },
  { term: 'Precision Ratio', definition: 'Total distance divided by misclosure. Expressed as 1:N. Minimum 1:5000 for cadastral per Cap. 299.' },
  { term: 'Cap. 299', definition: 'Survey Act Chapter 299 — the primary Kenyan surveying legislation.' },
  { term: 'RDM 1.1', definition: 'Survey Regulations Manual — defines tolerances, procedures, and deliverables.' },
  { term: 'ISK', definition: 'Institution of Surveyors of Kenya — the professional body for licensed surveyors.' },
  { term: 'SoK', definition: 'Survey of Kenya — the government agency that regulates surveying and maintains records.' },
  { term: 'NLIMS', definition: 'National Land Management Information System — the digital land registry platform.' },
  { term: 'Form No. 4', definition: 'The official deed plan form required for land registration.' },
  { term: 'Form C22', definition: 'The cadastral form used for mutation surveys.' },
  { term: 'Beacon', definition: 'A physical marker (concrete, iron pin, etc.) placed at boundary corners.' },
  { term: 'Cassini-Soldner', definition: 'A legacy projection system used in older Kenyan colonial surveys.' },
  { term: 'UTM', definition: 'Universal Transverse Mercator — the standard grid coordinate system. Kenya uses zones 36 and 37.' },
]

export function OnboardingTour({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState(0)
  const [showGlossary, setShowGlossary] = useState(false)
  const current = TOUR_STEPS[step]
  const Icon = current.icon

  if (showGlossary) {
    return (
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Surveying Glossary (Kenya)</h3>
          <button onClick={() => setShowGlossary(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            Back to tour
          </button>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {GLOSSARY.map(g => (
            <div key={g.term} className="border-b border-[var(--border-color)] pb-2">
              <p className="text-xs font-semibold text-[var(--accent)]">{g.term}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{g.definition}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Your First Survey — A Walkthrough</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-4">
        {TOUR_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'}`}
          />
        ))}
      </div>

      {/* Current step */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">{current.title}</h4>
          <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{current.description}</p>
          <div className="mt-2 flex items-start gap-1.5 text-xs text-[var(--accent)] bg-[var(--accent)]/10 rounded-lg p-2">
            <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{current.tip}</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowGlossary(true)}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center gap-1"
        >
          <BookOpen className="w-3.5 h-3.5" /> Glossary
        </button>
        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}
          {step < TOUR_STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-[var(--accent)] text-black rounded-lg"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-semibold bg-[var(--accent)] text-black rounded-lg"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Got it
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 2. Document Checklist ──────────────────────────────────────────────────

interface DocumentItem {
  name: string
  required: boolean
  uploaded: boolean
  description: string
}

const DOC_REQUIREMENTS: Record<string, DocumentItem[]> = {
  cadastral: [
    { name: 'Survey Order', required: true, uploaded: false, description: 'Authorization from the client to conduct the survey' },
    { name: 'Title Deed', required: true, uploaded: false, description: 'Copy of the current title deed for the parcel' },
    { name: 'RIM Extract', required: true, uploaded: false, description: 'Registry Index Map sheet showing the parcel location' },
    { name: 'Mutation Form', required: true, uploaded: false, description: 'Form signed by the client authorizing the boundary change' },
    { name: 'Deed Plan (Form No. 4)', required: false, uploaded: false, description: 'Generated by METARDU after computation' },
    { name: 'Form C22', required: false, uploaded: false, description: 'Generated by METARDU for submission' },
    { name: 'Survey Report', required: false, uploaded: false, description: 'Generated by METARDU per RDM 1.1 template' },
  ],
  engineering: [
    { name: 'Design Drawings', required: true, uploaded: false, description: 'Road/structure design drawings from the engineer' },
    { name: 'Setting-Out Schedule', required: true, uploaded: false, description: 'List of design coordinates for staking' },
    { name: 'Control Point Schedule', required: true, uploaded: false, description: 'Known control points in the project area' },
    { name: 'As-Built Drawings', required: false, uploaded: false, description: 'Generated after construction survey' },
    { name: 'Cross-Section Drawings', required: false, uploaded: false, description: 'Generated by METARDU from field data' },
    { name: 'Earthwork Quantities', required: false, uploaded: false, description: 'Cut/fill volumes computed by METARDU' },
  ],
  topographic: [
    { name: 'Task Brief', required: true, uploaded: false, description: 'Scope of work from the client' },
    { name: 'Deliverables Specification', required: true, uploaded: false, description: 'Required scale, contour interval, and output format' },
    { name: 'Site Boundary Coordinates', required: true, uploaded: false, description: 'Coordinates of the survey area boundary' },
    { name: 'Topographic Plan', required: false, uploaded: false, description: 'Generated by METARDU with contours and spot heights' },
    { name: 'DXF Export', required: false, uploaded: false, description: 'AutoCAD-ready drawing with feature-coded layers' },
    { name: 'Survey Report', required: false, uploaded: false, description: 'Generated by METARDU per RDM 1.1 template' },
  ],
}

export function DocumentChecklist({ surveyType }: { surveyType: 'cadastral' | 'engineering' | 'topographic' }) {
  const [docs, setDocs] = useState<DocumentItem[]>(DOC_REQUIREMENTS[surveyType] || [])

  const toggle = (index: number) => {
    setDocs(prev => prev.map((d, i) => i === index ? { ...d, uploaded: !d.uploaded } : d))
  }

  const requiredCount = docs.filter(d => d.required).length
  const uploadedRequired = docs.filter(d => d.required && d.uploaded).length
  const allRequiredUploaded = uploadedRequired === requiredCount

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-[var(--accent)]" />
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Document Checklist</h3>
        <span className={`ml-auto text-xs font-semibold ${allRequiredUploaded ? 'text-emerald-400' : 'text-amber-400'}`}>
          {uploadedRequired}/{requiredCount} required
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all ${allRequiredUploaded ? 'bg-emerald-500' : 'bg-[var(--accent)]'}`}
          style={{ width: `${(uploadedRequired / requiredCount) * 100}%` }}
        />
      </div>

      {/* Document list */}
      <div className="space-y-1.5">
        {docs.map((doc, i) => (
          <div
            key={doc.name}
            className={`flex items-center gap-2 p-2 rounded-lg ${doc.uploaded ? 'bg-emerald-500/5' : 'bg-[var(--bg-tertiary)]/30'}`}
          >
            <button onClick={() => toggle(i)} className="shrink-0">
              {doc.uploaded
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                : <Circle className="w-4 h-4 text-[var(--text-muted)]" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${doc.uploaded ? 'text-emerald-400' : 'text-[var(--text-primary)]'}`}>
                  {doc.name}
                </span>
                {doc.required && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold uppercase">
                    Required
                  </span>
                )}
                {!doc.required && doc.name.includes('Generated') && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)] font-semibold uppercase">
                    Auto
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">{doc.description}</p>
            </div>
            {doc.required && !doc.uploaded && (
              <button
                onClick={() => toggle(i)}
                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--accent)]"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Completion message */}
      {allRequiredUploaded && (
        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded-lg p-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          All required documents are ready. You can proceed with the survey.
        </div>
      )}
    </div>
  )
}
