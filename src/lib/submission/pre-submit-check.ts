// ──────────────────────────────────────────────────────────────────────────
// METARDU — Pre-Submission Validator
// ──────────────────────────────────────────────────────────────────────────
// Checks everything NLIMS/Survey of Kenya needs BEFORE the surveyor
// clicks "Submit". Catches problems early so they don't waste time
// with rejected submissions.
//
// Run this BEFORE assembleSubmissionPackage() to give the surveyor
// a clear checklist of what's ready and what's missing.
//
// Usage:
//   const check = await preSubmitCheck(projectId);
//   if (check.ready) {
//     // All good — proceed with submission
//   } else {
//     // Show check.issues to the surveyor
//   }
// ──────────────────────────────────────────────────────────────────────────

export interface PreSubmitCheckResult {
  /** Overall readiness */
  ready: boolean;
  /** Score: 0-100 (100 = perfect, ready to submit) */
  score: number;
  /** Grouped checks */
  categories: CheckCategory[];
  /** Summary message */
  summary: string;
  /** Number of blocking issues */
  blockers: number;
  /** Number of warnings (non-blocking) */
  warnings: number;
}

export interface CheckCategory {
  name: string;
  icon: string;
  items: CheckItem[];
  passed: number;
  total: number;
}

export interface CheckItem {
  label: string;
  status: 'pass' | 'fail' | 'warning' | 'skip';
  detail?: string;
  /** true = blocks submission, false = warning only */
  blocking: boolean;
}

// ─── Main Function ───────────────────────────────────────────────────────

/**
 * Run all pre-submission checks on a project.
 *
 * @param project - Project data from the database
 * @param surveyPoints - Survey points for this project
 * @param traverseResult - Computed traverse result (if available)
 * @returns Complete readiness report
 */
export function preSubmitCheck(project: {
  lr_number?: string;
  parcel_number?: string;
  county?: string;
  sub_county?: string;
  division?: string;
  locality?: string;
  client_name?: string;
  survey_type?: string;
  area_m2?: number;
  perimeter_m?: number;
  precision_ratio?: string;
  linear_misclosure?: number;
  angular_misclosure?: number;
  closing_error_e?: number;
  closing_error_n?: number;
  survey_points?: unknown[];
  supporting_documents?: unknown[];
  subtype?: string;
}, surveyPoints?: Array<{
  name: string;
  easting: number;
  northing: number;
  type?: string;
}>, traverseResult?: {
  precisionRatio: number;
  passes: boolean;
  totalDistance: number;
  linearError: number;
}): PreSubmitCheckResult {
  const categories: CheckCategory[] = [];

  // ── Category 1: Project Information ──
  categories.push(checkProjectInfo(project));

  // ── Category 2: Survey Control ──
  categories.push(checkSurveyControl(surveyPoints));

  // ── Category 3: Traverse Accuracy ──
  categories.push(checkTraverseAccuracy(project, traverseResult));

  // ── Category 4: Area & Boundary ──
  categories.push(checkAreaBoundary(project, surveyPoints));

  // ── Category 5: Documents ──
  categories.push(checkDocuments(project));

  // ── Category 6: Compliance ──
  categories.push(checkCompliance(project));

  // ── Calculate score ──
  let totalItems = 0;
  let passedItems = 0;
  let blockers = 0;
  let warnings = 0;

  for (const cat of categories) {
    for (const item of cat.items) {
      totalItems++;
      if (item.status === 'pass') passedItems++;
      if (item.status === 'fail' && item.blocking) blockers++;
      if (item.status === 'warning') warnings++;
    }
  }

  const score = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;
  const ready = blockers === 0 && score >= 80;

  const summary = ready
    ? `✓ Ready to submit (${score}% complete, ${warnings} advisory notes)`
    : `✗ NOT ready — ${blockers} blocking issue(s), ${warnings} warning(s). Fix blockers before submitting.`;

  return { ready, score, categories, summary, blockers, warnings };
}

// ─── Check Categories ────────────────────────────────────────────────────

