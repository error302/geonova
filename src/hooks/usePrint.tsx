'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Printer, ChevronDown } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PaperSize = 'a4' | 'a3' | 'a1';
export type Orientation = 'portrait' | 'landscape';

export interface PrintOptions {
  /** Paper size. Default 'a4'. */
  paperSize?: PaperSize;
  /** Page orientation. Default 'landscape'. */
  orientation?: Orientation;
  /** CSS selector for the element to isolate during print.
   *  If provided, only this element (and its children) will be visible.
   *  If omitted, the full page prints with nav/sidebar hidden. */
  printTarget?: string;
  /** Document title shown in the print header. */
  title?: string;
  /** Subtitle / description for the print header. */
  subtitle?: string;
  /** Show METARDU branding header. Default true. */
  showBranding?: boolean;
}

const PAPER_LABELS: Record<PaperSize, string> = {
  a4: 'A4',
  a3: 'A3',
  a1: 'A1',
};

const ORIENT_LABELS: Record<Orientation, string> = {
  portrait: 'Portrait',
  landscape: 'Landscape',
};

/* ------------------------------------------------------------------ */
/*  Print CSS injection                                                */
/* ------------------------------------------------------------------ */

let injectedEl: HTMLStyleElement | null = null;
let cleanupFn: (() => void) | null = null;

function injectPrintCSS(options: PrintOptions): void {
  if (injectedEl) return;

  const paperSize = options.paperSize ?? 'a4';
  const orientation = options.orientation ?? 'landscape';
  const target = options.printTarget;

  const targetRule = target
    ? `
    /* Hide everything except print target */
    body > *:not(#${target}) {
      display: none !important;
    }

    #${target} {
      position: static !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 12mm !important;
      overflow: visible !important;
      z-index: auto !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }

    /* Expand scrollable containers */
    #${target} * {
      overflow: visible !important;
      max-height: none !important;
    }
    `
    : '';

  const brandingHTML = options.showBranding !== false && options.title
    ? `
    .metardu-print-header {
      display: flex !important;
      flex-direction: column;
      align-items: center;
      margin-bottom: 6mm;
      padding-bottom: 4mm;
      border-bottom: 2px solid #1B3A5C;
      page-break-after: avoid;
    }

    .metardu-print-header h1 {
      font-size: 16pt;
      color: #1B3A5C;
      margin: 0 0 2mm 0;
      font-family: 'Geist', system-ui, sans-serif;
    }

    .metardu-print-header p {
      font-size: 9pt;
      color: #666;
      margin: 0;
    }
    `
    : `
    .metardu-print-header {
      display: none !important;
    }
    `;

  const css = `
    @media print {
      @page {
        size: ${paperSize} ${orientation};
        margin: 10mm;
      }

      /* Reset dark theme to white */
      html, body {
        background: white !important;
        color: black !important;
        font-size: 11pt;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* Hide navigation, sidebar, buttons, feedback widgets */
      nav, .sidebar, button, .btn, .no-print,
      .feedback-widget, .mobile-nav, .aside, header nav,
      .print-hide, [data-print="hide"] {
        display: none !important;
      }

      /* Make cards, panels white with subtle borders */
      .card, .results-panel, .calculation-output, main {
        background: white !important;
        color: black !important;
        border: 1px solid #ddd !important;
        page-break-inside: avoid;
        box-shadow: none !important;
        border-radius: 0 !important;
      }

      /* Card headers */
      .card-header {
        background: #f5f5f5 !important;
        color: black !important;
        border-bottom: 1px solid #ccc !important;
      }

      /* Tables */
      table {
        border-collapse: collapse !important;
        width: 100% !important;
      }

      th, td {
        border: 1px solid #bbb !important;
        padding: 6px 8px !important;
        color: black !important;
        background: white !important;
      }

      thead {
        display: table-header-group !important;
      }

      thead th {
        background: #f0f0f0 !important;
        color: #333 !important;
        font-weight: bold !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* Sticky header fix for print */
      thead th, thead tr {
        position: static !important;
      }

      /* Inputs — show value as plain text */
      input, select, textarea {
        border: none !important;
        background: transparent !important;
        color: black !important;
        box-shadow: none !important;
        padding: 2px !important;
      }

      /* Links */
      a {
        color: black !important;
        text-decoration: underline !important;
      }

      /* Fix color-coded elements for print */
      .result-positive, .text-green-400, .text-green-500, .text-green-600 {
        color: #166534 !important;
      }

      .result-negative, .text-red-400, .text-red-500, .text-red-600 {
        color: #991b1b !important;
      }

      .result-accent, .text-[var(--accent)] {
        color: #c2410c !important;
      }

      /* Metric displays */
      .metric {
        background: #f9f9f9 !important;
        border: 1px solid #ddd !important;
        color: black !important;
      }

      .metric-value {
        color: #1B3A5C !important;
      }

      .metric-label {
        color: #666 !important;
      }

      /* Badges */
      .badge-success, .bg-green-50, .bg-emerald-50 {
        background: #dcfce7 !important;
        color: #166534 !important;
      }

      .badge-error, .bg-red-50 {
        background: #fee2e2 !important;
        color: #991b1b !important;
      }

      .badge-warning, .bg-amber-50 {
        background: #fef3c7 !important;
        color: #92400e !important;
      }

      /* Sheet layout overlays */
      .sheet-layout-overlay {
        display: block !important;
      }

      .sheet-title-block, .sheet-certificate {
        break-inside: avoid;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      /* Map canvas */
      .ol-viewport canvas {
        max-width: 100% !important;
      }

      /* Avoid orphaned headers */
      h2, h3, h4 {
        page-break-after: avoid;
      }

      /* SVG scaling */
      svg {
        max-width: 100% !important;
        height: auto !important;
      }

      /* Scrollbar — hide in print */
      ::-webkit-scrollbar {
        display: none !important;
      }

      ${brandingHTML}

      ${targetRule}

      /* Print footer with page number */
      @page {
        @bottom-center {
          content: "METARDU — Page " counter(page) " of " counter(pages);
          font-size: 8pt;
          color: #999;
        }
      }
    }

    /* Print header (hidden on screen) */
    .metardu-print-header {
      display: none;
    }
  `;

  injectedEl = document.createElement('style');
  injectedEl.id = 'metardu-dynamic-print-css';
  injectedEl.textContent = css;
  document.head.appendChild(injectedEl);
}

