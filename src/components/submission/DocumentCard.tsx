'use client';

import { useState } from 'react';
import { SubmissionDocument, DocumentStatus, ProjectDocument } from '@/types/submission';

interface Props {
  doc: SubmissionDocument;
  projectId: string;
  existing: ProjectDocument | null;
  onStatusChange: (documentId: string, status: DocumentStatus, fileUrl?: string) => void;
}

const STATUS_CONFIG: Record<DocumentStatus, { label: string; color: string }> = {
  missing: { label: 'Missing', color: 'text-gray-500' },
  pending: { label: 'Not generated', color: 'text-gray-400' },
  generating: { label: 'Generating…', color: 'text-blue-500' },
  ready: { label: 'Ready', color: 'text-green-600' },
  error: { label: 'Failed', color: 'text-red-500' },
};

const FORMAT_BADGE: Record<string, string> = {
  pdf:     'bg-red-100 text-red-700',
  xlsx:    'bg-green-100 text-green-700',
  zip:     'bg-purple-100 text-purple-700',
  dxf:     'bg-yellow-100 text-yellow-700',
  shp:     'bg-blue-100 text-blue-700',
  geojson: 'bg-teal-100 text-teal-700',
};

export default function DocumentCard({ doc, projectId, existing, onStatusChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const status: DocumentStatus = existing?.status ?? 'pending';
  const fileUrl = existing?.file_url ?? null;
  const statusConfig = STATUS_CONFIG[status];

  const handleGenerate = async () => {
    setLoading(true);
    setLocalError(null);
    onStatusChange(doc.id, 'generating');

    try {
      const res = await fetch('/api/submission/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, documentId: doc.id }),
      });

      const data = await res.json() as { error?: string; fileUrl?: string };

      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Generation failed');
      }

      onStatusChange(doc.id, 'ready', data.fileUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? (err as Error).message : 'Unknown error';
      setLocalError(message);
      onStatusChange(doc.id, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">{doc.label}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${FORMAT_BADGE[doc.format] ?? 'bg-gray-100 text-gray-600'}`}>
          {doc.format.toUpperCase()}
        </span>
      </div>

      <ul className="text-xs text-gray-400 list-disc list-inside space-y-0.5">
        {doc.requiredData.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p className={`text-xs font-medium ${statusConfig.color}`}>
        {statusConfig.label}
        {existing?.generated_at && status === 'ready' && (
          <span className="text-gray-400 font-normal ml-1">
            — {new Date(existing.generated_at).toLocaleTimeString()}
          </span>
        )}
      </p>

{(localError || (status === 'error' && existing?.errorMessage)) && (
    <p className="text-xs text-red-500 bg-red-50 rounded p-2 leading-relaxed">
      {localError ?? existing?.errorMessage}
    </p>
      )}

      <div className="flex gap-2 mt-auto">
        <button
          onClick={handleGenerate}
          disabled={loading || status === 'generating'}
          className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {status === 'ready' ? 'Regenerate' : 'Generate'}
        </button>

        {status === 'ready' && fileUrl && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 text-center transition-colors"
          >
            Download
          </a>
        )}
      </div>
    </div>
  );
}