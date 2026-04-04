'use client'

import { useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useCountry } from '@/lib/country'
import RegistryIndexMap from './RegistryIndexMap'
import { formatAreaByCountry, getTraverseValidation } from '@/lib/engine/country-math'
import type { SurveyEnvironment } from '@/lib/country'

interface FieldCondition {
  id: string
  value: string
}

interface FixedPoint {
  id: string
  pointRef: string
  description: string
  usedForFixation: boolean
}

interface Discrepancy {
  id: string
  type: 'encroachment' | 'shortfall' | 'service_clash' | 'planning_conflict' | 'other'
  description: string
  suggestedSolution: string
}

interface SurveyReportProps {
  isOpen: boolean
  onClose: () => void
  jobNo?: string
  parcelAreaSqM?: number
  parcelDescription?: string
  environment?: SurveyEnvironment
  precisionRatio?: number
  linearError?: number
  totalDistance?: number
}

const FIELD_CONDITIONS = [
  'Open / undeveloped',
  'Built-up / urban',
  'Dense vegetation',
  'Coastal / marine',
  'Reclaimed land',
  'Rocky / mountainous',
  'Agricultural / rural',
] as const

const DISCREPANCY_TYPES = [
  { value: 'encroachment', label: 'Encroachment' },
  { value: 'shortfall', label: 'Shortfall' },
  { value: 'service_clash', label: 'Service / utility clash' },
  { value: 'planning_conflict', label: 'Planning intention conflict' },
  { value: 'other', label: 'Other' },
] as const

const SURVEY_METHODS = [
  'RTK GPS (PRN/base station)',
  'Conventional Total Station',
  'Taped offsets',
  'Tacheometry',
  'Static GPS',
  'Hybrid (GPS + TS)',
  'Aerial / drone mapping',
  'Lidar',
] as const

