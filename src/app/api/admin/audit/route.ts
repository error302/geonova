import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/apiHandler';
import { requirePermissionAsync } from '@/lib/auth/rbac';
import { queryAuditLogs, type AuditQuery } from '@/lib/enterprise/auditTrail';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit
 *
 * Query audit logs with pagination and filters.
 * Requires `org.audit_log` permission.
 *
 * Query params:
 *   userId, action, resourceType, resourceId,
 *   startDate (ISO string), endDate (ISO string),
 *   limit (number, default 50, max 500),
 *   offset (number, default 0)
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
    offset: searchParams.has('offset') ? parseInt(searchParams.get('offset') ?? '', 10) : undefined,
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

  const { events, total } = await queryAuditLogs(query);

  return NextResponse.json({
    data: events,
    pagination: {
      total,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
      hasMore: (query.offset ?? 0) + events.length < total,
    },
  });
});
