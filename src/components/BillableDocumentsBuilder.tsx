'use client';

import { useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { PrintMetaPanel, defaultPrintMeta } from '@/components/shared/PrintMetaPanel'
import type { PrintMeta } from '@/components/shared/PrintMetaPanel'
import {
  printEnvironmentalSetback,
  printRoadReserveReport,
  printSubdivisionScheme,
  printTitleSearchSummary,
  printValuationSupport,
  type ParcelScheduleRow,
  type RoadChainageRow,
  type SetbackRow,
  type Status,
  type ValuationParcelRow,
} from '@/lib/print/billableDocuments'

type Tab = 'subdivision' | 'road' | 'valuation' | 'title' | 'setback'

const tabs: { id: Tab; label: string; tier: string }[] = [
  { id: 'subdivision', label: 'Subdivision Scheme', tier: 'Tier 3' },
  { id: 'road', label: 'Road Reserve', tier: 'Tier 3' },
  { id: 'valuation', label: 'Valuation Support', tier: 'Tier 3' },
  { id: 'title', label: 'Title Search Summary', tier: 'Tier 3' },
  { id: 'setback', label: 'Setback Certificate', tier: 'Tier 4' },
]

function inputClass(extra = ''): string {
  return `input w-full ${extra}`.trim()
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="block text-xs text-[var(--text-muted)] mb-1">{label}</span>
      <input
        className={inputClass('text-sm')}
        type={type}
        value={value}
        placeholder={placeholder || label}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  )
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="block">
      <span className="block text-xs text-[var(--text-muted)] mb-1">{label}</span>
      <textarea
        className={inputClass('resize-none text-sm')}
        rows={rows}
        value={value}
        placeholder={placeholder || label}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">{title}</h2>
      {children}
    </section>
  )
}

