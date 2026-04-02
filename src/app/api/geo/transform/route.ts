import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { transformCoordinates, TransformInput } from '@/lib/geo/transform';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: TransformInput & { projectId?: string } = await req.json();

  if (!body.points?.length || !body.fromCRS || !body.toCRS) {
    return NextResponse.json({ error: 'Missing points, fromCRS, or toCRS' }, { status: 400 });
  }

  if (body.points.length > 5000) {
    return NextResponse.json({ error: 'Maximum 5000 points per request' }, { status: 400 });
  }

  try {
    const result = transformCoordinates(body);

    await supabase.from('online_service_logs').insert({
      user_id: session.user.id,
      project_id: body.projectId ?? null,
      service: 'coordinate-transform',
      input_summary: `${body.points.length} points, ${body.fromCRS} → ${body.toCRS}`,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
