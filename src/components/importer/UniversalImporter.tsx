'use client';

import { useState, useCallback } from 'react';
import { ParseResult, SupportedFormat } from '@/types/importer';
import ImportPreviewTable from './ImportPreviewTable';
import GenericCSVMapper from './GenericCSVMapper';

import '@/lib/importers/index';
import { detectFormat, getParser } from '@/lib/importers/registry';
import { smartImport, SmartImportResult } from '@/lib/importers/universalImporter';

interface Props {
  projectId: string;
  onImportComplete: (rowCount: number) => void;
}

type ImportStep = 'idle' | 'parsing' | 'mapping' | 'preview' | 'committing' | 'done';

export default function UniversalImporter({ projectId, onImportComplete }: Props) {
  const [step, setStep] = useState<ImportStep>('idle');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [smartResult, setSmartResult] = useState<SmartImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setError(null);
    setStep('parsing');

    try {
      const result = await smartImport(file);
      setSmartResult(result);
      
      if (result.success) {
        setStep('preview');
      } else {
        setError(result.errors.join(', ') || 'Import failed');
        setStep('idle');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStep('idle');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleCommit = async () => {
    if (!smartResult || smartResult.entries.length === 0) return;
    setStep('committing');

    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          entries: smartResult.entries,
          adjustedLegs: smartResult.adjustedLegs,
          fileName,
          relativePrecision: smartResult.relativePrecision,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Commit failed');

      setStep('done');
      onImportComplete(data.imported);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Commit failed');
      setStep('preview');
    }
  };

  if (step === 'idle' || step === 'parsing') {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <p className="text-lg font-medium text-gray-700 mb-2">
          {step === 'parsing' ? 'Parsing file…' : 'Drop any survey file here'}
        </p>
        <p className="text-sm text-gray-400 mb-4">
          CSV, GSI, JobXML, RW5, DXF — or any format. Auto-detected.
        </p>
        {step === 'idle' && (
          <label className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700 text-sm">
            Browse Files
            <input type="file" className="hidden" onChange={handleFileInput} />
          </label>
        )}
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      </div>
    );
  }

  if (step === 'mapping' && parseResult) {
    return (
      <GenericCSVMapper
        rawContent={(parseResult.metadata?.rawContent as string) ?? ''}
        onMapped={(result) => { setParseResult(result); setStep('preview'); }}
        onCancel={() => setStep('idle')}
      />
    );
  }

  if ((step === 'preview' || step === 'committing') && smartResult) {
    return (
      <ImportPreviewTable
        result={{ format: 'csv', points: smartResult.entries.map(e => ({ point_no: e.station, bearing: e.bearing, distance: e.distance, raw_data: { deltaE: e.deltaE, deltaN: e.deltaN } })), warnings: smartResult.warnings, errors: smartResult.errors }}
        fileName={fileName}
        onCommit={handleCommit}
        onCancel={() => setStep('idle')}
        committing={step === 'committing'}
        error={error}
        precision={smartResult.relativePrecision}
      />
    );
  }

  if (step === 'done') {
    return (
      <div className="text-center py-12">
        <p className="text-green-600 font-semibold text-lg">Import complete</p>
        {smartResult?.relativePrecision && (
          <p className="text-sm text-gray-600 mt-1">Precision: {smartResult.relativePrecision}</p>
        )}
        <button
          onClick={() => { setStep('idle'); setSmartResult(null); }}
          className="mt-4 px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200"
        >
          Import another file
        </button>
      </div>
    );
  }

  return null;
}
