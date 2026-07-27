// ──────────────────────────────────────────────────────────────────────────
// METARDU — Conflict Resolution for Offline Sync
// ──────────────────────────────────────────────────────────────────────────
// When a surveyor edits data offline and another user edits the same record
// online, we need to resolve the conflict deterministically.
//
// Strategy: Last-Write-Wins with field-level merge for observations.
// For critical fields (angles, distances), the offline version wins
// because the surveyor was physically at the instrument.
// ──────────────────────────────────────────────────────────────────────────

export interface ConflictEntry<T = Record<string, unknown>> {
  local: T;          // The version saved offline
  remote: T;         // The version on the server
  localTimestamp: number;
  remoteTimestamp: number;
  entity: string;
  entityId: string;
}

export type ResolutionStrategy = 'local-wins' | 'remote-wins' | 'merge' | 'manual';

export interface ResolvedConflict<T = Record<string, unknown>> {
  merged: T;
  strategy: ResolutionStrategy;
  fieldsFromLocal: string[];
  fieldsFromRemote: string[];
  conflictFields: string[];
}

// ─── Field Priority Rules ────────────────────────────────────────────────
// Survey measurement fields: local wins (surveyor was at the instrument)
// Metadata fields: remote wins (server has latest administrative state)
// Timestamps: always use the latest

const LOCAL_PRIORITY_FIELDS = new Set([
  // Raw measurements — the surveyor recorded these physically
  'rawHorizontalAngle',
  'rawVerticalAngle',
  'rawSlopeDistance',
  'temperature',
  'pressure',
  'humidity',
  'instrumentHeight',
  'targetHeight',
  'edmConstant',
  'ppmSetting',
  'observationDate',
  // Station data — field-verified
  'name',
  'type',
  'order',
]);

const REMOTE_PRIORITY_FIELDS = new Set([
  // Computed/corrected values — server is authoritative
  'correctedDistance',
  'correctedHd',
  'correctedVd',
  'correctedBearing',
  'correctionsLog',
  'stdDevDistance',
  'stdDevAngle',
  // Status fields
  'status',
  'computedAt',
  // Audit fields
  'createdAt',
]);

// ─── Resolver ────────────────────────────────────────────────────────────

/**
 * Resolve a conflict between local (offline) and remote (server) versions.
 *
 * @returns The merged result and metadata about what was kept from each side.
 */
export function resolveConflict<T extends Record<string, unknown>>(
  conflict: ConflictEntry<T>
): ResolvedConflict<T> {
  const merged = {} as Record<string, unknown>;
  const fieldsFromLocal: string[] = [];
  const fieldsFromRemote: string[] = [];
  const conflictFields: string[] = [];

  // Collect all keys from both versions
  const allKeys = new Set([
    ...Object.keys(conflict.local),
    ...Object.keys(conflict.remote),
  ]);

  for (const key of allKeys) {
    const localVal = conflict.local[key];
    const remoteVal = conflict.remote[key];

    // If values are identical, keep either (prefer local for consistency)
    if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) {
      merged[key] = localVal;
      continue;
    }

    // If only one side has the field, keep it
    if (localVal === undefined || localVal === null) {
      merged[key] = remoteVal;
      fieldsFromRemote.push(key);
      continue;
    }
    if (remoteVal === undefined || remoteVal === null) {
      merged[key] = localVal;
      fieldsFromLocal.push(key);
      continue;
    }

    // Both sides have different values — apply priority rules
    if (LOCAL_PRIORITY_FIELDS.has(key)) {
      merged[key] = localVal;
      fieldsFromLocal.push(key);
      conflictFields.push(key);
    } else if (REMOTE_PRIORITY_FIELDS.has(key)) {
      merged[key] = remoteVal;
      fieldsFromRemote.push(key);
      conflictFields.push(key);
    } else {
      // Default: use the more recent timestamp
      merged[key] = conflict.localTimestamp >= conflict.remoteTimestamp ? localVal : remoteVal;
      if (conflict.localTimestamp >= conflict.remoteTimestamp) {
        fieldsFromLocal.push(key);
      } else {
        fieldsFromRemote.push(key);
      }
      conflictFields.push(key);
    }
  }

  return {
    merged: merged as T,
    strategy: conflictFields.length > 0 ? 'merge' : 'local-wins',
    fieldsFromLocal,
    fieldsFromRemote,
    conflictFields,
  };
}

/**
 * Check if two versions are actually in conflict (some fields differ).
 */
export function hasConflict<T extends Record<string, unknown>>(local: T, remote: T): boolean {
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const key of allKeys) {
    if (JSON.stringify(local[key]) !== JSON.stringify(remote[key])) {
      // Check if it's a field we auto-merge
      if (!LOCAL_PRIORITY_FIELDS.has(key) && !REMOTE_PRIORITY_FIELDS.has(key)) {
        return true; // Genuine conflict on a non-auto-merge field
      }
    }
  }
  return false;
}

/**
 * Generate a human-readable conflict summary for the audit log.
 */
export function describeConflict<T>(resolved: ResolvedConflict<T>): string {
  if (resolved.conflictFields.length === 0) {
    return 'No conflicts detected — versions were identical.';
  }

  const lines = [
    `Resolved ${resolved.conflictFields.length} conflicting field(s) using ${resolved.strategy} strategy:`,
  ];

  for (const field of resolved.conflictFields) {
    const source = resolved.fieldsFromLocal.includes(field) ? 'LOCAL (offline)' : 'REMOTE (server)';
    lines.push(`  • ${field}: kept ${source} value`);
  }

  return lines.join('\n');
}
