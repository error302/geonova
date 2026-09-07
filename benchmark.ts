import { performance } from 'perf_hooks';

interface Point3D {
  easting: number;
  northing: number;
  elevation: number;
}

function generatePoints(count: number): Point3D[] {
  const points: Point3D[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      easting: Math.random() * 1000,
      northing: Math.random() * 1000,
      elevation: Math.random() * 100
    });
  }
  return points;
}

function oldGetBounds(points: Point3D[]) {
  return {
    minE: Math.min(...points.map(p => p.easting)),
    maxE: Math.max(...points.map(p => p.easting)),
    minN: Math.min(...points.map(p => p.northing)),
    maxN: Math.max(...points.map(p => p.northing)),
  };
}

function newGetBounds(points: Point3D[]) {
  let minE = Infinity;
  let maxE = -Infinity;
  let minN = Infinity;
  let maxN = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.easting < minE) minE = p.easting;
    if (p.easting > maxE) maxE = p.easting;
    if (p.northing < minN) minN = p.northing;
    if (p.northing > maxN) maxN = p.northing;
  }
  return { minE, maxE, minN, maxN };
}

const points = generatePoints(100000); // 100k points to fit within call stack limit for old method, barely

const start1 = performance.now();
for(let i=0; i<10; i++) {
  oldGetBounds(points);
}
const end1 = performance.now();

const start2 = performance.now();
for(let i=0; i<10; i++) {
  newGetBounds(points);
}
const end2 = performance.now();

console.log(`Old method (100k points): ${end1 - start1} ms`);
console.log(`New method (100k points): ${end2 - start2} ms`);

try {
  const hugePoints = generatePoints(150000); // Exceeds call stack limit usually around 100-120k
  oldGetBounds(hugePoints);
} catch (e: any) {
  console.log(`Old method (150k points) failed: ${e.message}`);
}
