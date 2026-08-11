/**
 * CLA Forms API — Community Land Act 2016 Form Generation
 *
 * GET  /api/cla-forms       → List available form types
 * POST /api/cla-forms       → Generate a specific CLA form PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth/requireAuth';
import { CLA_FORM_REGISTRY } from '@/lib/legal/claForms';
import { CLAFormGenerateSchema } from '@/lib/validation/apiSchemas';

export const dynamic = 'force-dynamic';

/** GET: Return list of available CLA forms */
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  const forms = Object.entries(CLA_FORM_REGISTRY).map(([key, value]) => ({
    formType: key,
    claFormNumber: value.claFormNumber,
    description: value.description,
  }));

  return NextResponse.json({
    success: true,
    data: forms,
  });
}

/** POST: Generate a CLA form PDF */
export async function POST(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rawBody = await request.json().catch(() => null)
    const parsed = CLAFormGenerateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.issues },
        { status: 422 }
      )
    }
    const { formType, data } = parsed.data

    const formEntry = CLA_FORM_REGISTRY[formType];

    if (!formEntry) {
      const available = Object.keys(CLA_FORM_REGISTRY).join(', ');
      return NextResponse.json(
        { success: false, error: `Unknown form type: "${formType}". Available: ${available}` },
        { status: 400 }
      );
    }

    const pdfBytes = formEntry.generator(data as never);

    if (!pdfBytes || pdfBytes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'PDF generation failed — empty output.' },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(pdfBytes);
    const filename = `${formType}_${Date.now()}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during CLA form generation.';
    logger.error('[cla-forms] Generation error:', { message, error });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
