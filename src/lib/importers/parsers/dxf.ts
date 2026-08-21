import { registerParser } from '../registry';
import { ParseResult, ParsedPoint } from '@/types/importer';

/**
 * Enhanced DXF Parser for METARDU
 * Supports AutoCAD & Civil 3D entities:
 * 1. Standard POINT entities
 * 2. INSERT entities (Block References with attributes PN, ELEV, DESC)
 * 3. TEXT / MTEXT spot levels and point labels
 */
registerParser({
  format: 'dxf',
  label: 'DXF (AutoCAD / Civil 3D Blocks & Points)',
  extensions: ['dxf'],
  detect: (content) => content.includes('SECTION') && content.includes('ENTITIES'),
  parse: (content): ParseResult => {
    const points: ParsedPoint[] = [];
    const warnings: string[] = [];
    const lines = content.split(/\r?\n/).map((l) => l.trim());

    let i = 0;
    let blockCount = 0;
    let pointEntityCount = 0;
    let textEntityCount = 0;

    while (i < lines.length) {
      const code = lines[i];
      const value = lines[i + 1];

      // ── 1. Standard AutoCAD POINT Entity ──
      if (code === '0' && value === 'POINT') {
        const point: ParsedPoint = { raw: {} };
        i += 2;
        while (i < lines.length && lines[i] !== '0') {
          const c = lines[i];
          const v = lines[i + 1];
          if (c === '10') point.easting = parseFloat(v);
          else if (c === '20') point.northing = parseFloat(v);
          else if (c === '30') point.rl = parseFloat(v);
          else if (c === '8') point.code = v;
          i += 2;
        }
        if (point.easting !== undefined && point.northing !== undefined && !isNaN(point.easting) && !isNaN(point.northing)) {
          if (!point.point_no) {
            point.point_no = `PT_${points.length + 1}`;
          }
          points.push(point);
          pointEntityCount++;
        }
      }

      // ── 2. AutoCAD / Civil 3D INSERT Entity (Block Reference) ──
      else if (code === '0' && value === 'INSERT') {
        const blockPoint: ParsedPoint = { raw: {} };
        let blockName = '';
        let layerName = '';
        let hasAttribs = false;

        i += 2;
        while (i < lines.length && lines[i] !== '0') {
          const c = lines[i];
          const v = lines[i + 1];
          if (c === '2') blockName = v;
          else if (c === '8') layerName = v;
          else if (c === '10') blockPoint.easting = parseFloat(v);
          else if (c === '20') blockPoint.northing = parseFloat(v);
          else if (c === '30') blockPoint.rl = parseFloat(v);
          else if (c === '66' && v === '1') hasAttribs = true;
          i += 2;
        }

        blockPoint.code = blockName || layerName || 'BLOCK_POINT';
        blockPoint.feature_code = blockName;
        blockPoint.raw = { blockName, layerName };

        // If block has attributes (ATTRIB entities following), parse them until SEQEND
        if (hasAttribs) {
          while (i < lines.length) {
            if (lines[i] === '0' && lines[i + 1] === 'ATTRIB') {
              let tag = '';
              let val = '';
              let attrZ: number | undefined;

              i += 2;
              while (i < lines.length && lines[i] !== '0') {
                const ac = lines[i];
                const av = lines[i + 1];
                if (ac === '2') tag = av.toUpperCase();
                else if (ac === '1') val = av;
                else if (ac === '30') attrZ = parseFloat(av);
                i += 2;
              }

              // Map common Civil 3D / LandXML / AutoCAD attribute tags
              if (tag === 'PN' || tag === 'PT' || tag === 'NUM' || tag === 'POINT' || tag === 'NAME' || tag === 'PNT') {
                blockPoint.point_no = val;
              } else if (tag === 'ELEV' || tag === 'Z' || tag === 'HEIGHT' || tag === 'RL' || tag === 'LEVEL') {
                const parsedElev = parseFloat(val);
                if (!isNaN(parsedElev)) blockPoint.rl = parsedElev;
              } else if (tag === 'DESC' || tag === 'CODE' || tag === 'DESCRIPTION' || tag === 'RAW_DESC' || tag === 'FCODE') {
                blockPoint.code = val;
                blockPoint.remark = val;
              }

              if (attrZ !== undefined && !isNaN(attrZ) && blockPoint.rl === undefined) {
                blockPoint.rl = attrZ;
              }
            } else if (lines[i] === '0' && lines[i + 1] === 'SEQEND') {
              i += 2;
              break;
            } else if (lines[i] === '0') {
              break;
            } else {
              i++;
            }
          }
        }

        if (blockPoint.easting !== undefined && blockPoint.northing !== undefined && !isNaN(blockPoint.easting) && !isNaN(blockPoint.northing)) {
          if (!blockPoint.point_no) {
            blockPoint.point_no = `${blockName || 'BLK'}_${points.length + 1}`;
          }
          points.push(blockPoint);
          blockCount++;
        }
      }

      // ── 3. AutoCAD TEXT / MTEXT Spot Levels ──
      else if (code === '0' && (value === 'TEXT' || value === 'MTEXT')) {
        let textContent = '';
        let textLayer = '';
        let textX: number | undefined;
        let textY: number | undefined;
        let textZ: number | undefined;

        i += 2;
        while (i < lines.length && lines[i] !== '0') {
          const c = lines[i];
          const v = lines[i + 1];
          if (c === '1') textContent = v;
          else if (c === '8') textLayer = v;
          else if (c === '10') textX = parseFloat(v);
          else if (c === '20') textY = parseFloat(v);
          else if (c === '30') textZ = parseFloat(v);
          i += 2;
        }

        // If the text is a numeric spot level or elevation on a spot/survey layer
        const isNumeric = /^-?\d+(\.\d+)?$/.test(textContent.trim());
        const isSurveyLayer = /(SPOT|LEVEL|ELEV|SURVEY|TOPO|POINTS|HEIGHT)/i.test(textLayer);

        if (isNumeric && isSurveyLayer && textX !== undefined && textY !== undefined && !isNaN(textX) && !isNaN(textY)) {
          const elev = parseFloat(textContent.trim());
          points.push({
            point_no: `TXT_${points.length + 1}`,
            easting: textX,
            northing: textY,
            rl: !isNaN(elev) ? elev : textZ,
            code: textLayer || 'SPOT_LEVEL',
            remark: `Extracted from ${value}: ${textContent}`,
            raw: { textContent, textLayer },
          });
          textEntityCount++;
        }
      } else {
        i++;
      }
    }

    if (points.length === 0) {
      warnings.push('No POINT, Block Reference (INSERT), or Spot Level entities found in the DXF file.');
    } else {
      if (blockCount > 0) {
        warnings.push(`Successfully extracted and converted ${blockCount} AutoCAD/Civil 3D Block Reference (INSERT) points to COGO Points.`);
      }
      if (textEntityCount > 0) {
        warnings.push(`Extracted ${textEntityCount} Spot Level elevations from CAD text annotations.`);
      }
    }

    return {
      format: 'dxf',
      points,
      warnings,
      metadata: {
        totalPoints: points.length,
        pointEntities: pointEntityCount,
        blockReferences: blockCount,
        textSpotLevels: textEntityCount,
      },
    };
  },
});
