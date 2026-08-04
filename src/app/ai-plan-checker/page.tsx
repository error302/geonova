'use client';

import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { checkSurveyPlan, type PlanCheckInput, type PlanCheckResult } from '@/lib/marketplace/aiPlanChecker'
import {
  AlertCircle, CheckCircle2, AlertTriangle, Upload, FileText, Shield,
} from 'lucide-react'

interface ImportedPoint {
  name: string
  easting: number
  northing: number
  elevation?: number
}

export default function AIPlanCheckerPage() {
  const [projectName, setProjectName] = useState('')
  const [surveyType, setSurveyType] = useState<PlanCheckInput['surveyType']>('boundary')
  const [country, setCountry] = useState<PlanCheckInput['country']>('kenya')
  const [csvText, setCsvText] = useState('')
  const [result, setResult] = useState<PlanCheckResult | null>(null)
  const [error, setError] = useState('')

  const handleCheck = useCallback(() => {
    setError('')
    setResult(null)

    if (!projectName.trim()) {
      setError('Project name is required.')
      return
    }

    // Parse CSV: name,easting,northing,elevation
    const lines = csvText.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'))
    if (lines.length < 3) {
      setError('At least 3 survey points are required. Paste CSV data (name,easting,northing,elevation).')
      return
    }

    const points: ImportedPoint[] = []
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim())
      if (parts.length < 3) {
        setError(`Line ${i + 1}: expected at least 3 columns (name,easting,northing)`)
        return
      }
      const easting = parseFloat(parts[1])
      const northing = parseFloat(parts[2])
      const elevation = parts[3] ? parseFloat(parts[3]) : undefined
      if (isNaN(easting) || isNaN(northing)) {
        setError(`Line ${i + 1}: invalid coordinates`)
        return
      }
      points.push({ name: parts[0], easting, northing, elevation })
    }

    const input: PlanCheckInput = {
      projectName,
      surveyType,
      country,
      points,
    }

    const res = checkSurveyPlan(input)
    setResult(res)
  }, [projectName, surveyType, country, csvText])

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />
      case 'info': return <CheckCircle2 className="w-4 h-4 text-blue-400" />
      default: return <CheckCircle2 className="w-4 h-4 text-green-400" />
    }
  }

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'border-red-700/40 bg-red-950/20'
      case 'warning': return 'border-amber-700/40 bg-amber-950/20'
      case 'info': return 'border-blue-700/40 bg-blue-950/20'
      default: return 'border-green-700/40 bg-green-950/20'
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <PageHeader
        title="Plan Compliance Checker"
        subtitle="Automated survey plan compliance checking against regulatory standards"
        reference="Survey Act Cap. 299 | RDM 1.1 | Survey Regulations 1994"
        // AUDIT FIX (2026-07-03): Removed the 'AI' badge — the checker
        // is a deterministic rule engine (5 + 14 rules), not an LLM.
        // Calling it 'AI' was misleading. The functionality is real;
        // only the label was wrong.
      />

      {/* Input form */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5" htmlFor="project-name">Project Name</label>
            <input id="project-name"
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="LR 2090/42"
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5" htmlFor="survey-type">Survey Type</label>
            <select id="survey-type"
              value={surveyType}
              onChange={e => setSurveyType(e.target.value as PlanCheckInput['surveyType'])}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="boundary">Boundary / Cadastral</option>
              <option value="traverse">Traverse</option>
              <option value="leveling">Levelling</option>
              <option value="topographic">Topographic</option>
              <option value="engineering">Engineering</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1.5" htmlFor="country">Country</label>
            <select id="country"
              value={country}
              onChange={e => setCountry(e.target.value as PlanCheckInput['country'])}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="kenya">Kenya</option>
              <option value="uganda">Uganda</option>
              <option value="tanzania">Tanzania</option>
              <option value="nigeria">Nigeria</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-[var(--text-muted)] mb-1.5" htmlFor="survey-points-csv-format-name-easting-northing-elevation">
            Survey Points (CSV format: name, easting, northing, elevation)
          </label>
          <textarea
             id="survey-points-csv-format-name-easting-northing-elevation" value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder="TS1, 274812.403, 9856214.778, 1895.250&#10;TS2, 274937.125, 9856340.501, 1897.100&#10;TS3, 275061.802, 9856466.234, 1899.550"
            rows={6}
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/20 border border-red-700/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleCheck}
          className="px-6 py-2.5 bg-[var(--accent)] text-[var(--bg-primary)] font-semibold rounded-lg text-sm hover:bg-[var(--accent-dim)] transition-colors"
        >
          <Shield className="w-4 h-4 inline mr-2" />
          Run Compliance Check
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Score */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Compliance Score</h2>
              <div className={`text-3xl font-bold ${
                result.overallScore >= 80 ? 'text-green-400' :
                result.overallScore >= 50 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {result.overallScore}/100
              </div>
            </div>
            <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium ${
              result.grade === 'excellent' ? 'bg-green-900/40 text-green-300' :
              result.grade === 'good' ? 'bg-blue-900/40 text-blue-300' :
              result.grade === 'acceptable' ? 'bg-amber-900/40 text-amber-300' :
              'bg-red-900/40 text-red-300'
            }`}>
              Grade: {result.grade} · {result.passed ? 'PASSES' : 'FAILS'} compliance
            </div>
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                Issues Found ({result.issues.length})
              </h2>
              <div className="space-y-2">
                {result.issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${severityColor(issue.severity)}`}
                  >
                    {severityIcon(issue.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{issue.title}</span>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)]">
                          {issue.category}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">{issue.description}</p>
                      {issue.recommendation && (
                        <p className="text-xs text-[var(--accent)] mt-1">→ {issue.recommendation}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.issues.length === 0 && (
            <div className="bg-green-950/20 border border-green-700/40 rounded-xl p-6 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-300">No compliance issues found. Plan meets all regulatory requirements.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
