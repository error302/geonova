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

  it('marks the RTK section ready when a GNSS observation report is saved', () => {
    const result = evaluatePackageCompleteness({
      generatedArtifacts: {
        gnss_observation_report: 'gnss_observation_report.txt',
      },
    })

    expect(result.statusBySection.rtk_result).toBe('ready')
    expect(result.missingOptional.some((s) => s.id === 'rtk_result')).toBe(false)
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

  it('counts the RTK section as REQUIRED for GNSS-based subtypes', () => {
    const result = evaluatePackageCompleteness({ requiredGnss: true })

    expect(result.complete).toBe(false)
    expect(result.missingRequired.some((s) => s.id === 'rtk_result')).toBe(true)
    expect(result.missingOptional.some((s) => s.id === 'rtk_result')).toBe(false)
  })

  it('marks the RTK section ready for GNSS-based subtypes when the report is saved', () => {
    const result = evaluatePackageCompleteness({
      requiredGnss: true,
      generatedArtifacts: {
        'gnss-observation-report': 'gnss_observation_report.txt',
      },
    })

    expect(result.statusBySection.rtk_result).toBe('ready')
    expect(result.missingRequired.some((s) => s.id === 'rtk_result')).toBe(false)
  })

  it('keeps the RTK section optional when requiredGnss is false/omitted', () => {
    const result = evaluatePackageCompleteness({ requiredGnss: false })
    expect(result.missingRequired.some((s) => s.id === 'rtk_result')).toBe(false)
    expect(result.missingOptional.some((s) => s.id === 'rtk_result')).toBe(true)
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

  it('embeds an empty provenance ledger when no records are passed', () => {
    const { provenance } = buildPackageManifest({})
    expect(provenance.records).toEqual([])
    expect(provenance.engineVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(typeof provenance.generatedAt).toBe('string')
  })

  it('embeds engine provenance records in the manifest (court-grade evidence)', () => {
    const { provenance } = buildPackageManifest({
      provenance: [
        {
          artifact: 'traverse_adjustment',
          engine: 'traverse',
          method: 'bowditch',
          engineVersion: '1.0.1',
          inputHash: 'a'.repeat(64),
          residuals: { linearError: 0.0036, precisionRatio: 14200 },
          timestamp: '2026-08-18T10:00:00.000Z',
        },
        {
          artifact: 'area_computation',
          engine: 'area',
          method: 'coordinate-area',
          engineVersion: '1.0.1',
          inputHash: 'b'.repeat(64),
          residuals: { areaM2: 8000 },
          timestamp: '2026-08-18T10:00:00.000Z',
        },
      ],
    })

    expect(provenance.records).toHaveLength(2)
    expect(provenance.records[0]).toMatchObject({
      engine: 'traverse',
      method: 'bowditch',
      inputHash: 'a'.repeat(64),
    })
    expect(provenance.records[1].engine).toBe('area')
    expect(provenance.records.every((r) => r.engineVersion === '1.0.1')).toBe(true)
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
