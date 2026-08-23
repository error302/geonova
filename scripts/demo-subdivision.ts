/**
 * Field simulation: village subdivision survey run through METARDU engines.
 * Persona walkthrough — all numbers below come from src/lib/computations/traverseEngine
 * and src/lib/engine/area, exactly as the app computes them.
 */
import { computeTraverse } from '../src/lib/computations/traverseEngine';
import { coordinateArea } from '../src/lib/engine/area';

// ── Job card ──────────────────────────────────────────────────────────────
// Client: Mzee Kariuki — subdivide family shamba for his two sons.
// Mother title: LR 209/12345/IV, Kiambu. Arc 1960 / UTM Zone 37S.
// Opening beacon MB1 (recovered, verified against registry coordinates).
const OBS = [
  // MB1: BS north (registry bearing to old trig), turned 90° CW along fence
  { station: 'MB2', bs: 'TRIG-A', fs: 'MB3', hclDeg: '90', hclMin: '00', hclSec: '10', hcrDeg: '270', hcrMin: '00', hcrSec: '00', slopeDist: '141.455', vaDeg: '90', vaMin: '00', vaSec: '30', ih: '1.520', th: '1.500' },
  { station: 'MB3', bs: 'MB1', fs: 'MB4', hclDeg: '270', hclMin: '00', hclSec: '00', hcrDeg: '90', hcrMin: '00', hcrSec: '20', slopeDist: '113.148', vaDeg: '89', vaMin: '59', vaSec: '30', ih: '1.520', th: '1.500' },
  { station: 'MB4', bs: 'MB2', fs: 'MB1', hclDeg: '270', hclMin: '00', hclSec: '05', hcrDeg: '90', hcrMin: '00', hcrSec: '00', slopeDist: '141.402', vaDeg: '90', vaMin: '00', vaSec: '45', ih: '1.520', th: '1.500' },
  { station: 'MB1', bs: 'MB3', fs: 'X', hclDeg: '269', hclMin: '59', hclSec: '50', hcrDeg: '90', hcrMin: '00', hcrSec: '10', slopeDist: '113.121', vaDeg: '90', vaMin: '00', vaSec: '15', ih: '1.520', th: '1.500' },
];

const result = computeTraverse({
  openingEasting: 285340.00,
  openingNorthing: 9870620.00,
  openingRL: 1682.40,
  openingStation: 'MB1',
  closingEasting: 285340.00,
  closingNorthing: 9870620.00,
  closingStation: 'MB1',
  backsightBearingDeg: 0,
  backsightBearingMin: 0,
  backsightBearingSec: 0,
  observations: OBS,
});

console.log('════════ METARDU COMPUTE — SUBDIVISION TRAVERSE ════════');
console.log(`Perimeter        : ${result.totalPerimeter.toFixed(3)} m`);
console.log(`Linear misclosure: ${(result.linearError * 1000).toFixed(2)} mm  (C=${result.C_mm.toFixed(2)}mm, K=${result.K_km.toFixed(3)}km)`);
console.log(`Precision ratio  : 1:${Math.round(result.precisionRatio).toLocaleString()}`);
console.log(`RDM 1.1 class    : ${result.accuracyOrder}`);
console.log(`Allowable C      : ${result.allowable.toFixed(2)} mm — ${result.linearError * 1000 <= result.allowable ? 'PASS' : 'FAIL'}`);
console.log(`Formula          : ${result.formula}`);
console.log('');
console.log('── Adjusted beacons ──');
for (const c of result.coordinates) {
  console.log(`  ${c.station.padEnd(4)}  E ${c.easting.toFixed(3)}  N ${c.northing.toFixed(3)}  RL ${c.rl!.toFixed(2)}`);
}
console.log('');

// ── Subdivision: cut line between midpoints of long boundaries ────────────
const adj = result.coordinates;
const byStn = new Map(adj.map((c) => [c.station, c]));
const mb1 = byStn.get('MB1')!, mb2 = byStn.get('MB2')!;
const mb3 = byStn.get('MB3')!, mb4 = byStn.get('MB4')!;
// New internal beacons placed at midpoints of the north and south boundaries
const mid = (a: typeof mb1, b: typeof mb1) => ({
  easting: (a.easting + b.easting) / 2,
  northing: (a.northing + b.northing) / 2,
});
const N1 = mid(mb1, mb2); // new beacon on north boundary
const N2 = mid(mb3, mb4); // new beacon on south boundary

const areaOf = (pts: Array<{ easting: number; northing: number }>) =>
  coordinateArea(pts as unknown as Parameters<typeof coordinateArea>[0]).areaSqm;

const motherArea = areaOf([mb1, mb2, mb3, mb4]);
const parcelA = areaOf([mb1, N1, N2, mb4]); // western half
const parcelB = areaOf([N1, mb2, mb3, N2]); // eastern half

const ha = (m2: number) => (m2 / 10000).toFixed(4);
console.log('════════ SUBDIVISION AREAS ════════');
console.log(`New beacons     : N1 (${N1.easting.toFixed(3)} E, ${N1.northing.toFixed(3)} N)`);
console.log(`                  N2 (${N2.easting.toFixed(3)} E, ${N2.northing.toFixed(3)} N)`);
console.log(`Mother parcel   : ${motherArea.toFixed(1)} m² = ${ha(motherArea)} ha`);
console.log(`Parcel A (west) : ${parcelA.toFixed(1)} m² = ${ha(parcelA)} ha  → son 1`);
console.log(`Parcel B (east) : ${parcelB.toFixed(1)} m² = ${ha(parcelB)} ha  → son 2`);
const sumCheck = Math.abs(parcelA + parcelB - motherArea);
console.log(`Closure of areas: |A+B−mother| = ${sumCheck.toExponential(2)} m² ${sumCheck < 0.001 ? '(exact)' : ''}`);
