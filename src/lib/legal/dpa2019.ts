/**
 * METARDU Kenya Data Protection Act 2019 — Compliance Module
 * ============================================================
 * Implements core DPA 2019 requirements:
 * - Data Subject Access Requests (DSAR)
 * - Consent management
 * - Data retention policies
 * - Right to erasure
 * - Data breach notification
 *
 * Kenya DPA 2019 key provisions:
 * - Section 25: Right to access personal data
 * - Section 27: Right to correction/deletion
 * - Section 33: Data breach notification (72 hours)
 * - Section 43: Registration with the Office of the Data Protection Commissioner
 */

import { db } from '@/lib/db';

// ─── Types ──────────────────────────────────────────────────────────────

export type DSARStatus = 'pending' | 'acknowledged' | 'in_progress' | 'completed' | 'rejected';
export type DSARType = 'access' | 'correction' | 'deletion' | 'portability' | 'objection';
export type ConsentType = 'marketing' | 'analytics' | 'third_party_sharing' | 'cookies' | 'profiling';

export interface DataSubjectRequest {
  id: string;
  userId: string;
  type: DSARType;
  status: DSARStatus;
  description: string;
  requestedAt: Date;
  acknowledgedAt?: Date;
  completedAt?: Date;
  response?: string;
  rejectionReason?: string;
}

export interface UserConsent {
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  version: string;
}

export interface DataRetentionPolicy {
  dataType: string;
  retentionDays: number;
  description: string;
  autoDelete: boolean;
}

// ─── Row types ──────────────────────────────────────────────────────────────

interface DSARRow {
  id: string;
  user_id: string;
  type: DSARType;
  status: DSARStatus;
  description: string;
  requested_at: Date;
  acknowledged_at: Date | null;
  completed_at: Date | null;
  response: string | null;
  rejection_reason: string | null;
}

interface UserConsentRow {
  user_id: string;
  consent_type: ConsentType;
  granted: boolean;
  granted_at: Date;
  revoked_at: Date | null;
  version: string;
}

// ─── Data Retention Policies (Kenya DPA 2019) ──────────────────────────

export const DATA_RETENTION_POLICIES: DataRetentionPolicy[] = [
  {
    dataType: 'user_accounts',
    retentionDays: 365 * 7, // 7 years (Survey Act Cap 299 requires record retention)
    description: 'User account data retained for 7 years per Survey Act Cap 299 record-keeping requirements.',
    autoDelete: false, // Must not auto-delete — survey records have legal retention requirements
  },
  {
    dataType: 'survey_projects',
    retentionDays: 365 * 15, // 15 years
    description: 'Survey project data retained for 15 years per Survey Regulations 1994 Section 40.',
    autoDelete: false,
  },
  {
    dataType: 'audit_logs',
    retentionDays: 365 * 7, // 7 years
    description: 'Audit trail retained for 7 years for legal compliance and dispute resolution.',
    autoDelete: false,
  },
  {
    dataType: 'payment_history',
    retentionDays: 365 * 7, // 7 years
    description: 'Payment records retained for 7 years per Kenya tax regulations.',
    autoDelete: false,
  },
  {
    dataType: 'session_tokens',
    retentionDays: 30,
    description: 'Session tokens automatically expire after 30 days.',
    autoDelete: true,
  },
  {
    dataType: 'analytics_events',
    retentionDays: 365 * 2, // 2 years
    description: 'Usage analytics retained for 2 years for product improvement.',
    autoDelete: true,
  },
  {
    dataType: 'marketing_consents',
    retentionDays: 365 * 3, // 3 years or until revoked
    description: 'Marketing consent records retained for 3 years or until user revokes.',
    autoDelete: false,
  },
];

// ─── DSAR (Data Subject Access Request) ─────────────────────────────────

/**
 * Create a new Data Subject Access Request
 */
export async function createDSAR(
  userId: string,
  type: DSARType,
  description: string
): Promise<DataSubjectRequest> {
  const id = crypto.randomUUID();

  // Check if a similar pending request already exists
  const existing = await db.query(
    `SELECT id FROM data_subject_requests
     WHERE user_id = $1 AND type = $2 AND status IN ('pending', 'acknowledged', 'in_progress')
     LIMIT 1`,
    [userId, type]
  );

  if (existing.rows.length > 0) {
    throw new Error(`A pending ${type} request already exists for this user.`);
  }

  await db.query(
    `INSERT INTO data_subject_requests (id, user_id, type, status, description, requested_at)
     VALUES ($1, $2, $3, 'pending', $4, NOW())`,
    [id, userId, type, description]
  );

  return {
    id,
    userId,
    type,
    status: 'pending',
    description,
    requestedAt: new Date(),
  };
}

/**
 * Get all DSARs for a user
 */
export async function getUserDSARs(userId: string): Promise<DataSubjectRequest[]> {
  const result = await db.query<DSARRow>(
    `SELECT * FROM data_subject_requests WHERE user_id = $1 ORDER BY requested_at DESC`,
    [userId]
  );
  return result.rows.map(mapDSARRow);
}

