'use client';

import { useState } from 'react';

interface Observation {
  fromStationId: string;
  toStationId: string;
  rawSlopeDistance: number;
  rawHorizontalAngle?: number;
  rawVerticalAngle?: number;
  edmConstant?: number;
  temperature?: number;
  pressure?: number;
  humidity?: number;
  instrumentHeight?: number;
  targetHeight?: number;
}

export default function ObservationsPage() {
  const { id } = { id: 'demo' }; // useParams would go here
  const [observations, setObservations] = useState<Observation[]>([
    { fromStationId: 'A', toStationId: 'B', rawSlopeDistance: 0, rawVerticalAngle: 90 },
  ]);
  const [syncing, setSyncing] = useState(false);

  const addObservation = () => {
    setObservations([...observations, {
      fromStationId: '',
      toStationId: '',
      rawSlopeDistance: 0,
      rawVerticalAngle: 90,
    }]);
  };

  const removeObservation = (index: number) => {
    setObservations(observations.filter((_, i) => i !== index));
  };

  const updateObs = (index: number, field: keyof Observation, value: Observation[keyof Observation]) => {
    const updated = [...observations];
    updated[index] = { ...updated[index], [field]: value };
    setObservations(updated);
  };

  const syncToServer = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: id,
          observations: observations,
          surveyorId: 'demo',
          surveyorName: 'Demo Surveyor',
        }),
      });
      const data = await res.json();
      alert(`Synced ${data.count} observations`);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Observations</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Enter field observations with atmospheric conditions for correction pipeline
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={addObservation}>+ Add Observation</button>
          <button className="btn-primary" onClick={syncToServer} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync to Server'}
          </button>
        </div>
      </div>

      {/* Observation entries */}
      {observations.map((obs, i) => (
        <div key={`${obs}-${i}`} className="card" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
              Observation {i + 1}
            </h3>
            {observations.length > 1 && (
              <button className="btn-secondary" style={{ fontSize: '12px', padding: '2px 8px' }} onClick={() => removeObservation(i)}>
                Remove
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
            <div>
              <label htmlFor={`obs-${i}-from`} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>From Station</label>
              <input id={`obs-${i}-from`} className="input-field" value={obs.fromStationId} onChange={e => updateObs(i, 'fromStationId', e.target.value)} placeholder="A" />
            </div>
            <div>
              <label htmlFor={`obs-${i}-to`} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>To Station</label>
              <input id={`obs-${i}-to`} className="input-field" value={obs.toStationId} onChange={e => updateObs(i, 'toStationId', e.target.value)} placeholder="B" />
            </div>
            <div>
              <label htmlFor={`obs-${i}-slope`} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Slope Distance (m)</label>
              <input id={`obs-${i}-slope`} className="input-field" type="number" step="0.001" value={obs.rawSlopeDistance} onChange={e => updateObs(i, 'rawSlopeDistance', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label htmlFor={`obs-${i}-vert`} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Vertical Angle (deg)</label>
              <input id={`obs-${i}-vert`} className="input-field" type="number" step="0.0001" value={obs.rawVerticalAngle} onChange={e => updateObs(i, 'rawVerticalAngle', parseFloat(e.target.value))} />
            </div>
            <div>
              <label htmlFor={`obs-${i}-temp`} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Temp (C)</label>
              <input id={`obs-${i}-temp`} className="input-field" type="number" value={obs.temperature ?? ''} onChange={e => updateObs(i, 'temperature', parseFloat(e.target.value))} placeholder="22" />
            </div>
            <div>
              <label htmlFor={`obs-${i}-press`} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Pressure (hPa)</label>
              <input id={`obs-${i}-press`} className="input-field" type="number" value={obs.pressure ?? ''} onChange={e => updateObs(i, 'pressure', parseFloat(e.target.value))} placeholder="840" />
            </div>
            <div>
              <label htmlFor={`obs-${i}-hum`} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Humidity (%)</label>
              <input id={`obs-${i}-hum`} className="input-field" type="number" value={obs.humidity ?? ''} onChange={e => updateObs(i, 'humidity', parseFloat(e.target.value))} placeholder="60" />
            </div>
            <div>
              <label htmlFor={`obs-${i}-inst`} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Inst. Height (m)</label>
              <input id={`obs-${i}-inst`} className="input-field" type="number" step="0.01" value={obs.instrumentHeight ?? ''} onChange={e => updateObs(i, 'instrumentHeight', parseFloat(e.target.value))} placeholder="1.55" />
            </div>
            <div>
              <label htmlFor={`obs-${i}-target`} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Target Height (m)</label>
              <input id={`obs-${i}-target`} className="input-field" type="number" step="0.01" value={obs.targetHeight ?? ''} onChange={e => updateObs(i, 'targetHeight', parseFloat(e.target.value))} placeholder="1.60" />
            </div>
          </div>
        </div>
      ))}

      {/* Info card */}
      <div className="card" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
        <strong style={{ color: 'var(--accent)' }}>Tip:</strong> Temperature and pressure are critical for atmospheric correction.
        At Nairobi altitude (~840 hPa), missing these values introduces ~50 ppm error per measurement.
        Enter them for every observation to achieve 2nd-order accuracy.
      </div>
    </div>
  );
}
