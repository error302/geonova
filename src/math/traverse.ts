// src/math/traverse.ts
// Fully compliant with Schofield & Breach Ch.6 + Basak Ch.9 (Bowditch adjustment)

export type TraverseLeg = {
  id: string;
  from: string;
  to: string;
  length: number;
  bearing: number;
  latitude: number;
  departure: number;
  correctedLat?: number;
  correctedDep?: number;
  description?: string;
};

export interface TraverseRun {
  legs: TraverseLeg[];
  startE: number;
  startN: number;
  endE?: number;
  endN?: number;
}

export const applyBowditchAdjustment = (run: TraverseRun) => {
  const totalLength = run.legs.reduce((sum, leg) => sum + leg.length, 0);
  
  if (totalLength === 0) throw new Error("Traverse has zero length");

  let sumLat = run.legs.reduce((sum, leg) => sum + leg.latitude, 0);
  let sumDep = run.legs.reduce((sum, leg) => sum + leg.departure, 0);

  const misclosureLat = run.endN !== undefined ? (run.startN + sumLat) - run.endN : sumLat;
  const misclosureDep = run.endE !== undefined ? (run.startE + sumDep) - run.endE : sumDep;

  const correctedLegs = run.legs.map((leg: any) => {
    const ratio = leg.length / totalLength;
    const corrLat = -misclosureLat * ratio;
    const corrDep = -misclosureDep * ratio;

    return {
      ...leg,
      correctedLat: Number((leg.latitude + corrLat).toFixed(4)),
      correctedDep: Number((leg.departure + corrDep).toFixed(4)),
    };
  });

  const linearMisclosure = Math.sqrt(misclosureLat ** 2 + misclosureDep ** 2);
  const relativePrecision = totalLength / linearMisclosure;

  return {
    correctedLegs,
    misclosureLat: Number(misclosureLat.toFixed(4)),
    misclosureDep: Number(misclosureDep.toFixed(4)),
    linearMisclosure: Number(linearMisclosure.toFixed(4)),
    relativePrecision: `1:${Math.round(relativePrecision)}`,
    totalLength: Number(totalLength.toFixed(2)),
    message: `Bowditch adjustment applied. Relative precision = 1:${Math.round(relativePrecision)}`
  };
};

export const computeCoordinates = (startE: number, startN: number, legs: TraverseLeg[]) => {
  let e = startE;
  let n = startN;
  const points: { station: string; e: number; n: number }[] = [{ station: legs[0].from, e, n }];

  legs.forEach((leg: any) => {
    e += leg.correctedDep || leg.departure;
    n += leg.correctedLat || leg.latitude;
    points.push({ station: leg.to, e: Number(e.toFixed(4)), n: Number(n.toFixed(4)) });
  });

  return points;
};