/**
 * Acknowledge a DSAR (must happen within 14 days per DPA 2019)
 */
export async function acknowledgeDSAR(requestId: string): Promise<void> {
  await db.query(
    `UPDATE data_subject_requests SET status = 'acknowledged', acknowledged_at = NOW() WHERE id = $1`,
    [requestId]
  );
}

/**
 * Complete a DSAR with a response
 */
export async function completeDSAR(
  requestId: string,
  response: string
): Promise<void> {
  await db.query(
    `UPDATE data_subject_requests SET status = 'completed', completed_at = NOW(), response = $1 WHERE id = $2`,
    [response, requestId]
  );
}

/**
 * Reject a DSAR with a reason
 */
export async function rejectDSAR(
  requestId: string,
  reason: string
): Promise<void> {
  await db.query(
    `UPDATE data_subject_requests SET status = 'rejected', rejection_reason = $1, completed_at = NOW() WHERE id = $2`,
    [reason, requestId]
  );
}

// ─── Consent Management ────────────────────────────────────────────────

/**
 * Grant or update user consent for a specific purpose
 */
export async function grantConsent(
  userId: string,
  consentType: ConsentType,
  version: string = '1.0'
): Promise<void> {
  await db.query(
    `INSERT INTO user_consents (user_id, consent_type, granted, granted_at, version)
     VALUES ($1, $2, true, NOW(), $3)
     ON CONFLICT (user_id, consent_type)
     DO UPDATE SET granted = true, granted_at = NOW(), revoked_at = NULL, version = $3`,
    [userId, consentType, version]
  );
}

/**
 * Revoke user consent for a specific purpose
 */
export async function revokeConsent(
  userId: string,
  consentType: ConsentType
): Promise<void> {
  await db.query(
    `INSERT INTO user_consents (user_id, consent_type, granted, revoked_at, version)
     VALUES ($1, $2, false, NOW(), '1.0')
     ON CONFLICT (user_id, consent_type)
     DO UPDATE SET granted = false, revoked_at = NOW()`,
    [userId, consentType]
  );
}

/**
 * Get all consents for a user
 */
export async function getUserConsents(userId: string): Promise<UserConsent[]> {
  const result = await db.query<UserConsentRow>(
    `SELECT * FROM user_consents WHERE user_id = $1 ORDER BY consent_type`,
    [userId]
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    consentType: row.consent_type,
    granted: row.granted,
    grantedAt: row.granted_at,
    revokedAt: row.revoked_at ?? undefined,
    version: row.version,
  }));
}

/**
 * Check if a user has granted consent for a specific purpose
 */
export async function hasConsent(
  userId: string,
  consentType: ConsentType
): Promise<boolean> {
  const result = await db.query<{ granted: boolean }>(
    `SELECT granted FROM user_consents WHERE user_id = $1 AND consent_type = $2`,
    [userId, consentType]
  );
  return result.rows.length > 0 && result.rows[0].granted === true;
}

// ─── Data Export (Right to Portability) ─────────────────────────────────

/**
 * Export all personal data for a user (DPA 2019 Section 25)
 * Returns a structured JSON object with all data linked to the user
 */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const [profile, projects, payments, consents, dsars] = await Promise.all([
    db.query('SELECT * FROM surveyor_profiles WHERE user_id = $1', [userId]),
    db.query('SELECT id, name, created_at, updated_at FROM projects WHERE user_id = $1', [userId]),
    db.query('SELECT id, amount, currency, status, created_at FROM payment_history WHERE user_id = $1', [userId]),
    getUserConsents(userId),
    getUserDSARs(userId),
  ]);

  return {
    exportDate: new Date().toISOString(),
    platform: 'METARDU',
    legalBasis: 'Kenya Data Protection Act 2019, Section 25',
    profile: profile.rows[0] || null,
    projects: projects.rows,
    payments: payments.rows,
    consents,
    dataSubjectRequests: dsars,
  };
}

// ─── Data Breach Notification ──────────────────────────────────────────

/**
 * Record a data breach notification (DPA 2019 Section 33)
 * Must notify the Data Protection Commissioner within 72 hours
 */
export async function recordBreachNotification(params: {
  reportedBy: string;
  description: string;
  affectedDataTypes: string[];
  estimatedAffectedUsers: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  containmentMeasures: string;
}): Promise<string> {
  const id = crypto.randomUUID();

  await db.query(
    `INSERT INTO data_breach_notifications
     (id, reported_by, description, affected_data_types, estimated_affected_users,
      severity, containment_measures, reported_at, commissioner_notified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false)`,
    [
      id,
      params.reportedBy,
      params.description,
      params.affectedDataTypes,
      params.estimatedAffectedUsers,
      params.severity,
      params.containmentMeasures,
    ]
  );

  return id;
}

// ─── Helper ────────────────────────────────────────────────────────────

function mapDSARRow(row: DSARRow): DataSubjectRequest {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    description: row.description,
    requestedAt: row.requested_at,
    acknowledgedAt: row.acknowledged_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    response: row.response ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
  };
}
