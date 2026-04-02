import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { findNearestCORS } from '@/lib/geo/cors';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  if (lat < -5 || lat > 5 || lng < 33 || lng > 42) {
    return NextResponse.json({
      error: 'Coordinates outside Kenya bounds. Ensure you are using geographic coordinates (WGS84).'
    }, { status: 400 });
  }

  const results = findNearestCORS(lat, lng);
  return NextResponse.json({ results });
}
