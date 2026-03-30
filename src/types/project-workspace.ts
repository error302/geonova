export type SurveyMode = 'boundary' | 'levelling' | 'topographic' | 'gnss';

export type BoundarySurveyType =
  | 'subdivision'
  | 'amalgamation'
  | 'resurvey'
  | 'mutation'
  | 'gnss_control';

export type LevellingSurveyType =
  | 'differential'
  | 'profile'
  | 'cross_section'
  | 'benchmark_establishment'
  | 'two_peg_test';

export type SurveyType =
  | BoundarySurveyType
  | LevellingSurveyType
  | 'topographic'
  | 'mining'
  | 'hydrographic'
  | 'drone_uav';

export type StepStatus = 'locked' | 'pending' | 'in_progress' | 'complete';

export interface WorkspaceStep {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  gated?: boolean;
  toolRoute?: string;
  count?: number;
}

export interface Beacon {
  id: string;
  name: string;
  type: 'old' | 'new' | 'reference';
  easting: number;
  northing: number;
  elevation?: number;
  description?: string;
  confirmed: boolean;
}

export interface BoundaryLine {
  from: string;
  to: string;
  bearing?: number;
  distance?: number;
}

export interface Lot {
  id: string;
  lotNumber: string;
  area: number;
  beaconIds: string[];
  deedPlanStatus: StepStatus;
}

export interface BoundaryProjectData {
  beacons: Beacon[];
  boundaries: BoundaryLine[];
  lots: Lot[];
  totalArea?: number;
  workingDiagramStatus: StepStatus;
  rdmReportStatus: StepStatus;
}

export interface LevelStation {
  id: string;
  stationId: string;
  chainage?: number;
  backSight?: number;
  intermediateSight?: number;
  foreSight?: number;
  reducedLevel?: number;
  remarks?: string;
}

export interface LevelLine {
  startBMRef: string;
  startRL: number;
  endBMRef?: string;
  endRL?: number;
  totalDistance: number;
}

export interface LevellingProjectData {
  levelLine: Partial<LevelLine>;
  stations: LevelStation[];
  computationMethod: 'hpc' | 'rise_fall';
  misclosureAllowed?: number;
  misclosureActual?: number;
  closurePassed?: boolean;
  fieldBookStatus: StepStatus;
  computationStatus: StepStatus;
  levelReportStatus: StepStatus;
}

export interface MetarduProject {
  id: string;
  name: string;
  description?: string;
  surveyType: SurveyType;
  utmZone: number;
  hemisphere: 'N' | 'S';
  country: string;
  datum: string;
  clientName?: string;
  surveyorName?: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'in_progress' | 'complete' | 'archived';
  boundaryData?: BoundaryProjectData;
  levellingData?: LevellingProjectData;
}

export function getSurveyMode(type: SurveyType): SurveyMode {
  const levellingTypes: SurveyType[] = [
    'differential', 'profile', 'cross_section',
    'benchmark_establishment', 'two_peg_test',
  ];
  const boundaryTypes: SurveyType[] = [
    'subdivision', 'amalgamation', 'resurvey',
    'mutation', 'gnss_control',
  ];
  if (levellingTypes.includes(type)) return 'levelling';
  if (boundaryTypes.includes(type)) return 'boundary';
  if (type === 'topographic') return 'topographic';
  return 'gnss';
}

export const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
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

export function getWorkspaceSteps(
  project: MetarduProject,
  mode: SurveyMode
): WorkspaceStep[] {
  if (mode === 'boundary') return getBoundarySteps(project);
  if (mode === 'levelling') return getLevellingSteps(project);
  return getGenericSteps();
}

