'use client';

import { useState } from 'react';
import { geographicToUTM, utmToGeographic, latLonToString } from '@/lib/engine/coordinates';
import { decimalToDMS } from '@/lib/engine/angles';

export default function CoordinatesCalculator() {
  const [tab, setTab] = useState<'utm-to-geo' | 'geo-to-utm' | 'dms-dec'>('utm-to-geo');
  const [utm, setUtm] = useState({ e: '500000', n: '5500000', z: '48', h: 'S' });
  const [geo, setGeo] = useState({ lat: '40.7128', lon: '-74.0060' });
  const [dms, setDms] = useState({ value: '40° 42\' 46.08"', type: 'lat' });
  const [result, setResult] = useState<any>(null);

  const convertUTMtoGeo = () => {
    const e = parseFloat(utm.e), n = parseFloat(utm.n), z = parseInt(utm.z);
    if (isNaN(e) || isNaN(n) || isNaN(z)) return;
    
    const r = utmToGeographic(e, n, z, utm.h as 'N' | 'S');
    const latDMS = decimalToDMS(r.lat, true);
    const lonDMS = decimalToDMS(r.lon, false);
    
    setResult({
      type: 'utm-to-geo',
      lat: r.lat.toFixed(6),
      lon: r.lon.toFixed(6),
      latDMS: `${latDMS.degrees}° ${latDMS.minutes}' ${latDMS.seconds.toFixed(3)}" ${latDMS.direction}`,
      lonDMS: `${lonDMS.degrees}° ${lonDMS.minutes}' ${lonDMS.seconds.toFixed(3)}" ${lonDMS.direction}`
    });
  };

  const convertGeoToUTM = () => {
    const lat = parseFloat(geo.lat), lon = parseFloat(geo.lon);
    if (isNaN(lat) || isNaN(lon)) return;
    
    const r = geographicToUTM(lat, lon);
    setResult({
      type: 'geo-to-utm',
      e: r.easting.toFixed(4),
      n: r.northing.toFixed(4),
      z: r.zone,
      h: r.hemisphere
    });
  };

  const convertDMS = () => {
    const cleaned = dms.value.replace(/[°'"]/g, ' ').trim().replace(/\s+/g, ' ').split(' ');
    if (cleaned.length >= 3) {
      const deg = parseFloat(cleaned[0]);
      const min = parseFloat(cleaned[1]);
      const sec = parseFloat(cleaned[2]);
      const dir = dms.type === 'lat' 
        ? (deg >= 0 ? 'N' : 'S') 
        : (deg >= 0 ? 'E' : 'W');
      
      let decimal = deg + min / 60 + sec / 3600;
      if (dir === 'S' || dir === 'W') decimal = -decimal;
      
      setResult({
        type: 'dms',
        dms: dms.value,
        decimal: decimal.toFixed(6)
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Coordinate Conversion</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">WGS84 / UTM — Based on N.N. Basak</p>

      <div className="flex gap-4 mb-6 flex-wrap">
        <button onClick={() => { setTab('utm-to-geo'); setResult(null); }} className={`btn ${tab === 'utm-to-geo' ? 'btn-primary' : 'btn-secondary'}`}>
          UTM → Lat/Lon
        </button>
        <button onClick={() => { setTab('geo-to-utm'); setResult(null); }} className={`btn ${tab === 'geo-to-utm' ? 'btn-primary' : 'btn-secondary'}`}>
          Lat/Lon → UTM
        </button>
        <button onClick={() => { setTab('dms-dec'); setResult(null); }} className={`btn ${tab === 'dms-dec' ? 'btn-primary' : 'btn-secondary'}`}>
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
                <div><label className="label">DMS (degrees° minutes' seconds")</label><input className="input" value={dms.value} onChange={e => setDms({...dms, value: e.target.value})} placeholder="40° 42' 46.08&quot;" /></div>
              </div>
            </div>
          )}

          <button 
            onClick={tab === 'utm-to-geo' ? convertUTMtoGeo : tab === 'geo-to-utm' ? convertGeoToUTM : convertDMS} 
            className="btn btn-primary w-full"
          >
            Convert
          </button>
        </div>

        {result && (
          <div className="card">
            <div className="card-header"><span className="label">Results</span></div>
            <div className="card-body space-y-3">
              {result.type === 'utm-to-geo' && (
                <>
                  <ResultRow label="Latitude" value={`${result.lat}°`} />
                  <ResultRow label="Longitude" value={`${result.lon}°`} />
                  <ResultRow label="Latitude (DMS)" value={result.latDMS} />
                  <ResultRow label="Longitude (DMS)" value={result.lonDMS} />
                </>
              )}
              {result.type === 'geo-to-utm' && (
                <>
                  <ResultRow label="Zone" value={`${result.z}${result.h}`} />
                  <ResultRow label="Easting" value={`${result.e} m`} />
                  <ResultRow label="Northing" value={`${result.n} m`} />
                </>
              )}
              {result.type === 'dms' && (
                <>
                  <ResultRow label="DMS" value={result.dms} />
                  <ResultRow label="Decimal" value={`${result.decimal}°`} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[var(--border-color)]">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
