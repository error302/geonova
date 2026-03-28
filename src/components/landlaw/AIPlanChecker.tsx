'use client'

import { useState } from 'react'
import { FileCheck, AlertTriangle, CheckCircle, XCircle, Info, Download, RefreshCw } from 'lucide-react'
import { runPlanCheck, type PlanInput, type Coordinate, type BeaconRecord } from '@/lib/compute/planChecker'
import type { PlanCheckReport } from '@/types/landLaw'

export default function AIPlanChecker() {
  const [planData, setPlanData] = useState<Partial<PlanInput>>({
    planId: '',
    coordinates: [],
    beacons: [],
    distances: [],
    area: 0,
    perimeter: 0,
    northArrow: false,
    legend: false
  })
  const [report, setReport] = useState<PlanCheckReport | null>(null)
  const [manualMode, setManualMode] = useState(true)

  const addCoordinate = () => {
    const coords = planData.coordinates || []
    setPlanData({
      ...planData,
      coordinates: [
        ...coords,
        { id: `P${coords.length + 1}`, easting: 0, northing: 0, description: `Point ${coords.length + 1}` }
      ]
    })
  }

  const updateCoordinate = (index: number, field: keyof Coordinate, value: string | number) => {
    const coords = [...(planData.coordinates || [])]
    coords[index] = { ...coords[index], [field]: value }
    setPlanData({ ...planData, coordinates: coords })
  }

  const removeCoordinate = (index: number) => {
    const coords = (planData.coordinates || []).filter((_, i) => i !== index)
    setPlanData({ ...planData, coordinates: coords })
  }

  const addBeacon = () => {
    const beacons = planData.beacons || []
    setPlanData({
      ...planData,
      beacons: [
        ...beacons,
        { id: `B${beacons.length + 1}`, type: 'CB', coordinates: { easting: 0, northing: 0 }, description: '' }
      ]
    })
  }

  const handleRunCheck = () => {
    if (!planData.planId || !planData.coordinates?.length) return

    const distances: number[] = []
    const coords = planData.coordinates
    for (let i = 0; i < coords.length; i++) {
      const curr = coords[i]
      const next = coords[(i + 1) % coords.length]
      const dist = Math.sqrt(
        Math.pow(next.easting - curr.easting, 2) + Math.pow(next.northing - curr.northing, 2)
      )
      distances.push(dist)
    }

    const perimeter = distances.reduce((a, b) => a + b, 0)

    let area = 0
    for (let i = 0; i < coords.length; i++) {
      const curr = coords[i]
      const next = coords[(i + 1) % coords.length]
      area += curr.easting * next.northing
      area -= next.easting * curr.northing
    }
    area = Math.abs(area) / 2

    const input: PlanInput = {
      planId: planData.planId || '',
      coordinates: coords,
      bearings: [],
      beacons: planData.beacons || [],
      distances,
      area: planData.area || area,
      perimeter: planData.perimeter || perimeter,
      northArrow: planData.northArrow || false,
      legend: planData.legend || false,
      parcelNumber: planData.parcelNumber,
      titleNumber: planData.titleNumber,
      coordinatesSystem: planData.coordinatesSystem,
      scale: planData.scale,
      metadata: planData.metadata
    }

    const result = runPlanCheck(input)
    setReport(result)
  }

  const getSeverityIcon = (severity: string, passed: boolean) => {
    if (passed) return <CheckCircle className="w-4 h-4 text-green-500" />
    switch (severity) {
      case 'ERROR': return <XCircle className="w-4 h-4 text-red-500" />
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      default: return <Info className="w-4 h-4 text-blue-500" />
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
        <h3 className="font-semibold text-blue-900 flex items-center gap-2">
          <FileCheck className="w-5 h-5" />
          AI Plan Compliance Checker
        </h3>
        <p className="text-sm text-blue-700 mt-1">
          Automatically check survey plans against Kenya Survey Regulations and RDM 1.1 standards
        </p>
      </div>

      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
        <span className="text-sm font-medium">Input Mode:</span>
        <button
          onClick={() => setManualMode(true)}
          className={`px-3 py-1 text-sm rounded ${manualMode ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Manual Entry
        </button>
        <button
          onClick={() => setManualMode(false)}
          className={`px-3 py-1 text-sm rounded ${!manualMode ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Upload Plan
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan ID</label>
              <input
                type="text"
                value={planData.planId || ''}
                onChange={e => setPlanData({ ...planData, planId: e.target.value })}
                placeholder="Plan number"
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parcel Number</label>
              <input
                type="text"
                value={planData.parcelNumber || ''}
                onChange={e => setPlanData({ ...planData, parcelNumber: e.target.value })}
                placeholder="LR Number"
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CRS</label>
              <select
                value={planData.coordinatesSystem || ''}
                onChange={e => setPlanData({ ...planData, coordinatesSystem: e.target.value })}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Select</option>
                <option value="Arc 1960">Arc 1960</option>
                <option value="WGS84">WGS84</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scale</label>
              <select
                value={planData.scale || ''}
                onChange={e => setPlanData({ ...planData, scale: Number(e.target.value) })}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">Select</option>
                <option value="100">1:100</option>
                <option value="200">1:200</option>
                <option value="500">1:500</option>
                <option value="1000">1:1000</option>
                <option value="2000">1:2000</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Area (m²)</label>
              <input
                type="number"
                value={planData.area || ''}
                onChange={e => setPlanData({ ...planData, area: Number(e.target.value) })}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={planData.northArrow || false}
                onChange={e => setPlanData({ ...planData, northArrow: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">North Arrow</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={planData.legend || false}
                onChange={e => setPlanData({ ...planData, legend: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Legend</span>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Boundary Coordinates</label>
              <button
                onClick={addCoordinate}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add Point
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(planData.coordinates || []).map((coord, index) => (
                <div key={coord.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <span className="text-xs text-gray-500 w-6">{index + 1}</span>
                  <input
                    type="number"
                    value={coord.easting}
                    onChange={e => updateCoordinate(index, 'easting', Number(e.target.value))}
                    placeholder="Easting"
                    className="w-24 p-1 text-sm border rounded"
                  />
                  <input
                    type="number"
                    value={coord.northing}
                    onChange={e => updateCoordinate(index, 'northing', Number(e.target.value))}
                    placeholder="Northing"
                    className="w-24 p-1 text-sm border rounded"
                  />
                  <input
                    type="text"
                    value={coord.description}
                    onChange={e => updateCoordinate(index, 'description', e.target.value)}
                    placeholder="Desc"
                    className="flex-1 p-1 text-sm border rounded"
                  />
                  <button
                    onClick={() => removeCoordinate(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleRunCheck}
            disabled={!planData.planId || !planData.coordinates?.length}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Run Compliance Check
          </button>
        </div>

        <div>
          {report ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Compliance Score</p>
                  <p className={`text-3xl font-bold ${getScoreColor(report.score)}`}>
                    {report.score}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    <span className="text-red-600 font-medium">{report.errors}</span> errors
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="text-yellow-600 font-medium">{report.warnings}</span> warnings
                  </p>
                </div>
              </div>

              {report.overallPass && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-800 font-medium">Plan passes compliance checks</span>
                </div>
              )}

              {!report.overallPass && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-800 font-medium">Plan has compliance issues</span>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">Check Results</h4>
                {report.checks.map((check, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex items-start gap-2">
                      {getSeverityIcon(check.severity, check.passed)}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{check.checkName}</p>
                        <p className="text-xs text-gray-600">{check.details}</p>
                        {check.recommendation && !check.passed && (
                          <p className="text-xs text-blue-600 mt-1">{check.recommendation}</p>
                        )}
                        {check.regulation && (
                          <p className="text-xs text-gray-400 mt-1">Ref: {check.regulation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {report.suggestions.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 text-sm mb-2">Suggestions</h4>
                  <ul className="space-y-1">
                    {report.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-xs text-blue-800 flex items-start gap-2">
                        <Info className="w-3 h-3 mt-0.5" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Enter plan details and run check</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
