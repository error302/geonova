// pdfjs-dist v5 API — note: GlobalWorkerOptions must be set before getDocument()
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { GeoPDFLayer } from '@/types/field';

let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPDFJS() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist');
  // v5: worker is bundled separately — point to the CDN build
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

export interface RenderedPDF {
  dataUrl: string;   // PNG base64
  widthPx: number;
  heightPx: number;
}

export async function renderPDFPageToDataURL(
  file: File,
  pageNumber = 1,
  scale = 2.0            // 2x for retina — keeps map overlay sharp at zoom
): Promise<RenderedPDF> {
  const lib = await getPDFJS();
  const arrayBuffer = await file.arrayBuffer();
  const pdf: PDFDocumentProxy = await lib.getDocument({ data: arrayBuffer }).promise;
  const page: PDFPageProxy = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  const renderParams: import('pdfjs-dist/types/src/display/api').RenderParameters = { canvasContext: ctx, canvas: ctx.canvas, viewport };
  await page.render(renderParams).promise;

  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthPx: viewport.width,
    heightPx: viewport.height,
  };
}

// Build an OpenLayers ImageStatic layer from a GeoPDFLayer with 4 GCPs.
// GCPs define the bounding box: min/max lat/lng of the 4 corners.
// OL imports are done via require() since this function is only called
// inside MapViewer's browser-only useEffect via dynamic import.
export function buildOLGeoPDFLayer(layer: GeoPDFLayer): import('ol/layer/Base').default {
  // Browser-only dynamic require (SSR-safe, see note above).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: ImageLayer } = require('ol/layer/Image') as typeof import('ol/layer/Image');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: ImageStatic } = require('ol/source/ImageStatic') as typeof import('ol/source/ImageStatic');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { transformExtent } = require('ol/proj') as typeof import('ol/proj');

  const lats = layer.gcps.map((g) => g.lat);
  const lngs = layer.gcps.map((g) => g.lng);
  const extent4326: [number, number, number, number] = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
  // Convert extent from WGS84 → EPSG:3857 for OpenLayers
  const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');

  return new ImageLayer({
    source: new ImageStatic({
      url: layer.dataUrl,
      imageExtent: extent3857,
      projection: 'EPSG:3857',
    }),
    opacity: 0.75,
    visible: layer.visible,
  });
}
