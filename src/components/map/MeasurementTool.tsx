'use client';

import { useState } from 'react';
import { Ruler, Square, Compass, MapPin, X, Check } from 'lucide-react';
import { useMeasurement, type MeasurementMode } from '@/hooks/useMeasurement';
import type Map from 'ol/Map';

interface MeasurementToolProps {
  map: Map | null;
}

export function MeasurementTool({ map }: MeasurementToolProps) {
  const {
    state,
    startMeasurement,
    finishAreaMeasurement,
    cancelMeasurement,
    clearMeasurement,
    getFormattedResult,
  } = useMeasurement(map);

  const [, setHoverTool] = useState<MeasurementMode | null>(null);

  const tools: Array<{
    mode: MeasurementMode;
    icon: React.ReactNode;
    label: string;
    description: string;
  }> = [
    {
      mode: 'distance',
      icon: <Ruler className="w-5 h-5" />,
      label: 'Distance',
      description: 'Click two points to measure distance',
    },
    {
      mode: 'area',
      icon: <Square className="w-5 h-5" />,
      label: 'Area',
      description: 'Click points to draw polygon, then finish',
    },
    {
      mode: 'bearing',
      icon: <Compass className="w-5 h-5" />,
      label: 'Bearing',
      description: 'Click two points to measure bearing',
    },
    {
      mode: 'coordinate',
      icon: <MapPin className="w-5 h-5" />,
      label: 'Coordinate',
      description: 'Click to get coordinate',
    },
  ];

  const handleToolClick = (mode: MeasurementMode) => {
    if (state.isActive && state.mode !== mode) {
      cancelMeasurement();
    }
    startMeasurement(mode);
  };

  const result = getFormattedResult();

  return (
    <div className="bg-white rounded-lg shadow-lg border w-56">
      <div className="flex items-center border-b">
        {tools.map((tool) => (
          <button
            key={tool.mode}
            onClick={() => handleToolClick(tool.mode)}
            onMouseEnter={() => setHoverTool(tool.mode)}
            onMouseLeave={() => setHoverTool(null)}
            className={[
              'flex-1 p-2 flex flex-col items-center gap-1 transition-colors',
              state.mode === tool.mode && state.isActive
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-100',
            ].join(' ')}
            title={tool.description}
          >
            {tool.icon}
            <span className="text-[10px]">{tool.label}</span>
          </button>
        ))}
      </div>

      {state.isActive && (
        <div className="px-3 py-2 bg-blue-50 text-xs text-blue-700">
          {state.mode === 'distance' && state.points.length === 0 && 'Click first point'}
          {state.mode === 'distance' && state.points.length === 1 && 'Click second point'}
          {state.mode === 'area' && state.points.length < 3 && `Click points (${state.points.length}/3 min)`}
          {state.mode === 'area' && state.points.length >= 3 && `${state.points.length} pts - Finish or add`}
          {state.mode === 'bearing' && state.points.length === 0 && 'Click first point'}
          {state.mode === 'bearing' && state.points.length === 1 && 'Click second point'}
          {state.mode === 'coordinate' && 'Click to get coordinate'}
        </div>
      )}

      {result && (
        <div className="px-4 py-3 border-t">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-gray-500 uppercase">{result.type}</div>
              <div className="text-base font-semibold font-mono">
                {result.formatted}
              </div>
            </div>
            <button
              onClick={clearMeasurement}
              className="p-1.5 hover:bg-gray-100 rounded"
              title="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {state.points.length > 0 && (
            <div className="mt-2 text-[10px] text-gray-500">
              {state.points.map((p, i) => (
                <div key={`${p}-${i}`}>Pt {i + 1}: E {p.easting.toFixed(0)} N {p.northing.toFixed(0)}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.isActive && !result && (
        <div className="px-4 py-2 border-t">
          {state.mode === 'area' && state.points.length >= 3 ? (
            <button
              onClick={finishAreaMeasurement}
              className="w-full py-1.5 bg-green-600 text-white text-sm rounded flex items-center justify-center gap-1"
            >
              <Check className="w-4 h-4" />
              Finish
            </button>
          ) : (
            <button
              onClick={cancelMeasurement}
              className="w-full py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}