// ─── SURVEY ENGINE TEST SUITE ─────────────────────────────────────────────────
// Run with: npx ts-node tests.ts
// or compile + run: tsc && node tests.js
//
// No test framework needed — pure assertions with clear failure messages.

import {
  distanceBearing,
  slopeDistance,
  polarPoint,
  bowditchAdjustment,
  transitAdjustment,
  riseAndFall,
  heightOfCollimation,
  coordinateArea,
  geographicToUTM,
  utmToGeographic,
  bearingIntersection,
  tienstraResection,
  distanceIntersection,
  validateTraversePrecision,
  computeTraverseClosure,
  TRAVERSE_ORDERS,
  horizontalFromSlope,
  tapeTemperatureCorrection,
  edmAtmosphericCorrection,
  formatAreaForDisplay,
  minimumParcelAreaWarning,
  dmsToDecimal,
  decimalToDMS,
  bearingToString,
  normalizeBearing,
  toRadians,
} from "./index";

// ─── TEST RUNNER ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓  ${message}`);
    passed++;
  } else {
    console.error(`  ✗  FAIL: ${message}`);
    failed++;
  }
}

function near(a: number, b: number, tolerance = 0.001): boolean {
  return Math.abs(a - b) <= tolerance;
}

function section(name: string): void {
  console.log(`\n── ${name.toUpperCase()} ──`);
}

// ─── ANGLES ───────────────────────────────────────────────────────────────────

section("Angles");

assert(near(dmsToDecimal({ degrees: 45, minutes: 30, seconds: 0 }), 45.5),
  "DMS 45°30'00\" → 45.5°");

assert(near(dmsToDecimal({ degrees: 0, minutes: 0, seconds: 1 }), 1/3600, 0.000001),
  "DMS 0°0'1\" → 0.000278°");

const dms = decimalToDMS(45.5);
assert(dms.degrees === 45 && dms.minutes === 30 && near(dms.seconds, 0),
  "45.5° → DMS 45°30'00\"");

assert(near(normalizeBearing(-10), 350),     "normalizeBearing(-10) = 350");
assert(near(normalizeBearing(370), 10),      "normalizeBearing(370) = 10");
assert(near(normalizeBearing(180), 180),     "normalizeBearing(180) = 180");

// ─── DISTANCE & BEARING ───────────────────────────────────────────────────────

section("Distance & Bearing");

const db1 = distanceBearing(
  { easting: 1000, northing: 1000 },
  { easting: 1100, northing: 1100 }
);
assert(db1.ok && near(db1.value.distance, 141.421, 0.001),
  "NE diagonal: distance = 141.421 m");
assert(db1.ok && near(db1.value.forwardBearing, 45.0, 0.001),
  "NE diagonal: bearing = 045°");

// Due north
const db2 = distanceBearing(
  { easting: 500, northing: 500 },
  { easting: 500, northing: 600 }
);
assert(db2.ok && near(db2.value.forwardBearing, 0),
  "Due north: bearing = 000°");
assert(db2.ok && near(db2.value.backBearing, 180),
  "Due north: back bearing = 180°");

// Due east
const db3 = distanceBearing(
  { easting: 500, northing: 500 },
  { easting: 600, northing: 500 }
);
assert(db3.ok && near(db3.value.forwardBearing, 90),
  "Due east: bearing = 090°");

// Identical points should fail gracefully
const db4 = distanceBearing(
  { easting: 100, northing: 100 },
  { easting: 100, northing: 100 }
);
assert(!db4.ok, "Identical points return error (bearing undefined)");

// Polar point
const pp = polarPoint({ easting: 1000, northing: 1000 }, 90, 50);
assert(pp.ok && near(pp.value.easting, 1050) && near(pp.value.northing, 1000),
  "Polar: 90° bearing, 50m → easting +50");

// ─── TRAVERSE ─────────────────────────────────────────────────────────────────

section("Traverse Adjustment");

// Closed traverse — last point = first point (ideal, zero misclosure)
const perfectTraverse = [
  { name: "T1", easting: 1000, northing: 1000 },
  { name: "T2", easting: 1100, northing: 1000 },
  { name: "T3", easting: 1100, northing: 1100 },
  { name: "T1c", easting: 1000, northing: 1000 }, // closing
];

