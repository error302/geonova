'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

const WorkingDiagramClient = dynamic(
  () => import('@/components/working-diagram/WorkingDiagramClient'),
  { ssr: false }
)

type StepStatus = 'locked' | 'pending' | 'in_progress' | 'complete';
type SurveyMode = 'boundary' | 'levelling' | 'topographic' | 'gnss';

interface WorkspaceStep {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  gated?: boolean;
  toolRoute?: string;
  count?: number;
}

interface MetarduProject {
  id: string;
  name: string;
  description?: string;
  survey_type: string;
  utm_zone: number;
  hemisphere: 'N' | 'S';
  country: string;
  datum?: string;
  client_name?: string;
  surveyor_name?: string;
  created_at: string;
  updated_at: string;
  status: 'draft' | 'in_progress' | 'complete' | 'archived';
  boundary_data?: Record<string, unknown>;
  levelling_data?: Record<string, unknown>;
}

const SURVEY_TYPE_LABELS: Record<string, string> = {
  subdivision: 'Subdivision',
  amalgamation: 'Amalgamation',
  resurvey: 'Boundary Resurvey',
  mutation: 'Mutation',
  gnss_control: 'GNSS Control Survey',
  differential: 'Differential Levelling',
  profile: 'Profile Levelling',
  cross_section: 'Cross-Section Levelling',
  benchmark_establishment: 'Benchmark Establishment',
  two_peg_test: 'Two Peg Test',
  topographic: 'Topographic Survey',
  mining: 'Mining Survey',
  hydrographic: 'Hydrographic Survey',
  drone_uav: 'Drone / UAV Survey',
};

function getSurveyMode(type: string): SurveyMode {
  const levelling = ['differential', 'profile', 'cross_section', 'benchmark_establishment', 'two_peg_test'];
  const boundary = ['subdivision', 'amalgamation', 'resurvey', 'mutation', 'gnss_control'];
  if (levelling.includes(type)) return 'levelling';
  if (boundary.includes(type)) return 'boundary';
  if (type === 'topographic') return 'topographic';
  return 'gnss';
}

function getWorkspaceSteps(project: MetarduProject, mode: SurveyMode): WorkspaceStep[] {
  if (mode === 'boundary') return getBoundarySteps(project);
  if (mode === 'levelling') return getLevellingSteps(project);
  return getGenericSteps();
}

function getBoundarySteps(project: MetarduProject): WorkspaceStep[] {
  const bd = project.boundary_data as Record<string, unknown> | undefined;
  const beacons = (bd?.beacons as unknown[]) ?? [];
  const lots = (bd?.lots as unknown[]) ?? [];
  const lotCount = lots.length || 1;

  const steps: WorkspaceStep[] = [
    { id: 'setup', label: 'Project Setup', description: 'Client details, datum, LR reference', status: 'complete' },
    { id: 'beacons', label: 'Beacon & Boundary Data', description: 'Enter all beacons once — all outputs auto-populate', status: beacons.length > 0 ? 'complete' : 'in_progress' },
    { id: 'working_diagram', label: 'Working Diagram', description: 'Traverse plan auto-populated from beacon data', status: (bd?.working_diagram_status as StepStatus) ?? 'pending', gated: true },
  ];

  if (['subdivision', 'amalgamation'].includes(project.survey_type)) {
    steps.push({ id: 'deed_plans', label: lotCount > 1 ? `Deed Plans (${lotCount} lots)` : 'Deed Plan', description: 'Auto-populated from beacon data', status: 'pending', count: lotCount, gated: true });
  }

  if (project.survey_type === 'resurvey') {
    steps.push({ id: 'reinstatement', label: 'Beacon Reinstatement Record', description: 'Reinstatement details and beacon condition notes', status: 'pending', gated: true });
  }

  steps.push({ id: 'rdm', label: 'RDM Report', description: 'Auto-populated beacon list + area tables', status: 'pending', gated: true });
  steps.push({ id: 'export', label: 'Export Package', description: 'PDF, DXF, GeoJSON — unlocks when all outputs done', status: 'locked', gated: true });
  steps.push({ id: 'submission', label: 'Submission Package', description: 'Assemble benchmark-compliant handoff package', status: 'locked', gated: true });

  return steps;
}

