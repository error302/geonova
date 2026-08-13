'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader'
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { heightOfObjectSolved } from '@/lib/engine/solution/wrappers/heightOfObject'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function HeightOfObjectCalculator() {
  const { t } = useLanguage()
  const [inputs, setInputs] = useState({
    distance: '',
    angleTop:  { d: '', m: '', s: '' },
    angleBase: { d: '', m: '', s: '' },
    hi: ''
  });
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const calculate = () => {
    const D = parseFloat(inputs.distance);
    const HI = parseFloat(inputs.hi) || 0;
    const degTop  = parseFloat(inputs.angleTop.d)  || 0
    const minTop  = parseFloat(inputs.angleTop.m)  || 0
    const secTop  = parseFloat(inputs.angleTop.s)  || 0
    const degBase = parseFloat(inputs.angleBase.d) || 0
    const minBase = parseFloat(inputs.angleBase.m) || 0
    const secBase = parseFloat(inputs.angleBase.s) || 0
    if (isNaN(D)) return;
    const s = heightOfObjectSolved({
      horizontalDistance: D,
      angleTop:  { degrees: degTop,  minutes: minTop,  seconds: secTop,  direction: 'N' },
      angleBase: { degrees: degBase, minutes: minBase, seconds: secBase, direction: 'N' },
      instrumentHeight: HI,
    })
    setSteps(s.steps); setSolutionTitle(s.solution.title)
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.heightOfObject')}
        subtitle={t('tools.heightOfObjectDesc')}
        reference="Survey Regulations 1994 | Survey Act Cap 299 | RDM 1.1 (2025)"
      />

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <div className="card-header"><span className="label">Measurements</span></div>
          <div className="card-body space-y-4">
            <div>
              <label className="label" htmlFor="horizontal-distance-to-base-m">Horizontal Distance to Base (m)</label>
              <input id="horizontal-distance-to-base-m" className="input" value={inputs.distance} onChange={e => setInputs({...inputs, distance: e.target.value})} placeholder="50.000" />
            </div>
            <div>
              <div className="label">Vertical Angle to Top (D° M&apos; S&quot;)</div>
              <div className="flex gap-2">
                <input className="input flex-1" value={inputs.angleTop.d} onChange={e => setInputs({...inputs, angleTop: {...inputs.angleTop, d: e.target.value}})} placeholder="30°" />
                <input className="input flex-1" value={inputs.angleTop.m} onChange={e => setInputs({...inputs, angleTop: {...inputs.angleTop, m: e.target.value}})} placeholder="15'" />
                <input className="input flex-1" value={inputs.angleTop.s} onChange={e => setInputs({...inputs, angleTop: {...inputs.angleTop, s: e.target.value}})} placeholder="00&quot;" />
              </div>
            </div>
            <div>
              <div className="label">Vertical Angle to Base (D° M&apos; S&quot;)</div>
              <div className="flex gap-2">
                <input className="input flex-1" value={inputs.angleBase.d} onChange={e => setInputs({...inputs, angleBase: {...inputs.angleBase, d: e.target.value}})} aria-label="Angle to base (deg)" placeholder="02°" />
                <input className="input flex-1" value={inputs.angleBase.m} onChange={e => setInputs({...inputs, angleBase: {...inputs.angleBase, m: e.target.value}})} aria-label="Angle to base (min)" placeholder="30'" />
                <input className="input flex-1" value={inputs.angleBase.s} onChange={e => setInputs({...inputs, angleBase: {...inputs.angleBase, s: e.target.value}})} aria-label="Angle to base (sec)" placeholder="00&quot;" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="height-of-instrument-above-ground-h-i-m">Height of Instrument above Ground, h.i. (m)</label>
              <input id="height-of-instrument-above-ground-h-i-m" className="input" value={inputs.hi} onChange={e => setInputs({...inputs, hi: e.target.value})} placeholder="1.500" />
            </div>
            <button onClick={calculate} className="btn btn-primary w-full">Calculate Height</button>
          </div>
        </div>

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );
}
