import { executeWorkflow, generateReport } from '@/lib/compute/workflowEngine'

describe('SurveyFlow Automator', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'completed',
        results: { node1: { status: 'success' } },
        errors: []
      })
    }) as jest.Mock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
  
  test('executes workflow', async () => {
    const result = await executeWorkflow([], [])
    
    expect(result.status).toBe('completed')
    expect(result.results).toBeDefined()
  })
  
  test('generates report', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: 'Report content',
        sections: ['summary'],
        word_count: 10
      })
    }) as jest.Mock
    
    const result = await generateReport({}, ['summary'])
    
    expect(result.content).toBeDefined()
    expect(result.sections).toContain('summary')
  })
})