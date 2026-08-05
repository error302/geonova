'use client';
import { useState } from 'react';
import { renderPDFPageToDataURL } from '@/lib/field/geopdf';
import { GeoPDFLayer, GCP } from '@/types/field';
import { Upload, MapPin, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  onLayerReady: (layer: GeoPDFLayer) => void;
}

const GCP_LABELS = ['TL', 'TR', 'BL', 'BR'] as const;
const GCP_NAMES = {
  TL: 'Top-Left corner',
  TR: 'Top-Right corner',
  BL: 'Bottom-Left corner',
  BR: 'Bottom-Right corner',
};

export default function GeoPDFImport({ onLayerReady }: Props) {
  const [step, setStep] = useState<'idle' | 'rendering' | 'gcp' | 'done'>('idle');
  const [rendered, setRendered] = useState<{ dataUrl: string; w: number; h: number } | null>(null);
  const [gcps, setGCPs] = useState<Partial<GCP>[]>(
    GCP_LABELS.map(label => ({ id: label, label, pixelX: 0, pixelY: 0, lat: undefined, lng: undefined }))
  );
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      return;
    }
    setFileName(file.name);
    setError(null);
    setStep('rendering');
    try {
      const result = await renderPDFPageToDataURL(file, 1, 2.0);
      // Default pixel positions: corners at 5% inset from edges
      const insetX = Math.round(result.widthPx * 0.05);
      const insetY = Math.round(result.heightPx * 0.05);
      setGCPs([
        { id: 'TL', label: 'TL', pixelX: insetX,                   pixelY: insetY },
        { id: 'TR', label: 'TR', pixelX: result.widthPx - insetX,   pixelY: insetY },
        { id: 'BL', label: 'BL', pixelX: insetX,                   pixelY: result.heightPx - insetY },
        { id: 'BR', label: 'BR', pixelX: result.widthPx - insetX,   pixelY: result.heightPx - insetY },
      ]);
      setRendered({ dataUrl: result.dataUrl, w: result.widthPx, h: result.heightPx });
      setStep('gcp');
    } catch (err) {
      setError(`Failed to render PDF: ${(err as Error).message}`);
      setStep('idle');
    }
  }

  function updateGCP(label: string, field: 'lat' | 'lng', value: string) {
    setGCPs(prev => prev.map(g =>
      g.label === label ? { ...g, [field]: parseFloat(value) || 0 } : g
    ));
  }

  function handleSubmit() {
    if (!rendered) return;
    const complete = gcps.filter(g => g.lat !== undefined && g.lng !== undefined && g.lat !== 0);
    if (complete.length < 4) {
      setError('Enter latitude and longitude for all 4 corners.');
      return;
    }
    const layer: GeoPDFLayer = {
      id: `geopdf_${Date.now()}`,
      name: fileName,
      dataUrl: rendered.dataUrl,
      widthPx: rendered.w,
      heightPx: rendered.h,
      gcps: gcps as GCP[],
      visible: true,
      loadedAt: Date.now(),
    };
    onLayerReady(layer);
    setStep('done');
  }

  if (step === 'idle' || step === 'rendering') return (
    <div className="p-4 space-y-3 text-white">
      <label className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg cursor-pointer w-fit">
        <Upload className="w-4 h-4" />
        {step === 'rendering' ? 'Rendering PDF…' : 'Import GeoPDF'}
        <input type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} disabled={step === 'rendering'} />
      </label>
      {error && <p className="text-red-400 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
      <p className="text-gray-500 text-xs">You will enter the WGS84 coordinates of the 4 map corners after import.</p>
    </div>
  );

  if (step === 'done') return (
    <div className="p-4 flex items-center gap-2 text-green-400">
      <CheckCircle className="w-5 h-5" />
      <span className="text-sm">GeoPDF layer added to map.</span>
    </div>
  );

  // GCP registration step
  return (
    <div className="p-4 space-y-4 overflow-y-auto max-h-[80vh] text-white">
      <h3 className="font-semibold text-sm">Enter map corner coordinates — <span className="text-gray-400 font-normal">WGS84 decimal degrees</span></h3>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="grid grid-cols-1 gap-3">
        {gcps.map(g => (
          <div key={g.label} className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-mono font-bold">{g.label}</span>
              <span className="text-xs text-gray-400">{GCP_NAMES[g.label as keyof typeof GCP_NAMES]}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number" step="0.000001" aria-label="Latitude" placeholder="e.g. -1.2921"
                className="bg-gray-700 text-sm px-2 py-1.5 rounded border border-gray-600 text-white"
                onChange={e => updateGCP(g.label!, 'lat', e.target.value)}
              />
              <input
                type="number" step="0.000001" aria-label="Longitude" placeholder="e.g. 36.8219"
                className="bg-gray-700 text-sm px-2 py-1.5 rounded border border-gray-600 text-white"
                onChange={e => updateGCP(g.label!, 'lng', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
      <button onClick={handleSubmit}
        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 rounded-lg text-sm">
        Add to Map
      </button>
    </div>
  );
}