const tr1 = bowditchAdjustment(perfectTraverse);
assert(tr1.ok && near(tr1.value.linearError, 0, 0.0001),
  "Perfect traverse: linear error ≈ 0");
assert(tr1.ok && tr1.value.precisionGrade === "excellent",
  "Perfect traverse: grade = excellent");

// Traverse with known misclosure — last point intentionally slightly off
const imperfectTraverse = [
  { name: "A", easting: 0,      northing: 0 },
  { name: "B", easting: 100,    northing: 0 },
  { name: "C", easting: 100,    northing: 100 },
  { name: "A_close", easting: 0.02, northing: -0.015 }, // should close to (0,0)
];

const tr2 = bowditchAdjustment(imperfectTraverse);
assert(tr2.ok && tr2.value.linearError > 0,
  "Imperfect traverse: non-zero linear error detected");
assert(tr2.ok && tr2.value.linearError > 0 &&
       near(tr2.value.adjustedPoints[3].easting, 0.02) &&
       near(tr2.value.adjustedPoints[3].northing, -0.015),
  "Bowditch: adjusted coordinates propagate to the given closing point");

// Too few points
const tr3 = bowditchAdjustment([
  { name: "A", easting: 0, northing: 0 },
  { name: "B", easting: 100, northing: 0 },
]);
assert(!tr3.ok, "Too few stations returns error");

// ─── LEVELING ─────────────────────────────────────────────────────────────────

section("Leveling");

const levelReadings = [
  { station: "BM1", staff: 1.500, type: "BS" as const },
  { station: "TP1", staff: 1.200, type: "IS" as const },
  { station: "TP2", staff: 0.800, type: "IS" as const },
  { station: "BM2", staff: 1.100, type: "FS" as const },
];

const lev1 = riseAndFall(levelReadings, 100.000);
assert(lev1.ok, "Rise & fall: result computed");
assert(lev1.ok && near(lev1.value.rows[0].reducedLevel, 100.000),
  "First RL = opening RL (100.000)");
assert(lev1.ok && near(lev1.value.rows[1].reducedLevel, 100.300),
  "TP1 RL: staff dropped 0.3 m → rise 0.3 → RL = 100.300");
assert(lev1.ok && near(lev1.value.rows[2].reducedLevel, 100.700),
  "TP2 RL: staff dropped 0.4 m → rise 0.4 → RL = 100.700");
assert(lev1.ok && lev1.value.checks.arithmeticCheckPassed,
  "Rise & fall: arithmetic check passes");

// Misclosure correction — known closing RL is 100.390, computed will be 100.400
const lev2 = riseAndFall(levelReadings, 100.000, 100.390);
assert(lev2.ok && near(lev2.value.misclosure, 0.010, 0.0001),
  "Misclosure = 0.010 m detected");

// ─── AREA ─────────────────────────────────────────────────────────────────────

section("Area");

// Perfect 100×100 square
const square = [
  { easting: 0,   northing: 0   },
  { easting: 100, northing: 0   },
  { easting: 100, northing: 100 },
  { easting: 0,   northing: 100 },
];

const area1 = coordinateArea(square);
assert(area1.ok && near(area1.value.squareMetres, 10000),
  "100×100 m square: area = 10 000 m²");
assert(area1.ok && near(area1.value.hectares, 1.0),
  "100×100 m square: area = 1 ha");
assert(area1.ok && near(area1.value.perimeter, 400),
  "100×100 m square: perimeter = 400 m");
assert(area1.ok && near(area1.value.centroid.easting, 50) &&
                   near(area1.value.centroid.northing, 50),
  "100×100 m square: centroid = (50, 50)");

// Counter-clockwise should give same area
const ccw = [...square].reverse();
const area2 = coordinateArea(ccw);
assert(area2.ok && near(area2.value.squareMetres, 10000),
  "CCW winding order: same area");

// Triangle: base=100, height=50 → area = 2500
const triangle = [
  { easting: 0,   northing: 0  },
  { easting: 100, northing: 0  },
  { easting: 50,  northing: 50 },
];
const area3 = coordinateArea(triangle);
assert(area3.ok && near(area3.value.squareMetres, 2500),
  "Triangle: area = 2 500 m²");

// Too few points
const area4 = coordinateArea([{ easting: 0, northing: 0 }, { easting: 1, northing: 0 }]);
assert(!area4.ok, "Two points: returns error");

