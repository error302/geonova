'use client'

import { useState } from 'react'
import { FileText, Download, Save, CheckCircle, AlertCircle } from 'lucide-react'
import type { DeedPlanInput, DeedPlanOutput, BoundaryPoint, BeaconType } from '@/types/deedPlan'
import { generateDeedPlan } from '@/lib/compute/deedPlanApi'
import { saveDeedPlan } from '@/lib/supabase/deedPlans'

interface DeedPlanGeneratorProps {
  projectId: string
  initialPoints?: BoundaryPoint[]
}

const SCALES = [500, 1000, 2500, 5000] as const
const MARK_TYPES: BeaconType[] = ['PSC', 'SSC', 'BM', 'MASONRY_NAIL', 'IRON_PIN', 'CONCRETE_BEACON', 'INDICATORY', 'RIVET', 'TBM']
const MARK_STATUSES = ['FOUND', 'SET', 'REFERENCED', 'DESTROYED', 'NOT_FOUND'] as const

export default function DeedPlanGenerator({ projectId, initialPoints = [] }: DeedPlanGeneratorProps) {
  const [step, setStep] = useState<'input' | 'preview' | 'export'>('input')
  const [isGenerating, setIsGenerating] = useState(false)
  const [output, setOutput] = useState<DeedPlanOutput | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [input, setInput] = useState<DeedPlanInput>({
    surveyNumber: '',
    drawingNumber: '',
    parcelNumber: '',
    locality: '',
    area: 0,
    registrationSection: '',
    county: '',
    utmZone: 37,
    hemisphere: 'S',
    scale: 1000,
    datum: 'WGS84',
    projectionType: 'UTM',
    boundaryPoints: initialPoints.length > 0 ? initialPoints : [
      { id: 'BP1', easting: 200000, northing: 9900000, markType: 'PSC', markStatus: 'FOUND' },
      { id: 'BP2', easting: 200100, northing: 9900000, markType: 'PSC', markStatus: 'FOUND' },
      { id: 'BP3', easting: 200100, northing: 9900100, markType: 'PSC', markStatus: 'SET' },
      { id: 'BP4', easting: 200000, northing: 9900100, markType: 'PSC', markStatus: 'SET' }
    ],
    abuttalNorth: '',
    abuttalSouth: '',
    abuttalEast: '',
    abuttalWest: '',
    surveyorName: '',
    iskNumber: '',
    firmName: '',
    firmAddress: '',
    surveyDate: new Date().toISOString().split('T')[0],
    signatureDate: new Date().toISOString().split('T')[0]
  })

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const result = await generateDeedPlan(input)
      setOutput(result)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate deed plan')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!output) return
    try {
      await saveDeedPlan(projectId, input, output)
      alert('Deed plan saved successfully!')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const handleDownloadSVG = () => {
    if (!output) return
    const blob = new Blob([output.svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${input.parcelNumber || 'deed-plan'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Deed Plan Generator</h1>

      {/* Step Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setStep('input')}
          className={`px-4 py-2 rounded-lg ${step === 'input' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          1. Input
        </button>
        <button
          onClick={() => output && setStep('preview')}
          disabled={!output}
          className={`px-4 py-2 rounded-lg ${step === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200'} ${!output ? 'opacity-50' : ''}`}
        >
          2. Preview
        </button>
        <button
          onClick={() => output && setStep('export')}
          disabled={!output}
          className={`px-4 py-2 rounded-lg ${step === 'export' ? 'bg-blue-600 text-white' : 'bg-gray-200'} ${!output ? 'opacity-50' : ''}`}
        >
          3. Export
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* INPUT STEP */}
      {step === 'input' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Project Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Project Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Survey Number</label>
                <input
                  type="text"
                  value={input.surveyNumber}
                  onChange={(e) => setInput({ ...input, surveyNumber: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="ISK/2024/001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Drawing Number</label>
                <input
                  type="text"
                  value={input.drawingNumber}
                  onChange={(e) => setInput({ ...input, drawingNumber: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Parcel Number</label>
                <input
                  type="text"
                  value={input.parcelNumber}
                  onChange={(e) => setInput({ ...input, parcelNumber: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="LOT 1234/NAIROBI"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Locality</label>
                <input
                  type="text"
                  value={input.locality}
                  onChange={(e) => setInput({ ...input, locality: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Registration Section</label>
                <input
                  type="text"
                  value={input.registrationSection}
                  onChange={(e) => setInput({ ...input, registrationSection: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">County</label>
                <input
                  type="text"
                  value={input.county}
                  onChange={(e) => setInput({ ...input, county: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Scale</label>
                <select
                  value={input.scale}
                  onChange={(e) => setInput({ ...input, scale: Number(e.target.value) as 500 | 1000 | 2500 | 5000 })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {SCALES.map((s: any) => (
                    <option key={s} value={s}>1 : {s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Datum</label>
                <select
                  value={input.datum}
                  onChange={(e) => setInput({ ...input, datum: e.target.value as 'ARC1960' | 'WGS84' })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="WGS84">WGS84</option>
                  <option value="ARC1960">ARC1960</option>
                </select>
              </div>
            </div>
          </div>

          {/* Surveyor Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Surveyor's Certificate</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Surveyor Name</label>
                <input
                  type="text"
                  value={input.surveyorName}
                  onChange={(e) => setInput({ ...input, surveyorName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ISK Number</label>
                <input
                  type="text"
                  value={input.iskNumber}
                  onChange={(e) => setInput({ ...input, iskNumber: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Firm Name</label>
                <input
                  type="text"
                  value={input.firmName}
                  onChange={(e) => setInput({ ...input, firmName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Survey Date</label>
                <input
                  type="date"
                  value={input.surveyDate}
                  onChange={(e) => setInput({ ...input, surveyDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <h3 className="text-lg font-semibold mt-6 mb-4">Abuttals</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">North</label>
                <input
                  type="text"
                  value={input.abuttalNorth}
                  onChange={(e) => setInput({ ...input, abuttalNorth: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">South</label>
                <input
                  type="text"
                  value={input.abuttalSouth}
                  onChange={(e) => setInput({ ...input, abuttalSouth: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">East</label>
                <input
                  type="text"
                  value={input.abuttalEast}
                  onChange={(e) => setInput({ ...input, abuttalEast: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">West</label>
                <input
                  type="text"
                  value={input.abuttalWest}
                  onChange={(e) => setInput({ ...input, abuttalWest: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Boundary Points */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Boundary Points</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">ID</th>
                    <th className="text-left py-2">Easting</th>
                    <th className="text-left py-2">Northing</th>
                    <th className="text-left py-2">Mark Type</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {input.boundaryPoints.map((point, i) => (
                    <tr key={point.id} className="border-b">
                      <td className="py-2">{point.id}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          value={point.easting}
                          onChange={(e) => {
                            const newPoints = [...input.boundaryPoints]
                            newPoints[i] = { ...point, easting: parseFloat(e.target.value) }
                            setInput({ ...input, boundaryPoints: newPoints })
                          }}
                          className="w-32 px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          value={point.northing}
                          onChange={(e) => {
                            const newPoints = [...input.boundaryPoints]
                            newPoints[i] = { ...point, northing: parseFloat(e.target.value) }
                            setInput({ ...input, boundaryPoints: newPoints })
                          }}
                          className="w-32 px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="py-2">
                        <select
                          value={point.markType}
                          onChange={(e) => {
                            const newPoints = [...input.boundaryPoints]
                            newPoints[i] = { ...point, markType: e.target.value as BeaconType }
                            setInput({ ...input, boundaryPoints: newPoints })
                          }}
                          className="px-2 py-1 border rounded"
                        >
                          {MARK_TYPES.map((t: any) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <select
                          value={point.markStatus}
                          onChange={(e) => {
                            const newPoints = [...input.boundaryPoints]
                            newPoints[i] = { ...point, markStatus: e.target.value as 'FOUND' | 'SET' | 'REFERENCED' }
                            setInput({ ...input, boundaryPoints: newPoints })
                          }}
                          className="px-2 py-1 border rounded"
                        >
                          {MARK_STATUSES.map((s: any) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-2 flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isGenerating ? (
                <>Generating...</>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Generate Deed Plan
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW STEP */}
      {step === 'preview' && output && (
        <div className="space-y-6">
          {/* Closure Check Badge */}
          <div className={`flex items-center gap-4 p-4 rounded-lg ${output.closureCheck.passes ? 'bg-green-50' : 'bg-red-50'}`}>
            {output.closureCheck.passes ? (
              <CheckCircle className="h-6 w-6 text-green-500" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-500" />
            )}
            <div>
              <span className="font-semibold">Precision Ratio: {output.closureCheck.precisionRatio}</span>
              <span className="ml-2 text-sm text-gray-600">
                ({output.closureCheck.passes ? 'PASSES' : 'FAILS'} - minimum 1:5000 required)
              </span>
            </div>
            <div className="ml-auto text-sm">
              Perimeter: {output.closureCheck.perimeter.toFixed(2)}m
            </div>
          </div>

          {/* SVG Preview */}
          <div className="bg-white rounded-lg p-4 border overflow-auto">
            <div 
              className="mx-auto"
              dangerouslySetInnerHTML={{ __html: output.svg }} 
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('export')}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Continue to Export
            </button>
          </div>
        </div>
      )}

      {/* EXPORT STEP */}
      {step === 'export' && output && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleDownloadSVG}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
            >
              <Download className="h-5 w-5" />
              Download SVG
            </button>
            <button
              onClick={handleSave}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save className="h-5 w-5" />
              Save to Project
            </button>
          </div>

          {/* Bearing Schedule */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Bearing Schedule</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Leg</th>
                  <th className="text-left py-2">From</th>
                  <th className="text-left py-2">To</th>
                  <th className="text-left py-2">Bearing (WCB)</th>
                  <th className="text-right py-2">Distance (m)</th>
                </tr>
              </thead>
              <tbody>
                {output.bearingSchedule.map((leg, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2">{leg.fromPoint}</td>
                    <td className="py-2">{leg.toPoint}</td>
                    <td className="py-2 font-mono">{leg.bearing}</td>
                    <td className="py-2 text-right">{leg.distance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
