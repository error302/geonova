// ──────────────────────────────────────────────────────────────────────────
// METARDU — Prometheus Metrics
// ──────────────────────────────────────────────────────────────────────────
// Exposes application metrics in Prometheus format at /api/public/metrics.
//
// Metric Categories:
//   1. HTTP Request Metrics (latency, status codes, throughput)
//   2. Survey Computation Metrics (type, duration, accuracy)
//   3. Database Metrics (query duration, pool stats)
//   4. WebSocket/Collaboration Metrics (connections, messages)
//   5. Sync Metrics (offline sync queue, conflicts)
//   6. System Metrics (memory, uptime, version)
//
// Install: npm install prom-client
// ──────────────────────────────────────────────────────────────────────────

import { Registry, Counter, Histogram, Gauge, Summary, collectDefaultMetrics } from 'prom-client';

// ─── Registry ────────────────────────────────────────────────────────────

export const register = new Registry();

// Collect default Node.js metrics (event loop lag, GC, memory, etc.)
collectDefaultMetrics({ register, prefix: 'metardu_' });

// ─── 1. HTTP Request Metrics ─────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name: 'metardu_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'metardu_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestSize = new Summary({
  name: 'metardu_http_request_size_bytes',
  help: 'HTTP request body size in bytes',
  labelNames: ['method', 'path'] as const,
  percentiles: [0.5, 0.9, 0.99],
  registers: [register],
});

export const httpResponseSize = new Summary({
  name: 'metardu_http_response_size_bytes',
  help: 'HTTP response body size in bytes',
  labelNames: ['method', 'path'] as const,
  percentiles: [0.5, 0.9, 0.99],
  registers: [register],
});

export const httpActiveRequests = new Gauge({
  name: 'metardu_http_active_requests',
  help: 'Number of currently active HTTP requests',
  registers: [register],
});

export const routeHitsTotal = new Counter({
  name: 'metardu_route_hits_total',
  help: 'Total API route hits (apiHandler-wrapped routes), by normalized path',
  labelNames: ['method', 'path'] as const,
  registers: [register],
});

// ─── 2. Survey Computation Metrics ──────────────────────────────────────

export const surveyComputationsTotal = new Counter({
  name: 'metardu_survey_computations_total',
  help: 'Total survey computations performed',
  labelNames: ['operation', 'status'] as const,  // operation: traverse, levelling, etc. | status: success, error
  registers: [register],
});

