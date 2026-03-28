'use client'

import { useState } from 'react'
import { Gavel, FileText, Clock, DollarSign, ChevronRight, Building2 } from 'lucide-react'
import { getDisputeProcedureByType, getAllDisputeTypes } from '@/lib/data/disputeProcedures'
import type { DisputeProcedure, DisputeType } from '@/types/landLaw'
import { DISPUTE_TYPE_LABELS } from '@/types/landLaw'

export default function DisputeGuide() {
  const [selectedType, setSelectedType] = useState<DisputeType | null>(null)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)

  const disputeTypes = getAllDisputeTypes()

  const selectedProcedure = selectedType ? getDisputeProcedureByType(selectedType) : null

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4 border border-red-200">
        <h3 className="font-semibold text-red-900 flex items-center gap-2">
          <Gavel className="w-5 h-5" />
          Dispute Resolution Guide
        </h3>
        <p className="text-sm text-red-700 mt-1">
          Navigate Kenyan land dispute procedures from negotiation to court
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Dispute Types</h4>
          <div className="space-y-2">
            {disputeTypes.map(({ type }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedType === type
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium">{DISPUTE_TYPE_LABELS[type]}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          {selectedProcedure ? (
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-lg border">
                <h4 className="font-semibold text-lg text-gray-900">{selectedProcedure.title}</h4>
                <p className="text-gray-600 mt-2">{selectedProcedure.description}</p>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Timeframe</p>
                      <p className="text-sm font-medium">{selectedProcedure.timeframe}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                    <DollarSign className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-xs text-gray-500">Estimated Cost</p>
                      <p className="text-sm font-medium">{selectedProcedure.estimatedCost}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700">Jurisdiction: {selectedProcedure.jurisdiction}</p>
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border">
                <h5 className="font-medium text-gray-700 mb-3">Resolution Stages</h5>
                <div className="flex flex-wrap gap-2">
                  {selectedProcedure.stages.map((stage, index) => (
                    <button
                      key={stage}
                      onClick={() => setExpandedStage(expandedStage === stage ? null : stage)}
                      className={`px-3 py-1 text-sm rounded-full flex items-center gap-1 ${
                        expandedStage === stage
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {index + 1}. {stage.replace(/_/g, ' ')}
                      <ChevronRight className={`w-3 h-3 transition-transform ${expandedStage === stage ? 'rotate-90' : ''}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-white rounded-lg border">
                <h5 className="font-medium text-gray-700 mb-3">Required Documents</h5>
                <ul className="space-y-2">
                  {selectedProcedure.requiredDocuments.map((doc, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedProcedure.mediationSteps && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="font-medium text-blue-900 mb-3">Mediation Steps</h5>
                  <ol className="space-y-2">
                    {selectedProcedure.mediationSteps.map((step, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                        <span className="font-medium">{index + 1}.</span>
                        <span>{step.replace(/^\d+\.\s*/, '')}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-700 mb-3">Precedent Cases</h5>
                <ul className="space-y-2">
                  {selectedProcedure.precedentCases.map((case_, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Gavel className="w-4 h-4 text-amber-500 mt-0.5" />
                      <span className="text-gray-700">{case_}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Gavel className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Select a dispute type to see resolution procedures</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
