import { MBTilesSession } from '@/types/field';

export async function uploadMBTiles(file: File): Promise<MBTilesSession> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/field/mbtiles/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error ?? 'Upload failed');
  }
  return res.json() as Promise<MBTilesSession>;
}

// buildOLMBTilesLayer is only called inside MapViewer useEffect (browser-only)
// so the OL imports are safe here — this function is dynamically imported
export function buildOLMBTilesLayer(session: MBTilesSession): import('ol/layer/Tile').default {
  // Browser-only dynamic require (SSR-safe, see note above).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: XYZ } = require('ol/source/XYZ');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: TileLayer } = require('ol/layer/Tile');
  
  return new TileLayer({
    source: new XYZ({
      url: `/api/field/mbtiles/tiles/${session.key}/{z}/{x}/{y}`,
      minZoom: session.minZoom,
      maxZoom: session.maxZoom,
    }),
    opacity: 1.0,
  });
}