export default function BillableDocumentsBuilder() {
  const [active, setActive] = useState<Tab>('subdivision')
  const [meta, setMeta] = useState<PrintMeta>(defaultPrintMeta)

  const [subdivision, setSubdivision] = useState({
    motherParcel: '',
    county: '',
    schemePurpose: 'Subdivision for sale / family transfer',
    planningAuthority: '',
    consentReference: '',
    accessRoadWidth: '9.0 m',
    originalAreaHa: '',
    conditions: 'All proposed parcels to retain legal access. Road reserves and wayleaves to be surrendered where applicable. Final parcel numbers to be issued by the land registry / survey office.',
  })
  const [parcels, setParcels] = useState<ParcelScheduleRow[]>([
    { parcelNo: 'A', ownerOrBeneficiary: '', areaHa: '', landUse: 'Residential', access: 'Access road', remarks: '' },
    { parcelNo: 'B', ownerOrBeneficiary: '', areaHa: '', landUse: 'Residential', access: 'Access road', remarks: '' },
  ])

  const [road, setRoad] = useState({
    roadName: '',
    authority: '',
    routeSection: '',
    surveyPurpose: 'Road reserve verification and encroachment identification',
    designReserveWidth: '20.0 m',
    datum: 'Arc 1960 / UTM Zone 37S',
    anomalies: '',
    recommendations: '',
  })
  const [chainages, setChainages] = useState<RoadChainageRow[]>([
    { chainage: '0+000', easting: '', northing: '', offsetLeft: '', offsetRight: '', reserveWidth: '', feature: 'Start control', remarks: '' },
  ])

  const [valuation, setValuation] = useState({
    valuationClient: '',
    valuationPurpose: 'Market valuation support',
    propertyLocation: '',
    inspectionDate: defaultPrintMeta.date,
    coordinateSystem: 'Arc 1960 / UTM Zone 37S',
    boundaryNotes: '',
  })
  const [valuationParcels, setValuationParcels] = useState<ValuationParcelRow[]>([
    { parcelNo: '', tenure: '', registeredAreaHa: '', surveyedAreaHa: '', variance: '', encumbrance: '', valuationNote: '' },
  ])

  const [title, setTitle] = useState({
    parcelNumber: '',
    registry: '',
    searchDate: defaultPrintMeta.date,
    registeredOwner: '',
    tenure: '',
    titleArea: '',
    encumbrances: 'None disclosed in the supplied search certificate.',
    restrictions: 'None disclosed in the supplied search certificate.',
    surveyorInterpretation: '',
    clientAdvice: '',
  })

  const [setback, setSetback] = useState({
    parcelNumber: '',
    county: '',
    permitPurpose: 'Development permit / building approval support',
    authority: '',
    inspectionDate: defaultPrintMeta.date,
    siteObservations: '',
    conclusion: '',
  })
  const [setbackRows, setSetbackRows] = useState<SetbackRow[]>([
    { feature: 'Road reserve', requiredSetback: '', observedSetback: '', status: 'review', affectedParcel: '', remarks: '' },
    { feature: 'Riparian reserve', requiredSetback: '', observedSetback: '', status: 'review', affectedParcel: '', remarks: '' },
  ])

  const setObj = <T extends Record<string, string>>(
    setter: Dispatch<SetStateAction<T>>,
    value: T,
    key: keyof T,
    next: string,
  ) => {
    setter({ ...value, [key]: next })
  }

  const updateRow = <T,>(rows: T[], setter: (rows: T[]) => void, index: number, next: T) => {
    setter(rows.map((row, i) => (i === index ? next : row)))
  }

  const removeRow = <T,>(rows: T[], setter: (rows: T[]) => void, index: number) => {
    setter(rows.filter((_, i) => i !== index))
  }

  function printActive() {
    if (active === 'subdivision') {
      printSubdivisionScheme({ meta: { ...meta, title: 'Subdivision Scheme Document' }, ...subdivision, proposedParcels: parcels })
    } else if (active === 'road') {
      printRoadReserveReport({ meta: { ...meta, title: 'Road Reserve Survey Report' }, ...road, chainages })
    } else if (active === 'valuation') {
      printValuationSupport({ meta: { ...meta, title: 'Valuation Support Schedule' }, ...valuation, parcels: valuationParcels })
    } else if (active === 'title') {
      printTitleSearchSummary({ meta: { ...meta, title: 'Title Search Summary' }, ...title })
    } else {
      printEnvironmentalSetback({ meta: { ...meta, title: 'Environmental Setback Certificate' }, ...setback, rows: setbackRows })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-3 py-2 rounded border text-sm transition-colors ${
              active === tab.id
                ? 'bg-[var(--accent)] text-black border-[var(--accent)] font-semibold'
                : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`ml-2 text-[10px] ${active === tab.id ? 'text-black' : 'text-zinc-400'}`}>{tab.tier}</span>
          </button>
        ))}
      </div>

      <PrintMetaPanel meta={meta} onChange={setMeta} />

      {active === 'subdivision' && (
        <Section title="Subdivision Scheme Document">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Mother Parcel" value={subdivision.motherParcel} onChange={v => setObj(setSubdivision, subdivision, 'motherParcel', v)} />
            <Field label="County" value={subdivision.county} onChange={v => setObj(setSubdivision, subdivision, 'county', v)} />
            <Field label="Planning Authority" value={subdivision.planningAuthority} onChange={v => setObj(setSubdivision, subdivision, 'planningAuthority', v)} />
            <Field label="Scheme Purpose" value={subdivision.schemePurpose} onChange={v => setObj(setSubdivision, subdivision, 'schemePurpose', v)} />
            <Field label="Consent Reference" value={subdivision.consentReference} onChange={v => setObj(setSubdivision, subdivision, 'consentReference', v)} />
            <Field label="Access Road Width" value={subdivision.accessRoadWidth} onChange={v => setObj(setSubdivision, subdivision, 'accessRoadWidth', v)} />
            <Field label="Original Area (ha)" value={subdivision.originalAreaHa} onChange={v => setObj(setSubdivision, subdivision, 'originalAreaHa', v)} />
          </div>
          <ParcelTable rows={parcels} setRows={setParcels} />
          <TextArea label="Conditions and Planning Notes" value={subdivision.conditions} onChange={v => setObj(setSubdivision, subdivision, 'conditions', v)} />
        </Section>
      )}

      {active === 'road' && (
        <Section title="Road Reserve Survey Report">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Road / Route Name" value={road.roadName} onChange={v => setObj(setRoad, road, 'roadName', v)} />
            <Field label="Authority" value={road.authority} onChange={v => setObj(setRoad, road, 'authority', v)} />
            <Field label="Route Section" value={road.routeSection} onChange={v => setObj(setRoad, road, 'routeSection', v)} />
            <Field label="Survey Purpose" value={road.surveyPurpose} onChange={v => setObj(setRoad, road, 'surveyPurpose', v)} />
            <Field label="Design Reserve Width" value={road.designReserveWidth} onChange={v => setObj(setRoad, road, 'designReserveWidth', v)} />
            <Field label="Datum / CRS" value={road.datum} onChange={v => setObj(setRoad, road, 'datum', v)} />
          </div>
          <RoadTable rows={chainages} setRows={setChainages} />
          <TextArea label="Encroachments, Utilities and Anomalies" value={road.anomalies} onChange={v => setObj(setRoad, road, 'anomalies', v)} />
          <TextArea label="Recommendations" value={road.recommendations} onChange={v => setObj(setRoad, road, 'recommendations', v)} />
        </Section>
      )}

      {active === 'valuation' && (
        <Section title="Valuation Support Schedule">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Client / Valuer" value={valuation.valuationClient} onChange={v => setObj(setValuation, valuation, 'valuationClient', v)} />
            <Field label="Purpose" value={valuation.valuationPurpose} onChange={v => setObj(setValuation, valuation, 'valuationPurpose', v)} />
            <Field label="Property Location" value={valuation.propertyLocation} onChange={v => setObj(setValuation, valuation, 'propertyLocation', v)} />
            <Field label="Inspection Date" type="date" value={valuation.inspectionDate} onChange={v => setObj(setValuation, valuation, 'inspectionDate', v)} />
            <Field label="Coordinate System" value={valuation.coordinateSystem} onChange={v => setObj(setValuation, valuation, 'coordinateSystem', v)} />
          </div>
          <ValuationTable rows={valuationParcels} setRows={setValuationParcels} />
          <TextArea label="Boundary and Inspection Notes" value={valuation.boundaryNotes} onChange={v => setObj(setValuation, valuation, 'boundaryNotes', v)} />
        </Section>
      )}

      {active === 'title' && (
        <Section title="Title Search Summary">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Parcel / Title Number" value={title.parcelNumber} onChange={v => setObj(setTitle, title, 'parcelNumber', v)} />
            <Field label="Registry" value={title.registry} onChange={v => setObj(setTitle, title, 'registry', v)} />
            <Field label="Search Date" type="date" value={title.searchDate} onChange={v => setObj(setTitle, title, 'searchDate', v)} />
            <Field label="Registered Owner" value={title.registeredOwner} onChange={v => setObj(setTitle, title, 'registeredOwner', v)} />
            <Field label="Tenure" value={title.tenure} onChange={v => setObj(setTitle, title, 'tenure', v)} />
            <Field label="Title Area" value={title.titleArea} onChange={v => setObj(setTitle, title, 'titleArea', v)} />
          </div>
          <TextArea label="Encumbrances" value={title.encumbrances} onChange={v => setObj(setTitle, title, 'encumbrances', v)} />
          <TextArea label="Restrictions / Cautions" value={title.restrictions} onChange={v => setObj(setTitle, title, 'restrictions', v)} />
          <TextArea label="Surveyor Interpretation" value={title.surveyorInterpretation} onChange={v => setObj(setTitle, title, 'surveyorInterpretation', v)} />
          <TextArea label="Client Advice / Next Action" value={title.clientAdvice} onChange={v => setObj(setTitle, title, 'clientAdvice', v)} />
        </Section>
      )}

      {active === 'setback' && (
        <Section title="Environmental Setback Certificate">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Parcel Number" value={setback.parcelNumber} onChange={v => setObj(setSetback, setback, 'parcelNumber', v)} />
            <Field label="County" value={setback.county} onChange={v => setObj(setSetback, setback, 'county', v)} />
            <Field label="Permit / Use Purpose" value={setback.permitPurpose} onChange={v => setObj(setSetback, setback, 'permitPurpose', v)} />
            <Field label="Authority" value={setback.authority} onChange={v => setObj(setSetback, setback, 'authority', v)} />
            <Field label="Inspection Date" type="date" value={setback.inspectionDate} onChange={v => setObj(setSetback, setback, 'inspectionDate', v)} />
          </div>
          <SetbackTable rows={setbackRows} setRows={setSetbackRows} />
          <TextArea label="Site Observations" value={setback.siteObservations} onChange={v => setObj(setSetback, setback, 'siteObservations', v)} />
          <TextArea label="Certification Conclusion" value={setback.conclusion} onChange={v => setObj(setSetback, setback, 'conclusion', v)} />
        </Section>
      )}

      <button
        onClick={printActive}
        className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-bold rounded text-sm transition-colors"
      >
        Print {tabs.find(tab => tab.id === active)?.label}
      </button>
    </div>
  )

  function ParcelTable({ rows, setRows }: { rows: ParcelScheduleRow[]; setRows: (rows: ParcelScheduleRow[]) => void }) {
    return (
      <EditableRows
        title="Proposed Parcel Schedule"
        addLabel="Add parcel"
        onAdd={() => setRows([...rows, { parcelNo: '', ownerOrBeneficiary: '', areaHa: '', landUse: '', access: '', remarks: '' }])}
      >
        {rows.map((row, index) => (
          <div key={`${row}-${index}`} className="grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr_0.8fr_1fr_1fr_1.2fr_auto] gap-2">
            <Field label="Parcel" value={row.parcelNo} onChange={v => updateRow(rows, setRows, index, { ...row, parcelNo: v })} />
            <Field label="Beneficiary" value={row.ownerOrBeneficiary} onChange={v => updateRow(rows, setRows, index, { ...row, ownerOrBeneficiary: v })} />
            <Field label="Area ha" value={row.areaHa} onChange={v => updateRow(rows, setRows, index, { ...row, areaHa: v })} />
            <Field label="Land Use" value={row.landUse} onChange={v => updateRow(rows, setRows, index, { ...row, landUse: v })} />
            <Field label="Access" value={row.access} onChange={v => updateRow(rows, setRows, index, { ...row, access: v })} />
            <Field label="Remarks" value={row.remarks} onChange={v => updateRow(rows, setRows, index, { ...row, remarks: v })} />
            <RemoveButton onClick={() => removeRow(rows, setRows, index)} />
          </div>
        ))}
      </EditableRows>
    )
  }

  function RoadTable({ rows, setRows }: { rows: RoadChainageRow[]; setRows: (rows: RoadChainageRow[]) => void }) {
    return (
      <EditableRows
        title="Chainage Schedule"
        addLabel="Add chainage"
        onAdd={() => setRows([...rows, { chainage: '', easting: '', northing: '', offsetLeft: '', offsetRight: '', reserveWidth: '', feature: '', remarks: '' }])}
      >
        {rows.map((row, index) => (
          <div key={`${row}-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Field label="Chainage" value={row.chainage} onChange={v => updateRow(rows, setRows, index, { ...row, chainage: v })} />
            <Field label="Easting" value={row.easting} onChange={v => updateRow(rows, setRows, index, { ...row, easting: v })} />
            <Field label="Northing" value={row.northing} onChange={v => updateRow(rows, setRows, index, { ...row, northing: v })} />
            <Field label="Reserve Width" value={row.reserveWidth} onChange={v => updateRow(rows, setRows, index, { ...row, reserveWidth: v })} />
            <Field label="Left Offset" value={row.offsetLeft} onChange={v => updateRow(rows, setRows, index, { ...row, offsetLeft: v })} />
            <Field label="Right Offset" value={row.offsetRight} onChange={v => updateRow(rows, setRows, index, { ...row, offsetRight: v })} />
            <Field label="Feature" value={row.feature} onChange={v => updateRow(rows, setRows, index, { ...row, feature: v })} />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="Remarks" value={row.remarks} onChange={v => updateRow(rows, setRows, index, { ...row, remarks: v })} />
              <RemoveButton onClick={() => removeRow(rows, setRows, index)} />
            </div>
          </div>
        ))}
      </EditableRows>
    )
  }

  function ValuationTable({ rows, setRows }: { rows: ValuationParcelRow[]; setRows: (rows: ValuationParcelRow[]) => void }) {
    return (
      <EditableRows
        title="Valuation Parcel Schedule"
        addLabel="Add parcel"
        onAdd={() => setRows([...rows, { parcelNo: '', tenure: '', registeredAreaHa: '', surveyedAreaHa: '', variance: '', encumbrance: '', valuationNote: '' }])}
      >
        {rows.map((row, index) => (
          <div key={`${row}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.8fr_1.2fr_1.2fr_auto] gap-2">
            <Field label="Parcel" value={row.parcelNo} onChange={v => updateRow(rows, setRows, index, { ...row, parcelNo: v })} />
            <Field label="Tenure" value={row.tenure} onChange={v => updateRow(rows, setRows, index, { ...row, tenure: v })} />
            <Field label="Title ha" value={row.registeredAreaHa} onChange={v => updateRow(rows, setRows, index, { ...row, registeredAreaHa: v })} />
            <Field label="Survey ha" value={row.surveyedAreaHa} onChange={v => updateRow(rows, setRows, index, { ...row, surveyedAreaHa: v })} />
            <Field label="Variance" value={row.variance} onChange={v => updateRow(rows, setRows, index, { ...row, variance: v })} />
            <Field label="Encumbrance" value={row.encumbrance} onChange={v => updateRow(rows, setRows, index, { ...row, encumbrance: v })} />
            <Field label="Valuation Note" value={row.valuationNote} onChange={v => updateRow(rows, setRows, index, { ...row, valuationNote: v })} />
            <RemoveButton onClick={() => removeRow(rows, setRows, index)} />
          </div>
        ))}
      </EditableRows>
    )
  }

  function SetbackTable({ rows, setRows }: { rows: SetbackRow[]; setRows: (rows: SetbackRow[]) => void }) {
    return (
      <EditableRows
        title="Setback Compliance Schedule"
        addLabel="Add setback"
        onAdd={() => setRows([...rows, { feature: '', requiredSetback: '', observedSetback: '', status: 'review', affectedParcel: '', remarks: '' }])}
      >
        {rows.map((row, index) => (
          <div key={`${row}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_0.8fr_0.8fr_1fr_1fr_1.2fr_auto] gap-2">
            <Field label="Feature" value={row.feature} onChange={v => updateRow(rows, setRows, index, { ...row, feature: v })} />
            <Field label="Required" value={row.requiredSetback} onChange={v => updateRow(rows, setRows, index, { ...row, requiredSetback: v })} />
            <Field label="Observed" value={row.observedSetback} onChange={v => updateRow(rows, setRows, index, { ...row, observedSetback: v })} />
            <label className="block">
              <span className="block text-xs text-[var(--text-muted)] mb-1">Status</span>
              <select
                className={inputClass('text-sm')}
                value={row.status}
                onChange={event => updateRow(rows, setRows, index, { ...row, status: event.target.value as Status })}
              >
                <option value="compliant">Compliant</option>
                <option value="review">Review</option>
                <option value="non_compliant">Non compliant</option>
              </select>
            </label>
            <Field label="Affected Parcel" value={row.affectedParcel} onChange={v => updateRow(rows, setRows, index, { ...row, affectedParcel: v })} />
            <Field label="Remarks" value={row.remarks} onChange={v => updateRow(rows, setRows, index, { ...row, remarks: v })} />
            <RemoveButton onClick={() => removeRow(rows, setRows, index)} />
          </div>
        ))}
      </EditableRows>
    )
  }
}

function EditableRows({
  title,
  addLabel,
  onAdd,
  children,
}: {
  title: string
  addLabel: string
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-1.5 border border-[var(--border-color)] hover:border-[var(--accent)] rounded text-xs text-[var(--text-secondary)]"
        >
          + {addLabel}
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-end h-10 px-3 border border-red-800/60 hover:border-red-500 rounded text-xs text-red-300"
      title="Remove row"
    >
      Remove
    </button>
  )
}
