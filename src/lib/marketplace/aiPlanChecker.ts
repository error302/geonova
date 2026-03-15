/**
 * AI Plan Checking Service
 * Phase 9 - Community Features
 * Automated survey plan review and compliance checking
 */

export interface PlanCheckInput {
  projectName: string
  surveyType: 'traverse' | 'leveling' | 'boundary' | 'topographic' | 'engineering' | 'mining' | 'hydrographic'
  country: 'kenya' | 'uganda' | 'tanzania' | 'nigeria' | 'ghana' | 'south_africa' | 'other'
  points: { name: string; easting: number; northing: number; elevation?: number }[]
  boundaries?: { from: string; to: string }[]
  controlPoints?: string[]
  metadata?: Record<string, any>
}

export interface PlanIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  category: 'precision' | 'compliance' | 'geometry' | 'documentation' | 'boundary' | 'closure'
  title: string
  description: string
  recommendation: string
  location?: string
  relatedPoints?: string[]
}

export interface PlanCheckResult {
  id: string
  input: PlanCheckInput
  checkedAt: number
  processingTime: number
  overallScore: number
  grade: 'excellent' | 'good' | 'acceptable' | 'needs_revision' | 'failed'
  issues: PlanIssue[]
  passed: boolean
  summary: string
  detailedReport: string
}

export interface ComplianceRule {
  id: string
  name: string
  description: string
  applicableTo: string[]
  severity: 'error' | 'warning'
  check: (input: PlanCheckInput) => PlanIssue | null
}

const complianceRules: ComplianceRule[] = [
  {
    id: 'min-points',
    name: 'Minimum Points Required',
    description: 'Survey must have at least 3 points for valid computation',
    applicableTo: ['traverse', 'boundary', 'topographic'],
    severity: 'error',
    check: (input) => {
      if (input.points.length < 3) {
        return {
          id: 'min-points',
          severity: 'error',
          category: 'documentation',
          title: 'Insufficient Points',
          description: `Only ${input.points.length} points provided. Minimum 3 required.`,
          recommendation: 'Add more survey points to create valid geometry.',
        }
      }
      return null
    }
  },
  {
    id: 'closure-check',
    name: 'Traverse Closure',
    description: 'Closed traverse must return to starting point',
    applicableTo: ['traverse'],
    severity: 'error',
    check: (input) => {
      if (input.boundaries && input.boundaries.length > 2) {
        const firstPoint = input.points[0]?.name
        const lastBoundary = input.boundaries[input.boundaries.length - 1]
        if (lastBoundary.to !== firstPoint) {
          return {
            id: 'closure-check',
            severity: 'warning',
            category: 'closure',
            title: 'Open Traverse Detected',
            description: 'Last point does not close to first point.',
            recommendation: 'This appears to be an open traverse. Ensure this is intentional.',
          }
        }
      }
      return null
    }
  },
  {
    id: 'coordinate-range',
    name: 'Coordinate Range Validation',
    description: 'Coordinates should be within reasonable UTM range',
    applicableTo: ['traverse', 'boundary', 'topographic', 'engineering'],
    severity: 'warning',
    check: (input) => {
      const invalidPoints = input.points.filter(p => 
        p.easting < 100000 || p.easting > 900000 ||
        p.northing < 0 || p.northing > 10000000
      )
      if (invalidPoints.length > 0) {
        return {
          id: 'coordinate-range',
          severity: 'warning',
          category: 'geometry',
          title: 'Unusual Coordinate Range',
          description: `${invalidPoints.length} point(s) have unusual UTM coordinates.`,
          recommendation: 'Verify coordinate system (UTM zone) is correct.',
          relatedPoints: invalidPoints.map(p => p.name),
        }
      }
      return null
    }
  },
  {
    id: 'control-points',
    name: 'Control Point Requirement',
    description: 'Boundary surveys should reference control points',
    applicableTo: ['boundary'],
    severity: 'warning',
    check: (input) => {
      if (input.surveyType === 'boundary' && (!input.controlPoints || input.controlPoints.length === 0)) {
        return {
          id: 'control-points',
          severity: 'warning',
          category: 'compliance',
          title: 'No Control Points Referenced',
          description: 'Boundary survey does not reference any control points.',
          recommendation: 'Include at least 2 known control points for boundary establishment.',
        }
      }
      return null
    }
  },
  {
    id: 'duplicate-points',
    name: 'Duplicate Point Detection',
    description: 'Check for duplicate point names',
    applicableTo: ['traverse', 'leveling', 'boundary', 'topographic', 'engineering'],
    severity: 'error',
    check: (input) => {
      const names = input.points.map(p => p.name)
      const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
      if (duplicates.length > 0) {
        return {
          id: 'duplicate-points',
          severity: 'error',
          category: 'documentation',
          title: 'Duplicate Point Names',
          description: `Found duplicate point names: ${Array.from(new Set(duplicates)).join(', ')}`,
          recommendation: 'Each point must have a unique name.',
        }
      }
      return null
    }
  },
]

