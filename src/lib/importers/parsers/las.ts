import { ParsedSurveyData } from '../droneTypes';

export async function parseLas(file: File): Promise<ParsedSurveyData> {
  const arrayBuffer = await file.arrayBuffer();
  const view = new DataView(arrayBuffer);

  try {
    const pointsCount = view.getUint32(107, true);
    const scaleX = view.getFloat64(131, true);
    const scaleY = view.getFloat64(139, true);
    const scaleZ = view.getFloat64(147, true);
    const offsetX = view.getFloat64(155, true);
    const offsetY = view.getFloat64(163, true);
    const offsetZ = view.getFloat64(171, true);

    const points: ParsedSurveyData['points'] = [];
    const pointDataStart = 227;
    const pointRecordLength = 28;
    const maxPoints = Math.min(pointsCount, 50000);

    for (let i = 0; i < maxPoints; i++) {
      const offset = pointDataStart + i * pointRecordLength;
      if (offset + 12 > arrayBuffer.byteLength) break;
      
      const x = view.getInt32(offset, true) * scaleX + offsetX;
      const y = view.getInt32(offset + 4, true) * scaleY + offsetY;
      const z = view.getInt32(offset + 8, true) * scaleZ + offsetZ;

      points.push({
        easting: Number(x.toFixed(3)),
        northing: Number(y.toFixed(3)),
        rl: Number(z.toFixed(3)),
        code: 'DRONE-PC',
      });
    }

    return {
      points,
      metadata: {
        source: 'LAS Point Cloud',
        format: 'LAS',
        totalPoints: pointsCount,
        droneSpecific: { flightDate: new Date().toISOString() },
      },
    };
  } catch {
    throw new Error('Failed to parse LAS file - invalid format');
  }
}

export async function parseLaz(file: File): Promise<ParsedSurveyData> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'parse-laz');

  const res = await fetch('/api/compute/parse-laz', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('LAZ parsing requires server-side processing');
  }

  return res.json();
}