function getLevellingSteps(project: MetarduProject): WorkspaceStep[] {
  if (project.survey_type === 'two_peg_test') {
    return [
      { id: 'setup', label: 'Project Setup', description: 'Instrument details, location', status: 'complete' },
      { id: 'two_peg', label: 'Two Peg Observations', description: 'Staff readings at two positions', status: 'in_progress', toolRoute: '/tools/leveling' },
      { id: 'collimation', label: 'Collimation Error Report', description: 'Calculated e value and pass/fail', status: 'pending', gated: true },
      { id: 'export', label: 'Export Report', description: 'PDF calibration certificate', status: 'locked', gated: true },
    ];
  }

  const ld = project.levelling_data as Record<string, unknown> | undefined;
  const steps: WorkspaceStep[] = [
    { id: 'setup', label: 'Project Setup', description: 'BM references, line description', status: 'complete' },
    { id: 'line_setup', label: 'Level Line Setup', description: 'Start BM RL, End BM RL, distance K (km)', status: ld?.start_rl !== undefined ? 'complete' : 'in_progress' },
    { id: 'field_book', label: 'Field Book Entry', description: 'BS / IS / FS per station', status: (ld?.field_book_status as StepStatus) ?? 'pending', toolRoute: '/tools/leveling', gated: true },
    { id: 'computation', label: ld?.computation_method === 'rise_fall' ? 'Rise & Fall Computation' : 'HPC Computation', description: 'Reduced levels + arithmetic check', status: (ld?.computation_status as StepStatus) ?? 'pending', gated: true },
    { id: 'closure', label: 'Closure Check', description: `Allowed: 12√K mm${ld?.closure_passed === true ? ' — ✓ PASSED' : ld?.closure_passed === false ? ' — ✗ FAILED' : ''}`, status: ld?.closure_passed !== undefined ? (ld.closure_passed ? 'complete' : 'in_progress') : 'pending', gated: true },
    { id: 'adjustment', label: 'Bowditch Adjustment', description: 'Distribute misclosure across stations', status: 'pending', gated: true },
  ];

  if (['profile', 'cross_section'].includes(project.survey_type)) {
    steps.push({ id: 'profile', label: project.survey_type === 'profile' ? 'Longitudinal Section' : 'Cross-Section Drawings', description: 'Chainage vs RL plot', status: 'pending', gated: true });
  }

  steps.push({ id: 'level_report', label: 'Level Report', description: 'Adjusted RLs + BM references', status: (ld?.level_report_status as StepStatus) ?? 'pending', gated: true });
  steps.push({ id: 'export', label: 'Export Package', description: 'PDF report + CSV table', status: 'locked', gated: true });

  return steps;
}

function getGenericSteps(): WorkspaceStep[] {
  return [
    { id: 'setup', label: 'Project Setup', description: 'Project metadata', status: 'complete' },
    { id: 'data', label: 'Field Data', description: 'Import or enter field observations', status: 'in_progress' },
    { id: 'processing', label: 'Processing', description: 'Run computations', status: 'pending', gated: true },
    { id: 'report', label: 'Report', description: 'Generate output documents', status: 'pending', gated: true },
    { id: 'export', label: 'Export Package', description: 'All outputs bundled', status: 'locked', gated: true },
  ];
}

const STATUS_STYLES: Record<StepStatus, string> = {
  complete: 'bg-[#f59e0b] text-black',
  in_progress: 'bg-blue-500 text-white',
  pending: 'bg-zinc-700 text-zinc-300',
  locked: 'bg-zinc-800 text-zinc-600',
};

const STATUS_LABELS: Record<StepStatus, string> = {
  complete: 'Complete',
  in_progress: 'In Progress',
  pending: 'Pending',
  locked: 'Locked',
};

const MODE_COLOURS: Record<SurveyMode, string> = {
  boundary: 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30',
  levelling: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  topographic: 'bg-green-500/20 text-green-400 border border-green-500/30',
  gnss: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
};

const MODE_LABELS: Record<SurveyMode, string> = {
  boundary: 'Boundary Mode',
  levelling: 'Levelling Mode',
  topographic: 'Topographic Mode',
  gnss: 'GNSS Mode',
};

