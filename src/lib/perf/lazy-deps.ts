// ──────────────────────────────────────────────────────────────────────────
// METARDU — Lazy-Loaded Heavy Dependencies
// ──────────────────────────────────────────────────────────────────────────
// These modules are 500KB+ each. Importing them eagerly bloats the main
// bundle and slows initial page load. Use these lazy wrappers instead.
//
// Usage:
//   // Instead of: import * as THREE from 'three'
//   const THREE = await loadThree();
//
//   // Instead of: import { Map } from 'ol'
//   const ol = await loadOpenLayers();
//
//   // For React components, use next/dynamic:
//   const MapView = dynamic(() => import('@/components/map/SurveyMap'))
// ──────────────────────────────────────────────────────────────────────────

// ─── Three.js (~600KB) ──────────────────────────────────────────────────
let threeCache: typeof import('three') | null = null;

export async function loadThree() {
  if (!threeCache) {
    threeCache = await import('three');
  }
  return threeCache;
}

// ─── OpenLayers (~400KB) ────────────────────────────────────────────────
let olCache: typeof import('ol') | null = null;

export async function loadOpenLayers() {
  if (!olCache) {
    olCache = await import('ol');
  }
  return olCache;
}

// ─── jsPDF (~300KB) ────────────────────────────────────────────────────
let jspdfCache: typeof import('jspdf') | null = null;

export async function loadJsPDF() {
  if (!jspdfCache) {
    jspdfCache = await import('jspdf');
    // Also load autotable plugin
    await import('jspdf-autotable');
  }
  return jspdfCache;
}

// ─── Konva (~200KB) ────────────────────────────────────────────────────
let konvaCache: typeof import('konva') | null = null;

export async function loadKonva() {
  if (!konvaCache) {
    konvaCache = await import('konva');
  }
  return konvaCache;
}

// ─── ReactFlow (~200KB) ────────────────────────────────────────────────
let reactflowCache: typeof import('reactflow') | null = null;

export async function loadReactFlow() {
  if (!reactflowCache) {
    reactflowCache = await import('reactflow');
    // Import default styles
    await import('reactflow/dist/style.css');
  }
  return reactflowCache;
}

// ─── ExcelJS (~400KB) ──────────────────────────────────────────────────
let exceljsCache: typeof import('exceljs') | null = null;

export async function loadExcelJS() {
  if (!exceljsCache) {
    exceljsCache = await import('exceljs');
  }
  return exceljsCache;
}

// ─── PDFKit (~300KB) ───────────────────────────────────────────────────
// Note: PDFKit is server-only (uses Node canvas)
let pdfkitCache: typeof import('pdfkit') | null = null;

export async function loadPDFKit() {
  if (!pdfkitCache) {
    const mod = await import('pdfkit');
    pdfkitCache = mod.default || mod;
  }
  return pdfkitCache;
}

// ─── d3-contour ────────────────────────────────────────────────────────
let d3ContourCache: typeof import('d3-contour') | null = null;

export async function loadD3Contour() {
  if (!d3ContourCache) {
    d3ContourCache = await import('d3-contour');
  }
  return d3ContourCache;
}

// ─── Bundle size reporter (dev only) ───────────────────────────────────

/**
 * Log which heavy deps have been loaded. Call in dev to audit bundle usage.
 */
export function reportLoadedDeps() {
  if (process.env.NODE_ENV !== 'development') return;

  const deps = [
    { name: 'three', loaded: !!threeCache },
    { name: 'ol', loaded: !!olCache },
    { name: 'jspdf', loaded: !!jspdfCache },
    { name: 'konva', loaded: !!konvaCache },
    { name: 'reactflow', loaded: !!reactflowCache },
    { name: 'exceljs', loaded: !!exceljsCache },
    { name: 'pdfkit', loaded: !!pdfkitCache },
    { name: 'd3-contour', loaded: !!d3ContourCache },
  ];

  const loaded = deps.filter(d => d.loaded);
  const notLoaded = deps.filter(d => !d.loaded);

  console.log(`[LazyDeps] Loaded: ${loaded.map(d => d.name).join(', ') || 'none'}`);
  console.log(`[LazyDeps] Not loaded: ${notLoaded.map(d => d.name).join(', ') || 'none'}`);
}
