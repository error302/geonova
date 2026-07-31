// ──────────────────────────────────────────────────────────────────────────
// METARDU — Instrumented Database Pool
// ──────────────────────────────────────────────────────────────────────────
// Wraps the pg Pool with Prometheus metrics tracking.
// Drop-in replacement for the standard Pool — all queries are automatically
// tracked for duration, status, and connection pool health.
//
// Usage:
//   // In src/lib/db/pool.ts, replace:
//   import { Pool } from 'pg';
//   // With:
//   import { createInstrumentedPool } from '@/lib/monitoring/instrumented-pool';
// ──────────────────────────────────────────────────────────────────────────

import { Pool, PoolClient, QueryResult, PoolConfig, QueryConfig } from 'pg';
import {
  dbQueryDuration,
  dbQueryTotal,
  dbPoolActiveConnections,
  dbPoolIdleConnections,
  dbPoolWaitingRequests,
} from './metrics';

export class InstrumentedPool {
  private pool: Pool;
  private metricsInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: PoolConfig) {
    this.pool = new Pool(config);

    // Update pool gauges every 15 seconds
    this.metricsInterval = setInterval(() => {
      this.updatePoolGauges();
    }, 15000);

    // Track pool errors
    this.pool.on('error', (err) => {
      console.error('[InstrumentedPool] Unexpected error:', err);
      dbQueryTotal.inc({ operation: 'pool_error', table: 'unknown', status: 'error' });
    });
  }

  // ─── Query with Metrics ───────────────────────────────────────────────

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string | QueryConfig,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const operation = this.extractOperation(text);
    const table = this.extractTable(text);
    const labels = { operation, table };

    const timer = dbQueryDuration.startTimer(labels);
    const startTime = performance.now();

    try {
      const result = await this.pool.query<T>(text, params);
      const duration = (performance.now() - startTime) / 1000;

      timer();
      dbQueryTotal.inc({ ...labels, status: 'success' });

      // Log slow queries (> 250ms)
      if (duration > 0.25) {
        console.warn(`[SLOW QUERY] ${duration.toFixed(3)}s`, {
          operation,
          table,
          query: typeof text === 'string' ? text.substring(0, 200) : text.text?.substring(0, 200),
        });
      }

      return result;
    } catch (err) {
      timer();
      dbQueryTotal.inc({ ...labels, status: 'error' });
      throw err;
    }
  }

  // ─── Connection with Metrics ──────────────────────────────────────────

  async connect(): Promise<InstrumentedClient> {
    const client = await this.pool.connect();
    return new InstrumentedClient(client, this);
  }

  // ─── Pool Proxy Methods ───────────────────────────────────────────────

  get totalCount(): number {
    return this.pool.totalCount;
  }

  get idleCount(): number {
    return this.pool.idleCount;
  }

  get waitingCount(): number {
    return this.pool.waitingCount;
  }

  async end(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    await this.pool.end();
  }

  on(event: 'error', listener: (err: Error, client: PoolClient) => void): this;
  on(event: 'connect' | 'acquire' | 'remove', listener: (client: PoolClient) => void): this;
  on(event: string, listener: (...args: any[]) => void): this {
    this.pool.on(event as any, listener);
    return this;
  }

  // ─── Internal ─────────────────────────────────────────────────────────

  private updatePoolGauges(): void {
    dbPoolActiveConnections.set(this.pool.totalCount - this.pool.idleCount);
    dbPoolIdleConnections.set(this.pool.idleCount);
    dbPoolWaitingRequests.set(this.pool.waitingCount);
  }

  private extractOperation(text: string | QueryConfig): string {
    const sql = typeof text === 'string' ? text : text.text || '';
    const trimmed = sql.trim().toUpperCase();

    if (trimmed.startsWith('SELECT')) return 'select';
    if (trimmed.startsWith('INSERT')) return 'insert';
    if (trimmed.startsWith('UPDATE')) return 'update';
    if (trimmed.startsWith('DELETE')) return 'delete';
    if (trimmed.startsWith('CREATE')) return 'create';
    if (trimmed.startsWith('ALTER')) return 'alter';
    if (trimmed.startsWith('DROP')) return 'drop';
    if (trimmed.startsWith('BEGIN')) return 'transaction';
    if (trimmed.startsWith('COMMIT')) return 'transaction';
    if (trimmed.startsWith('ROLLBACK')) return 'transaction';
    return 'other';
  }

  private extractTable(text: string | QueryConfig): string {
    const sql = typeof text === 'string' ? text : text.text || '';
    const trimmed = sql.trim().toUpperCase();

    // Common patterns: FROM table, INTO table, UPDATE table, JOIN table
    const patterns = [
      /(?:FROM|INTO|UPDATE|JOIN)\s+(?:"?(\w+)"?\.")?(\w+)/i,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return (match[2] || match[1]).toLowerCase();
      }
    }

    return 'unknown';
  }
}

// ─── Instrumented Client ─────────────────────────────────────────────────

export class InstrumentedClient {
  constructor(
    private client: PoolClient,
    private pool: InstrumentedPool,
  ) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string | QueryConfig,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  release(err?: Error): void {
    this.client.release(err);
  }

  // Removed invalid rowCount proxy
}

// ─── Factory ─────────────────────────────────────────────────────────────

let instance: InstrumentedPool | null = null;

export function createInstrumentedPool(config?: PoolConfig): InstrumentedPool {
  if (!instance) {
    instance = new InstrumentedPool(config);
  }
  return instance;
}

export function getInstrumentedPool(): InstrumentedPool | null {
  return instance;
}
