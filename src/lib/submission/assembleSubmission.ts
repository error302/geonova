export const SUBMISSION_SECTIONS = [
  { id: 'surveyor_report',    order: 1, label: "Surveyor's Report",        required: true,  status: 'missing' as const },
  { id: 'index',              order: 2, label: 'Index to Computations',     required: true,  status: 'missing' as const },
  { id: 'coordinate_list',    order: 3, label: 'Final Coordinate List',     required: true,  status: 'missing' as const },
  { id: 'working_diagram',    order: 4, label: 'Working Diagram',          required: true,  status: 'missing' as const },
  { id: 'theoretical_comps',  order: 5, label: 'Theoretical Computations', required: true,  status: 'missing' as const },
  { id: 'rtk_result',         order: 6, label: 'RTK / Field Result Bundle',required: false, status: 'missing' as const },
  { id: 'consistency_checks', order: 7, label: 'Consistency Checks',       required: true,  status: 'missing' as const },
  { id: 'area_computations',  order: 8, label: 'Area Computations',        required: true,  status: 'missing' as const },
]

export function buildPackageManifest(
  project: Record<string, any>,
  submission: Record<string, any> | null
) {
  return SUBMISSION_SECTIONS.map((section: any) => ({
    ...section,
    status: submission?.generated_artifacts?.[section.id] ? 'ready' as const : 'missing' as const,
  }))
}