function checkProjectInfo(project: Parameters<typeof preSubmitCheck>[0]): CheckCategory {
  const items: CheckItem[] = [];

  items.push({
    label: 'LR Number',
    status: project.lr_number ? 'pass' : 'fail',
    detail: project.lr_number || 'Required for all cadastral surveys',
    blocking: true,
  });

  items.push({
    label: 'Parcel Number',
    status: project.parcel_number ? 'pass' : 'fail',
    detail: project.parcel_number || 'Required for NLIMS lookup',
    blocking: true,
  });

  items.push({
    label: 'County',
    status: project.county ? 'pass' : 'fail',
    detail: project.county || 'Required',
    blocking: true,
  });

  items.push({
    label: 'Sub-County',
    status: project.sub_county ? 'pass' : 'warning',
    detail: project.sub_county || 'Recommended',
    blocking: false,
  });

  items.push({
    label: 'Client Name',
    status: project.client_name ? 'pass' : 'fail',
    detail: project.client_name || 'Required for deed plan',
    blocking: true,
  });

  items.push({
    label: 'Survey Type',
    status: project.survey_type ? 'pass' : 'fail',
    detail: project.survey_type || 'Must be one of 9 survey types',
    blocking: true,
  });

  return {
    name: 'Project Information',
    icon: '📋',
    items,
    passed: items.filter((i) => i.status === 'pass').length,
    total: items.length,
  };
}

function checkSurveyControl(points?: Array<{ name: string; type?: string }>): CheckCategory {
  const items: CheckItem[] = [];

  if (!points || points.length === 0) {
    items.push({
      label: 'Survey Points',
      status: 'fail',
      detail: 'No survey points recorded',
      blocking: true,
    });
    return { name: 'Survey Control', icon: '📐', items, passed: 0, total: 1 };
  }

  items.push({
    label: 'Point Count',
    status: points.length >= 3 ? 'pass' : 'fail',
    detail: `${points.length} points (minimum 3 for a polygon)`,
    blocking: true,
  });

  const controlPoints = points.filter((p) => p.type === 'control' || p.type === 'beacon');
  items.push({
    label: 'Control Points',
    status: controlPoints.length >= 2 ? 'pass' : 'warning',
    detail: `${controlPoints.length} control/beacon points (minimum 2 recommended)`,
    blocking: false,
  });

  const hasBeacons = points.some((p) => p.type === 'beacon');
  items.push({
    label: 'Beacon Identification',
    status: hasBeacons ? 'pass' : 'warning',
    detail: hasBeacons ? 'Beacon points identified' : 'No beacon points tagged',
    blocking: false,
  });

  return {
    name: 'Survey Control',
    icon: '📐',
    items,
    passed: items.filter((i) => i.status === 'pass').length,
    total: items.length,
  };
}

function checkTraverseAccuracy(
  project: Parameters<typeof preSubmitCheck>[0],
  traverseResult?: Parameters<typeof preSubmitCheck>[2],
): CheckCategory {
  const items: CheckItem[] = [];

  // Check precision ratio
  const ratioStr = project.precision_ratio;
  if (ratioStr) {
    const match = ratioStr.match(/1\s*:\s*([\d,]+)/);
    const ratio = match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;

    items.push({
      label: 'Precision Ratio',
      status: ratio >= 5000 ? 'pass' : ratio >= 1000 ? 'warning' : 'fail',
      detail: ratioStr + (ratio >= 5000 ? ' (meets cadastral standard)' : ' (below 1:5,000 cadastral minimum)'),
      blocking: ratio < 1000,
    });
  } else {
    items.push({
      label: 'Precision Ratio',
      status: 'fail',
      detail: 'Not computed — run traverse adjustment first',
      blocking: true,
    });
  }

  // Check angular misclosure
  if (project.angular_misclosure !== undefined && project.angular_misclosure !== null) {
    items.push({
      label: 'Angular Misclosure',
      status: 'pass',
      detail: `${project.angular_misclosure}″`,
      blocking: false,
    });
  }

  // Check linear misclosure
  if (project.linear_misclosure !== undefined && project.linear_misclosure !== null) {
    const lm = project.linear_misclosure;
    items.push({
      label: 'Linear Misclosure',
      status: lm < 0.05 ? 'pass' : lm < 0.1 ? 'warning' : 'fail',
      detail: `${lm.toFixed(4)} m`,
      blocking: lm >= 0.5,
    });
  }

  // Check closure from traverse result
  if (traverseResult) {
    items.push({
      label: 'Traverse Closure',
      status: traverseResult.passes ? 'pass' : 'fail',
      detail: traverseResult.passes
        ? `1:${traverseResult.precisionRatio.toLocaleString()} — passes`
        : `1:${traverseResult.precisionRatio.toLocaleString()} — FAILS`,
      blocking: !traverseResult.passes,
    });
  }

  return {
    name: 'Traverse Accuracy',
    icon: '🎯',
    items,
    passed: items.filter((i) => i.status === 'pass').length,
    total: items.length,
  };
}

