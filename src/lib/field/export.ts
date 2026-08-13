import { FieldProject } from '@/types/field';

export function projectToGeoJSON(project: FieldProject): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  project.beacons.forEach(b => {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [b.coordinate.lng, b.coordinate.lat] },
      properties: {
        label: b.label,
        beaconType: b.beaconType,
        notes: b.notes ?? '',
        capturedAt: new Date(b.capturedAt).toISOString(),
      },
    });
  });

  project.parcels.forEach(p => {
    if (p.walkPoints.length < 3) return;
    const coords = p.walkPoints.map(wp => [wp.coordinate.lng, wp.coordinate.lat]);
    coords.push(coords[0]); // close ring
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {
        label: p.label,
        areaM2: p.computedAreaM2,
        areaHa: p.computedAreaM2 ? (p.computedAreaM2 / 10000).toFixed(4) : null,
        perimeterM: p.computedPerimeterM,
      },
    });
  });

  return { type: 'FeatureCollection', features };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function exportToKML(project: FieldProject): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '<Document>',
    `  <name>${escapeXml(project.name)}</name>`,
    '  <description>Field data exported from Metardu</description>',
    '',
    '  <!-- Beacon Styles -->',
    '  <Style id="beaconStyle">',
    '    <IconStyle><color>ff00aaff</color><scale>1.2</scale>',
    '      <Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href></Icon>',
    '    </IconStyle>',
    '    <LabelStyle><color>ff00aaff</color><scale>0.9</scale></LabelStyle>',
    '  </Style>',
    '  <Style id="parcelStyle">',
    '    <LineStyle><color>ff00cc44</color><width>2</width></LineStyle>',
    '    <PolyStyle><color>4400cc44</color></PolyStyle>',
    '  </Style>',
    '',
  ];

  // Beacons folder
  if (project.beacons.length > 0) {
    lines.push('  <Folder>');
    lines.push('    <name>Beacons</name>');
    project.beacons.forEach(b => {
      lines.push('    <Placemark>');
      lines.push(`      <name>${escapeXml(b.label)}</name>`);
      lines.push(`      <description>Type: ${b.beaconType}${b.notes ? '\n' + escapeXml(b.notes) : ''}\nAccuracy: ±${b.coordinate.accuracy?.toFixed(1) ?? '?'}m\nCaptured: ${new Date(b.capturedAt).toISOString()}</description>`);
      lines.push('      <styleUrl>#beaconStyle</styleUrl>');
      lines.push(`      <Point><coordinates>${b.coordinate.lng},${b.coordinate.lat},${b.coordinate.altitude ?? 0}</coordinates></Point>`);
      lines.push('    </Placemark>');
    });
    lines.push('  </Folder>');
  }

  // Parcels folder
  if (project.parcels.length > 0) {
    lines.push('  <Folder>');
    lines.push('    <name>Parcels</name>');
    project.parcels.forEach(p => {
      if (p.walkPoints.length < 3) return;
      const coordStr = p.walkPoints
        .map(wp => `${wp.coordinate.lng},${wp.coordinate.lat},${wp.coordinate.altitude ?? 0}`)
        .join(' ');
      // Close the ring
      const first = p.walkPoints[0];
      const closed = coordStr + ` ${first.coordinate.lng},${first.coordinate.lat},${first.coordinate.altitude ?? 0}`;

      lines.push('    <Placemark>');
      lines.push(`      <name>${escapeXml(p.label)}</name>`);
      lines.push(`      <description>Area: ${p.computedAreaM2 ? (p.computedAreaM2 / 10000).toFixed(4) + ' ha' : 'N/A'}\nPerimeter: ${p.computedPerimeterM?.toFixed(1) ?? 'N/A'} m\nPoints: ${p.walkPoints.length}</description>`);
      lines.push('      <styleUrl>#parcelStyle</styleUrl>');
      lines.push('      <Polygon>');
      lines.push('        <outerBoundaryIs><LinearRing>');
      lines.push(`          <coordinates>${closed}</coordinates>`);
      lines.push('        </LinearRing></outerBoundaryIs>');
      lines.push('      </Polygon>');
      lines.push('    </Placemark>');
    });
    lines.push('  </Folder>');
  }

  lines.push('</Document>');
  lines.push('</kml>');
  return lines.join('\n');
}

export function exportToCSV(project: FieldProject): string {
  const rows: string[] = ['Label,Latitude,Longitude,Altitude,Accuracy,Type,Notes,CapturedAt'];
  project.beacons.forEach(b => {
    rows.push([
      b.label,
      b.coordinate.lat.toFixed(8),
      b.coordinate.lng.toFixed(8),
      b.coordinate.altitude?.toFixed(3) ?? '',
      b.coordinate.accuracy?.toFixed(2) ?? '',
      b.beaconType,
      `"${(b.notes ?? '').replace(/"/g, '""')}"`,
      new Date(b.capturedAt).toISOString(),
    ].join(','));
  });
  return rows.join('\n');
}

export function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
