'use client';

import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { PrintMetaPanel, defaultPrintMeta, type PrintMeta } from '@/components/shared/PrintMetaPanel'
import { buildPrintDocument, openPrint } from '@/lib/print/buildPrintDocument'
import { CONTROL_MARK_REGISTER_COLUMNS } from '@/lib/standards/rdm11'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface MarkRow {
  id: string
  type: string
  order: string
  easting: string
  northing: string
  elevation: string
  description: string
  condition: string
  photoRef: string
  witnessNotes: string
}

const blankRow = (): MarkRow => ({
  id: '',
  type: 'Concrete Pillar',
  order: 'SECONDARY',
  easting: '',
  northing: '',
  elevation: '',
  description: '',
  condition: 'FOUND GOOD',
  photoRef: '',
  witnessNotes: '',
})

const FIELD_WIDTHS: Record<keyof MarkRow, string> = {
  id: 'min-w-[120px]',
  type: 'min-w-[170px]',
  order: 'min-w-[140px]',
  easting: 'min-w-[150px]',
  northing: 'min-w-[160px]',
  elevation: 'min-w-[140px]',
  description: 'min-w-[320px]',
  condition: 'min-w-[150px]',
  photoRef: 'min-w-[160px]',
  witnessNotes: 'min-w-[360px]',
}

const FIELD_LABELS: Record<keyof MarkRow, string> = {
  id: 'Mark ID',
  type: 'Type',
  order: 'Order',
  easting: 'Easting (m)',
  northing: 'Northing (m)',
  elevation: 'Elevation (m)',
  description: 'Description',
  condition: 'Condition',
  photoRef: 'Photo / Sketch Ref',
  witnessNotes: 'Witness / Recovery Notes',
}

function esc(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function ControlMarksRegisterPage() {
  const { t } = useLanguage()
  const [meta, setMeta] = useState<PrintMeta>(defaultPrintMeta)
  const [rows, setRows] = useState<MarkRow[]>([blankRow()])

  const updateRow = (index: number, field: keyof MarkRow, value: string) => {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  // loadDemo removed — PHASE13_DEMO_PROJECTS was removed

  const handlePrint = () => {
    const bodyRows = rows.map(row => `
      <tr>
        <td class="mono bold">${esc(row.id)}</td>
        <td>${esc(row.type)}</td>
        <td>${esc(row.order)}</td>
        <td class="right mono">${esc(row.easting)}</td>
        <td class="right mono">${esc(row.northing)}</td>
        <td class="right mono">${esc(row.elevation)}</td>
        <td>${esc(row.description)}</td>
        <td>${esc(row.condition)}</td>
        <td class="mono">${esc(row.photoRef)}</td>
        <td>${esc(row.witnessNotes)}</td>
      </tr>
    `).join('')

    openPrint(buildPrintDocument(`
      <h2>Survey Control Marks Register</h2>
      <table>
        <tr>${CONTROL_MARK_REGISTER_COLUMNS.map(c => `<th>${c}</th>`).join('')}</tr>
        ${bodyRows}
      </table>
      <div class="summary-box">
        <div class="summary-row"><span class="summary-label">Total Marks</span><span class="summary-value">${rows.length}</span></div>
        <div class="summary-row"><span class="summary-label">Reference</span><span class="summary-value">RDM 1.1 Section 5.6.3 | Survey Regulations 1994</span></div>
      </div>
    `, {
      title: 'Survey Control Marks Register',
      reference: 'RDM 1.1 (2025) Section 5.6.3 | Survey Regulations 1994 | Survey Act Cap 299',
      ...meta,
    }))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.controlMarksRegister')}
        subtitle={t('tools.controlMarksRegisterDesc')}
        reference="RDM 1.1 (2025) Section 5.6.3 | Survey Regulations 1994 | Survey Act Cap 299"
        badge="RDM 5.6.3"
      />

      <div className="card mb-6">
        <div className="card-header flex items-center justify-between gap-4">
          <span className="label">Register Header</span>
        </div>
        <div className="p-4">
          <PrintMetaPanel meta={meta} onChange={setMeta} />
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between gap-4">
          <span className="label">Control Marks</span>
          <button onClick={() => setRows(prev => [...prev, blankRow()])} className="btn btn-secondary">Add Mark</button>
        </div>
        <div className="overflow-x-auto">
          <table className="table min-w-[2130px]">
            <thead>
              <tr>
                {CONTROL_MARK_REGISTER_COLUMNS.map(column => <th key={column}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row}-${index}`}>
                  {(Object.keys(row) as (keyof MarkRow)[]).map(field => (
                    <td key={field}>
                      <input aria-label={FIELD_LABELS[field]}
                        className={`input ${FIELD_WIDTHS[field]} text-xs`}
                        value={row[field]}
                        onChange={e => updateRow(index, field, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={handlePrint} className="btn btn-primary">Print Control Marks Register</button>
      </div>
    </div>
  )
}
