// ──────────────────────────────────────────────────────────────────────────
// METARDU — Middleware Metrics Tracker
// ──────────────────────────────────────────────────────────────────────────
// Integrates with Next.js middleware to track HTTP request metrics.
//
// Usage — add to your existing middleware.ts:
//
//   import { withMetrics } from '@/lib/monitoring/middleware-tracker';
//
//   export async function middleware(request: NextRequest) {
//     return withMetrics(request, async () => {
//       // ... your existing middleware logic ...
//       return NextResponse.next();
//     });
//   }
// ──────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpActiveRequests,
  httpRequestSize,
  httpResponseSize,
} from './metrics';

/**
 * Wrap a middleware handler with Prometheus metrics tracking.
 *
 * @param request - The incoming Next.js request
 * @param handler - Your middleware logic (must return a NextResponse)
 * @returns The response from the handler, with metrics recorded
 */
export async function withMetrics(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  const method = request.method;
  const pathname = request.nextUrl.pathname;

  // Normalize path to avoid high cardinality labels
  // e.g., /projects/abc123 → /projects/[id]
  const normalizedPath = normalizePath(pathname);

  // Skip metrics for static assets and the metrics endpoint itself
  if (shouldSkipMetrics(pathname)) {
    return handler();
  }

  httpActiveRequests.inc();

  // Track request body size
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    httpRequestSize.observe({ method, path: normalizedPath }, parseInt(contentLength, 10));
  }

  const startTime = performance.now();

  try {
    const response = await handler();

    const duration = (performance.now() - startTime) / 1000;
    const statusCode = String(response.status);

    httpRequestsTotal.inc({ method, path: normalizedPath, status_code: statusCode });
    httpRequestDuration.observe({ method, path: normalizedPath, status_code: statusCode }, duration);

    // Track response size if available
    const responseContentLength = response.headers.get('content-length');
    if (responseContentLength) {
      httpResponseSize.observe({ method, path: normalizedPath }, parseInt(responseContentLength, 10));
    }

    return response;
  } catch (err) {
    const duration = (performance.now() - startTime) / 1000;

    httpRequestsTotal.inc({ method, path: normalizedPath, status_code: '500' });
    httpRequestDuration.observe({ method, path: normalizedPath, status_code: '500' }, duration);

    throw err;
  } finally {
    httpActiveRequests.dec();
  }
}

// ─── Path Normalization ──────────────────────────────────────────────────

/**
 * Normalize dynamic route segments to avoid high cardinality.
 *
 * Examples:
 *   /projects/abc123       → /projects/[id]
 *   /projects/abc123/edit  → /projects/[id]/edit
 *   /api/survey/audit?id=x → /api/survey/audit
 *   /users/123/profile     → /users/[id]/profile
 */
export function normalizePath(pathname: string): string {
  // Skip static assets
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/)
  ) {
    return '/_next/static';
  }

  // Normalize dynamic segments
  const segments = pathname.split('/').filter(Boolean);
  const normalized = segments.map((segment, index) => {
    // UUID pattern
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
      return '[id]';
    }
    // CUID pattern (starts with 'c')
    if (/^c[a-z0-9]{24,}$/i.test(segment)) {
      return '[id]';
    }
    // Pure numeric
    if (/^\d+$/.test(segment)) {
      return '[id]';
    }
    // Looks like a hash or encoded ID (long alphanumeric)
    if (segment.length > 20 && /^[a-zA-Z0-9_-]+$/.test(segment)) {
      return '[id]';
    }
    return segment;
  });

  return '/' + normalized.join('/');
}

// ─── Skip Conditions ─────────────────────────────────────────────────────

function shouldSkipMetrics(pathname: string): boolean {
  return (
    pathname === '/api/public/metrics' ||    // Don't track the metrics endpoint itself
    pathname.startsWith('/_next/') ||         // Static assets
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/) !== null
  );
}
