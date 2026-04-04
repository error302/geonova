import { createClient } from '@/lib/supabase/client';
import { computeDeedPlanGeometry } from './deedPlanGeometry';

export async function generateSettingOutDxf(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {
  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .single();

  if (!project) throw new Error('Project not found');

  const geom = await computeDeedPlanGeometry(projectId, supabase);

  const beacons = geom.stations.map((s: any) => ({
    name: s.station,
    e: s.easting,
    n: s.northing,
  }));

  let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1021
9
$INSBASE
10
0.0
20
0.0
30
0.0
9
$EXTMIN
10
0.0
20
0.0
30
0.0
9
$EXTMAX
10
10000.0
20
10000.0
30
0.0
0
ENDSEC
0
SECTION
2
ENTITIES
`;

  beacons.forEach((beacon, i) => {
    dxf += `0
POINT
8
0
10
${beacon.e.toFixed(4)}
20
${beacon.n.toFixed(4)}
30
0.0
`;

    dxf += `0
TEXT
8
0
10
${beacon.e.toFixed(4)}
20
${(beacon.n + 2).toFixed(4)}
40
1.5
1
${beacon.name || `B${i + 1}`}
`;
  });

  for (let i = 0; i < beacons.length; i++) {
    const p1 = beacons[i];
    const p2 = beacons[(i + 1) % beacons.length];

    dxf += `0
LINE
8
0
10
${p1.e.toFixed(4)}
20
${p1.n.toFixed(4)}
11
${p2.e.toFixed(4)}
21
${p2.n.toFixed(4)}
`;
  }

  dxf += `0
ENDSEC
0
EOF
`;

  return Buffer.from(dxf, 'utf-8');
}

