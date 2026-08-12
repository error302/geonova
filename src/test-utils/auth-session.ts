/**
 * Shared NextAuth session fixture for route tests.
 *
 * Pass a `userId` when the route under test must resolve a specific user
 * (matches the seeded E2E row id for parity with the CI e2e user).
 */
export function createAuthSession(userId = 'user-1') {
  return {
    user: { id: userId, email: 'test@metardu.com', name: 'Test' },
    expires: new Date().toISOString(),
  }
}
