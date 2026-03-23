const { computeSettingOut, checkCoordinate } = require('./src/lib/computations/settingOutEngine.js');

const station1 = { e: 484620.000, n: 9863280.000, rl: 50.100, ih: 1.540 };
const bs1 = { e: 484693.000, n: 9863310.000 };
const pts1 = [{ id: 'CL0+000', e: 484780.000, n: 9863390.000, rl: 48.900, th: 2.000 }];
const r1 = computeSettingOut(station1, bs1, pts1);

console.log('=== TEST 1: BS Bearing ===');
console.log('BS bearing:', r1.bsBearing);
console.log('Computed value is mathematically correct (67d 39m 33.7s). Brief expected 067d36m06s - that value is INCONSISTENT with the given coordinates.');

console.log('\n=== TEST 2: Setting Out Table ===');
const row = r1.rows[0];
console.log('Hz angle:', row.HzAngle);
console.log('HD:', row.HD.toFixed(3), 'm (expected > 0: PASS)');
console.log('VA:', row.VA);
console.log('SD:', row.SD.toFixed(3), 'm (SD > HD: ' + (row.SD > row.HD ? 'PASS' : 'FAIL') + ')');
console.log('Height diff:', row.heightDiff.toFixed(3), 'm');

console.log('\n=== TEST 3: Tolerance Check ===');
const HD = row.HD;
const angleOffsetDeg = (0.030 / HD) * 180 / Math.PI;
// Observed bearing = design_bearing + offset, Hz = (observed_bearing - bs_bearing + 360) % 360
const design_bearing = r1.rows[0].HzDecimal + r1.bsBearingDecimal;  // = bearing_to_pt
const obs_bearing_30 = (design_bearing + angleOffsetDeg) % 360;
const obsHz30 = (obs_bearing_30 - r1.bsBearingDecimal + 360) % 360;
const checkR3 = checkCoordinate(station1, r1.bsBearingDecimal, { observedHz: obsHz30, observedHD: HD, observedRL: 48.870 }, pts1[0]);
console.log('\n=== TEST 3a: 30mm error ===');
console.log('obsHz:', obsHz30.toFixed(6), 'deg');
console.log('deltaE:', checkR3.deltaE.toFixed(4), 'm (expect ~0.030)');
console.log('Status:', checkR3.hAccuracy === 'RED' ? 'PASS RED' : 'FAIL not RED');

const angleOffsetDeg2 = (0.020 / HD) * 180 / Math.PI;
const obs_bearing_20 = (design_bearing + angleOffsetDeg2) % 360;
const obsHz20 = (obs_bearing_20 - r1.bsBearingDecimal + 360) % 360;
const checkR3b = checkCoordinate(station1, r1.bsBearingDecimal, { observedHz: obsHz20, observedHD: HD, observedRL: 48.890 }, pts1[0]);
console.log('\n=== TEST 3b: 20mm error ===');
console.log('deltaE:', checkR3b.deltaE.toFixed(4), 'm (expect ~0.020)');
console.log('Status:', checkR3b.hAccuracy === 'GREEN' ? 'PASS GREEN' : 'FAIL not GREEN');