export default function SurveyReport({
  isOpen,
  onClose,
  jobNo: initialJobNo = '',
  parcelAreaSqM = 0,
  parcelDescription: initialParcelDesc = '',
  environment: initialEnv = 'rural',
  precisionRatio,
  linearError,
  totalDistance,
}: SurveyReportProps) {
  const { t } = useLanguage()
  const { standard, country, getTraverseOrder, getAreaRule } = useCountry()

  const [surveyorName, setSurveyorName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [jobNo, setJobNo] = useState(initialJobNo)
  const [parcelDescription, setParcelDescription] = useState(initialParcelDesc)
  const [fieldConditions, setFieldConditions] = useState<FieldCondition[]>([])
  const [boundaryDescription, setBoundaryDescription] = useState('')
  const [fixedPoints, setFixedPoints] = useState<FixedPoint[]>([
    { id: '1', pointRef: '', description: '', usedForFixation: true },
  ])
  const [locationMethod, setLocationMethod] = useState('')
  const [surveyMethods, setSurveyMethods] = useState<string[]>([])
  const [equipment, setEquipment] = useState('')
  const [accuracyNotes, setAccuracyNotes] = useState('')
  const [fieldChecks, setFieldChecks] = useState('')
  const [areaCalcMethod, setAreaCalcMethod] = useState('coordinate')
  const [difficulties, setDifficulties] = useState('')
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([])
  const [certificateText, setCertificateText] = useState(
    'I certify that this survey was carried out in compliance with all applicable Survey Regulations and Technical Instructions.'
  )
  const [supervisorName, setSupervisorName] = useState('')
  const [validated, setValidated] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showRIM, setShowRIM] = useState(false)

  if (!isOpen) return null

  const rimData = { district: '', location: '', parcels: [] as any[] }

  const areaResult = parcelAreaSqM > 0 ? formatAreaByCountry(country, parcelAreaSqM) : null

  const precisionValidation = (precisionRatio && linearError && totalDistance)
    ? getTraverseValidation({ country, environment: initialEnv, linearError, totalDistance })
    : null

  function toggleCondition(c: string) {
    setFieldConditions(prev =>
      prev.some((x: any) => x.value === c)
        ? prev.filter((x: any) => x.value !== c)
        : [...prev, { id: crypto.randomUUID(), value: c }]
    )
  }

  function toggleMethod(m: string) {
    setSurveyMethods(prev =>
      prev.includes(m) ? prev.filter((x: any) => x !== m) : [...prev, m]
    )
  }

  function addFixedPoint() {
    setFixedPoints(prev => [...prev, { id: crypto.randomUUID(), pointRef: '', description: '', usedForFixation: true }])
  }

  function removeFixedPoint(id: string) {
    setFixedPoints(prev => prev.filter((p: any) => p.id !== id))
  }

  function addDiscrepancy() {
    setDiscrepancies(prev => [...prev, { id: crypto.randomUUID(), type: 'other', description: '', suggestedSolution: '' }])
  }

  function removeDiscrepancy(id: string) {
    setDiscrepancies(prev => prev.filter((d: any) => d.id !== id))
  }

  function validateReport(): string[] {
    const errors: string[] = []
    if (surveyMethods.length === 0) errors.push('At least one survey method must be selected.')
    if (!boundaryDescription.trim()) errors.push('Boundary description is required.')
    if (!certificateText.trim()) errors.push('Certificate of compliance text is required.')
    return errors
  }

  function handleValidate() {
    const errors = validateReport()
    setValidationErrors(errors)
    setValidated(errors.length === 0)
  }

  function handlePrint() {
    window.print()
  }

  const SectionHeader = ({ children }: { children: React.ReactNode }) => (
    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4 mb-2">
      {children}
    </div>
  )

  const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )

  const Input = ({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      className={`w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    />
  )

  const Textarea = ({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
      className={`w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y ${className}`}
      {...props}
    />
  )

  const Select = ({ className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <select
      className={`w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      {...props}
    >
      {props.children}
    </select>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t('surveyReport.title')}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {t('surveyReport.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              {t('surveyReport.print')}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex flex-wrap gap-4">
            <span><strong>{standard.name}</strong> ({standard.isoCode})</span>
            <span>Datum: <strong>{standard.datum}</strong> / {standard.ellipsoid}</span>
            <span>UTM Zone{standard.utmZones.length > 1 ? 's' : ''}: <strong>{standard.utmZones.join(', ')}</strong> {standard.utmHemisphere}</span>
            <span>Traverse: <strong>1:{getTraverseOrder(initialEnv)?.minPrecision.toLocaleString() ?? '—'}</strong></span>
            {standard.parcelMinArea && (
              <span>Min parcel: <strong>{standard.parcelMinArea.sqMetres} m²</strong></span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <FieldLabel required>{t('surveyReport.jobNo')}</FieldLabel>
              <Input value={jobNo} onChange={e => setJobNo(e.target.value)} placeholder="e.g. SD-2024-00123" />
            </div>
            <div>
              <FieldLabel required>{t('surveyReport.surveyor')}</FieldLabel>
              <Input
                value={surveyorName}
                onChange={e => setSurveyorName(e.target.value.toUpperCase())}
                placeholder="JOHN M. KARIUKI"
                className="uppercase"
              />
            </div>
            <div>
              <FieldLabel required>{t('surveyReport.date')}</FieldLabel>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          <SectionHeader>{t('surveyReport.parcelInfo')}</SectionHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>{t('surveyReport.parcelDesc')}</FieldLabel>
              <Input
                value={parcelDescription}
                onChange={e => setParcelDescription(e.target.value)}
                placeholder="Urban residential plot, Block 12, Dagoretti"
              />
            </div>
            <div>
              <FieldLabel>{t('surveyReport.environment')}</FieldLabel>
              <Select value={initialEnv} disabled>
                <option value="urban">{t('surveyReport.envUrban')}</option>
                <option value="rural">{t('surveyReport.envRural')}</option>
                <option value="transmission_line">{t('surveyReport.envTransmission')}</option>
                <option value="detail">{t('surveyReport.envDetail')}</option>
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel>{t('surveyReport.fieldConditions')}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {FIELD_CONDITIONS.map((c: any) => (
                <button
                  key={c}
                  onClick={() => toggleCondition(c)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    fieldConditions.some((x: any) => x.value === c)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-700 hover:border-blue-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <SectionHeader>{t('surveyReport.boundarySection')}</SectionHeader>
          <div>
            <FieldLabel required>{t('surveyReport.boundaryDesc')}</FieldLabel>
            <Textarea
              rows={3}
              value={boundaryDescription}
              onChange={e => setBoundaryDescription(e.target.value)}
              placeholder="Parcel bounded on N by Road reserve (15m), E by remaining parent parcel..., etc."
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('surveyReport.boundaryHint')}
            </p>
          </div>

          <SectionHeader>{t('surveyReport.controlSection')}</SectionHeader>

          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>{t('surveyReport.fixedPoints')}</FieldLabel>
              <button
                onClick={addFixedPoint}
                className="text-xs text-blue-600 hover:underline"
              >
                + {t('surveyReport.addPoint')}
              </button>
            </div>
            <div className="space-y-2">
              {fixedPoints.map((fp, i) => (
                <div key={fp.id} className="grid grid-cols-3 gap-2 items-center">
                  <Input
                    value={fp.pointRef}
                    onChange={e => {
                      const updated = [...fixedPoints]
                      updated[i].pointRef = e.target.value
                      setFixedPoints(updated)
                    }}
                    placeholder={`Point ref (e.g. RM-001)`}
                  />
                  <Input
                    value={fp.description}
                    onChange={e => {
                      const updated = [...fixedPoints]
                      updated[i].description = e.target.value
                      setFixedPoints(updated)
                    }}
                    placeholder="Description / condition"
                  />
                  <button
                    onClick={() => removeFixedPoint(fp.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    {t('common.remove')}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>{t('surveyReport.locationMethod')}</FieldLabel>
              <Select value={locationMethod} onChange={e => setLocationMethod(e.target.value)}>
                <option value="">{t('common.select')}</option>
                <option value="polar">{t('surveyReport.methodPolar')}</option>
                <option value="intersection">{t('surveyReport.methodIntersection')}</option>
                <option value="resection">{t('surveyReport.methodResection')}</option>
                <option value="gps_rtk">{t('surveyReport.methodRTK')}</option>
                <option value="tape_offset">{t('surveyReport.methodTapeOffset')}</option>
              </Select>
            </div>
            <div>
              <FieldLabel>{t('surveyReport.areaMethod')}</FieldLabel>
              <Select value={areaCalcMethod} onChange={e => setAreaCalcMethod(e.target.value)}>
                <option value="coordinate">{t('surveyReport.areaCoord')}</option>
                <option value="subdivision">{t('surveyReport.areaSubdiv')}</option>
                <option value="decomposition">{t('surveyReport.areaDecomp')}</option>
                <option value="graphic">{t('surveyReport.areaGraphic')}</option>
              </Select>
            </div>
          </div>

          <SectionHeader>{t('surveyReport.methodsSection')}</SectionHeader>
          <div>
            <FieldLabel required>{t('surveyReport.surveyMethods')}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {SURVEY_METHODS.map((m: any) => (
                <button
                  key={m}
                  onClick={() => toggleMethod(m)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    surveyMethods.includes(m)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-700 hover:border-blue-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>{t('surveyReport.equipment')}</FieldLabel>
            <Input
              value={equipment}
              onChange={e => setEquipment(e.target.value)}
              placeholder="Leica TS16, Trimble R12i RTK GPS, 50m steel tape..."
            />
          </div>

          <SectionHeader>{t('surveyReport.accuracySection')}</SectionHeader>

          {precisionValidation && (
            <div className={`rounded-lg p-3 text-sm ${
              precisionValidation.isAcceptable
                ? 'bg-green-50 border border-green-200'
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="font-medium">
                  {t('surveyReport.traverseAccuracy')}
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  {standard.isoCode} · {precisionValidation.jurisdiction.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div>Achieved: <strong>1:{Math.round(precisionValidation.achievedRatio).toLocaleString()}</strong></div>
                <div>Required: <strong>1:{precisionValidation.requiredRatio.toLocaleString()}</strong></div>
                <div>Order: <strong>{precisionValidation.orderLabel.replace('_', ' ').toUpperCase()}</strong></div>
                <div>Linear error: <strong>{precisionValidation.linearError.toFixed(4)} m</strong></div>
                <div className="col-span-2 text-gray-500">Regulation: {precisionValidation.regulation}</div>
                {precisionValidation.warnings.map((w, i) => (
                  <div key={i} className="col-span-2 text-amber-700 mt-1">⚠ {w}</div>
                ))}
              </div>
            </div>
          )}

          <div>
            <FieldLabel>{t('surveyReport.accuracyNotes')}</FieldLabel>
            <Textarea
              rows={2}
              value={accuracyNotes}
              onChange={e => setAccuracyNotes(e.target.value)}
              placeholder="Traverse closure: 1:24,500. EDM check: ±15mm. GPS occupation: 0.5 min per point..."
            />
          </div>

          <div>
            <FieldLabel>{t('surveyReport.fieldChecks')}</FieldLabel>
            <Textarea
              rows={2}
              value={fieldChecks}
              onChange={e => setFieldChecks(e.target.value)}
              placeholder="Independent check measurement to RM-042: 0.005m difference. Second face observations: all within 20 arcsec..."
            />
          </div>

          <div className="flex items-center justify-between">
            <SectionHeader>{t('surveyReport.areaSection')}</SectionHeader>
            {country === 'kenya' && parcelAreaSqM > 0 && (
              <button
                onClick={() => setShowRIM(true)}
                className="px-3 py-1 text-xs bg-amber-100 text-amber-800 border border-amber-300 rounded hover:bg-amber-200 flex items-center gap-1"
              >
                📋 Generate RIM (Kenya)
              </button>
            )}
          </div>
          {areaResult ? (
            <div className="grid grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-gray-600">{t('surveyReport.area')}</span>
                <div className="font-semibold text-lg">{areaResult.formattedHa} ha</div>
                <div className="text-xs text-gray-500">{areaResult.regulation}</div>
              </div>
              <div>
                <span className="text-sm text-gray-600">{t('surveyReport.areaSqM')}</span>
                <div className="font-semibold">{areaResult.formattedM2} m²</div>
              </div>
              <div>
                <span className="text-sm text-gray-600">{t('surveyReport.decimalPlaces')}</span>
                <div className="font-semibold">{areaResult.decimalPlaces}</div>
              </div>
              <div>
                <span className="text-sm text-gray-600">{t('surveyReport.countryStd')}</span>
                <div className="font-semibold text-xs">{standard.name}</div>
                <div className="text-xs text-gray-500">{standard.isoCode} — {standard.datum}</div>
              </div>
              {areaResult.warnings.length > 0 && (
                <div className="col-span-4">
                  {areaResult.warnings.map((w, i) => (
                    <div key={i} className="text-xs text-amber-600">⚠ {w}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">{t('surveyReport.noArea')}</p>
          )}

          <SectionHeader>{t('surveyReport.difficultiesSection')}</SectionHeader>
          <div>
            <FieldLabel>{t('surveyReport.difficulties')}</FieldLabel>
            <Textarea
              rows={2}
              value={difficulties}
              onChange={e => setDifficulties(e.target.value)}
              placeholder="Beacon CM-07 destroyed — recovered from witness marks. Dense vegetation obscured line of sight..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>{t('surveyReport.discrepancies')}</FieldLabel>
              <button
                onClick={addDiscrepancy}
                className="text-xs text-blue-600 hover:underline"
              >
                + {t('surveyReport.addDiscrepancy')}
              </button>
            </div>
            <div className="space-y-3">
              {discrepancies.map((d: any) => (
                <div key={d.id} className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded">
                  <div>
                    <FieldLabel>{t('surveyReport.discType')}</FieldLabel>
                    <Select
                      value={d.type}
                      onChange={e => {
                        const updated = discrepancies.map((x: any) => x.id === d.id ? { ...x, type: e.target.value as Discrepancy['type'] } : x)
                        setDiscrepancies(updated)
                      }}
                    >
                      {DISCREPANCY_TYPES.map((t: any) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <FieldLabel>{t('surveyReport.discDesc')}</FieldLabel>
                    <Textarea
                      rows={2}
                      placeholder="Describe and suggest a resolution..."
                      value={d.description}
                      onChange={e => {
                        const updated = discrepancies.map((x: any) => x.id === d.id ? { ...x, description: e.target.value } : x)
                        setDiscrepancies(updated)
                      }}
                    />
                  </div>
                  <div className="col-span-3 text-right">
                    <button
                      onClick={() => removeDiscrepancy(d.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                </div>
              ))}
              {discrepancies.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                  {t('surveyReport.noDiscrepancies')}
                </p>
              )}
            </div>
          </div>

          <SectionHeader>{t('surveyReport.certificate')}</SectionHeader>
          <div>
            <Textarea
              rows={3}
              value={certificateText}
              onChange={e => setCertificateText(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>{t('surveyReport.signature')}</FieldLabel>
              <div className="border-b border-gray-400 pb-1 mt-6 text-sm font-medium uppercase">
                {surveyorName || <span className="text-gray-300 italic">{t('surveyReport.signHere')}</span>}
              </div>
              <div className="text-xs text-gray-500 mt-1">{surveyorName}</div>
            </div>
            <div>
              <FieldLabel>{t('surveyReport.supervisor')}</FieldLabel>
              <Input
                value={supervisorName}
                onChange={e => setSupervisorName(e.target.value.toUpperCase())}
                placeholder="SUPERVISOR NAME"
                className="uppercase"
              />
              <div className="border-b border-gray-400 pb-1 mt-4 text-sm font-medium uppercase">
                {supervisorName || <span className="text-gray-300 italic">{t('surveyReport.signHere')}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between rounded-b-xl">
          {validated ? (
            <div className="text-sm text-green-600 font-medium">
              ✓ {t('surveyReport.validated')}
            </div>
          ) : validationErrors.length > 0 ? (
            <div className="text-sm text-red-600">
              {validationErrors.map((e, i) => <div key={i}>✗ {e}</div>)}
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              {t('surveyReport.validationHint')}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleValidate}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {t('surveyReport.validate')}
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-900"
            >
              {t('surveyReport.export')}
            </button>
          </div>
        </div>
      </div>

      <RegistryIndexMap
        isOpen={showRIM}
        onClose={() => setShowRIM(false)}
        initialData={{
          district: 'KAJIADO',
          location: locationMethod || 'ILKISONGO',
          registrationUnit: jobNo || 'ENTARARA',
          sheetNumber: '1',
          edition: '1ST EDITION',
          scale: '1:2,500',
          parcels: parcelAreaSqM > 0 ? [{
            id: crypto.randomUUID(),
            number: '1',
            x: 40, y: 40, width: 180, height: 120,
            area: (parcelAreaSqM / 10_000).toFixed(4),
            description: parcelDescription || 'Parcel 1',
            color: '#fef3c7',
          }] : [],
        }}
      />
    </div>
  )
}
