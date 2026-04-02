import { SurveyType } from '@/types/project';
import { SurveyWorkflow, WorkflowStep } from '@/types/workflow';

function step(
  index: number,
  id: string,
  label: string,
  description: string,
  routeSuffix: string | null = null
): WorkflowStep {
  return { index, id, label, description, routeSuffix };
}

const SUBMISSION_STEP = step(
  5,
  'submission',
  'Submission',
  'Generate and download all required documents.',
  'submission'
);

const WORKFLOWS: Record<SurveyType, SurveyWorkflow> = {
  cadastral: {
    type: 'cadastral',
    label: 'Cadastral Survey',
    steps: [
      step(1, 'setup', 'Setup', 'Enter project details, LR number, client info, and UTM zone.'),
      step(2, 'fieldbook', 'Field Book', 'Record traverse observations and beacon coordinates.'),
      step(3, 'compute', 'Compute', 'Run Bowditch traverse adjustment and area calculation.'),
      step(4, 'review', 'Review', 'Check traverse diagram, closure, and boundary plan.'),
      SUBMISSION_STEP,
    ],
  },
  engineering: {
    type: 'engineering',
    label: 'Engineering Survey',
    steps: [
      step(1, 'setup', 'Setup', 'Enter project name, road/structure reference, and chainage range.'),
      step(2, 'fieldbook', 'Field Book', 'Record levelling runs, cross-sections, and setting-out observations.'),
      step(3, 'compute', 'Compute', 'Reduce levels, apply 10√K mm closure check, and compute volumes.'),
      step(4, 'review', 'Review', 'Inspect longitudinal section, cross-sections, and earthwork quantities.'),
      SUBMISSION_STEP,
    ],
  },
  topographic: {
    type: 'topographic',
    label: 'Topographic Survey',
    steps: [
      step(1, 'setup', 'Setup', 'Enter project name, scale, contour interval, and datum.'),
      step(2, 'fieldbook', 'Field Book', 'Record radial observations, GPS points, and spot heights.'),
      step(3, 'compute', 'Compute', 'Reduce coordinates, generate DTM, and extract contours.'),
      step(4, 'review', 'Review', 'Inspect contour plan and TIN surface.'),
      SUBMISSION_STEP,
    ],
  },
  geodetic: {
    type: 'geodetic',
    label: 'Geodetic / Control Survey',
    steps: [
      step(1, 'setup', 'Setup', 'Enter network order, datum, and control point references.'),
      step(2, 'fieldbook', 'Field Book', 'Record GNSS baselines and control network observations.'),
      step(3, 'compute', 'Compute', 'Run network adjustment and baseline processing.'),
      step(4, 'review', 'Review', 'Inspect network diagram and precision analysis.'),
      SUBMISSION_STEP,
    ],
  },
  mining: {
    type: 'mining',
    label: 'Mining Survey',
    steps: [
      step(1, 'setup', 'Setup', 'Enter mine name, permit number, and survey area.'),
      step(2, 'fieldbook', 'Field Book', 'Record traverse, levelling, and stockpile observations.'),
      step(3, 'compute', 'Compute', 'Compute traverse, volumes, and setting-out data.'),
      step(4, 'review', 'Review', 'Inspect volume quantities and working diagram.'),
      SUBMISSION_STEP,
    ],
  },
  hydrographic: {
    type: 'hydrographic',
    label: 'Hydrographic Survey',
    steps: [
      step(1, 'setup', 'Setup', 'Enter water body name, tide gauge reference, and sounding grid.'),
      step(2, 'fieldbook', 'Field Book', 'Record sounding data and tide gauge readings.'),
      step(3, 'compute', 'Compute', 'Apply tidal corrections and reduce soundings to chart datum.'),
      step(4, 'review', 'Review', 'Preview sounding chart and depth distribution.'),
      SUBMISSION_STEP,
    ],
  },
  drone: {
    type: 'drone',
    label: 'Drone / UAV Photogrammetry',
    steps: [
      step(1, 'setup', 'Setup', 'Enter mission ID, camera specifications, and flight parameters.'),
      step(2, 'fieldbook', 'Field Book', 'Record GCP coordinates, flight log, and overlap details.'),
      step(3, 'compute', 'Compute', 'Adjust GCPs, compute volumetrics, and generate point cloud.'),
      step(4, 'review', 'Review', 'Preview orthophoto overlay and GCP residuals.'),
      SUBMISSION_STEP,
    ],
  },
  deformation: {
    type: 'deformation',
    label: 'Deformation / Monitoring Survey',
    steps: [
      step(1, 'setup', 'Setup', 'Enter structure name, monitoring interval, and reference epoch.'),
      step(2, 'fieldbook', 'Field Book', 'Record epoch observations and reference point coordinates.'),
      step(3, 'compute', 'Compute', 'Compare epochs, derive displacement vectors.'),
      step(4, 'review', 'Review', 'Inspect deformation plot and statistical analysis.'),
      SUBMISSION_STEP,
    ],
  },
};

export function getWorkflow(surveyType: SurveyType): SurveyWorkflow {
  return WORKFLOWS[surveyType];
}

export function getStep(surveyType: SurveyType, stepIndex: number): WorkflowStep | undefined {
  return WORKFLOWS[surveyType]?.steps.find((s) => s.index === stepIndex);
}

export function isStepUnlocked(maxUnlocked: number, stepIndex: number): boolean {
  return stepIndex <= maxUnlocked;
}

export function nextStepIndex(surveyType: SurveyType, currentIndex: number): number | null {
  const steps = WORKFLOWS[surveyType]?.steps ?? [];
  const last = steps[steps.length - 1];
  if (currentIndex >= last.index) return null;
  return currentIndex + 1;
}

export { WORKFLOWS };