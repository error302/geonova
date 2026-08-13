'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader'
import SolutionStepsRenderer from '@/components/SolutionStepsRenderer'
import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'
import { gradeSolved } from '@/lib/engine/solution/wrappers/grade'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function GradeCalculator() {
  const { t } = useLanguage()
  const [elev1, setElev1] = useState('');
  const [elev2, setElev2] = useState('');
  const [distance, setDistance] = useState('');
  const [steps, setSteps] = useState<SolutionStep[] | null>(null);
  const [solutionTitle, setSolutionTitle] = useState<string | undefined>(undefined);

  const calculate = () => {
    const e1 = parseFloat(elev1);
    const e2 = parseFloat(elev2);
    const d = parseFloat(distance);
    if (isNaN(e1) || isNaN(e2) || isNaN(d) || d === 0) return;
    const s = gradeSolved({ elev1: e1, elev2: e2, horizontalDistance: d })
    setSteps(s.steps); setSolutionTitle(s.solution.title)
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title={t('tools.grade')}
        subtitle={t('tools.gradeDesc')}
        reference="Survey Regulations 1994 | RDM 1.1 (2025) | Survey Act Cap 299"
      />

      <div className="grid md:grid-cols-2 gap-8">
        <div className="card">
          <div className="card-header"><span className="label">Elevations &amp; Distance</span></div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="elevation-1-rl-m">Elevation 1 — RL (m)</label>
                <input id="elevation-1-rl-m" className="input" value={elev1} onChange={e => setElev1(e.target.value)} placeholder="100.000" />
              </div>
              <div>
                <label className="label" htmlFor="elevation-2-rl-m">Elevation 2 — RL (m)</label>
                <input id="elevation-2-rl-m" className="input" value={elev2} onChange={e => setElev2(e.target.value)} placeholder="105.500" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="horizontal-distance-m">Horizontal Distance (m)</label>
              <input id="horizontal-distance-m" className="input" value={distance} onChange={e => setDistance(e.target.value)} placeholder="50.000" />
            </div>
            <button onClick={calculate} className="btn btn-primary w-full">Calculate Gradient</button>
          </div>
        </div>

        {steps ? <SolutionStepsRenderer title={solutionTitle} steps={steps} /> : null}
      </div>
    </div>
  );
}
