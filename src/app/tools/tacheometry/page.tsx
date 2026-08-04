'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { tacheometrySolved } from '@/lib/engine/solution/wrappers/tacheometry'
import { PageHeader } from '@/components/shared/PageHeader'
import { generatePDF, downloadCSV, toCSV } from '@/lib/export/helpers'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function TacheometryCalculator() {
  const { t } = useLanguage()
  const [inputs, setInputs] = useState({
    hi: '',           // instrument height above ground (h.i.)
    upper: '',        // upper staff reading
    middle: '',       // middle staff reading
    lower: '',        // lower staff reading
    vertDeg: '',      // vertical angle degrees
    vertMin: '',      // vertical angle minutes
    vertSec: '',      // vertical angle seconds
    k: '100',         // multiplying constant
    c: '0'            // additive constant
  });
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const calculate = () => {
    const HI = parseFloat(inputs.hi);
    const upper = parseFloat(inputs.upper);
    const middle = parseFloat(inputs.middle);
    const lower = parseFloat(inputs.lower);
    const K = parseFloat(inputs.k) || 100;
    const C = parseFloat(inputs.c) || 0;

    const deg = parseFloat(inputs.vertDeg) || 0
    const min = parseFloat(inputs.vertMin) || 0
    const sec = parseFloat(inputs.vertSec) || 0

    if (isNaN(HI) || isNaN(upper) || isNaN(middle) || isNaN(lower)) return;

    const s = tacheometrySolved({
      instrumentHeight: HI,
      upper,
      middle,
      lower,
      verticalAngle: { degrees: deg, minutes: min, seconds: sec, direction: 'N' },
      K,
      C,
    })
    setSteps(s.steps)
    setSolutionTitle(s.solution.title)
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.tacheometry')}
        subtitle={t('tools.tacheometryDesc')}
        reference="Survey Regulations 1994 | RDM 1.1 (2025) Section 5.6 | Survey Act Cap 299"
      />

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <div className="card-header"><span className="label">Tacheometry Data</span></div>
          <div className="card-body space-y-4">
            <div>
              {/* h.i. = height of instrument above ground (not HPC — different context) */}
              <label className="label" htmlFor="instrument-height-above-ground-h-i-m">Instrument Height above Ground, h.i. (m)</label>
              <input id="instrument-height-above-ground-h-i-m" className="input" value={inputs.hi} onChange={e => setInputs({...inputs, hi: e.target.value})} placeholder="1.500" />
            </div>
            <div>
              <div className="label">Staff Readings (m)</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label text-xs" htmlFor="upper">Upper</label>
                  <input id="upper" className="input" value={inputs.upper} onChange={e => setInputs({...inputs, upper: e.target.value})} placeholder="1.850" />
                </div>
                <div>
                  <label className="label text-xs" htmlFor="middle">Middle</label>
                  <input id="middle" className="input" value={inputs.middle} onChange={e => setInputs({...inputs, middle: e.target.value})} placeholder="1.500" />
                </div>
                <div>
                  <label className="label text-xs" htmlFor="lower">Lower</label>
                  <input id="lower" className="input" value={inputs.lower} onChange={e => setInputs({...inputs, lower: e.target.value})} placeholder="1.150" />
                </div>
              </div>
            </div>
            <div>
              <div className="label">Vertical Angle (D° M&apos; S&quot;)</div>
              <div className="flex gap-2">
                <input className="input flex-1" value={inputs.vertDeg} onChange={e => setInputs({...inputs, vertDeg: e.target.value})} placeholder="05°" />
                <input className="input flex-1" value={inputs.vertMin} onChange={e => setInputs({...inputs, vertMin: e.target.value})} placeholder="30'" />
                <input className="input flex-1" value={inputs.vertSec} onChange={e => setInputs({...inputs, vertSec: e.target.value})} placeholder="00&quot;" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="multiplying-constant-k">Multiplying Constant K</label>
                <input id="multiplying-constant-k" className="input" value={inputs.k} onChange={e => setInputs({...inputs, k: e.target.value})} placeholder="100" />
              </div>
              <div>
                <label className="label" htmlFor="additive-constant-c">Additive Constant C</label>
                <input id="additive-constant-c" className="input" value={inputs.c} onChange={e => setInputs({...inputs, c: e.target.value})} placeholder="0" />
              </div>
            </div>
            {calcError && <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">{calcError}</div>}
            <button onClick={calculate} className="btn btn-primary w-full">{t('toolUI.calculate')}</button>
            {steps && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    generatePDF(
                      { title: 'Tacheometric Computation Sheet', reference: 'Survey Regulations 1994 | RDM 1.1 (2025) Section 5.6' },
                      [
                        { title: 'Observations', rows: [
                          { label: 'Instrument Height (h.i.)', value: `${inputs.hi} m` },
                          { label: 'Upper Staff Reading', value: `${inputs.upper} m` },
                          { label: 'Middle Staff Reading', value: `${inputs.middle} m` },
                          { label: 'Lower Staff Reading', value: `${inputs.lower} m` },
                          { label: 'Vertical Angle', value: `${inputs.vertDeg}° ${inputs.vertMin}' ${inputs.vertSec}"` },
                          { label: 'K (multiplying constant)', value: inputs.k },
                          { label: 'C (additive constant)', value: inputs.c },
                        ]},
                        { title: 'Computation Steps', rows: steps.map((s: SolutionStep) => ({ label: s.label, value: s.result || s.computation || '—' })) },
                      ],
                    )
                  }}
                  className="btn btn-secondary flex-1 inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> {t('toolUI.exportPdf')}
                </button>
                <button
                  onClick={() => {
                    const csv = toCSV(
                      ['Parameter', 'Value'],
                      [
                        ['Instrument Height (m)', inputs.hi],
                        ['Upper Staff (m)', inputs.upper],
                        ['Middle Staff (m)', inputs.middle],
                        ['Lower Staff (m)', inputs.lower],
                        ['Vertical Angle', `${inputs.vertDeg}° ${inputs.vertMin}' ${inputs.vertSec}"`],
                        ['K', inputs.k],
                        ['C', inputs.c],
                        ...steps.map((s: SolutionStep) => [s.label, s.result || s.computation || '']),
                      ],
                    )
                    downloadCSV(csv, 'tacheometry-data')
                  }}
                  className="btn btn-secondary flex-1 inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> {t('toolUI.exportCsv')}
                </button>
              </div>
            )}
          </div>
        </div>

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );
}
