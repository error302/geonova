'use client';

import { useState } from 'react'
import { Clipboard } from 'lucide-react'

export interface PrintMeta {
  projectName: string
  clientName: string
  surveyorName: string
  surveyorEmail: string
  clientEmail: string
  regNo: string
  iskNo: string
  date: string
  instrument: string
  weather: string
  observer: string
  submissionNo: string
}

export const defaultPrintMeta: PrintMeta = {
  projectName: '',
  clientName: '',
  surveyorName: '',
  surveyorEmail: '',
  clientEmail: '',
  regNo: '',
  iskNo: '',
  date: new Date().toISOString().slice(0, 10),
  instrument: '',
  weather: '',
  observer: '',
  submissionNo: '',
}

interface PrintMetaPanelProps {
  meta: PrintMeta
  onChange: (meta: PrintMeta) => void
}

const FIELDS: { key: keyof PrintMeta; label: string; placeholder?: string; type?: string }[] = [
  { key: 'projectName',   label: 'Project Name' },
  { key: 'clientName',    label: 'Client Name' },
  { key: 'surveyorName',  label: 'Surveyor Name' },
  { key: 'surveyorEmail', label: 'Surveyor Email', type: 'email' },
  { key: 'clientEmail',   label: 'Client Email', type: 'email' },
  { key: 'regNo',         label: 'Registration No.' },
  { key: 'iskNo',         label: 'ISK Membership No.' },
  { key: 'date',          label: 'Survey Date', type: 'date' },
  { key: 'instrument',    label: 'Instrument (make / model)', placeholder: 'e.g. Leica Sprinter 250M' },
  { key: 'observer',      label: 'Observer / Field Assistant' },
  { key: 'weather',       label: 'Weather Conditions', placeholder: 'e.g. Clear, wind < 5 km/h' },
  { key: 'submissionNo',  label: 'Submission No. (SRVY2025-1)', placeholder: 'e.g. RS149_2025_001_R00' },
]

/**
 * PrintMetaPanel — collapsible panel for filling in print header details.
 *
 * Rendered above every Print button in compute tool pages.
 * These details populate the standard document header required by:
 * Survey Regulations 1994 | RDM 1.1 (2025) Table 5.4 | SRVY2025-1
 */
export function PrintMetaPanel({ meta, onChange }: PrintMetaPanelProps) {
  const [open, setOpen] = useState(false)

  const set = (key: keyof PrintMeta, value: string) =>
    onChange({ ...meta, [key]: value })

  const filledCount = (Object.values(meta) as string[]).filter(v => v && v.trim()).length

  return (
    <div className="mb-4 border border-[var(--border-color)] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] transition-colors text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium flex items-center gap-1.5"><Clipboard className="w-4 h-4" /> Print Header</span>
          <span className="text-xs text-[var(--text-muted)]">
            project · surveyor · instrument — required for official output
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {filledCount > 0 && (
            <span className="text-xs bg-[var(--accent-subtle)] text-[var(--accent)] px-2 py-0.5 rounded font-mono">
              {filledCount}/{FIELDS.length}
            </span>
          )}
          <span className="text-[var(--text-muted)] text-xs">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="p-4 border-t border-[var(--border-color)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FIELDS.map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label className="block text-xs text-[var(--text-muted)] mb-1 font-medium" htmlFor={`pmp-${key}`}>
                  {label}
                </label>
                <input id={`pmp-${key}`}
                  className="input w-full text-sm"
                  type={type || 'text'}
                  value={meta[key]}
                  placeholder={placeholder || label}
                  onChange={e => set(key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            These fields appear in the document header and surveyor's certificate on all printed outputs.
            Required for formal submissions under <span className="font-mono">Survey Regulations 1994</span>{' '}
            and <span className="font-mono">SRVY2025-1</span>.
          </p>
        </div>
      )}
    </div>
  )
}