function BeaconDataPanel({ project, beacons, setBeacons, boundaries, saving, onSave }: { 
  project: MetarduProject; 
  beacons: Array<{id: string; name: string; type: string; easting: number; northing: number; description: string}>;
  setBeacons: React.Dispatch<React.SetStateAction<Array<{id: string; name: string; type: string; easting: number; northing: number; description: string}>>>;
  boundaries: Array<{from: string; to: string; bearing: number; distance: number}>;
  saving: boolean;
  onSave: () => void;
}) {
  const [newBeacon, setNewBeacon] = useState({ name: '', type: 'new', easting: 0, northing: 0, description: '' });

  const addBeacon = () => {
    const id = `B${beacons.length + 1}`;
    setBeacons([...beacons, { ...newBeacon, id }]);
    setNewBeacon({ name: '', type: 'new', easting: 0, northing: 0, description: '' });
  };

  const removeBeacon = (id: string) => {
    setBeacons(beacons.filter(b => b.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Beacon & Boundary Data</h3>
        <p className="text-zinc-400 text-sm">Enter your beacons once here. They will auto-populate the Working Diagram, Deed Plan(s), RDM Report, and all export tables.</p>
      </div>
      
      {/* Beacon list */}
      <div className="rounded-lg border border-zinc-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
          <span className="text-sm font-medium text-white">Beacons ({beacons.length})</span>
          <button onClick={onSave} disabled={saving} className="text-xs px-3 py-1.5 rounded bg-[#f59e0b] text-black font-semibold hover:bg-[#f59e0b]/90 transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        {beacons.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-sm py-10">
            <div className="text-2xl mb-2">📍</div>
            No beacons added yet. Add your first beacon below.
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800 text-zinc-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Easting</th>
                  <th className="px-3 py-2 text-right">Northing</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {beacons.map(b => (
                  <tr key={b.id} className="border-t border-zinc-800">
                    <td className="px-3 py-2 text-white font-medium">{b.id}</td>
                    <td className="px-3 py-2 text-zinc-400">{b.type}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{b.easting.toFixed(3)}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{b.northing.toFixed(3)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeBeacon(b.id)} className="text-red-400 text-xs hover:underline">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add beacon form */}
      <div className="rounded-lg border border-zinc-700 p-4">
        <h4 className="text-sm font-medium text-white mb-3">Add New Beacon</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <input type="text" placeholder="Name (e.g. B1)" value={newBeacon.name} onChange={e => setNewBeacon({...newBeacon, name: e.target.value})} className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white" />
          <select value={newBeacon.type} onChange={e => setNewBeacon({...newBeacon, type: e.target.value})} className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white">
            <option value="new">New</option>
            <option value="old">Old</option>
            <option value="reference">Reference</option>
          </select>
          <input type="number" placeholder="Easting" value={newBeacon.easting || ''} onChange={e => setNewBeacon({...newBeacon, easting: parseFloat(e.target.value) || 0})} className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white" />
          <input type="number" placeholder="Northing" value={newBeacon.northing || ''} onChange={e => setNewBeacon({...newBeacon, northing: parseFloat(e.target.value) || 0})} className="px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-white" />
          <button onClick={addBeacon} className="px-3 py-1.5 bg-[#f59e0b] text-black rounded text-sm font-medium hover:bg-[#f59e0b]/90">Add</button>
        </div>
      </div>

      {/* Boundaries */}
      <div className="rounded-lg border border-zinc-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
          <span className="text-sm font-medium text-white">Boundary Lines ({boundaries.length})</span>
        </div>
        {boundaries.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-sm py-8">Add at least 3 beacons to define boundaries.</div>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800 text-zinc-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">From</th>
                  <th className="px-3 py-2 text-left">To</th>
                  <th className="px-3 py-2 text-right">Bearing</th>
                  <th className="px-3 py-2 text-right">Distance</th>
                </tr>
              </thead>
              <tbody>
                {boundaries.map((b, i) => (
                  <tr key={i} className="border-t border-zinc-800">
                    <td className="px-3 py-2 text-white">{b.from}</td>
                    <td className="px-3 py-2 text-white">{b.to}</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{b.bearing.toFixed(4)}°</td>
                    <td className="px-3 py-2 text-right text-zinc-300">{b.distance.toFixed(3)}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldBookPanel({ 
  project,
  stations,
  setStations,
  levelLine,
  setLevelLine,
  saving,
  onSave
}: { 
  project: MetarduProject;
  stations: Array<{id: string; stationId: string; backSight?: number; intermediateSight?: number; foreSight?: number; reducedLevel?: number; remarks?: string}>;
  setStations: React.Dispatch<React.SetStateAction<Array<{id: string; stationId: string; backSight?: number; intermediateSight?: number; foreSight?: number; reducedLevel?: number; remarks?: string}>>>;
  levelLine: {startBMRef: string; startRL: number; endBMRef?: string; endRL?: number; totalDistance: number};
  setLevelLine: React.Dispatch<React.SetStateAction<{startBMRef: string; startRL: number; endBMRef?: string; endRL?: number; totalDistance: number}>>;
  saving: boolean;
  onSave: () => void;
}) {
  const method = (project.levelling_data as Record<string, unknown>)?.computation_method ?? 'hpc';
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Field Book Entry</h3>
        <p className="text-zinc-400 text-sm">Enter BS / IS / FS readings. Reduced Levels are computed automatically using the {method === 'rise_fall' ? 'Rise & Fall' : 'Height of Plane of Collimation'} method.</p>
      </div>
      <div className="flex gap-3 mb-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="method" defaultChecked={method === 'hpc'} className="accent-[#f59e0b]" />
          <span className="text-sm text-zinc-300">HPC Method</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="method" defaultChecked={method === 'rise_fall'} className="accent-[#f59e0b]" />
          <span className="text-sm text-zinc-300">Rise & fall</span>
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-800 text-zinc-400 text-xs uppercase tracking-wide">
              <th className="px-3 py-2 text-left">Station</th>
              <th className="px-3 py-2 text-right">BS</th>
              <th className="px-3 py-2 text-right">IS</th>
              <th className="px-3 py-2 text-right">FS</th>
              <th className="px-3 py-2 text-right">RL</th>
              <th className="px-3 py-2 text-left">Remarks</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-zinc-800">
              <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">No readings yet. Add your first station below.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex gap-3">
        <button className="flex-1 py-2.5 rounded-lg bg-[#f59e0b] text-black text-sm font-semibold hover:bg-[#f59e0b]/90 transition-colors">+ Add Station Reading</button>
        <Link href="/tools/leveling" className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-zinc-300 text-sm text-center hover:bg-zinc-800 transition-colors">Open Levelling Tool ↗</Link>
      </div>
    </div>
  );
}

function LevelLineSetupPanel({ 
  project,
  levelLine,
  setLevelLine,
  saving,
  onSave
}: { 
  project: MetarduProject;
  levelLine: {startBMRef: string; startRL: number; endBMRef?: string; endRL?: number; totalDistance: number};
  setLevelLine: React.Dispatch<React.SetStateAction<{startBMRef: string; startRL: number; endBMRef?: string; endRL?: number; totalDistance: number}>>;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Level Line Setup</h3>
        <p className="text-zinc-400 text-sm">Define your starting and closing benchmarks. The total distance K (km) determines the allowable misclosure: 12√K mm.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Start Benchmark Reference', placeholder: 'e.g. TBM 14A' },
          { label: 'Start RL (m)', placeholder: 'e.g. 1243.571' },
          { label: 'End Benchmark Reference', placeholder: 'e.g. TBM 22B (or same as start)' },
          { label: 'End RL (m)', placeholder: 'Leave blank if loop traverse' },
          { label: 'Total Distance K (km)', placeholder: 'e.g. 2.4' },
        ].map(f => (
          <div key={f.label}>
            <label className="block text-xs text-zinc-400 mb-1">{f.label}</label>
            <input type="text" placeholder={f.placeholder} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-[#f59e0b] focus:outline-none transition-colors" />
          </div>
        ))}
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Allowable Misclosure (auto)</label>
          <div className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-500">— mm (fill K first)</div>
        </div>
      </div>
      <button className="w-full py-2.5 rounded-lg bg-[#f59e0b] text-black text-sm font-semibold hover:bg-[#f59e0b]/90 transition-colors">Save Level Line Setup</button>
    </div>
  );
}

function ExportPanel({ project, steps }: { project: MetarduProject; steps: WorkspaceStep[] }) {
  const allDone = steps.filter(s => s.id !== 'export').every(s => s.status === 'complete');
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Export Package</h3>
        <p className="text-zinc-400 text-sm">{allDone ? 'All outputs are complete. Choose your export formats below.' : 'Complete all required outputs to unlock the export package.'}</p>
      </div>
      {!allDone && (
        <div className="rounded-lg border border-zinc-700 p-4 space-y-2">
          {steps.filter(s => s.id !== 'export' && s.status !== 'complete').map(s => (
            <div key={s.id} className="flex items-center gap-2 text-sm text-zinc-400"><span className="text-zinc-600">○</span> {s.label}</div>
          ))}
        </div>
      )}
      <div className={`grid grid-cols-2 gap-3 ${!allDone ? 'opacity-40 pointer-events-none' : ''}`}>
        {['PDF Report', 'DXF Export', 'GeoJSON', 'CSV Tables'].map(fmt => (
          <button key={fmt} className="py-3 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors">↓ {fmt}</button>
        ))}
      </div>
    </div>
  );
}

function WorkingDiagramPanel({ project, beacons, boundaries }: {
  project: MetarduProject;
  beacons: Array<{id: string; name: string; type: string; easting: number; northing: number; description: string}>;
  boundaries: Array<{from: string; to: string; bearing: number; distance: number}>;
}) {
  if (beacons.length < 3) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Working Diagram</h3>
          <p className="text-zinc-400 text-sm">Add at least 3 beacons in the Beacon & Boundary Data step to generate the working diagram.</p>
        </div>
        <div className="rounded-lg border border-zinc-800 p-8 text-center text-zinc-600 text-sm">
          No beacon data yet
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Working Diagram</h3>
        <p className="text-zinc-400 text-sm">Auto-populated from beacon data. Use the toolbar to add annotations, then export as PDF.</p>
      </div>
      <WorkingDiagramClient />
    </div>
  );
}

function GenericStepPanel({ step }: { step: WorkspaceStep }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{step.label}</h3>
        <p className="text-zinc-400 text-sm">{step.description}</p>
      </div>
      {step.toolRoute && (
        <Link href={step.toolRoute} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#f59e0b] text-black text-sm font-semibold hover:bg-[#f59e0b]/90 transition-colors">Open Tool ↗</Link>
      )}
      {step.status === 'locked' && (
        <div className="rounded-lg border border-zinc-800 p-4 text-zinc-600 text-sm"> Complete the previous steps to unlock this section.</div>
      )}
    </div>
  );
}

function renderStepContent(
  step: WorkspaceStep | undefined, 
  project: MetarduProject, 
  steps: WorkspaceStep[],
  beacons: Array<{id: string; name: string; type: string; easting: number; northing: number; description: string}>,
  setBeacons: React.Dispatch<React.SetStateAction<Array<{id: string; name: string; type: string; easting: number; northing: number; description: string}>>>,
  boundaries: Array<{from: string; to: string; bearing: number; distance: number}>,
  saving: boolean,
  onSave: () => void,
  stations: Array<{id: string; stationId: string; backSight?: number; intermediateSight?: number; foreSight?: number; reducedLevel?: number; remarks?: string}>,
  setStations: React.Dispatch<React.SetStateAction<Array<{id: string; stationId: string; backSight?: number; intermediateSight?: number; foreSight?: number; reducedLevel?: number; remarks?: string}>>>,
  levelLine: {startBMRef: string; startRL: number; endBMRef?: string; endRL?: number; totalDistance: number},
  setLevelLine: React.Dispatch<React.SetStateAction<{startBMRef: string; startRL: number; endBMRef?: string; endRL?: number; totalDistance: number}>>
) {
  if (!step) return null;
  switch (step.id) {
    case 'beacons': return <BeaconDataPanel project={project} beacons={beacons} setBeacons={setBeacons} boundaries={boundaries} saving={saving} onSave={onSave} />;
    case 'field_book': return <FieldBookPanel project={project} stations={stations} setStations={setStations} levelLine={levelLine} setLevelLine={setLevelLine} saving={saving} onSave={onSave} />;
    case 'line_setup': return <LevelLineSetupPanel project={project} levelLine={levelLine} setLevelLine={setLevelLine} saving={saving} onSave={onSave} />;
    case 'working_diagram': return <WorkingDiagramPanel project={project} beacons={beacons} boundaries={boundaries} />;
    case 'export': return <ExportPanel project={project} steps={steps} />;
    default: return <GenericStepPanel step={step} />;
  }
}

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [project, setProject] = useState<MetarduProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Beacon/boundary state
  const [beacons, setBeacons] = useState<Array<{id: string; name: string; type: string; easting: number; northing: number; description: string}>>([]);
  const [boundaries, setBoundaries] = useState<Array<{from: string; to: string; bearing: number; distance: number}>>([]);

  // Levelling state
  const [stations, setStations] = useState<Array<{id: string; stationId: string; backSight?: number; intermediateSight?: number; foreSight?: number; reducedLevel?: number; remarks?: string}>>([]);
  const [levelLine, setLevelLine] = useState<{startBMRef: string; startRL: number; endBMRef?: string; endRL?: number; totalDistance: number}>({startBMRef: '', startRL: 0, totalDistance: 0});

  const fetchProject = useCallback(async () => {
    setLoading(true);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        const next = encodeURIComponent(window.location.pathname);
        window.location.href = '/login?next=' + next;
        return;
      }

      const { data, error: err } = await supabase.from('projects').select('*').eq('id', params.id).single();
      if (err || !data) {
        setError(err?.message ?? 'Project not found');
      } else {
        setProject(data as MetarduProject);
        
        // Load boundary data
        const bd = (data.boundary_data as any) || {};
        setBeacons(bd.beacons || []);
        setBoundaries(bd.boundaries || []);
        
        // Load levelling data
        const ld = (data.levelling_data as any) || {};
        setStations(ld.stations || []);
        setLevelLine(ld.level_line || {startBMRef: '', startRL: 0, totalDistance: 0});
        
        const mode = getSurveyMode(data.survey_type);
        const steps = getWorkspaceSteps(data as MetarduProject, mode);
        const firstActive = steps.find(s => s.status === 'in_progress') ?? steps.find(s => s.status === 'pending') ?? steps[0];
        setActiveStep(firstActive?.id ?? steps[0]?.id ?? '');
      }
    } catch (err) {
      console.warn('Project auth or load check failed:', err);
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = '/login?next=' + next;
      return;
    }
    setLoading(false);
  }, [params.id, supabase]);

  // Save beacons to Supabase
  const saveBeacons = async () => {
    if (!project) return;
    setSaving(true);
    
    // Auto-compute boundaries from consecutive beacons
    const computedBoundaries = [];
    for (let i = 0; i < beacons.length; i++) {
      const from = beacons[i];
      const to = beacons[(i + 1) % beacons.length]; // wrap around for closed traverse
      if (from && to) {
        const dx = to.easting - from.easting;
        const dy = to.northing - from.northing;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let bearing = Math.atan2(dx, dy) * (180 / Math.PI);
        if (bearing < 0) bearing += 360;
        computedBoundaries.push({ from: from.id, to: to.id, bearing, distance });
      }
    }
    
    const boundaryData = {
      beacons,
      boundaries: computedBoundaries,
      lots: [],
      total_area: null,
      working_diagram_status: 'pending',
      rdm_report_status: 'pending'
    };
    
    await supabase.from('projects').update({ boundary_data: boundaryData }).eq('id', project.id);
    setBoundaries(computedBoundaries);
    setSaving(false);
  };

  // Save levelling to Supabase
  const saveLevelling = async () => {
    if (!project) return;
    setSaving(true);
    
    const levellingData = {
      level_line: levelLine,
      stations,
      computation_method: 'hpc',
      misclosure_allowed: levelLine.totalDistance > 0 ? 12 * Math.sqrt(levelLine.totalDistance) : null,
      field_book_status: 'complete',
      computation_status: 'pending',
      level_report_status: 'pending'
    };
    
    await supabase.from('projects').update({ levelling_data: levellingData }).eq('id', project.id);
    setSaving(false);
  };

  useEffect(() => { fetchProject(); }, [fetchProject]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500 text-sm animate-pulse">Loading project…</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-sm">{error ?? 'Project not found'}</div>
        <button onClick={() => router.push('/dashboard')} className="text-[#f59e0b] text-sm underline">Back to Dashboard</button>
      </div>
    );
  }

  const mode = getSurveyMode(project.survey_type);
  const steps = getWorkspaceSteps(project, mode);
  const currentStep = steps.find(s => s.id === activeStep) ?? steps[0];
  const completedCount = steps.filter(s => s.status === 'complete').length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">← Projects</button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-semibold text-white truncate">{project.name}</h1>
              <span className="text-zinc-600">·</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODE_COLOURS[mode]}`}>{MODE_LABELS[mode]}</span>
              <span className="text-xs text-zinc-500">{SURVEY_TYPE_LABELS[project.survey_type] ?? project.survey_type}</span>
            </div>
            <div className="text-xs text-zinc-600 mt-0.5">UTM Zone {project.utm_zone}{project.hemisphere} · {project.country}{project.client_name && ` · ${project.client_name}`}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block w-24 h-1.5 rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-[#f59e0b] transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-xs text-zinc-400">{progressPct}%</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row">
        <nav className="w-full lg:w-64 xl:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800">
          <div className="p-4 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-1">Workflow</div>
            <ol className="space-y-1">
              {steps.map((step, idx) => {
                const isActive = step.id === activeStep;
                const isLocked = step.status === 'locked';
                return (
                  <li key={step.id}>
                    <button disabled={isLocked} onClick={() => setActiveStep(step.id)} className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-start gap-3 ${isActive ? 'bg-zinc-800 border border-zinc-700' : isLocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-zinc-900 border border-transparent'}`}>
                      <span className={`shrink-0 w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold mt-0.5 ${STATUS_STYLES[step.status]}`}>{step.status === 'complete' ? '✓' : step.status === 'locked' ? '🔒' : idx + 1}</span>
                      <div className="min-w-0">
                        <div className={`text-sm font-medium leading-tight ${isLocked ? 'text-zinc-600' : isActive ? 'text-white' : 'text-zinc-300'}`}>{step.label}{step.count && step.count > 1 && <span className="ml-1 text-xs text-zinc-500">({step.count})</span>}</div>
                        <div className="text-xs text-zinc-600 mt-0.5 leading-tight truncate">{step.description}</div>
                      </div>
                      {!isLocked && !isActive && <span className={`shrink-0 ml-auto text-xs px-1.5 py-0.5 rounded self-start ${step.status === 'complete' ? 'text-[#f59e0b]' : step.status === 'in_progress' ? 'text-blue-400' : 'text-zinc-600'}`}>{step.status === 'complete' ? 'Done' : step.status === 'in_progress' ? 'Active' : ''}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mt-6 pt-4 border-t border-zinc-800">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2 px-1">Standalone Tools</div>
              <Link href="/tools" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"><span>🔧</span> All Tools</Link>
            </div>
          </div>
        </nav>

        <main className="flex-1 min-w-0 p-4 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full text-sm flex items-center justify-center font-semibold ${STATUS_STYLES[currentStep?.status ?? 'pending']}`}>{currentStep?.status === 'complete' ? '✓' : steps.findIndex(s => s.id === activeStep) + 1}</span>
              <div>
                <h2 className="text-base font-semibold text-white">{currentStep?.label}</h2>
                <div className="text-xs text-zinc-500">{STATUS_LABELS[currentStep?.status ?? 'pending']}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentStep?.toolRoute && <Link href={`${currentStep.toolRoute}?project=${project.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors">Open in Tool ↗</Link>}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">{renderStepContent(currentStep, project, steps, beacons, setBeacons, boundaries, saving, () => saveBeacons(), stations, setStations, levelLine, setLevelLine)}</div>
          <div className="flex items-center justify-between mt-4">
            <button onClick={() => { const idx = steps.findIndex(s => s.id === activeStep); if (idx > 0) setActiveStep(steps[idx - 1].id); }} disabled={steps.findIndex(s => s.id === activeStep) === 0} className="text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors">← Previous</button>
            <span className="text-xs text-zinc-700">Step {steps.findIndex(s => s.id === activeStep) + 1} of {steps.length}</span>
            <button onClick={() => { const idx = steps.findIndex(s => s.id === activeStep); if (idx < steps.length - 1 && steps[idx + 1].status !== 'locked') setActiveStep(steps[idx + 1].id); }} disabled={steps.findIndex(s => s.id === activeStep) === steps.length - 1 || steps[steps.findIndex(s => s.id === activeStep) + 1]?.status === 'locked'} className="text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors">Next →</button>
          </div>
        </main>
      </div>
    </div>
  );
}
