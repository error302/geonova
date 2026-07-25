/**
 * Parcel Search — Kenya land registry search
 *
 * STUB MODULE (2026-05-29): The actual parcel search service is not yet
 * implemented. This file exists so that `src/lib/parcel/index.ts` can
 * re-export it without TypeScript errors. When the integration is built,
 * replace this stub with the real client (likely wrapping the Ardhisasa
 * API at src/lib/integrations/ardhisasaClient.ts).
 */

export interface ParcelSearchResult {
  parcelNumber: string
  lrNumber: string
  county: string
  subCounty: string
  area: number
  status: 'active' | 'pending' | 'archived'
}

export interface ParcelSearchParams {
  query: string
  county?: string
  limit?: number
}

export async function searchParcels(
  _params: ParcelSearchParams,
): Promise<ParcelSearchResult[]> {
  throw new Error(
    'Parcel search not yet implemented. Use the Ardhisasa client ' +
    '(src/lib/integrations/ardhisasaClient.ts) directly for live lookups.'
  )
}