function getBoundarySteps(project: MetarduProject): WorkspaceStep[] {
  const bd = project.boundaryData;
  const lotCount = bd?.lots?.length ?? 1;

  return [
    { id: 'setup', label: 'Project Setup', description: 'Client details, datum, LR reference', status: 'complete' },
    {
      id: 'beacons', label: 'Beacon & Boundary Data',
      description: 'Enter all beacons once — all outputs auto-populate',
      status: bd && bd.beacons.length > 0 ? 'complete' : 'in_progress',
    },
    {
      id: 'working_diagram', label: 'Working Diagram',
      description: 'Auto-populated from beacon data',
      status: bd?.workingDiagramStatus ?? 'pending',
      toolRoute: '/tools/cogo', gated: true,
    },
    ...(project.surveyType === 'subdivision' || project.surveyType === 'amalgamation'
      ? [{ id: 'deed_plans', label: `Deed Plan${lotCount > 1 ? `s (${lotCount} lots)` : ''}`, description: 'Auto-populated from beacon data', status: (bd?.lots?.every(l => l.deedPlanStatus === 'complete') ? 'complete' : 'pending') as StepStatus, count: lotCount, gated: true }]
      : []),
    ...(project.surveyType === 'resurvey'
      ? [{ id: 'reinstatement', label: 'Beacon Reinstatement Record', description: 'Reinstatement details and beacon condition notes', status: 'pending' as StepStatus, gated: true }]
      : []),
    { id: 'rdm', label: 'RDM Report', description: 'Auto-populated beacon list + area tables', status: bd?.rdmReportStatus ?? 'pending', gated: true },
    { id: 'export', label: 'Export Package', description: 'PDF, DXF, GeoJSON — unlocks when all outputs done', status: 'locked', gated: true },
  ];
}

function getLevellingSteps(project: MetarduProject): WorkspaceStep[] {
  if (project.surveyType === 'two_peg_test') {
    return [
      { id: 'setup', label: 'Project Setup', description: 'Instrument details, location', status: 'complete' },
      { id: 'two_peg', label: 'Two Peg Observations', description: 'Staff readings at two positions', status: 'in_progress', toolRoute: '/tools/leveling' },
      { id: 'collimation', label: 'Collimation Error Report', description: 'Calculated e value and pass/fail', status: 'pending', gated: true },
      { id: 'export', label: 'Export Report', description: 'PDF calibration certificate', status: 'locked', gated: true },
    ];
  }

  const ld = project.levellingData;
  return [
    { id: 'setup', label: 'Project Setup', description: 'BM references, line description', status: 'complete' },
    { id: 'line_setup', label: 'Level Line Setup', description: 'Start BM RL, End BM RL, distance K (km)', status: ld?.levelLine?.startRL !== undefined ? 'complete' : 'in_progress' },
    { id: 'field_book', label: 'Field Book Entry', description: 'BS / IS / FS per station', status: ld?.fieldBookStatus ?? 'pending', toolRoute: '/tools/leveling', gated: true },
    { id: 'computation', label: ld?.computationMethod === 'rise_fall' ? 'Rise & Fall Computation' : 'HPC Computation', description: 'Reduced levels + arithmetic check', status: ld?.computationStatus ?? 'pending', gated: true },
    { id: 'closure', label: 'Closure Check', description: `Allowed: 12√K mm${ld?.closurePassed === true ? ' — ✓ PASSED' : ld?.closurePassed === false ? ' — ✗ FAILED' : ''}`, status: ld?.closurePassed !== undefined ? (ld.closurePassed ? 'complete' : 'in_progress') : 'pending', gated: true },
    { id: 'adjustment', label: 'Bowditch Adjustment', description: 'Distribute misclosure across stations', status: 'pending', gated: true },
    ...(project.surveyType === 'profile' || project.surveyType === 'cross_section'
      ? [{ id: 'profile', label: project.surveyType === 'profile' ? 'Longitudinal Section' : 'Cross-Section Drawings', description: 'Chainage vs RL plot', status: 'pending' as StepStatus, gated: true }]
      : []),
    { id: 'level_report', label: 'Level Report', description: 'Adjusted RLs + BM references', status: ld?.levelReportStatus ?? 'pending', gated: true },
    { id: 'export', label: 'Export Package', description: 'PDF report + CSV table', status: 'locked', gated: true },
  ];
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
