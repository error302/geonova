/**
 * NLIS (National Land Information System) — Uganda
 *
 * STUB MODULE (2026-05-29): The actual NLIS API integration is not yet
 * implemented. This file exists so that `src/lib/integrations/index.ts`
 * can re-export it without TypeScript errors. When the integration is
 * built, replace this stub with the real client.
 */

export interface NLISConfig {
  apiKey: string
  baseUrl: string
}

export async function submitToNLIS(
  _payload: unknown,
  _config: NLISConfig,
): Promise<{ reference: string; status: string }> {
  throw new Error('NLIS (Uganda) integration not yet implemented.')
}
