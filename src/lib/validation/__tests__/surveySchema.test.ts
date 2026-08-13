import { BoundaryPointSchema, ControlPointSchema } from '../surveySchema'

describe('Survey Validation Schemas', () => {
  describe('BoundaryPointSchema', () => {
    it('should validate a valid boundary point', () => {
      const result = BoundaryPointSchema.safeParse({
        name: 'A',
        easting: 356789.123,
        northing: 9987654.321,
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing name', () => {
      const result = BoundaryPointSchema.safeParse({
        easting: 356789.123,
        northing: 9987654.321,
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-numeric easting', () => {
      const result = BoundaryPointSchema.safeParse({
        name: 'A',
        easting: 'not-a-number',
        northing: 9987654.321,
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing coordinates', () => {
      const result = BoundaryPointSchema.safeParse({ name: 'A' })
      expect(result.success).toBe(false)
    })
  })

  describe('ControlPointSchema', () => {
    it('should validate a valid control point', () => {
      const result = ControlPointSchema.safeParse({
        name: 'CP1',
        easting: 356789.123,
        northing: 9987654.321,
        elevation: 1890.456,
        monumentType: 'indicatory_beacon',
        beaconDescription: 'Concrete beacon with brass cap',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid monument type', () => {
      const result = ControlPointSchema.safeParse({
        name: 'CP1',
        easting: 356789.123,
        northing: 9987654.321,
        elevation: 1890.456,
        monumentType: 'not_a_valid_type',
      })
      expect(result.success).toBe(false)
    })
  })
})
