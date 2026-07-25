export const dynamic = 'force-dynamic'

/**
 * Company Logo Storage API
 *
 * GET  — Returns the user's uploaded company logo (metadata)
 * POST — Upload a new company logo (multipart form data, validates image)
 * DELETE — Remove the company logo
 *
 * Only available to Pro, Team, Firm, and Enterprise users.
 * Free tier keeps the METARDU watermark.
 *
 * Max file size: 2MB
 * Formats: PNG, JPG, SVG
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSubscription } from '@/lib/subscription/subscriptionEngine';
import type { PlanId } from '@/lib/subscription/catalog';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

function isPaidPlan(plan: PlanId): boolean {
  return plan !== 'free';
}

/** GET /api/documents/logo — Return current logo metadata */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    const { rows } = await db.query(
      'SELECT id, filename, mime_type, file_size, width_px, height_px, created_at FROM company_logos WHERE user_id = $1',
      [userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ logo: null });
    }

    const logo = rows[0];
    return NextResponse.json({
      logo: {
        id: logo.id,
        filename: logo.filename,
        mimeType: logo.mime_type,
        fileSize: logo.file_size,
        widthPx: logo.width_px,
        heightPx: logo.height_px,
        createdAt: logo.created_at,
      },
    });
  } catch (error) {
    console.error('[logo-api] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch logo' }, { status: 500 });
  }
}

/** POST /api/documents/logo — Upload a new logo */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    const email = session.user.email ?? undefined;
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    // Check subscription plan
    const subscription = await getSubscription(userId, email);
    const plan: PlanId = subscription?.plan ?? 'free';
    if (!isPaidPlan(plan)) {
      return NextResponse.json(
        { error: 'Company logo upload requires a paid plan (Pro or higher)', plan, upgradeRequired: true },
        { status: 403 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No logo file provided' }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file format. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 2MB' },
        { status: 400 }
      );
    }

    // Read file data
    const arrayBuffer = await file.arrayBuffer();
    const logoData = Buffer.from(arrayBuffer);

    // Upsert the logo (one logo per user)
    await db.query(
      `INSERT INTO company_logos (user_id, filename, mime_type, file_size, logo_data, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET filename = $2, mime_type = $3, file_size = $4, logo_data = $5, updated_at = NOW()`,
      [userId, file.name, file.type, file.size, logoData]
    );

    return NextResponse.json({
      success: true,
      message: 'Logo uploaded successfully',
      logo: {
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
      },
    });
  } catch (error) {
    console.error('[logo-api] POST error:', error);
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}

/** DELETE /api/documents/logo — Remove the company logo */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    const result = await db.query(
      'DELETE FROM company_logos WHERE user_id = $1',
      [userId]
    );

    if ((result as { rowCount?: number }).rowCount === 0) {
      return NextResponse.json({ error: 'No logo to delete' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Logo removed' });
  } catch (error) {
    console.error('[logo-api] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete logo' }, { status: 500 });
  }
}
