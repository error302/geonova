'use client'

import { useState } from 'react'
import { Calculator, Plus, Trash2, CheckCircle, XCircle, AlertCircle, Clock, FileText } from 'lucide-react'
import { computeAdversePossession, getRequiredEvidenceTypes } from '@/lib/compute/adversePossession'
import type { AdversePossessionAnalysis, AdversePossessionEvidenceInput } from '@/lib/compute/adversePossession'

export default function AdversePossessionCalc() {
  const [parcelId, setParcelId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [evidence, setEvidence] = useState<AdversePossessionEvidenceInput[]>([])
  const [analysis, setAnalysis] = useState<AdversePossessionAnalysis | null>(null)

  const evidenceTypes = getRequiredEvidenceTypes()

  const addEvidence = (type: AdversePossessionEvidenceInput['type']) => {
    setEvidence([
      ...evidence,
      {
        type,
        description: '',
        date: startDate || new Date().toISOString().split('T')[0]
      }
    ])
  }

  const updateEvidence = (index: number, field: keyof AdversePossessionEvidenceInput, value: string) => {
    const updated = [...evidence]
    updated[index] = { ...updated[index], [field]: value }
    setEvidence(updated)
  }

  const removeEvidence = (index: number) => {
    setEvidence(evidence.filter((_, i) => i !== index))
  }

  const handleCalculate = () => {
    if (!parcelId || !startDate) return

    const result = computeAdversePossession({
      parcelId,
      startDate,
      endDate: endDate || undefined,
      evidence
    })
    setAnalysis(result)
  }

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'STRONG': return 'text-green-600 bg-green-50'
      case 'MODERATE': return 'text-yellow-600 bg-yellow-50'
      case 'WEAK': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
        <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          Adverse Possession Calculator
        </h3>
        <p className="text-sm text-indigo-700 mt-1">
          Calculate whether you meet requirements for acquiring land through adverse possession under Kenyan law
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Parcel ID / LR Number
            </label>
            <input
              type="text"
              value={parcelId}
              onChange={e => setParcelId(e.target.value)}
              placeholder="e.g., NAIROBI BLOCK 2/1234"
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Possession Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date (if ended)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Evidence Collection
              </label>
              <span className="text-xs text-gray-500">Add evidence to strengthen your case</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {evidenceTypes.map(type => (
                <button
                  key={type.type}
                  onClick={() => addEvidence(type.type as AdversePossessionEvidenceInput['type'])}
                  className={`text-xs px-2 py-1 rounded-full border ${
                    type.priority === 'HIGH'
                      ? 'border-red-300 text-red-700 hover:bg-red-50'
                      : type.priority === 'MEDIUM'
                      ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  + {type.type.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {evidence.map((ev, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{ev.type.replace('_', ' ')}</span>
                    <button
                      onClick={() => removeEvidence(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={ev.date}
                      onChange={e => updateEvidence(index, 'date', e.target.value)}
                      className="text-sm p-1 border rounded"
                    />
                    <input
                      type="text"
                      value={ev.description}
                      onChange={e => updateEvidence(index, 'description', e.target.value)}
                      placeholder="Description of evidence"
                      className="text-sm p-1 border rounded"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleCalculate}
            disabled={!parcelId || !startDate}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            Calculate Adverse Possession
          </button>
        </div>

        <div>
          {analysis ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${
                analysis.meetsRequirements 
                  ? 'bg-green-50 border-green-300' 
                  : analysis.duration >= 10
                  ? 'bg-yellow-50 border-yellow-300'
                  : 'bg-red-50 border-red-300'
              }`}>
                <div className="flex items-center gap-3">
                  {analysis.meetsRequirements ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : analysis.duration >= 10 ? (
                    <Clock className="w-8 h-8 text-yellow-600" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-600" />
                  )}
                  <div>
                    <h4 className="font-semibold">
                      {analysis.meetsRequirements 
                        ? 'Ready to File!' 
                        : analysis.duration >= 10
                        ? 'Case Developing'
                        : 'Not Eligible Yet'}
                    </h4>
                    <p className="text-sm">
                      {analysis.duration} years of possession • {analysis.yearsRemaining} years remaining
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm">{analysis.recommendation}</p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg">
                <FileText className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium">Evidence Strength: </span>
                <span className={`px-2 py-0.5 rounded text-sm font-medium ${getStrengthColor(analysis.strength)}`}>
                  {analysis.strength}
                </span>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">Requirements Analysis</h4>
                {analysis.requirements.map((req, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {req.met ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="font-medium text-sm">{req.name}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${getStrengthColor(req.strength)}`}>
                        {req.strength}
                      </span>
                    </div>
                    {req.evidence.length > 0 && (
                      <ul className="mt-2 ml-6 text-xs text-gray-600">
                        {req.evidence.map((ev, i) => (
                          <li key={i}>• {ev}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">Analysis Steps</h4>
                {analysis.steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 p-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      step.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {step.passed ? '✓' : '✗'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="text-xs text-gray-600">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Enter details and add evidence to calculate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
