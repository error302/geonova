'use client';

import { useState } from 'react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { dmsToDecimalSolved, geographicToUtmSolved, utmToGeographicSolved, decimalToDmsSolved } from '@/lib/engine/solution/wrappers/coordinates'

export default function CoordinatesCalculator() {
  const [tab, setTab] = useState<'utm-to-geo' | 'geo-to-utm' | 'dms-dec'>('utm-to-geo');
  const [utm, setUtm] = useState({ e: '500000', n: '5500000', z: '48', h: 'S' });
  const [geo, setGeo] = useState({ lat: '40.7128', lon: '-74.0060' });
  const [dms, setDms] = useState({ value: '40° 42\' 46.08"', type: 'lat' });
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const convertUTMtoGeo = () => {
    const e = parseFloat(utm.e), n = parseFloat(utm.n), z = parseInt(utm.z);
    if (isNaN(e) || isNaN(n) || isNaN(z)) return;
    const s = utmToGeographicSolved({ easting: e, northing: n, zone: z, hemisphere: utm.h as 'N' | 'S' })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
  };

  const convertGeoToUTM = () => {
    const lat = parseFloat(geo.lat), lon = parseFloat(geo.lon);
    if (isNaN(lat) || isNaN(lon)) return;
    const s = geographicToUtmSolved({ lat, lon })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
  };

  const convertDMS = () => {
    const s = dmsToDecimalSolved({ dms: dms.value, isLatitude: dms.type === 'lat' })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
  };

  const convertDecimalToDms = () => {
    const raw = dms.value.trim()
    const dec = Number(raw)
    if (!isFinite(dec)) return
    const s = decimalToDmsSolved({ decimal: dec, isLatitude: dms.type === 'lat' })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Coordinate Conversion</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">WGS84 / UTM coordinate conversions</p>

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
                  <div><label className="label">Easting (m)</label><input className="input" value={utm.e} onChange={e => setUtm({...utm, e: e.target.value})} /></div>
                  <div><label className="label">Northing (m)</label><input className="input" value={utm.n} onChange={e => setUtm({...utm, n: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Zone</label><input className="input" value={utm.z} onChange={e => setUtm({...utm, z: e.target.value})} /></div>
                  <div><label className="label">Hemisphere</label><select className="input" value={utm.h} onChange={e => setUtm({...utm, h: e.target.value})}><option value="N">Northern</option><option value="S">Southern</option></select></div>
                </div>
              </div>
            </div>
          )}

          {tab === 'geo-to-utm' && (
            <div className="card">
              <div className="card-header"><span className="label">Geographic (WGS84)</span></div>
              <div className="card-body space-y-4">
                <div><label className="label">Latitude (decimal degrees)</label><input className="input" value={geo.lat} onChange={e => setGeo({...geo, lat: e.target.value})} placeholder="40.7128" /></div>
                <div><label className="label">Longitude (decimal degrees)</label><input className="input" value={geo.lon} onChange={e => setGeo({...geo, lon: e.target.value})} placeholder="-74.0060" /></div>
              </div>
            </div>
          )}

          {tab === 'dms-dec' && (
            <div className="card">
              <div className="card-header"><span className="label">DMS to Decimal</span></div>
              <div className="card-body space-y-4">
                <div className="flex gap-2">
                  <button onClick={() => setDms({...dms, type: 'lat'})} className={`btn ${dms.type === 'lat' ? 'btn-primary' : 'btn-secondary'} flex-1`}>Latitude</button>
                  <button onClick={() => setDms({...dms, type: 'lon'})} className={`btn ${dms.type === 'lon' ? 'btn-primary' : 'btn-secondary'} flex-1`}>Longitude</button>
                </div>
                <div>
                  <label className="label">DMS (e.g. 40° 42' 46.08&quot; N) OR Decimal (e.g. -74.0060)</label>
                  <input className="input" value={dms.value} onChange={e => setDms({...dms, value: e.target.value})} placeholder="40° 42' 46.08&quot; N" />
                </div>
              </div>
            </div>
          )}

          <button 
            onClick={tab === 'utm-to-geo' ? convertUTMtoGeo : tab === 'geo-to-utm' ? convertGeoToUTM : convertDMS} 
            className="btn btn-primary w-full"
          >
            Convert
          </button>
          {tab === 'dms-dec' && (
            <button onClick={convertDecimalToDms} className="btn btn-secondary w-full">
              Convert Decimal → DMS
            </button>
          )}
        </div>

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );
}
