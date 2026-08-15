import {
  evaluatePackageCompleteness,
  buildPackageManifest,
  ARTIFACT_TO_SECTION,
} from '../manifest'
import { SUBMISSION_SECTIONS } from '@/types/submission'

describe('evaluatePackageCompleteness (Phase 13 Milestone B)', () => {
  it('reports all required sections missing when no artifacts are present', () => {
    const result = evaluatePackageCompleteness({})

    expect(result.complete).toBe(false)
    expect(result.sections).toHaveLength(SUBMISSION_SECTIONS.length)
    // Every required section is missing
    const required = SUBMISSION_SECTIONS.filter((s) => s.required)
    expect(result.missingRequired).toHaveLength(required.length)
  })

  it('maps generated artifact keys onto benchmark sections', () => {
    const result = evaluatePackageCompleteness({
      generatedArtifacts: {
        working_diagram: 'working_diagram.dxf',
        'form-c22': 'form_c22.pdf',
        'area-computation': 'area.pdf',
        'control-schedule': 'coords.xlsx',
      },
    })

    expect(result.statusBySection.working_diagram).toBe('ready')
    expect(result.statusBySection.theoretical_comps).toBe('ready')
    expect(result.statusBySection.area_computations).toBe('ready')
    expect(result.statusBySection.coordinate_list).toBe('ready')
  })

  it('treats the optional RTK section as non-blocking when absent', () => {
    const result = evaluatePackageCompleteness({})

    expect(result.missingRequired.some((s) => s.id === 'rtk_result')).toBe(false)
    expect(result.missingOptional.some((s) => s.id === 'rtk_result')).toBe(true)
  })

  it('is complete when all required sections are satisfied via readySections', () => {
    const allRequired = SUBMISSION_SECTIONS.filter((s) => s.required).map((s) => s.id)
    const result = evaluatePackageCompleteness({ readySections: allRequired })

    expect(result.complete).toBe(true)
    expect(result.missingRequired).toHaveLength(0)
  })

  it('preserves benchmark section order in the report', () => {
    const result = evaluatePackageCompleteness({})
    const orders = result.sections.map((r) => r.section.order)
    const expected = SUBMISSION_SECTIONS.map((s) => s.order)
    expect(orders).toEqual(expected)
  })
})

describe('buildPackageManifest (Phase 13 Milestone B)', () => {
  it('returns sections in benchmark order with resolved status', () => {
    const { sections, completeness } = buildPackageManifest({
      generatedArtifacts: { working_diagram: 'wd.dxf' },
    })

    expect(sections[0].id).toBe('surveyor_report')
    expect(sections[3].id).toBe('working_diagram')
    expect(sections[3].status).toBe('ready')
    expect(completeness.complete).toBe(false)
    expect(completeness.missingRequired.some((s) => s.id === 'surveyor_report')).toBe(true)
  })
})

describe('ARTIFACT_TO_SECTION', () => {
  it('maps every key to a valid benchmark section id', () => {
    const validIds = new Set(SUBMISSION_SECTIONS.map((s) => s.id))
    for (const [key, sectionId] of Object.entries(ARTIFACT_TO_SECTION)) {
      expect(validIds.has(sectionId)).toBe(true)
      expect(key.length).toBeGreaterThan(0)
    }
  })
})