// ─── COORDINATE CONVERSION ────────────────────────────────────────────────────

section("Coordinate Conversion");

// Nairobi, Kenya — known UTM zone 37S
const nairobi: import("./types").LatLon = { latitude: -1.286389, longitude: 36.817222 };
const utm1 = geographicToUTM(nairobi);
assert(utm1.ok, "Nairobi → UTM computed");
assert(utm1.ok && utm1.value.zone === 37, "Nairobi: UTM zone 37");
assert(utm1.ok && utm1.value.hemisphere === "S", "Nairobi: southern hemisphere");
assert(utm1.ok && near(utm1.value.easting, 258_000, 1000),
  "Nairobi: easting ≈ 258 000 m");

// Round-trip
if (utm1.ok) {
  const rt = utmToGeographic(utm1.value);
  assert(rt.ok && near(rt.value.latitude, nairobi.latitude, 0.00001),
    "Round-trip: latitude preserved");
  assert(rt.ok && near(rt.value.longitude, nairobi.longitude, 0.00001),
    "Round-trip: longitude preserved");
}

// Polar extremes
const pole = geographicToUTM({ latitude: 85, longitude: 0 });
assert(!pole.ok, "Latitude 85° > 84°: UTM returns error");

// ─── COGO ─────────────────────────────────────────────────────────────────────

section("COGO");

// Bearing intersection
const int1 = bearingIntersection(
  { easting: 0,   northing: 0   }, 45,   // NE from origin
  { easting: 100, northing: 0   }, 315,  // NW from (100,0)
);
assert(int1.ok, "Bearing intersection: solution found");
assert(int1.ok && near(int1.value.point.easting, 50) &&
                  near(int1.value.point.northing, 50),
  "Bearing intersection: point = (50, 50)");

// Parallel bearings should fail
const int2 = bearingIntersection(
  { easting: 0, northing: 0 }, 90,
  { easting: 0, northing: 100 }, 90
);
assert(!int2.ok, "Parallel bearings: returns error");

// Distance-distance intersection
const di = distanceIntersection(
  { easting: 0,   northing: 0 }, 50,
  { easting: 100, northing: 0 }, 50
);
assert(di.ok, "Distance-distance: solution found");
assert(di.ok && near(di.value.solution1.easting, 50),
  "Distance-distance: midpoint easting = 50");

// ─── TRAVERSE ACCURACY VALIDATION ─────────────────────────────────────────────

section("Traverse accuracy validation");

const v1 = validateTraversePrecision(0.005, 100, "urban");
assert(v1.isAcceptable === false, "Kenya urban: 1:20,000 required; 1:20,000 achieved = fails");
const v2 = validateTraversePrecision(0.004, 100, "urban");
assert(v2.isAcceptable === true,  "Kenya urban: 1:25,000 achieved = passes");
assert(v2.order === "3rd_order",  "Kenya urban → 3rd order");
assert(v2.warnings.length === 0,  "No warnings when precision meets standard");

const v3 = validateTraversePrecision(0.010, 100, "rural");
assert(v3.isAcceptable === true,  "Kenya rural: 1:10,000 required; exactly 1:10,000 = passes");
assert(v3.order === "4th_order",  "Kenya rural → 4th order");

const v4 = validateTraversePrecision(0.015, 100, "transmission_line");
assert(v4.isAcceptable === false,  "KETRACO: 1:10,000 required; 1:6,667 = fails");

const v5 = validateTraversePrecision(0, 100, "urban");
assert(v5.warnings.length > 0, "Zero error triggers a perfect-closure warning");

const spec3 = TRAVERSE_ORDERS["3rd_order"];
assert(spec3.minPrecision === 20_000, "3rd order spec: 1:20,000");

// ─── TRAVERSE CLOSURE ─────────────────────────────────────────────────────────

section("Traverse closure computation");

const closed: import("./types").NamedPoint2D[] = [
  { name: "A", easting: 0,    northing: 0    },
  { name: "B", easting: 100,  northing: 0    },
  { name: "C", easting: 100,  northing: 100  },
  { name: "A", easting: 0,    northing: 0    },
];
const c1 = computeTraverseClosure(closed);
assert(c1.ok, "Closed traverse (A→B→C→A): no error");
assert(c1.ok && near(c1.value.linearError, 0), "Closed traverse: zero error");
assert(c1.ok && c1.value.isWithinTolerance, "Closed traverse: within Bahrain 1:20,000 tolerance");

