'use client'

import { useState, useRef, useEffect } from 'react'
import { interpretCSV, CSVInterpretResult } from '@/lib/parsers/csvSurveyInterpreter'
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { bowditchAdjustmentSolvedFromResult } from '@/lib/engine/solution/wrappers/traverse'
import { levelingSolved } from '@/lib/engine/solution/wrappers/leveling'
import { radiationSolved } from '@/lib/engine/solution/wrappers/radiation'
import { 
  detectSurveyType, 
  runWorkflow, 
  TraverseWorkflowData, 
  LevelingWorkflowData,
  RadiationWorkflowData,
  WorkflowResult 
} from '@/lib/workflows/workflowEngine'
import { 
  checkTolerance, 
  ToleranceProfile, 
  getToleranceConfig,
  getAllToleranceProfiles,
  ToleranceCheckResult 
} from '@/lib/validation/toleranceEngine'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ProcessPage() {
  const [processError, setProcessError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [interpretResult, setInterpretResult] = useState<CSVInterpretResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processed, setProcessed] = useState(false)
  const [manualType, setManualType] = useState<string>('')
  const [selectedProfile, setSelectedProfile] = useState<ToleranceProfile>('cadastral')
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null)
  const [workflowSolutions, setWorkflowSolutions] = useState<Array<{ title?: string; steps: SolutionStep[] }>>([])
  const [toleranceResult, setToleranceResult] = useState<ToleranceCheckResult | null>(null)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      setProjects(data)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files && files[0]) {
      const content = await files[0].text()
      setFileContent(content)
      const result = interpretCSV(content)
      setInterpretResult(result)
      
      if (result.ok && result.dataset) {
        const detected = detectSurveyTypeFromDataset(result.dataset)
        // survey type detected
      }
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      const content = await files[0].text()
      setFileContent(content)
      const result = interpretCSV(content)
      setInterpretResult(result)
    }
  }

  const detectSurveyTypeFromDataset = (dataset: any): string => {
    if (!dataset?.observations) return 'unknown'
    const obs = dataset.observations
    const types = new Set(obs.map((o: any) => o.type))
    
    if (types.has('BS') || types.has('IS') || types.has('FS')) return 'leveling'
    if (types.has('BEARING') && types.has('DISTANCE')) return 'traverse'
    if (types.has('ANGLE') && types.has('DISTANCE')) return 'radiation'
    if (types.has('COORDINATE')) return 'coordinates'
    return 'unknown'
  }

  const processSurvey = () => {
    setProcessing(true)
    
    setTimeout(() => {
      setProcessing(false)
      setProcessed(true)
    }, 1500)
  }

  const runProcessWithWorkflow = () => {
    if (!interpretResult?.ok || !interpretResult.dataset) return

    setProcessing(true)

    try {
      const dataset = interpretResult.dataset
      const surveyType = detectSurveyTypeFromDataset(dataset)
      let result: WorkflowResult

      const solutions: Array<{ title?: string; steps: SolutionStep[] }> = []

      if (surveyType === 'traverse') {
        const traverseData: TraverseWorkflowData = {
          legs: dataset.observations.map((obs: any, i: number) => ({
            fromStation: obs.station,
            toStation: dataset.observations[i + 1]?.station || `P${i + 2}`,
            bearing: obs.value1 || 0,
            distance: obs.value2 || 0
          })),
          openingPoint: {
            name: dataset.observations[0]?.station || 'A',
            easting: (dataset.metadata as any)?.openingEasting || 500000,
            northing: (dataset.metadata as any)?.openingNorthing || 4500000
          }
        }
        result = runWorkflow('traverse', traverseData)
        if (result.success && result.results?.legs) {
          try {
            const s = bowditchAdjustmentSolvedFromResult(result.results)
            solutions.push({ title: s.solution.title, steps: s.steps })
          } catch {}
        }
      } else if (surveyType === 'leveling') {
        const levelingData: LevelingWorkflowData = {
          readings: dataset.observations.map((obs: any) => ({
            station: obs.station,
            bs: obs.type === 'BS' ? obs.value1 : undefined,
            is: obs.type === 'IS' ? obs.value1 : undefined,
            fs: obs.type === 'FS' ? obs.value1 : undefined
          })),
          openingRL: (dataset.metadata as any)?.openingRL || 100
        }
        result = runWorkflow('leveling', levelingData)
        if (result.success && result.results?.readings) {
          try {
            const s = levelingSolved(
              { readings: levelingData.readings, openingRL: levelingData.openingRL, closingRL: levelingData.closingRL, method: 'rise_and_fall', distanceKm: 1 },
              result.results
            )
            solutions.push({ title: s.solution.title, steps: s.steps })
          } catch {}
        }
      } else if (surveyType === 'radiation') {
        const radiationData: RadiationWorkflowData = {
          station: {
            name: (dataset.metadata as any)?.stationName || 'STN1',
            easting: (dataset.metadata as any)?.stationEasting || 500000,
            northing: (dataset.metadata as any)?.stationNorthing || 4500000
          },
          observations: dataset.observations.map((obs: any) => ({
            pointName: obs.station,
            bearing: obs.value1 || 0,
            distance: obs.value2 || 0
          }))
        }
        result = runWorkflow('radiation', radiationData)
        if (radiationData.observations.length > 0) {
          for (const obs of radiationData.observations.slice(0, 3)) {
            try {
              const s = radiationSolved({
                station: { easting: radiationData.station.easting, northing: radiationData.station.northing },
                bearingDeg: obs.bearing,
                distance: obs.distance,
              })
              solutions.push({ title: s.solution.title, steps: s.steps })
            } catch {}
          }
        }
      } else {
        result = {
          success: false,
          surveyType: 'unknown',
          results: null,
          validation: { passed: false, checks: [] },
          warnings: [],
          errors: ['Unknown survey type - cannot process']
        }
      }

      setWorkflowResult(result)
      setWorkflowSolutions(solutions)

      if (result.success && result.results) {
        const config = getToleranceConfig(selectedProfile)
        
        if (surveyType === 'traverse' && result.results.legs) {
          const traverseTol = checkTolerance({
            traverse: {
              precisionRatio: result.results.precisionRatio || 0,
              angularMisclosure: null,
              linearError: Math.sqrt(result.results.closingErrorE ** 2 + result.results.closingErrorN ** 2),
              totalDistance: result.results.totalDistance || 0,
              numStations: result.results.legs?.length || 0
            }
          }, selectedProfile)
          setToleranceResult(traverseTol)
        } else if (surveyType === 'leveling' && result.results.readings) {
          const levelingTol = checkTolerance({
            leveling: {
              arithmeticCheckPassed: result.results.arithmeticCheck || false,
              arithmeticDiff: result.results.misclosure || 0,
              closingError: result.results.misclosure || 0,
              distanceKm: result.results.readings?.length * 0.1 || 1
            }
          }, selectedProfile)
          setToleranceResult(levelingTol)
        }
      }

      setProcessing(false)
      setProcessed(true)
    } catch (e) {
      console.error('Processing error:', e)
      setProcessing(false)
    }
  }

  const handleSaveToProject = async () => {
    if (!selectedProjectId || !workflowResult?.results) {
      setProcessError('Please select a project first.')
      return
    }

    setSaveLoading(true)

    try {
      if (workflowResult.surveyType === 'traverse' && workflowResult.results.legs) {
        const points = workflowResult.results.legs.map((leg: any) => ({
          project_id: selectedProjectId,
          name: leg.to,
          easting: leg.adjEasting,
          northing: leg.adjNorthing,
          elevation: null,
          is_control: false
        }))

        if (workflowResult.results.legs[0]) {
          points.unshift({
            project_id: selectedProjectId,
            name: workflowResult.results.legs[0].from,
            easting: workflowResult.results.legs[0].adjEasting - workflowResult.results.legs[0].adjDeltaE,
            northing: workflowResult.results.legs[0].adjNorthing - workflowResult.results.legs[0].adjDeltaN,
            elevation: null,
            is_control: true,
            control_order: 'primary',
            locked: true
          })
        }

        await supabase.from('survey_points').insert(points)
      } 
      else if (workflowResult.surveyType === 'radiation' && workflowResult.results.points) {
        const points = workflowResult.results.points.map((pt: any) => ({
          project_id: selectedProjectId,
          name: pt.name,
          easting: pt.easting,
          northing: pt.northing,
          elevation: null,
          is_control: false
        }))

        await supabase.from('survey_points').insert(points)
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e) {
      console.error('Save error:', e)
      setProcessError('Error saving points to project. Please try again.')
    }

    setSaveLoading(false)
  }

  const detectLabel = (type: string) => {
    switch (type) {
      case 'leveling': return 'Leveling Run'
      case 'traverse': return 'Traverse Survey'
      case 'radiation': return 'Radiation / Detail Survey'
      case 'boundary': return 'Boundary / Parcel'
      default: return 'Unknown Survey Type'
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Process Field Notes</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">
        Upload your CSV field notes — GeoNova detects the survey type and processes automatically
      </p>

      {!fileContent ? (
        <>
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              dragActive 
                ? 'border-[#E8841A] bg-[#E8841A]/10' 
                : 'border-[var(--border-color)] hover:border-gray-600'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-6xl mb-4">📋</div>
            <p className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Drop your field notes here or click to upload
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Accepts: .csv, .txt files
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          <div className="mt-8 p-6 bg-[var(--bg-secondary)]/50 rounded-xl border border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Download Sample Files</h3>
            <div className="flex flex-wrap gap-3">
              <a href="/sample-files/traverse_sample.csv" className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm">
                📄 Traverse Sample
              </a>
              <a href="/sample-files/leveling_sample.csv" className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm">
                📄 Leveling Sample
              </a>
              <a href="/sample-files/radiation_sample.csv" className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm">
                📄 Radiation Sample
              </a>
            </div>
          </div>
        </>
      ) : interpretResult?.ok && interpretResult.dataset ? (
        <div className="space-y-6">
          <div className="card border border-[var(--border-color)]">
            <div className="card-header flex items-center gap-3">
              <span className="text-2xl">✓</span>
              <span className="font-semibold">
                {detectLabel(detectSurveyTypeFromDataset(interpretResult.dataset!))} Detected
              </span>
            </div>
            <div className="card-body">
              <p className="text-sm text-[var(--text-primary)] mb-4">
                {interpretResult.dataset!.observations.length} observations found
              </p>

              <div className="bg-[var(--bg-tertiary)] rounded p-3 overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="text-[var(--text-muted)]">
                      <th className="px-2 py-1 text-left">Station</th>
                      <th className="px-2 py-1 text-left">Type</th>
                      <th className="px-2 py-1 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interpretResult.dataset!.observations.slice(0, 5).map((obs: any, i: number) => (
                      <tr key={i} className="border-t border-[var(--border-color)]">
                        <td className="px-2 py-1">{obs.station}</td>
                        <td className="px-2 py-1 text-[#E8841A]">{obs.type}</td>
                        <td className="px-2 py-1 text-right font-mono">{obs.value1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {interpretResult.warnings.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
                  {interpretResult.warnings.map((w, i) => (
                    <p key={i} className="text-sm text-yellow-400">⚠ {w}</p>
                  ))}
                </div>
              )}

              {!processed && (
                <>
                  <div className="mt-6">
                    <label className="block text-sm text-[var(--text-secondary)] mb-2">Tolerance Profile</label>
                    <div className="grid grid-cols-3 gap-3">
                      {getAllToleranceProfiles().map(profile => (
                        <button
                          key={profile}
                          onClick={() => setSelectedProfile(profile)}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            selectedProfile === profile
                              ? 'border-[#E8841A] bg-[#E8841A]/10'
                              : 'border-[var(--border-color)] hover:border-gray-600'
                          }`}
                        >
                          <div className="font-medium text-[var(--text-primary)] capitalize">{getToleranceConfig(profile).name}</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">{getToleranceConfig(profile).description}</div>
                          <div className="text-xs text-[var(--text-muted)] mt-2">1:{getToleranceConfig(profile).linearPrecision}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={runProcessWithWorkflow}
                      disabled={processing}
                      className="px-6 py-3 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded-lg"
                    >
                      {processing ? 'Processing...' : 'Process Survey'}
                    </button>
                    <button
                      onClick={() => {
                        setFileContent(null)
                        setInterpretResult(null)
                        setProcessed(false)
                        setWorkflowResult(null)
                        setWorkflowSolutions([])
                        setToleranceResult(null)
                      }}
                      className="px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg"
                    >
                      Upload Different File
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {processed && workflowResult && (
            <>
              <div className={`card border-2 ${toleranceResult?.passed ? 'border-green-700' : 'border-red-700'}`}>
                <div className="card-header flex items-center gap-3">
                  <span className="text-2xl">{toleranceResult?.passed ? '✓' : '✗'}</span>
                  <span className="font-semibold">
                    Tolerance Check: {toleranceResult?.passed ? 'PASS' : 'FAIL'}
                  </span>
                  <span className="text-sm text-[var(--text-muted)] ml-auto">
                    {toleranceResult?.precisionGrade}
                  </span>
                </div>
                <div className="card-body">
                  {toleranceResult?.checks.map((check, i) => (
                    <div key={i} className={`flex items-center justify-between py-2 border-b border-[var(--border-color)] last:border-0 ${check.passed ? 'text-green-400' : 'text-red-400'}`}>
                      <span>{check.passed ? '✓' : '✗'} {check.name}</span>
                      <span className="text-sm">{check.message}</span>
                    </div>
                  ))}
                  
                  {toleranceResult?.recommendations && toleranceResult.recommendations.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded">
                      <div className="text-sm text-yellow-400 mb-2">Recommendations:</div>
                      {toleranceResult.recommendations.map((rec, i) => (
                        <p key={i} className="text-xs text-yellow-300">• {rec}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {workflowSolutions.length > 0 ? (
                <div className="space-y-6">
                  {workflowSolutions.map((s, i) => (
                    <SolutionStepsRenderer key={i} title={s.title} steps={s.steps} />
                  ))}
                </div>
              ) : null}

              {workflowResult.surveyType === 'traverse' && workflowResult.results?.legs && (
                <div className="card border border-[var(--border-color)]">
                  <div className="card-header">
                    <span className="font-semibold">Gale's Table</span>
                  </div>
                  <div className="card-body overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                          <th className="px-2 py-2 text-left">From</th>
                          <th className="px-2 py-2 text-left">To</th>
                          <th className="px-2 py-2 text-right">Dist</th>
                          <th className="px-2 py-2 text-right">Bearing</th>
                          <th className="px-2 py-2 text-right">Easting</th>
                          <th className="px-2 py-2 text-right">Northing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workflowResult.results.legs.map((leg: any, i: number) => (
                          <tr key={i} className="border-b border-[var(--border-color)]">
                            <td className="px-2 py-2">{leg.from}</td>
                            <td className="px-2 py-2">{leg.to}</td>
                            <td className="px-2 py-2 text-right font-mono">{leg.distance?.toFixed(3)}</td>
                            <td className="px-2 py-2 text-right font-mono">{leg.bearingDMS}</td>
                            <td className="px-2 py-2 text-right font-mono">{leg.adjEasting?.toFixed(4)}</td>
                            <td className="px-2 py-2 text-right font-mono">{leg.adjNorthing?.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {workflowResult.surveyType === 'leveling' && workflowResult.results?.readings && (
                <div className="card border border-[var(--border-color)]">
                  <div className="card-header">
                    <span className="font-semibold">Leveling Results</span>
                  </div>
                  <div className="card-body overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                          <th className="px-2 py-2 text-left">Station</th>
                          <th className="px-2 py-2 text-right">BS</th>
                          <th className="px-2 py-2 text-right">IS</th>
                          <th className="px-2 py-2 text-right">FS</th>
                          <th className="px-2 py-2 text-right">Rise</th>
                          <th className="px-2 py-2 text-right">Fall</th>
                          <th className="px-2 py-2 text-right">RL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workflowResult.results.readings.map((r: any, i: number) => (
                          <tr key={i} className="border-b border-[var(--border-color)]">
                            <td className="px-2 py-2">{r.station}</td>
                            <td className="px-2 py-2 text-right font-mono">{r.bs?.toFixed(3) || '—'}</td>
                            <td className="px-2 py-2 text-right font-mono">{r.is?.toFixed(3) || '—'}</td>
                            <td className="px-2 py-2 text-right font-mono">{r.fs?.toFixed(3) || '—'}</td>
                            <td className="px-2 py-2 text-right font-mono">{r.rise?.toFixed(3) || '—'}</td>
                            <td className="px-2 py-2 text-right font-mono">{r.fall?.toFixed(3) || '—'}</td>
                            <td className="px-2 py-2 text-right font-mono">{r.reducedLevel?.toFixed(4) || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="card border border-[var(--border-color)]">
                <div className="card-body space-y-4">
                  <h3 className="font-semibold">Save to Project</h3>
                  
                  <div className="flex gap-3">
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="flex-1 px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    >
                      <option value="">Select a project...</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    
                    <button
                      onClick={handleSaveToProject}
                      disabled={!selectedProjectId || saveLoading}
                      className="px-6 py-3 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded-lg disabled:opacity-50"
                    >
                      {saveLoading ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Save Points'}
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Link href="/dashboard" className="px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg text-center">
                      View Projects
                    </Link>
                    <button className="px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg">
                      Generate PDF Report
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="card border-red-800">
          <div className="card-header">
            <span className="font-semibold text-red-400">Upload Failed</span>
          </div>
          <div className="card-body">
            <p className="text-[var(--text-primary)] mb-4">
              {interpretResult?.error || 'Could not parse the uploaded file'}
            </p>
            {interpretResult?.warnings.map((w, i) => (
              <p key={i} className="text-sm text-yellow-400">⚠ {w}</p>
            ))}
            
            <div className="mt-6 p-4 bg-[var(--bg-tertiary)] rounded">
              <p className="text-sm text-[var(--text-secondary)] mb-3">Or select survey type manually:</p>
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value)}
                className="input mb-3"
              >
                <option value="">Select type...</option>
                <option value="leveling">Leveling Run</option>
                <option value="traverse">Traverse Survey</option>
                <option value="radiation">Radiation / Detail</option>
              </select>
              {manualType && (
                <button className="btn btn-primary">
                  Process as {detectLabel(manualType)}
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setFileContent(null)
                setInterpretResult(null)
              }}
              className="btn btn-secondary mt-4"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
