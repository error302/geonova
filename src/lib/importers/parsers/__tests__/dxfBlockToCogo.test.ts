import { getParser } from '../../registry';
import '../dxf';

describe('DXF Parser - AutoCAD & Civil 3D Block Reference to COGO Points', () => {
  const parser = getParser('dxf');

  it('should be registered and detectable', () => {
    expect(parser).toBeDefined();
    expect(parser?.detect('0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF')).toBe(true);
  });

  it('should parse standard AutoCAD POINT entities', () => {
    const dxf = `0
SECTION
2
ENTITIES
0
POINT
8
SURVEY_POINTS
10
250000.123
20
9850000.456
30
1650.50
0
ENDSEC
0
EOF`;

    const result = parser!.parse(dxf);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].easting).toBeCloseTo(250000.123);
    expect(result.points[0].northing).toBeCloseTo(9850000.456);
    expect(result.points[0].rl).toBeCloseTo(1650.50);
    expect(result.points[0].code).toBe('SURVEY_POINTS');
  });

  it('should convert Civil 3D / AutoCAD INSERT Block References with ATTRIB tags to COGO Points', () => {
    const dxf = `0
SECTION
2
ENTITIES
0
INSERT
8
V-NODE
2
SURVEY_BCN
10
251100.500
20
9851200.750
30
1720.00
66
1
0
ATTRIB
2
PN
1
BCN_101
0
ATTRIB
2
ELEV
1
1720.85
0
ATTRIB
2
DESC
1
CONCRETE_PILLAR
0
SEQEND
0
ENDSEC
0
EOF`;

    const result = parser!.parse(dxf);
    expect(result.points).toHaveLength(1);
    const p = result.points[0];
    expect(p.point_no).toBe('BCN_101');
    expect(p.easting).toBeCloseTo(251100.500);
    expect(p.northing).toBeCloseTo(9851200.750);
    expect(p.rl).toBeCloseTo(1720.85);
    expect(p.code).toBe('CONCRETE_PILLAR');
    expect(p.feature_code).toBe('SURVEY_BCN');
  });

  it('should extract spot level elevations from survey TEXT entities', () => {
    const dxf = `0
SECTION
2
ENTITIES
0
TEXT
8
SPOT_HEIGHTS
10
250500.000
20
9850500.000
30
0.00
1
1745.62
0
ENDSEC
0
EOF`;

    const result = parser!.parse(dxf);
    expect(result.points).toHaveLength(1);
    const p = result.points[0];
    expect(p.easting).toBeCloseTo(250500.000);
    expect(p.northing).toBeCloseTo(9850500.000);
    expect(p.rl).toBeCloseTo(1745.62);
    expect(p.code).toBe('SPOT_HEIGHTS');
  });
});
