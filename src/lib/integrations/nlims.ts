/**
 * NLIMS (National Land Management Information System) — Kenya
 *
 * STUB MODULE (2026-07-05): The actual NLIMS API integration is not yet
 * implemented. This file exists so that `src/lib/integrations/index.ts`
 * can re-export it without TypeScript errors. When the integration is
 * built, replace this stub with the real client.
 *
 * Reference: docs/AUDIT.md, src/lib/export/nlimsExporter.ts (which has
 * the export-side logic already).
 */

export interface NLIMSConfig {
  apiKey: string
  baseUrl: string
  environment: 'sandbox' | 'production'
}

export interface NLIMSSubmissionResult {
  reference: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: string
}

export async function submitToNLIMS(
  _payload: unknown,
  _config: NLIMSConfig,
): Promise<NLIMSSubmissionResult> {
  throw new Error(
    'NLIMS integration not yet implemented. Use src/lib/export/nlimsExporter.ts ' +
    'for export-side logic, and submit manually via the NLIMS portal.'
  )
}

export function isNLIMSConfigured(): boolean {
  return Boolean(process.env.NLIMS_API_KEY)
}
