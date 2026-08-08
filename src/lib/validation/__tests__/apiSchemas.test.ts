import { AssignSurveyorSchema } from '../apiSchemas'

describe('AssignSurveyorSchema', () => {
  const validProjectId = '123e4567-e89b-12d3-a456-426614174000'
  const validBlockId = '98765432-b987-12d3-a456-426614174000'
  const validUserId = '55555555-5555-5555-5555-555555555555'

  it('accepts valid contract with project_id, block_id, and assigned_to', () => {
    const payload = {
      project_id: validProjectId,
      block_id: validBlockId,
      assigned_to: validUserId,
    }
    const result = AssignSurveyorSchema.safeParse(payload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.project_id).toBe(validProjectId)
      expect(result.data.block_id).toBe(validBlockId)
      expect(result.data.assigned_to).toBe(validUserId)
    }
  })

  it('accepts null or omitted assigned_to for unassignment', () => {
    const payloadNull = {
      project_id: validProjectId,
      block_id: validBlockId,
      assigned_to: null,
    }
    expect(AssignSurveyorSchema.safeParse(payloadNull).success).toBe(true)

    const payloadOmitted = {
      project_id: validProjectId,
      block_id: validBlockId,
    }
    expect(AssignSurveyorSchema.safeParse(payloadOmitted).success).toBe(true)
  })

  it('rejects invalid UUID for project_id or block_id', () => {
    const invalidProjectId = {
      project_id: 'not-a-uuid',
      block_id: validBlockId,
      assigned_to: validUserId,
    }
    expect(AssignSurveyorSchema.safeParse(invalidProjectId).success).toBe(false)

    const invalidBlockId = {
      project_id: validProjectId,
      block_id: '1234',
      assigned_to: validUserId,
    }
    expect(AssignSurveyorSchema.safeParse(invalidBlockId).success).toBe(false)
  })

  it('rejects missing required fields', () => {
    expect(AssignSurveyorSchema.safeParse({}).success).toBe(false)
    expect(AssignSurveyorSchema.safeParse({ project_id: validProjectId }).success).toBe(false)
  })
})
