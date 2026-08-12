import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/apiHandler';
import { requirePermissionAsync } from '@/lib/auth/rbac';
import { exportAuditCSV, type AuditQuery } from '@/lib/enterprise/auditTrail';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit/export
 *
 * Export audit logs as a CSV file download.
 * Requires `org.audit_log` permission.
 *
 * Query params:
 *   userId, action, resourceType, resourceId,
 *   startDate (ISO string), endDate (ISO string),
 *   limit (number, default 10000, max 10000)
 */
export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const callerId = ctx.userId;

  // Check permission
  const permCheck = await requirePermissionAsync(callerId, 'org.audit_log');
  if (permCheck) return permCheck.response as NextResponse;

  const { searchParams } = new URL(req.url);

  const query: AuditQuery = {
    userId: searchParams.get('userId') || undefined,
    action: searchParams.get('action') || undefined,
    resourceType: searchParams.get('resourceType') || undefined,
    resourceId: searchParams.get('resourceId') || undefined,
    limit: searchParams.has('limit') ? parseInt(searchParams.get('limit') ?? '', 10) : undefined,
  };

  const startDateStr = searchParams.get('startDate');
  if (startDateStr) {
    const parsed = new Date(startDateStr);
    if (!isNaN(parsed.getTime())) {
      query.startDate = parsed;
    }
  }

  const endDateStr = searchParams.get('endDate');
  if (endDateStr) {
    const parsed = new Date(endDateStr);
    if (!isNaN(parsed.getTime())) {
      query.endDate = parsed;
    }
  }

  const csv = await exportAuditCSV(query);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