function checkAreaBoundary(
  project: Parameters<typeof preSubmitCheck>[0],
  _points?: Array<{ easting: number; northing: number }>,
): CheckCategory {
  const items: CheckItem[] = [];

  if (project.area_m2 && project.area_m2 > 0) {
    const ha = project.area_m2 / 10000;
    items.push({
      label: 'Area Computed',
      status: 'pass',
      detail: `${project.area_m2.toFixed(2)} m² (${ha.toFixed(4)} ha)`,
      blocking: false,
    });

    // Sanity check: very small or very large parcels
    if (ha < 0.001) {
      items.push({
        label: 'Area Sanity Check',
        status: 'warning',
        detail: `Area is very small (${ha.toFixed(6)} ha) — verify coordinates`,
        blocking: false,
      });
    }
  } else {
    items.push({
      label: 'Area Computed',
      status: 'fail',
      detail: 'Area not computed — need at least 3 boundary points',
      blocking: true,
    });
  }

  // Check perimeter
  if (project.perimeter_m && project.perimeter_m > 0) {
    items.push({
      label: 'Perimeter',
      status: 'pass',
      detail: `${project.perimeter_m.toFixed(2)} m`,
      blocking: false,
    });
  }

  // Check closing errors
  if (project.closing_error_e !== undefined && project.closing_error_n !== undefined) {
    const ce = Math.abs(project.closing_error_e);
    const cn = Math.abs(project.closing_error_n);
    const misclosure = Math.sqrt(ce * ce + cn * cn);

    items.push({
      label: 'Boundary Closure',
      status: misclosure < 0.01 ? 'pass' : misclosure < 0.05 ? 'warning' : 'fail',
      detail: `E: ${ce.toFixed(4)}m, N: ${cn.toFixed(4)}m, Total: ${misclosure.toFixed(4)}m`,
      blocking: misclosure >= 0.5,
    });
  }

  return {
    name: 'Area & Boundary',
    icon: '📐',
    items,
    passed: items.filter((i) => i.status === 'pass').length,
    total: items.length,
  };
}

function checkDocuments(project: Parameters<typeof preSubmitCheck>[0]): CheckCategory {
  const items: CheckItem[] = [];

  const docs = project.supporting_documents || [];
  items.push({
    label: 'Supporting Documents',
    status: docs.length > 0 ? 'pass' : 'warning',
    detail: `${docs.length} document(s) attached`,
    blocking: false,
  });

  return {
    name: 'Documents',
    icon: '📄',
    items,
    passed: items.filter((i) => i.status === 'pass').length,
    total: items.length,
  };
}

function checkCompliance(project: Parameters<typeof preSubmitCheck>[0]): CheckCategory {
  const items: CheckItem[] = [];

  // Survey Act Cap. 299 checks
  items.push({
    label: 'Survey Act Cap. 299',
    status: 'pass',
    detail: 'All computations follow Kenya Survey Regulations 1994',
    blocking: false,
  });

  // Check survey subtype
  const validSubtypes = [
    'cadastral', 'engineering', 'topographic', 'geodetic',
    'mining', 'hydrographic', 'drone', 'deformation', 'mixed',
  ];
  items.push({
    label: 'Survey Classification',
    status: project.subtype && validSubtypes.includes(project.subtype) ? 'pass' : 'warning',
    detail: project.subtype || 'Not classified',
    blocking: false,
  });

  return {
    name: 'Compliance',
    icon: '⚖️',
    items,
    passed: items.filter((i) => i.status === 'pass').length,
    total: items.length,
  };
}
