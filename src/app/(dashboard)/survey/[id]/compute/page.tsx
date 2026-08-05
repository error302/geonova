'use client';

import { useState } from 'react';

export default function ComputePage() {
  const [method, setMethod] = useState<'bowditch' | 'least_squares'>('bowditch');
  const [order, setOrder] = useState(3);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runComputation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/survey/traverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observations: [
            {
              fromStation: 'A', toStation: 'B',
              rawSlopeDistance: 150.25, verticalAngle: 90.0,
              temperature: 22, pressure: 840, humidity: 60,
              edmConstant: 0.003, instrumentHeight: 1.55, targetHeight: 1.60,
              heightAboveEllipsoid: 1700,
              fromEasting: 250000, fromNorthing: 9850000,
              toEasting: 250150, toNorthing: 9850000,
              latitude: -1.0, longitude: 37.5,
            },
            {
              fromStation: 'B', toStation: 'C',
              rawSlopeDistance: 200.50, verticalAngle: 90.0,
              temperature: 22, pressure: 840, humidity: 60,
              edmConstant: 0.003, instrumentHeight: 1.55, targetHeight: 1.60,
              heightAboveEllipsoid: 1700,
              fromEasting: 250150, fromNorthing: 9850000,
              toEasting: 250150, toNorthing: 9850200,
              latitude: -1.0, longitude: 37.5,
            },
          ],
          stations: [
            { name: 'A', easting: 250000, northing: 9850000, isFixed: true },
            { name: 'B', isFixed: false },
            { name: 'C', isFixed: false },
          ],
          method,
          order,
        }),
      });
      setResult(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>Traverse Computation</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Run traverse adjustment with all P0 corrections applied automatically
      </p>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }} htmlFor="adjustment-method">Adjustment Method</label>
          <select id="adjustment-method" className="input-field" value={method} onChange={e => setMethod(e.target.value as any)} style={{ width: '200px' }}>
            <option value="bowditch">Bowditch (3rd/4th Order)</option>
            <option value="least_squares">Least Squares (1st/2nd Order)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }} htmlFor="accuracy-order">Accuracy Order</label>
          <select  id="accuracy-order" className="input-field" value={order} onChange={e => setOrder(parseInt(e.target.value))} style={{ width: '200px' }}>
            <option value={1}>1st Order (1:100,000)</option>
            <option value={2}>2nd Order (1:20,000)</option>
            <option value={3}>3rd Order (1:10,000)</option>
            <option value={4}>4th Order (1:5,000)</option>
          </select>
        </div>
        <button className="btn-primary" onClick={runComputation} disabled={loading} style={{ marginTop: '18px' }}>
          {loading ? 'Computing...' : 'Run Adjustment'}
        </button>
      </div>

      {result && (
        <div style={{ display: 'grid', gap: '16px' }}>
          {/* Misclosure */}
          {result.adjustmentResult?.misclosure && (
            <div className="card">
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--accent)' }}>Misclosure Analysis</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>dE</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{result.adjustmentResult.misclosure.easting?.toFixed(4)}</div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>dN</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{result.adjustmentResult.misclosure.northing?.toFixed(4)}</div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Linear</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{result.adjustmentResult.misclosure.linear?.toFixed(4)}</div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ratio</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent)' }}>{result.adjustmentResult.misclosure.ratio}</div>
                </div>
              </div>
            </div>
          )}

          {/* Corrections Applied */}
          {result.correctionsApplied && (
            <div className="card">
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--accent)' }}>Corrections Applied</h2>
              <div style={{ fontSize: '13px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted)' }}>Leg</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>Raw Dist</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>Grid Dist</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>Atm PPM</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>SL PPM</th>
                      <th style={{ padding: '8px', textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>Scale F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.correctionsApplied.map((c: any, i: number) => (
                      <tr key={`item-${i}`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px' }}>{c.from} → {c.to}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{c.rawDistance?.toFixed(4)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--accent)' }}>{c.gridDistance?.toFixed(4)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{c.atmosphericPPM?.toFixed(1)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{c.seaLevelPPM?.toFixed(1)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{c.lineScaleFactor?.toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
