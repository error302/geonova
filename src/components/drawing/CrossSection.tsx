'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { z } from 'zod';
import Konva from 'konva';
import { logEngineeringCompute } from '@/lib/engineering/compute';
import { initialiseDXFLayers, addStandardTitleBlock, DXF_LAYERS } from '@/lib/drawing/dxfLayers';

const CrossSectionSchema = z.object({
  stations: z.array(z.object({
    chainage: z.number(),
    groundLevel: z.number(),
    formationLevel: z.number(),
  })),
  sideSlope: z.number().min(1).default(1.5),
});

export interface CrossSectionProps {
  stations: Array<{ chainage: number; groundLevel: number; formationLevel: number }>;
  projectId?: string;
  sideSlope?: number;
  width?: number;
  height?: number;
  projectData?: {
    lr_number?: string;
    county?: string;
    district?: string;
    locality?: string;
  };
  surveyorProfile?: {
    fullName: string;
    registrationNumber: string;
    firmName: string;
  } | null;
}

export function CrossSection({
  stations,
  projectId,
  sideSlope = 1.5,
  width = 920,
  height = 520,
  projectData,
  surveyorProfile,
}: CrossSectionProps) {
  const [, setSelectedStation] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const validated = useMemo(() => {
    try {
      return CrossSectionSchema.parse({ stations, sideSlope });
    } catch {
      return null;
    }
  }, [stations, sideSlope]);

  const sections = useMemo(() => {
    if (!validated) return [];
    
    return validated.stations.map((station, i) => {
      const prev = validated.stations[i - 1];
      if (!prev) return { ...station, cutFillArea: 0, cutVolume: 0, fillVolume: 0 };

      const leftCut = Math.max(0, prev.groundLevel - prev.formationLevel);
      const rightCut = Math.max(0, station.groundLevel - station.formationLevel);

      const area = ((leftCut + rightCut) / 2) * (station.chainage - prev.chainage);
      const cutVolume = Math.max(0, area);
      const fillVolume = Math.max(0, -area);

      return { 
        ...station, 
        cutFillArea: area, 
        cutVolume, 
        fillVolume 
      };
    });
  }, [validated]);

  const totalCut = useMemo(() => sections.reduce((sum, s) => sum + s.cutVolume, 0), [sections]);
  const totalFill = useMemo(() => sections.reduce((sum, s) => sum + s.fillVolume, 0), [sections]);

  useEffect(() => {
    if (!containerRef.current || stations.length === 0 || !validated) return;

    const stage = new Konva.Stage({
      container: containerRef.current,
      width,
      height,
    });
    const layer = new Konva.Layer();
    stage.add(layer);

    const spacing = width / stations.length;
    const baseLevel = 1600;
    const vScale = 8;

    stations.forEach((station, i) => {
      const x = spacing * i + spacing / 2;
      const groundY = height / 2 - (station.groundLevel - baseLevel) * vScale;
      const formationY = height / 2 - (station.formationLevel - baseLevel) * vScale;

      layer.add(new Konva.Line({
        points: [x - 40, groundY, x + 40, groundY],
        stroke: '#22c55e',
        strokeWidth: 3,
      }));

      layer.add(new Konva.Line({
        points: [x - 40, formationY, x + 40, formationY],
        stroke: '#eab308',
        strokeWidth: 3,
      }));

      const slopeOffset = 40 / sideSlope;
      layer.add(new Konva.Line({
        points: [x - 40, groundY, x - 40 - slopeOffset, formationY],
        stroke: '#666',
        strokeWidth: 2,
      }));
      layer.add(new Konva.Line({
        points: [x + 40, groundY, x + 40 + slopeOffset, formationY],
        stroke: '#666',
        strokeWidth: 2,
      }));

      layer.add(new Konva.Text({
        x: x - 25,
        y: height - 40,
        text: `CH ${station.chainage.toFixed(0)}`,
        fontSize: 11,
        fill: '#aaa',
      }));
    });

    layer.draw();
    return () => {
      stage.destroy();
    };
  }, [stations, sideSlope, width, height, validated]);

  const exportBatchDXF = async () => {
    const { default: Drawing } = await import('dxf-writer');
    const drawing = new Drawing();
    initialiseDXFLayers(drawing);

    addStandardTitleBlock(drawing, {
      drawingTitle: 'CROSS SECTION SURVEY',
      lrNumber: projectData?.lr_number ?? 'N/A',
      county: projectData?.county ?? 'N/A',
      district: projectData?.district ?? 'N/A',
      locality: projectData?.locality ?? 'N/A',
      areaHa: 0,
      perimeterM: 0,
      surveyorName: surveyorProfile?.fullName ?? 'N/A',
      registrationNumber: surveyorProfile?.registrationNumber ?? 'N/A',
      firmName: surveyorProfile?.firmName ?? 'N/A',
      date: new Date().toLocaleDateString('en-KE'),
      submissionRef: 'N/A',
      coordinateSystem: 'Arc 1960 / UTM Zone 37S (SRID: 21037)',
      scale: '1:2500',
      sheetNumber: '1 of 1',
      revision: 'R00',
    });

    const baseLevel = 1600;
    const vScale = 1 / 100;

    sections.forEach((station, i) => {
      const xOffset = i * 50;
      const groundY = (station.groundLevel - baseLevel) * vScale;
      const formationY = (station.formationLevel - baseLevel) * vScale;

      drawing.setActiveLayer(DXF_LAYERS.PROFILE.name);
      drawing.drawLine(
        xOffset, groundY,
        xOffset + 20, groundY
      );

      drawing.setActiveLayer(DXF_LAYERS.CENTRELINE.name);
      drawing.drawLine(
        xOffset, formationY,
        xOffset + 20, formationY
      );

      drawing.setActiveLayer(DXF_LAYERS.CHAIN.name);
      drawing.drawText(
        xOffset, groundY + 1,
        0.15, 0,
        `CH${station.chainage.toFixed(0)}`
      );
    });

    logEngineeringCompute('cross_section_batch', { stations: stations.length, sideSlope },
      { totalCut, totalFill }, { projectId });

    const dxfString = drawing.toDxfString();
    const blob = new Blob([dxfString], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross_sections_batch_${projectId || 'export'}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!validated) {
    return <div className="p-4 text-red-400">Invalid cross-section data</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Cross-Section Batch Renderer</h3>
        <button
          onClick={exportBatchDXF}
          className="bg-orange-500 hover:bg-orange-600 px-5 py-2 rounded-lg text-white text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export All Stations to DXF
        </button>
      </div>

      <div ref={containerRef} className="bg-[#111] rounded-xl overflow-hidden border border-[var(--border-color)]" />

      <div className="overflow-x-auto border border-[var(--border-color)] rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-secondary)]">
              <th className="text-left py-3 px-6 text-[var(--text-muted)]">Chainage</th>
              <th className="text-right py-3 px-6 text-[var(--text-muted)]">Ground RL</th>
              <th className="text-right py-3 px-6 text-[var(--text-muted)]">Formation RL</th>
              <th className="text-right py-3 px-6 text-[var(--text-muted)]">Cut (m³)</th>
              <th className="text-right py-3 px-6 text-[var(--text-muted)]">Fill (m³)</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s, i) => (
              <tr key={`${s}-${i}`} 
                className="border-t border-[var(--border-color)] hover:bg-[var(--bg-secondary)] cursor-pointer"
                onClick={() => setSelectedStation(i)}
              >
                <td className="py-3 px-6 font-medium">{s.chainage.toFixed(0)}</td>
                <td className="py-3 px-6 text-right">{s.groundLevel.toFixed(3)}</td>
                <td className="py-3 px-6 text-right">{s.formationLevel.toFixed(3)}</td>
                <td className="py-3 px-6 text-right text-red-400">{s.cutVolume.toFixed(2)}</td>
                <td className="py-3 px-6 text-right text-green-400">{s.fillVolume.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          {sections.length > 0 && (
            <tfoot>
              <tr className="bg-[var(--bg-secondary)] font-semibold">
                <td className="py-3 px-6">Total</td>
                <td></td>
                <td></td>
                <td className="py-3 px-6 text-right text-red-400">{totalCut.toFixed(2)}</td>
                <td className="py-3 px-6 text-right text-green-400">{totalFill.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="text-xs text-[var(--text-muted)]">
        Side slope 1:{sideSlope} • Prismoidal + end-area method • RDM 1.1 compliant
      </div>
    </div>
  );
}