function removePrintCSS(): void {
  if (injectedEl) {
    injectedEl.remove();
    injectedEl = null;
  }
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}

/* ------------------------------------------------------------------ */
/*  usePrint Hook                                                      */
/* ------------------------------------------------------------------ */

export function usePrint(defaultOptions?: PrintOptions) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize>(defaultOptions?.paperSize ?? 'a4');
  const [orientation, setOrientation] = useState<Orientation>(defaultOptions?.orientation ?? 'landscape');
  const prevPrintTarget = useRef<string | undefined>(defaultOptions?.printTarget);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update target ref when prop changes
  useEffect(() => {
    prevPrintTarget.current = defaultOptions?.printTarget;
  }, [defaultOptions?.printTarget]);

  // Cleanup on unmount: clear any pending fallback timer and remove injected CSS
  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      removePrintCSS();
    };
  }, []);

  const print = useCallback(
    async (overrides?: Partial<PrintOptions>) => {
      const opts: PrintOptions = {
        paperSize,
        orientation,
        ...defaultOptions,
        ...overrides,
      };

      // Clear any previous fallback timer
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }

      setIsPrinting(true);
      injectPrintCSS(opts);

      // Allow the browser to repaint with injected styles
      await new Promise((resolve) => setTimeout(resolve, 350));

      window.print();

      // Clean up after print dialog closes
      const onAfterPrint = () => {
        if (fallbackTimerRef.current !== null) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        removePrintCSS();
        setIsPrinting(false);
        window.removeEventListener('afterprint', onAfterPrint);
      };
      window.addEventListener('afterprint', onAfterPrint);

      // Fallback cleanup — stored in ref so unmount can clear it
      fallbackTimerRef.current = setTimeout(() => {
        removePrintCSS();
        setIsPrinting(false);
        fallbackTimerRef.current = null;
      }, 6000);
    },
    [paperSize, orientation, defaultOptions]
  );

  return {
    print,
    isPrinting,
    paperSize,
    setPaperSize,
    orientation,
    setOrientation,
    /** Convenience: print immediately with A4 landscape */
    printA4: useCallback(() => print({ paperSize: 'a4', orientation: 'landscape' }), [print]),
    /** Convenience: print immediately with A3 landscape */
    printA3: useCallback(() => print({ paperSize: 'a3', orientation: 'landscape' }), [print]),
  };
}

