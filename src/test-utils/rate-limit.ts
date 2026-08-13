/**
 * Factory for the `@/lib/security/rateLimit` jest.mock module shape.
 *
 * Use inside a jest.mock factory:
 *
 *   jest.mock('@/lib/security/rateLimit', () => mockRateLimitModule())
 *   jest.mock('@/lib/security/rateLimit', () =>
 *     mockRateLimitModule({ remaining: 60, clientId: 'test-ip' })
 *   )
 *
 * The name starts with `mock` so babel-plugin-jest-hoist allows referencing
 * it from the hoisted jest.mock factory.
 */
export function mockRateLimitModule(
  options: { remaining?: number; clientId?: string } = {}
): {
  rateLimit: jest.Mock
  getClientIdentifier: jest.Mock
} {
  const { remaining = 10, clientId = 'test-client' } = options
  return {
    rateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining }),
    getClientIdentifier: jest.fn().mockReturnValue(clientId),
  }
}
