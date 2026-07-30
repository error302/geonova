/**
 * P0-2 verification: toolGates registry + gate lookup logic.
 *
 * The actual <ToolGate> component reads from useSubscription() which
 * requires a React context provider — tested via integration. This
 * unit test covers the pure registry logic: the map is complete, the
 * PLAN_RANK ordering is correct, and getToolGate returns the right
 * info for known paths and null for unknown ones.
 */
import { TOOL_GATES, PLAN_RANK, getToolGate } from '@/lib/subscription/toolGates'

describe('P0-2: toolGates registry', () => {
  test('all 9 gated tools are in the registry', () => {
    const expected = [
      '/tools/civil-export',
      '/tools/gis-export',
      '/tools/machine-control',
      '/tools/topo-drawing',
      '/tools/survey-plan-demo',
      '/tools/gnss-baseline',
      '/tools/drone',
      '/tools/slope-analysis',
      '/tools/progress-monitor',
    ]
    for (const path of expected) {
      expect(TOOL_GATES[path]).toBeDefined()
      expect(TOOL_GATES[path].minPlan).toBeTruthy()
      expect(TOOL_GATES[path].feature).toBeTruthy()
      expect(TOOL_GATES[path].label).toBeTruthy()
    }
    expect(Object.keys(TOOL_GATES).length).toBe(expected.length)
  })

  test('PLAN_RANK is monotonically increasing free → enterprise', () => {
    expect(PLAN_RANK.free).toBeLessThan(PLAN_RANK.pro)
    expect(PLAN_RANK.pro).toBeLessThan(PLAN_RANK.team)
    expect(PLAN_RANK.team).toBeLessThan(PLAN_RANK.firm)
    expect(PLAN_RANK.firm).toBeLessThan(PLAN_RANK.enterprise)
  })

  test('getToolGate returns GateInfo for known gated path', () => {
    const gate = getToolGate('/tools/civil-export')
    expect(gate).not.toBeNull()
    expect(gate!.minPlan).toBe('pro')
    expect(gate!.feature).toBe('dxf_export')
    expect(gate!.label).toBe('DXF Export')
  })

  test('getToolGate returns null for free (ungated) tool', () => {
    expect(getToolGate('/tools/traverse')).toBeNull()
    expect(getToolGate('/tools/cassini-utm')).toBeNull()
    expect(getToolGate('/tools/leveling')).toBeNull()
  })

  test('getToolGate returns null for unknown path', () => {
    expect(getToolGate('/tools/nonexistent')).toBeNull()
    expect(getToolGate('/not-a-tool')).toBeNull()
  })

  test('progress-monitor is the only Team-tier gate', () => {
    const teamGates = Object.entries(TOOL_GATES).filter(([, g]) => g.minPlan === 'team')
    expect(teamGates.length).toBe(1)
    expect(teamGates[0][0]).toBe('/tools/progress-monitor')
  })

  test('all other gates are Pro-tier', () => {
    const proGates = Object.entries(TOOL_GATES).filter(([, g]) => g.minPlan === 'pro')
    expect(proGates.length).toBe(8)
  })
})
