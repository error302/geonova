import { computePolygonArea } from '@/math/area';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/client';
import { computeDeedPlanGeometry } from './deedPlanGeometry';

export async function generateBoundaryShapefile(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<Buffer> {
  const { data: project } = await supabase
    .from('projects')
    .select('name, utm_zone, hemisphere')
    .eq('id', projectId)
    .single();

  if (!project) throw new Error('Project not found');

  const geom = await computeDeedPlanGeometry(projectId, supabase);

  const beacons = geom.stations.map((s, i) => ({
    name: s.station,
    e: s.easting,
    n: s.northing,
    beaconNo: s.beaconNo,
  }));

  const zip = new JSZip();

  const geoJson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [beacons.map((b: any) => [b.e, b.n]).concat([[beacons[0].e, beacons[0].n]])]
      },
      properties: {
        project: project.name,
        area_m2: geom.areaM2,
        area_ha: geom.areaHa,
        surveyed_date: new Date().toISOString().split('T')[0],
        rdm_compliant: true
      }
    }]
  };

  zip.file(`${project.name}_Boundary.geojson`, JSON.stringify(geoJson, null, 2));

  const zone = project.utm_zone || 37;
  const hemisphere = project.hemisphere || 'S';
  const prjContent = `PROJCS["Arc 1960 / UTM zone ${zone}${hemisphere}",GEOGCS["Arc 1960",DATUM["Arc_1960",SPHEROID["Clarke_1880_RGS",6378249.145,293.465]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",${zone * 6 - 183}],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",${hemisphere === 'S' ? 10000000 : 0}],UNIT["metre",1]]`;

  zip.file(`${project.name}_Boundary.prj`, prjContent);

  const blob = await zip.generateAsync({ type: 'nodebuffer' });
  return Buffer.from(blob);
}

