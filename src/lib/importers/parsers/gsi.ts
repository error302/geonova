import { registerParser } from '../registry';
import { ParseResult, ParsedPoint } from '@/types/importer';

const GSI_WORDS: Record<string, keyof ParsedPoint> = {
  '11': 'point_no',
  '81': 'easting',
  '82': 'northing',
  '83': 'rl',
  '21': 'bearing',
  '22': 'distance',
};

registerParser({
  format: 'gsi',
  label: 'Leica GSI',
  extensions: ['gsi', 'txt'],
  detect: (content) => content.trimStart().startsWith('*'),
  parse: (content): ParseResult => {
    const lines = content.trim().split('\n');
    const points: ParsedPoint[] = [];
    const warnings: string[] = [];

    for (const line of lines) {
      if (!line.startsWith('*')) continue;
      const words = line.slice(1).match(/.{16}/g) ?? [];
      const point: ParsedPoint = { raw: {} };

      for (const word of words) {
        const wi = word.slice(0, 2);
        const valueStr = word.slice(7).replace(/\+/, '').trim();
        const value = parseFloat(valueStr) / 1000;
        const field = GSI_WORDS[wi];
        if (field) {
          (point as Record<string, unknown>)[field] = value;
          point.raw![wi] = value;
        }
      }

      if (point.point_no !== undefined) {
        points.push(point);
      } else {
        warnings.push(`GSI line could not be parsed: ${line.slice(0, 30)}`);
      }
    }

    return { format: 'gsi', points, warnings };
  },
});
