'use client';

/**
 * LogoUpload Component
 *
 * Drag & drop or click to upload company logo.
 * - Shows plan restriction for free users (upgrade CTA)
 * - Preview current logo
 * - Remove logo button
 * - Validates: max 2MB, PNG/JPG/SVG only
 * - Crop/resize to fit document header (max 200x60px in document)
 */

import { useCallback, useRef, useState } from 'react';
import type { PlanId } from '@/lib/subscription/catalog';
import SubscriptionBadge from '@/components/SubscriptionBadge';

interface LogoInfo {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  widthPx?: number;
  heightPx?: number;
  createdAt: string;
}

interface LogoUploadProps {
  /** Current plan of the user */
  plan: PlanId;
  /** Existing logo (if any), fetched server-side */
  existingLogo?: LogoInfo | null;
  /** Callback after successful upload */
  onUploadSuccess?: (logo: LogoInfo) => void;
  /** Callback after successful delete */
  onDeleteSuccess?: () => void;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];
const ALLOWED_EXTENSIONS = '.png, .jpg, .jpeg, .svg';

export default function LogoUpload({
  plan,
  existingLogo,
  onUploadSuccess,
  onDeleteSuccess,
}: LogoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<LogoInfo | null>(existingLogo ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFree = plan === 'free';

  // Read file and create preview
  const processFile = useCallback((file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`Invalid format. Allowed: ${ALLOWED_EXTENSIONS}`);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size: 2MB.');
      return;
    }

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload the file
    uploadLogo(file);
  }, []);

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch('/api/documents/logo', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as { upgradeRequired?: boolean; error?: string };

      if (!res.ok) {
        if (data.upgradeRequired) {
          setError('Upgrade to Pro or higher to upload your company logo.');
        } else {
          setError(data.error || 'Upload failed');
        }
        setPreview(null);
        return;
      }

      // Fetch the updated logo metadata
      const metaRes = await fetch('/api/documents/logo');
      const metaData = (await metaRes.json()) as { logo?: LogoInfo };

      if (metaData.logo) {
        setLogo(metaData.logo);
        onUploadSuccess?.(metaData.logo);
      }
    } catch (err) {
      console.error('[LogoUpload] Upload error:', err);
      setError('Upload failed. Please try again.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      if (isFree) return;

      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [isFree, processFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!isFree) setDragOver(true);
    },
    [isFree]
  );

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch('/api/documents/logo', { method: 'DELETE' });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || 'Delete failed');
        return;
      }

      setLogo(null);
      setPreview(null);
      onDeleteSuccess?.();
    } catch (err) {
      console.error('[LogoUpload] Delete error:', err);
      setError('Delete failed. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── Free tier: locked state ─────────────────────────────────────
  if (isFree) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border-color)] p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <svg
            className="w-8 h-8 text-[var(--text-secondary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <SubscriptionBadge plan={plan} compact />
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-2">
          Custom company logos are available on Pro and higher plans.
        </p>
        <p className="text-xs text-[var(--text-tertiary)] mb-4">
          Free tier documents use the METARDU watermark.
        </p>
        <a
          href="/pricing"
          className="inline-flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
        >
          Upgrade to Pro
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    );
  }

  // ─── Paid tier: upload interface ──────────────────────────────────
  const displaySrc = preview || (logo ? `/api/documents/logo/data` : null);

  return (
    <div className="space-y-4">
      {/* Current logo preview */}
      {displaySrc && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
          <div className="flex-shrink-0 w-[200px] h-[60px] bg-white rounded border border-gray-200 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displaySrc}
              alt="Company logo preview"
              className="max-w-full max-h-full object-contain"
              style={{ maxWidth: '200px', maxHeight: '60px' }}
            />
          </div>
          <div className="flex-1 min-w-0">
            {logo && (
              <div className="text-sm">
                <p className="font-medium truncate">{logo.filename}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {formatFileSize(logo.fileSize)}
                  {logo.widthPx && logo.heightPx && (
                    <> &middot; {logo.widthPx}×{logo.heightPx}px</>
                  )}
                </p>
              </div>
            )}
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Document size: 200×60px max
            </p>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-shrink-0 px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      )}

      {/* Drop zone */}
      {!displaySrc && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors
            ${dragOver
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
              : 'border-[var(--border-color)] hover:border-emerald-400 hover:bg-[var(--bg-secondary)]'
            }
          `}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload company logo"
        >
          <svg
            className="w-10 h-10 mx-auto text-[var(--text-secondary)] mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {uploading ? 'Uploading…' : 'Drop your logo here or click to browse'}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            PNG, JPG, or SVG &middot; Max 2MB
          </p>
        </div>
      )}

      {/* Change logo link when logo exists */}
      {displaySrc && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Change logo'}
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <svg
            className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