const countryRequirements: Record<string, { precision: number; notes: string }> = {
  kenya: { precision: 5000, notes: 'Kenya Survey Act requirements' },
  uganda: { precision: 3000, notes: 'Uganda Survey Regulations' },
  tanzania: { precision: 3000, notes: 'Tanzania Land Survey Regulations' },
  nigeria: { precision: 2500, notes: 'Nigeria Survey Practice Regulations' },
  ghana: { precision: 3000, notes: 'Ghana Survey Act' },
  south_africa: { precision: 5000, notes: 'South Africa Survey Standards' },
  other: { precision: 3000, notes: 'International best practice' },
}

export function checkSurveyPlan(input: PlanCheckInput): PlanCheckResult {
  const startTime = Date.now()
  const issues: PlanIssue[] = []

  for (const rule of complianceRules) {
    if (rule.applicableTo.includes(input.surveyType)) {
      const issue = rule.check(input)
      if (issue) {
        issues.push(issue)
      }
    }
  }

  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')

  let overallScore = 100
  overallScore -= errors.length * 20
  overallScore -= warnings.length * 5

  let grade: PlanCheckResult['grade']
  if (overallScore >= 90) grade = 'excellent'
  else if (overallScore >= 75) grade = 'good'
  else if (overallScore >= 60) grade = 'acceptable'
  else if (overallScore >= 40) grade = 'needs_revision'
  else grade = 'failed'

  const summary = errors.length === 0 
    ? errors.length === 0 && warnings.length === 0 
      ? 'Survey plan passes all automated checks.' 
      : `Survey plan passed with ${warnings.length} warning(s).`
    : `Survey plan has ${errors.length} error(s) and ${warnings.length} warning(s).`

  const countryReq = countryRequirements[input.country] || countryRequirements.other
  
  const detailedReport = `
Survey Plan Analysis Report
===========================
Project: ${input.projectName}
Survey Type: ${input.surveyType}
Country: ${input.country.toUpperCase()}
Date: ${new Date().toLocaleDateString()}

Summary
-------
Overall Score: ${overallScore}/100
Grade: ${grade.toUpperCase()}
Issues Found: ${issues.length} (${errors.length} errors, ${warnings.length} warnings)

Country Requirements
-------------------
Minimum Precision: 1:${countryReq.precision}
Notes: ${countryReq.notes}

Points Analyzed: ${input.points.length}
${input.controlPoints ? `Control Points: ${input.controlPoints.length}` : ''}

Detailed Issues
---------------
${issues.map((issue, i) => `${i + 1}. [${issue.severity.toUpperCase()}] ${issue.title}
   ${issue.description}
   Recommendation: ${issue.recommendation}
`).join('\n')}
`.trim()

  return {
    id: `check-${Date.now()}`,
    input,
    checkedAt: Date.now(),
    processingTime: Date.now() - startTime,
    overallScore,
    grade,
    issues,
    passed: errors.length === 0,
    summary,
    detailedReport,
  }
}

export function getComplianceRules(): ComplianceRule[] {
  return complianceRules
}

export function getCountryRequirements(country: string) {
  return countryRequirements[country] || countryRequirements.other
}
