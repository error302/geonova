'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, CheckCircle2, AlertCircle, Download, FileText } from 'lucide-react'

export default function PortfolioPage() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadPortfolio() }, [])

  const loadPortfolio = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/portfolio')
      if (res.ok) { const data = await res.json(); setReport(data.data) }
    } catch {} finally { setLoading(false) }
  }

  const inputCls = "w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)]"

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-muted)]">Loading portfolio...</div>
  if (!report) return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-muted)]">Failed to load portfolio.</div>

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2"><GraduationCap className="w-6 h-6" /> License Application Portfolio</h1>
          <p className="text-sm text-[var(--text-muted)]">Kenya Land Surveyors' Board — practical experience portfolio per March 2025 guidelines</p>
        </div>
      </div>

      {/* Overall status */}
      <div className={`p-4 rounded-xl mb-6 ${report.allMandatoryMet && report.atLeastOneElectiveMet ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
        <div className="flex items-center gap-2 mb-1">
          {report.allMandatoryMet && report.atLeastOneElectiveMet ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <AlertCircle className="w-5 h-5 text-yellow-400" />}
          <span className={`text-sm font-semibold ${report.allMandatoryMet && report.atLeastOneElectiveMet ? 'text-green-400' : 'text-yellow-400'}`}>
            {report.allMandatoryMet && report.atLeastOneElectiveMet ? 'PORTFOLIO COMPLETE' : 'PORTFOLIO INCOMPLETE'}
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{report.summary}</p>
      </div>

      {/* Mandatory requirements */}
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Mandatory Requirements</h2>
      <div className="space-y-3 mb-6">
        {report.requirements.map((req: any) => (
          <div key={req.id} className={`p-4 rounded-xl border ${req.met ? 'bg-green-500/5 border-green-500/15' : 'bg-red-500/5 border-red-500/15'}`}>
            <div className="flex justify-between items-start mb-1">
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{req.category}</span>
                {req.met ? <CheckCircle2 className="w-4 h-4 text-green-400 inline ml-2" /> : <AlertCircle className="w-4 h-4 text-red-400 inline ml-2" />}
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[var(--text-muted)]">Required: {req.minimumRequired}</div>
                <div className={`text-xs font-mono ${req.met ? 'text-green-400' : 'text-red-400'}`}>{req.userHas}</div>
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mb-2">{req.description}</p>
            {req.projects.length > 0 && (
              <div className="text-[10px] text-[var(--text-secondary)]">
                Projects: {req.projects.map((p: any) => p.name).join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Electives */}
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Elective (select one)</h2>
      <div className="space-y-3 mb-6">
        {report.electives.map((req: any) => (
          <div key={req.id} className={`p-4 rounded-xl border ${req.met ? 'bg-green-500/5 border-green-500/15' : 'bg-[var(--bg-secondary)]/50 border-[var(--border-color)]'}`}>
            <div className="flex justify-between items-start mb-1">
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{req.category}</span>
                {req.met && <CheckCircle2 className="w-4 h-4 text-green-400 inline ml-2" />}
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[var(--text-muted)]">Required: {req.minimumRequired}</div>
                <div className={`text-xs font-mono ${req.met ? 'text-green-400' : 'text-[var(--text-muted)]'}`}>{req.userHas}</div>
              </div>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">{req.description}</p>
          </div>
        ))}
      </div>

      {/* Missing items */}
      {report.missingItems.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-semibold text-yellow-400 mb-2">Missing Requirements</h3>
          {report.missingItems.map((item: string, i: number) => (
            <div key={i} className="text-xs text-yellow-300/80 flex gap-2"><span>•</span> {item}</div>
          ))}
        </div>
      )}

      {/* Declaration Forms */}
      <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Declaration Forms (Third Schedule)</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Form A — Declaration of Supervision</h3>
          <pre className="text-[9px] text-[var(--text-secondary)] whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">{report.declarationFormA}</pre>
          <button onClick={() => { const blob = new Blob([report.declarationFormA], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'Form_A_Declaration.txt'; a.click(); URL.revokeObjectURL(url) }} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] text-[10px] font-semibold rounded-lg hover:bg-[var(--accent)]/25">
            <Download className="w-3 h-3" /> Download Form A
          </button>
        </div>
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-2">Form B — Declaration of Qualifications</h3>
          <pre className="text-[9px] text-[var(--text-secondary)] whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">{report.declarationFormB}</pre>
          <button onClick={() => { const blob = new Blob([report.declarationFormB], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'Form_B_Declaration.txt'; a.click(); URL.revokeObjectURL(url) }} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] text-[10px] font-semibold rounded-lg hover:bg-[var(--accent)]/25">
            <Download className="w-3 h-3" /> Download Form B
          </button>
        </div>
      </div>
    </div>
  )
}