/* ------------------------------------------------------------------ */
/*  PrintButton Component                                              */
/* ------------------------------------------------------------------ */

export interface PrintButtonProps {
  /** usePrint hook instance */
  print: (overrides?: Partial<PrintOptions>) => Promise<void>;
  isPrinting?: boolean;
  paperSize: PaperSize;
  setPaperSize: (size: PaperSize) => void;
  orientation: Orientation;
  setOrientation: (orient: Orientation) => void;
  /** Compact mode — icon only. Default false. */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Target CSS selector for print isolation */
  printTarget?: string;
  /** Document title for print header */
  printTitle?: string;
  /** Document subtitle for print header */
  printSubtitle?: string;
}

export function PrintButton({
  print,
  isPrinting = false,
  paperSize,
  setPaperSize,
  orientation,
  setOrientation,
  compact = false,
  className = '',
  printTarget,
  printTitle,
  printSubtitle,
}: PrintButtonProps) {
  const [showOptions, setShowOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showOptions) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showOptions]);

  const handlePrint = () => {
    setShowOptions(false);
    print({
      paperSize,
      orientation,
      printTarget,
      title: printTitle,
      subtitle: printSubtitle,
    });
  };

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handlePrint}
          disabled={isPrinting}
          className={`p-2 rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors text-[var(--text-secondary)] hover:text-[var(--accent)] no-print print-hide ${className}`}
          title="Print document"
        >
          <Printer className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative no-print print-hide" ref={dropdownRef}>
      {/* Main button */}
      <button
        onClick={handlePrint}
        disabled={isPrinting}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-[#1B3A5C] text-white rounded-lg text-sm font-semibold hover:bg-[#1B3A5C]/90 transition-colors disabled:opacity-50 ${className}`}
      >
        <Printer className="w-4 h-4" />
        {isPrinting ? 'Preparing...' : 'Print'}
      </button>

      {/* Options toggle */}
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="inline-flex items-center ml-1 px-2 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
        title="Print options"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {/* Dropdown */}
      {showOptions && (
        <div className="absolute right-0 top-full mt-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-xl p-3 z-50 min-w-[180px] space-y-3">
          <div>
            <div className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
              Paper Size
            </div>
            <div className="flex gap-1">
              {(['a4', 'a3', 'a1'] as PaperSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setPaperSize(size)}
                  className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded border transition-colors ${
                    paperSize === size
                      ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                      : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                  }`}
                >
                  {PAPER_LABELS[size]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
              Orientation
            </div>
            <div className="flex gap-1">
              {(['portrait', 'landscape'] as Orientation[]).map((orient) => (
                <button
                  key={orient}
                  onClick={() => setOrientation(orient)}
                  className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded border transition-colors ${
                    orientation === orient
                      ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                      : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                  }`}
                >
                  {ORIENT_LABELS[orient]}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-[var(--text-muted)] border-t border-[var(--border-color)] pt-2">
            Prints to connected printer via browser dialog. Save as PDF option available.
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PrintHeader Component (visible only during print)                  */
/* ------------------------------------------------------------------ */

export interface PrintHeaderProps {
  title: string;
  subtitle?: string;
}

export function PrintHeader({ title, subtitle }: PrintHeaderProps) {
  return (
    <div className="metardu-print-header no-print" aria-hidden="true">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      <p style={{ fontSize: '8pt', color: '#999', marginTop: '2mm' }}>
        Generated by METARDU &mdash; {new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </p>
    </div>
  );
}

export default usePrint;