const nearlyClosed: import("./types").NamedPoint2D[] = [
  { name: "P1", easting: 0,    northing: 0    },
  { name: "P2", easting: 500,  northing: 0    },
  { name: "P3", easting: 500,  northing: 500  },
  { name: "P4", easting: 0.01, northing: 500  }, // small 1cm misclose in E
];
const c2 = computeTraverseClosure(nearlyClosed);
assert(c2.ok, "Nearly-closed traverse: computed");
if (!c2.ok) throw new Error(c2.error)
assert(near(c2.value.precisionRatio, 500 / 0.01, 0.5),
  `Nearly-closed: ~1:${Math.round(c2.value.precisionRatio)}`);

const err1 = computeTraverseClosure([{ name: "X", easting: 0, northing: 0 }]);
assert(!err1.ok, "Too few stations: returns error");

// ─── SLOPE CORRECTION ────────────────────────────────────────────────────────

section("Slope correction (Kenya Reg 62)");

const s1 = horizontalFromSlope(100, 5);
assert(s1.ok, "Slope 100m at 5°: ok");
assert(s1.ok && near(s1.value.horizontalDistance, 100 * Math.cos(toRadians(5)), 0.001),
  "Horizontal distance = 100 × cos(5°)");
assert(s1.ok && s1.value.requiresTwoFace === false, "5° < 10°: two-face NOT required");

const s2 = horizontalFromSlope(100, 15);
assert(s2.ok, "Slope 100m at 15°: ok");
assert(s2.ok && s2.value.requiresTwoFace === true,
  "Kenya Reg 62: 15° > 10° → requires both faces");
assert(s2.ok && s2.value.warnings.length > 0,
  "15° slope generates a regulation warning");

const s3 = horizontalFromSlope(100, 0);
assert(s3.ok && near(s3.value.horizontalDistance, 100), "0° = horizontal distance");

const s4 = horizontalFromSlope(100, 45);
assert(s4.ok && near(s4.value.horizontalDistance, 100 * Math.cos(toRadians(45)), 0.001),
  "45° slope: horizontal = 100 × cos(45°)");
assert(s4.ok && near(s4.value.verticalDifference, 100 * Math.sin(toRadians(45)), 0.001),
  "45° slope: vertical diff = 100 × sin(45°)");

const tempCorr = tapeTemperatureCorrection(100, 30, 20);
assert(near(tempCorr, 100 * 0.0000117 * 10, 0.0001),
  "Steel tape at 30°C vs 20°C standard: positive correction");

const ppm = edmAtmosphericCorrection(1000, 1000);
assert(typeof ppm === "number" && Math.abs(ppm) < 0.1,
  "EDM atmospheric correction: small ppm value");

const err2 = horizontalFromSlope(-5, 10);
assert(!err2.ok, "Negative slope distance: returns error");

// ─── AREA PRECISION FORMATTING ────────────────────────────────────────────────

section("Area precision (Kenya Reg 84)");

const a1 = formatAreaForDisplay(5000);       // 0.5 ha → 4dp
assert(a1.ok, "formatAreaForDisplay ok");
assert(a1.decimalPlaces === 4, "≤1 ha → 4 decimal places");
assert(a1.formattedValue.includes("0.5000"), `0.5 ha formatted as "${a1.formattedValue}"`);

const a2 = formatAreaForDisplay(50_000);       // 5 ha → 3dp
assert(a2.decimalPlaces === 3, "1–10 ha → 3 decimal places");

const a3 = formatAreaForDisplay(500_000);     // 50 ha → 2dp
assert(a3.decimalPlaces === 2, "10–100 ha → 2 decimal places");

const a4 = formatAreaForDisplay(5_000_000);   // 500 ha → 1dp
assert(a4.decimalPlaces === 1, ">100 ha → 1 decimal place");

const a5 = formatAreaForDisplay(5000, "m2");
assert(a5.unit === "m²", "m² unit label used");

const a6 = formatAreaForDisplay(5000, "acres");
assert(a6.unit === "acres", "acres unit label used");

const warns = minimumParcelAreaWarning(5);
assert(warns.length > 0, "Very small area triggers minimum parcel warning");

// ─── SUMMARY ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("Some tests failed. Review engine logic above.");
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
