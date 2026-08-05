'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader'
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { dmsToDecimalSolved, geographicToUtmSolved, utmToGeographicSolved, decimalToDmsSolved } from '@/lib/engine/solution/wrappers/coordinates'
import { generatePDF, downloadCSV, toCSV } from '@/lib/export/helpers'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function CoordinatesCalculator() {
  const { t } = useLanguage()
  const [tab, setTab] = useState<'utm-to-geo' | 'geo-to-utm' | 'dms-dec'>('utm-to-geo');
  const [utm, setUtm] = useState({ e: '', n: '', z: '', h: 'S' });
  const [geo, setGeo] = useState({ lat: '40.7128', lon: '-74.0060' });
  const [dms, setDms] = useState({ value: '40° 42\' 46.08"', type: 'lat' });
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const convertUTMtoGeo = () => {
    const e = parseFloat(utm.e), n = parseFloat(utm.n), z = parseInt(utm.z);
    if (isNaN(e) || isNaN(n) || isNaN(z)) return;
    const s = utmToGeographicSolved({ easting: e, northing: n, zone: z, hemisphere: utm.h as 'N' | 'S' })
    setSteps(s.steps); setSolutionTitle(s.solution.title)
  };

  const convertGeoToUTM = () => {
    const lat = parseFloat(geo.lat), lon = parseFloat(geo.lon);
    if (isNaN(lat) || isNaN(lon)) return;
    const s = geographicToUtmSolved({ lat, lon })
    setSteps(s.steps); setSolutionTitle(s.solution.title)
  };

  const convertDMS = () => {
    const s = dmsToDecimalSolved({ dms: dms.value, isLatitude: dms.type === 'lat' })
    setSteps(s.steps); setSolutionTitle(s.solution.title)
  };

  const convertDecimalToDms = () => {
    const raw = dms.value.trim()
    const dec = Number(raw)
    if (!isFinite(dec)) return
    const s = decimalToDmsSolved({ decimal: dec, isLatitude: dms.type === 'lat' })
    setSteps(s.steps); setSolutionTitle(s.solution.title)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.coordinates')}
        subtitle={t('tools.coordinatesDesc')}
        reference="Survey Regulations 1994 | Survey Act Cap 299 | Kenya UTM Zones 36S / 37S"
      />

      <div className="flex gap-4 mb-6 flex-wrap">
        <button onClick={() => { setTab('utm-to-geo'); setSteps(null); setSolutionTitle(undefined); }} className={`btn ${tab === 'utm-to-geo' ? 'btn-primary' : 'btn-secondary'}`}>
          UTM → Lat/Lon
        </button>
        <button onClick={() => { setTab('geo-to-utm'); setSteps(null); setSolutionTitle(undefined); }} className={`btn ${tab === 'geo-to-utm' ? 'btn-primary' : 'btn-secondary'}`}>
          Lat/Lon → UTM
        </button>
        <button onClick={() => { setTab('dms-dec'); setSteps(null); setSolutionTitle(undefined); }} className={`btn ${tab === 'dms-dec' ? 'btn-primary' : 'btn-secondary'}`}>
          DMS ↔ Decimal
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {tab === 'utm-to-geo' && (
            <div className="card">
              <div className="card-header"><span className="label">UTM Coordinates</span></div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label" htmlFor="easting-m">Easting (m)</label><input id="easting-m" aria-label="E" className="input" value={utm.e} onChange={e => setUtm({...utm, e: e.target.value})} /></div>
                  <div><label className="label" htmlFor="northing-m">Northing (m)</label><input id="northing-m" aria-label="N" className="input" value={utm.n} onChange={e => setUtm({...utm, n: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label" htmlFor="zone">Zone</label><input id="zone" className="input" value={utm.z} onChange={e => setUtm({...utm, z: e.target.value})} placeholder="37" /></div>
                  <div><label className="label" htmlFor="hemisphere">Hemisphere</label>
                    <select id="hemisphere" className="input" value={utm.h} onChange={e => setUtm({...utm, h: e.target.value})}>
                      <option value="N">Northern</option>
                      <option value="S">Southern (Kenya)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'geo-to-utm' && (
            <div className="card">
              <div className="card-header"><span className="label">Geographic (WGS84)</span></div>
              <div className="card-body space-y-4">
                <div><label className="label" htmlFor="latitude-decimal-degrees-negative-south">Latitude (decimal degrees, negative = South)</label><input id="latitude-decimal-degrees-negative-south" className="input" value={geo.lat} onChange={e => setGeo({...geo, lat: e.target.value})} placeholder="-1.2921 (Nairobi)" /></div>
                <div><label className="label" htmlFor="longitude-decimal-degrees">Longitude (decimal degrees)</label><input id="longitude-decimal-degrees" className="input" value={geo.lon} onChange={e => setGeo({...geo, lon: e.target.value})} aria-label="Longitude (decimal degrees)" placeholder="36.8219 (Nairobi)" /></div>
              </div>
            </div>
          )}

          {tab === 'dms-dec' && (
            <div className="card">
              <div className="card-header"><span className="label">DMS ↔ Decimal Degrees</span></div>
              <div className="card-body space-y-4">
                <div className="flex gap-2">
                  <button onClick={() => setDms({...dms, type: 'lat'})} className={`btn ${dms.type === 'lat' ? 'btn-primary' : 'btn-secondary'} flex-1`}>Latitude</button>
                  <button onClick={() => setDms({...dms, type: 'lon'})} className={`btn ${dms.type === 'lon' ? 'btn-primary' : 'btn-secondary'} flex-1`}>Longitude</button>
                </div>
                <div>
                  <label className="label" htmlFor="dms-e-g-01-17-31-56-s-or-decimal-e-g-1-2921">DMS (e.g. 01° 17' 31.56&quot; S) OR Decimal (e.g. -1.2921)</label>
                  <input id="dms-e-g-01-17-31-56-s-or-decimal-e-g-1-2921" className="input" value={dms.value} onChange={e => setDms({...dms, value: e.target.value})} placeholder="01° 17' 31.56&quot; S" />
                </div>
              </div>
            </div>
          )}

          <button onClick={tab === 'utm-to-geo' ? convertUTMtoGeo : tab === 'geo-to-utm' ? convertGeoToUTM : convertDMS} className="btn btn-primary w-full">
            Convert
          </button>
          {tab === 'dms-dec' && (
            <button onClick={convertDecimalToDms} className="btn btn-secondary w-full">
              Convert Decimal → DMS
            </button>
          )}
          {steps && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  generatePDF(
                    { title: 'Coordinate Transformation Report', reference: 'WGS84 | Arc 1960 / UTM Zone 37S | SRID 21037' },
                    [
                      { title: 'Conversion Steps', rows: steps.map((s: SolutionStep) => ({ label: s.label, value: s.result || s.computation || '—' })) },
                    ],
                  )
                }}
                className="btn btn-secondary flex-1 inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> {t('toolUI.exportPdf')}
              </button>
              <button
                onClick={() => {
                  const inputRows: string[][] = []
                  const outputRows: string[][] = []
                  steps.forEach((s: SolutionStep) => {
                    if (s.formula) inputRows.push([s.label, s.formula])
                    if (s.result || s.computation) outputRows.push([s.label, s.result || s.computation || ''])
                  })
                  const csv = toCSV(
                    ['Parameter', 'Input', 'Output'],
                    steps.map((s: SolutionStep) => [s.label, s.formula || '', s.result || s.computation || '']),
                  )
                  downloadCSV(csv, 'coordinate-transformation')
                }}
                className="btn btn-secondary flex-1 inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> {t('toolUI.exportCsv')}
              </button>
            </div>
          )}
        </div>

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );
}