export const surveyComputationDuration = new Histogram({
  name: 'metardu_survey_computation_duration_seconds',
  help: 'Survey computation duration in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

export const surveyAccuracyChecks = new Counter({
  name: 'metardu_survey_accuracy_checks_total',
  help: 'Survey accuracy check results',
  labelNames: ['operation', 'passed'] as const,  // passed: true, false
  registers: [register],
});

export const surveyObservationsProcessed = new Counter({
  name: 'metardu_survey_observations_processed_total',
  help: 'Total observations processed (import, correction, adjustment)',
  labelNames: ['action'] as const,  // action: import, correct, adjust
  registers: [register],
});

export const surveyDocumentsGenerated = new Counter({
  name: 'metardu_survey_documents_generated_total',
  help: 'Survey documents generated (deed plans, reports, etc.)',
  labelNames: ['document_type'] as const,  // deed_plan, traverse_sheet, form_c22, etc.
  registers: [register],
});

// ─── 3. Database Metrics ────────────────────────────────────────────────

export const dbQueryDuration = new Histogram({
  name: 'metardu_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 5],
  registers: [register],
});

export const dbQueryTotal = new Counter({
  name: 'metardu_db_queries_total',
  help: 'Total database queries executed',
  labelNames: ['operation', 'table', 'status'] as const,
  registers: [register],
});

export const dbPoolActiveConnections = new Gauge({
  name: 'metardu_db_pool_active_connections',
  help: 'Number of active database connections in the pool',
  registers: [register],
});

export const dbPoolIdleConnections = new Gauge({
  name: 'metardu_db_pool_idle_connections',
  help: 'Number of idle database connections in the pool',
  registers: [register],
});

export const dbPoolWaitingRequests = new Gauge({
  name: 'metardu_db_pool_waiting_requests',
  help: 'Number of requests waiting for a database connection',
  registers: [register],
});

// ─── 4. WebSocket / Collaboration Metrics ────────────────────────────────

export const wsActiveConnections = new Gauge({
  name: 'metardu_ws_active_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export const wsMessagesTotal = new Counter({
  name: 'metardu_ws_messages_total',
  help: 'Total WebSocket messages sent/received',
  labelNames: ['direction', 'type'] as const,  // direction: in, out | type: edit, cursor, presence
  registers: [register],
});

export const wsConnectionDuration = new Histogram({
  name: 'metardu_ws_connection_duration_seconds',
  help: 'WebSocket connection duration',
  buckets: [10, 60, 300, 900, 1800, 3600, 7200, 14400],
  registers: [register],
});

// ─── 5. Sync Metrics (Offline) ──────────────────────────────────────────

export const syncQueueSize = new Gauge({
  name: 'metardu_sync_queue_size',
  help: 'Number of items in the offline sync queue',
  labelNames: ['entity'] as const,  // observation, station, media
  registers: [register],
});

export const syncOperationsTotal = new Counter({
  name: 'metardu_sync_operations_total',
  help: 'Total sync operations performed',
  labelNames: ['entity', 'status'] as const,  // status: success, conflict, error
  registers: [register],
});

export const syncDuration = new Histogram({
  name: 'metardu_sync_duration_seconds',
  help: 'Duration of sync batch operations',
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

export const syncConflictsTotal = new Counter({
  name: 'metardu_sync_conflicts_total',
  help: 'Total sync conflicts detected',
  labelNames: ['entity', 'resolution'] as const,  // resolution: local-wins, remote-wins, merge, manual
  registers: [register],
});

// ─── 6. System Metrics ──────────────────────────────────────────────────

export const appVersion = new Gauge({
  name: 'metardu_app_version_info',
  help: 'Application version info (always 1, labels carry the value)',
  labelNames: ['version', 'node_version', 'environment'] as const,
  registers: [register],
});

export const activeUsers = new Gauge({
  name: 'metardu_active_users',
  help: 'Number of currently active (authenticated) users',
  registers: [register],
});

export const projectsTotal = new Gauge({
  name: 'metardu_projects_total',
  help: 'Total number of projects in the system',
  labelNames: ['status'] as const,  // active, archived, completed
  registers: [register],
});

// ─── Middleware Helper ────────────────────────────────────────────────────

/**
 * Track an HTTP request. Call at the start and end of request handling.
 *
 * Usage in middleware or API route:
 *   const end = trackHttpRequest(req.method, pathname);
 *   // ... handle request ...
 *   end(statusCode);
 */
export function trackHttpRequest(
  method: string,
  path: string,
): (statusCode: number) => void {
  httpActiveRequests.inc();
  const timer = httpRequestDuration.startTimer({ method, path });
  const startTime = performance.now();

  return (statusCode: number) => {
    const duration = (performance.now() - startTime) / 1000;
    timer({ status_code: String(statusCode) });
    httpRequestsTotal.inc({ method, path, status_code: String(statusCode) });
    httpActiveRequests.dec();
  };
}

/**
 * Track a survey computation.
 *
 * Usage:
 *   const end = trackComputation('traverse_adjustment');
 *   // ... perform computation ...
 *   end('success', true);  // status, accuracyPassed
 */
export function trackComputation(
  operation: string,
): (status: 'success' | 'error', accuracyPassed?: boolean) => void {
  const timer = surveyComputationDuration.startTimer({ operation });
  const startTime = performance.now();

  return (status: 'success' | 'error', accuracyPassed?: boolean) => {
    const duration = (performance.now() - startTime) / 1000;
    timer();
    surveyComputationsTotal.inc({ operation, status });

    if (accuracyPassed !== undefined) {
      surveyAccuracyChecks.inc({ operation, passed: String(accuracyPassed) });
    }
  };
}

/**
 * Track a database query.
 */
export function trackDbQuery(
  operation: string,
  table: string,
): (status?: 'success' | 'error') => void {
  const timer = dbQueryDuration.startTimer({ operation, table });

  return (status: 'success' | 'error' = 'success') => {
    timer();
    dbQueryTotal.inc({ operation, table, status });
  };
}

/**
 * Update database pool gauges from a pg Pool instance.
 * Call periodically (e.g., every 30s) or on pool events.
 */
export function updatePoolStats(pool: {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}): void {
  dbPoolActiveConnections.set(pool.totalCount - pool.idleCount);
  dbPoolIdleConnections.set(pool.idleCount);
  dbPoolWaitingRequests.set(pool.waitingCount);
}

/**
 * Set application version info. Call once at startup.
 */
export function setAppVersion(version: string, environment: string): void {
  appVersion.set(
    { version, node_version: process.version, environment },
    1
  );
}

// ─── Expose as OpenTelemetry-compatible format ───────────────────────────

/**
 * Get all metrics in Prometheus text format.
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get the content type for Prometheus scraping.
 */
export function getContentType(): string {
  return register.contentType;
}
