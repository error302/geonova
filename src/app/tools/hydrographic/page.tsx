'use client';

import { useState } from 'react';

interface TideReading {
  id: number;
  time: string;
  level: string;
}

interface SoundingRecord {
  id: number;
  line: string;
  fixNo: string;
  time: string;
  easting: string;
  northing: string;
  rawDepth: string;
  tideHeight: string;
}

interface CrossSectionMeasurement {
  id: number;
  distanceFromBank: string;
  depth: string;
}

interface ChartDatumParams {
  msl: string;
  lat: string;
  hat: string;
  mhws: string;
}

function formatNumber(n: number, decimals: number = 4): string {
  return n.toFixed(decimals);
}

function parseTimeToHours(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return parseInt(match[1]) + parseInt(match[2]) / 60;
}

function linearInterpolate(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x2 === x1) return y1;
  return y1 + (x - x1) * (y2 - y1) / (x2 - x1);
}

export default function HydrographicSurveyPage() {
  const [activeTab, setActiveTab] = useState<'tidal' | 'datum' | 'sounding' | 'crossSection'>('tidal');

  const [tideReadings, setTideReadings] = useState<TideReading[]>([
    { id: 1, time: '08:00', level: '1.200' },
    { id: 2, time: '09:00', level: '1.450' },
    { id: 3, time: '10:00', level: '1.680' },
    { id: 4, time: '11:00', level: '1.520' },
  ]);

  const [soundingRecords, setSoundingRecords] = useState<SoundingRecord[]>([
    { id: 1, line: 'L1', fixNo: '001', time: '09:30', easting: '484520', northing: '9863100', rawDepth: '8.450', tideHeight: '' },
  ]);

  const [tidalCorrectionResults, setTidalCorrectionResults] = useState<any>(null);

  const [chartDatumParams, setChartDatumParams] = useState<ChartDatumParams>({
    msl: '0.000',
    lat: '-2.500',
    hat: '3.200',
    mhws: '2.800',
  });

  const [datumConversion, setDatumConversion] = useState<{from: string, to: string, result: number} | null>(null);

  const addTideReading = () => {
    const last = tideReadings[tideReadings.length - 1];
    const lastTime = parseTimeToHours(last?.time || '08:00');
    const nextHour = Math.floor(lastTime) + 1;
    const nextTime = `${String(nextHour).padStart(2, '0')}:00`;
    setTideReadings([...tideReadings, { id: Date.now(), time: nextTime, level: '' }]);
  };

  const updateTideReading = (id: number, field: keyof TideReading, value: string) => {
    setTideReadings(tideReadings.map((t: any) => t.id === id ? { ...t, [field]: value } : t));
  };

  const addSoundingRecord = () => {
    const last = soundingRecords[soundingRecords.length - 1];
    const lastFix = parseInt(last?.fixNo || '0');
    setSoundingRecords([...soundingRecords, { 
      id: Date.now(), 
      line: last?.line || 'L1', 
      fixNo: String(lastFix + 1).padStart(3, '0'), 
      time: '', 
      easting: '', 
      northing: '', 
      rawDepth: '', 
      tideHeight: '' 
    }]);
  };

  const updateSoundingRecord = (id: number, field: keyof SoundingRecord, value: string) => {
    setSoundingRecords(soundingRecords.map((s: any) => s.id === id ? { ...s, [field]: value } : s));
  };

  const calculateTidalCorrection = () => {
    const sortedReadings = tideReadings
      .map((t: any) => ({ time: parseTimeToHours(t.time), level: parseFloat(t.level) }))
      .filter((t: any) => !isNaN(t.time) && !isNaN(t.level))
      .sort((a: any, b: any) => a.time - b.time);

    if (sortedReadings.length < 2) return;

    const results = soundingRecords.map((s: any) => {
      const soundingTime = parseTimeToHours(s.time);
      const rawDepth = parseFloat(s.rawDepth);
      if (isNaN(soundingTime) || isNaN(rawDepth)) return null;

      let tideHeight = 0;
      for (let i = 0; i < sortedReadings.length - 1; i++) {
        if (soundingTime >= sortedReadings[i].time && soundingTime <= sortedReadings[i + 1].time) {
          tideHeight = linearInterpolate(
            soundingTime,
            sortedReadings[i].time, sortedReadings[i].level,
            sortedReadings[i + 1].time, sortedReadings[i + 1].level
          );
          break;
        }
      }

      const correctedDepth = rawDepth - tideHeight;

      return {
        line: s.line,
        fixNo: s.fixNo,
        time: s.time,
        rawDepth,
        tideHeight,
        correctedDepth,
      };
    }).filter(Boolean);

    setTidalCorrectionResults({ readings: sortedReadings, soundings: results });
  };

  const [crossSectionMeasurements, setCrossSectionMeasurements] = useState<CrossSectionMeasurement[]>([
    { id: 1, distanceFromBank: '0.0', depth: '0.0' },
    { id: 2, distanceFromBank: '5.0', depth: '1.2' },
    { id: 3, distanceFromBank: '10.0', depth: '2.8' },
    { id: 4, distanceFromBank: '15.0', depth: '3.5' },
    { id: 5, distanceFromBank: '20.0', depth: '2.9' },
    { id: 6, distanceFromBank: '25.0', depth: '1.5' },
    { id: 7, distanceFromBank: '30.0', depth: '0.0' },
  ]);

  const [crossSectionResults, setCrossSectionResults] = useState<any>(null);
  const [seabedResults, setSeabedResults] = useState<any>(null);
  const [seabedLoading, setSeabedLoading] = useState(false);

  const addCrossSectionMeasurement = () => {
    const last = crossSectionMeasurements[crossSectionMeasurements.length - 1];
    const lastDist = parseFloat(last?.distanceFromBank || '0');
    setCrossSectionMeasurements([...crossSectionMeasurements, { 
      id: Date.now(), 
      distanceFromBank: String(lastDist + 5), 
      depth: '' 
    }]);
  };

  const updateCrossSectionMeasurement = (id: number, field: keyof CrossSectionMeasurement, value: string) => {
    setCrossSectionMeasurements(crossSectionMeasurements.map((m: any) => m.id === id ? { ...m, [field]: value } : m));
  };

  const calculateCrossSection = () => {
    const measurements = crossSectionMeasurements
      .map((m: any) => ({ distance: parseFloat(m.distanceFromBank), depth: parseFloat(m.depth) }))
      .filter((m: any) => !isNaN(m.distance) && !isNaN(m.depth))
      .sort((a: any, b: any) => a.distance - b.distance);

    if (measurements.length < 2) return;

    let area = 0;
    let wettedPerimeter = 0;
    const trapezoids: any[] = [];

    for (let i = 1; i < measurements.length; i++) {
      const d1 = measurements[i - 1].distance;
      const d2 = measurements[i].distance;
      const z1 = measurements[i - 1].depth;
      const z2 = measurements[i].depth;
      
      const dx = d2 - d1;
      const avgDepth = (z1 + z2) / 2;
      const trapArea = dx * avgDepth;
      area += trapArea;

      const slopeLength = Math.sqrt(dx * dx + (z2 - z1) * (z2 - z1));
      wettedPerimeter += slopeLength;

      trapezoids.push({ fromDist: d1, toDist: d2, fromDepth: z1, toDepth: z2, dx, avgDepth, area: trapArea });
    }

    const hydraulicRadius = area / wettedPerimeter;

    setCrossSectionResults({
      measurements,
      trapezoids,
      area,
      wettedPerimeter,
      hydraulicRadius,
    });
  };

  const analyzeSeabed = async () => {
    const points = soundingRecords
      .filter((r: any) => r.easting && r.northing && r.rawDepth)
      .map((r: any) => ({
        easting: parseFloat(r.easting),
        northing: parseFloat(r.northing),
        depth: parseFloat(r.rawDepth),
      }))
    if (points.length < 2) return
    setSeabedLoading(true)
    try {
      const res = await fetch('/api/compute/seabed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      })
      const data = await res.json()
      if (res.ok) setSeabedResults(data)
    } catch {
      // fallback: compute locally
      const depths = points.map((p: any) => p.depth)
      setSeabedResults({
        depth_min: Math.min(...depths),
        depth_max: Math.max(...depths),
        depth_mean: depths.reduce((a, b) => a + b, 0) / depths.length,
        volume: depths.reduce((a, b) => a + b, 0),
        area: points.length,
      })
    } finally {
      setSeabedLoading(false)
    }
  }

  const convertDatum = (from: string, to: string) => {
    const msl = parseFloat(chartDatumParams.msl);
    const lat = parseFloat(chartDatumParams.lat);
    const hat = parseFloat(chartDatumParams.hat);
    const mhws = parseFloat(chartDatumParams.mhws);

    const getOffset = (datum: string): number => {
      switch (datum) {
        case 'MSL': return msl;
        case 'LAT': return lat;
        case 'HAT': return hat;
        case 'MHWS': return mhws;
        case 'CD': return lat;
        default: return 0;
      }
    };

    const offsetFrom = getOffset(from);
    const offsetTo = getOffset(to);
    const result = offsetFrom - offsetTo;

    setDatumConversion({ from, to, result });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">🌊 Hydrographic Survey Tools</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">Bathymetry, tidal corrections, and chart datum conversions</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'tidal', label: 'Tidal Correction' },
          { id: 'datum', label: 'Chart Datum' },
          { id: 'sounding', label: 'Sounding Records' },
          { id: 'crossSection', label: 'River Cross Section' },
        ].map((tab: any) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === tab.id 
                ? 'bg-[var(--accent)] text-white' 
                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--accent)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'tidal' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">Tide Gauge Readings</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Enter tide gauge readings at known times to interpolate water levels at sounding times.
            </p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Water Level (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {tideReadings.map((t: any) => (
                    <tr key={t.id}>
                      <td><input className="input w-24" value={t.time} onChange={e => updateTideReading(t.id, 'time', e.target.value)} placeholder="HH:MM" /></td>
                      <td><input className="input w-32" value={t.level} onChange={e => updateTideReading(t.id, 'level', e.target.value)} placeholder="m" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex gap-4">
              <button onClick={addTideReading} className="btn btn-secondary">+ Add Reading</button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="label">Sounding Data</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Enter sounding records. Tide height will be interpolated from gauge readings.
            </p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Fix No</th>
                    <th>Time</th>
                    <th>Easting</th>
                    <th>Northing</th>
                    <th>Raw Depth (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {soundingRecords.map((s: any) => (
                    <tr key={s.id}>
                      <td><input className="input w-20" value={s.line} onChange={e => updateSoundingRecord(s.id, 'line', e.target.value)} /></td>
                      <td><input className="input w-20" value={s.fixNo} onChange={e => updateSoundingRecord(s.id, 'fixNo', e.target.value)} /></td>
                      <td><input className="input w-24" value={s.time} onChange={e => updateSoundingRecord(s.id, 'time', e.target.value)} placeholder="HH:MM" /></td>
                      <td><input className="input w-28" value={s.easting} onChange={e => updateSoundingRecord(s.id, 'easting', e.target.value)} /></td>
                      <td><input className="input w-28" value={s.northing} onChange={e => updateSoundingRecord(s.id, 'northing', e.target.value)} /></td>
                      <td><input className="input w-28" value={s.rawDepth} onChange={e => updateSoundingRecord(s.id, 'rawDepth', e.target.value)} placeholder="m" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex gap-4">
              <button onClick={addSoundingRecord} className="btn btn-secondary">+ Add Sounding</button>
              <button onClick={calculateTidalCorrection} className="btn btn-primary">Apply Tidal Correction</button>
            </div>
          </div>

          {tidalCorrectionResults && (
            <div className="card">
              <div className="card-header">
                <span className="label">Corrected Soundings</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th>Fix</th>
                      <th>Time</th>
                      <th>Raw Depth (m)</th>
                      <th>Tide Height (m)</th>
                      <th>Corrected Depth (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tidalCorrectionResults.soundings.map((s: any, i: number) => (
                      <tr key={i}>
                        <td>{s.line}</td>
                        <td>{s.fixNo}</td>
                        <td>{s.time}</td>
                        <td>{formatNumber(s.rawDepth, 3)}</td>
                        <td>{formatNumber(s.tideHeight, 3)}</td>
                        <td className="font-semibold">{formatNumber(s.correctedDepth, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'datum' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">Local Tidal Parameters</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Enter the local tidal parameters for your survey area.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Mean Sea Level (MSL)</label>
                <input 
                  className="input" 
                  type="number"
                  value={chartDatumParams.msl}
                  onChange={e => setChartDatumParams({...chartDatumParams, msl: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Lowest Astron. Tide (LAT)</label>
                <input 
                  className="input" 
                  type="number"
                  value={chartDatumParams.lat}
                  onChange={e => setChartDatumParams({...chartDatumParams, lat: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Highest Astron. Tide (HAT)</label>
                <input 
                  className="input" 
                  type="number"
                  value={chartDatumParams.hat}
                  onChange={e => setChartDatumParams({...chartDatumParams, hat: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Mean High Water Springs</label>
                <input 
                  className="input" 
                  type="number"
                  value={chartDatumParams.mhws}
                  onChange={e => setChartDatumParams({...chartDatumParams, mhws: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="label">Datum Conversion</span>
            </div>
            <div className="flex gap-4 items-end flex-wrap">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">From</label>
                <select className="input" onChange={e => convertDatum(e.target.value, (document.getElementById('datumTo') as HTMLSelectElement)?.value || 'MSL')}>
                  <option value="MSL">MSL</option>
                  <option value="LAT">LAT</option>
                  <option value="HAT">HAT</option>
                  <option value="MHWS">MHWS</option>
                  <option value="CD">Chart Datum</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">To</label>
                <select className="input" id="datumTo" onChange={e => convertDatum((document.querySelector('select') as HTMLSelectElement)?.value || 'MSL', e.target.value)}>
                  <option value="MSL">MSL</option>
                  <option value="LAT">LAT</option>
                  <option value="HAT">HAT</option>
                  <option value="MHWS">MHWS</option>
                  <option value="CD">Chart Datum</option>
                </select>
              </div>
              <button 
                onClick={() => {
                  const fromSelect = document.querySelectorAll('select')[0] as HTMLSelectElement;
                  const toSelect = document.querySelectorAll('select')[1] as HTMLSelectElement;
                  convertDatum(fromSelect.value, toSelect.value);
                }}
                className="btn btn-primary"
              >
                Convert
              </button>
            </div>

            {datumConversion && (
              <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded">
                <div className="text-center">
                  <span className="text-[var(--text-secondary)]">Conversion: </span>
                  <span className="font-semibold">{datumConversion.from} → {datumConversion.to}</span>
                  <div className="text-2xl font-mono mt-2">{formatNumber(datumConversion.result, 3)} m</div>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h4 className="font-semibold mb-3">Reference Chart</h4>
              <div className="overflow-x-auto">
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Offset from MSL (m)</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>HAT</td>
                      <td>{formatNumber(parseFloat(chartDatumParams.hat) - parseFloat(chartDatumParams.msl), 3)}</td>
                      <td>Highest Astronomical Tide</td>
                    </tr>
                    <tr>
                      <td>MHWS</td>
                      <td>{formatNumber(parseFloat(chartDatumParams.mhws) - parseFloat(chartDatumParams.msl), 3)}</td>
                      <td>Mean High Water Springs</td>
                    </tr>
                    <tr>
                      <td>MSL</td>
                      <td>0.000</td>
                      <td>Mean Sea Level</td>
                    </tr>
                    <tr>
                      <td>CD/LAT</td>
                      <td>{formatNumber(parseFloat(chartDatumParams.lat) - parseFloat(chartDatumParams.msl), 3)}</td>
                      <td>Chart Datum / Lowest Astronomical Tide</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sounding' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">Sounding Record Entry</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Full sounding record with position, depth, and reduced level calculation.
            </p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Fix No</th>
                    <th>Time</th>
                    <th>Easting</th>
                    <th>Northing</th>
                    <th>Raw Depth</th>
                    <th>Corrected</th>
                    <th>RL</th>
                  </tr>
                </thead>
                <tbody>
                  {soundingRecords.map((s: any) => (
                    <tr key={s.id}>
                      <td><input className="input w-16" value={s.line} onChange={e => updateSoundingRecord(s.id, 'line', e.target.value)} /></td>
                      <td><input className="input w-16" value={s.fixNo} onChange={e => updateSoundingRecord(s.id, 'fixNo', e.target.value)} /></td>
                      <td><input className="input w-20" value={s.time} onChange={e => updateSoundingRecord(s.id, 'time', e.target.value)} /></td>
                      <td><input className="input w-24" value={s.easting} onChange={e => updateSoundingRecord(s.id, 'easting', e.target.value)} /></td>
                      <td><input className="input w-24" value={s.northing} onChange={e => updateSoundingRecord(s.id, 'northing', e.target.value)} /></td>
                      <td><input className="input w-24" value={s.rawDepth} onChange={e => updateSoundingRecord(s.id, 'rawDepth', e.target.value)} /></td>
                      <td className="text-[var(--text-secondary)]">—</td>
                      <td className="text-[var(--text-secondary)]">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex gap-4">
              <button onClick={addSoundingRecord} className="btn btn-secondary">+ Add Record</button>
              <button onClick={calculateTidalCorrection} className="btn btn-primary">Calculate RL</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'crossSection' && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <span className="label">River Cross Section Measurements</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Enter distance from bank and depth at regular intervals across the river.
            </p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Distance from Bank (m)</th>
                    <th>Depth (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {crossSectionMeasurements.map((m: any) => (
                    <tr key={m.id}>
                      <td><input className="input w-32" value={m.distanceFromBank} onChange={e => updateCrossSectionMeasurement(m.id, 'distanceFromBank', e.target.value)} /></td>
                      <td><input className="input w-32" value={m.depth} onChange={e => updateCrossSectionMeasurement(m.id, 'depth', e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 flex gap-4">
              <button onClick={addCrossSectionMeasurement} className="btn btn-secondary">+ Add Point</button>
              <button onClick={calculateCrossSection} className="btn btn-primary">Calculate Section</button>
              <button
                onClick={analyzeSeabed}
                disabled={seabedLoading}
                className="btn btn-secondary disabled:opacity-60"
              >
                {seabedLoading ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Analysing…</>
                ) : 'Analyse Seabed (Python)'}
              </button>
            </div>
          </div>

          {crossSectionResults && (
            <div className="card">
              <div className="card-header">
                <span className="label">Cross Section Results</span>
              </div>
              
              <div className="mb-6">
                <svg viewBox="0 0 500 200" className="w-full h-48 bg-[var(--bg-tertiary)] rounded">
                  {crossSectionResults.measurements.map((m: any, i: number) => {
                    const maxDist = Math.max(...crossSectionResults.measurements.map((x: any) => x.distance));
                    const maxDepth = Math.max(...crossSectionResults.measurements.map((x: any) => x.depth));
                    const x = 50 + (m.distance / maxDist) * 400;
                    const y = 20 + (m.depth / maxDepth) * 160;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="4" fill="#E8841A" />
                        {i > 0 && (
                          <line 
                            x1={50 + (crossSectionResults.measurements[i-1].distance / maxDist) * 400} 
                            y1={20 + (crossSectionResults.measurements[i-1].depth / maxDepth) * 160}
                            x2={x} 
                            y2={y} 
                            stroke="#E8841A" 
                            strokeWidth="2"
                          />
                        )}
                      </g>
                    );
                  })}
                  <line x1="50" y1="180" x2="450" y2="180" stroke="#666" strokeWidth="2" />
                  <text x="50" y="195" fill="#666" fontSize="10">Bank</text>
                  <text x="400" y="195" fill="#666" fontSize="10">Bank</text>
                </svg>
              </div>

              <div className="grid grid-cols-3 gap-4 p-4 bg-[var(--bg-tertiary)] rounded">
                <div>
                  <span className="text-[var(--text-secondary)]">Cross Sectional Area</span>
                  <div className="font-mono text-xl">{formatNumber(crossSectionResults.area, 2)} m²</div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Wetted Perimeter</span>
                  <div className="font-mono text-xl">{formatNumber(crossSectionResults.wettedPerimeter, 2)} m</div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Hydraulic Radius</span>
                  <div className="font-mono text-xl">{formatNumber(crossSectionResults.hydraulicRadius, 2)} m</div>
                </div>
              </div>

              <p className="text-sm text-[var(--text-secondary)] mt-4">
                <strong>Formula:</strong> Q = A × V (Discharge = Area × Velocity)<br/>
                Enter velocity data to calculate discharge.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
