'use client'

import { useState, useRef, useCallback } from 'react'

interface AvatarUploaderProps {
  currentAvatar: string | null
  fullName: string
  email: string
  userId: string
  onUploaded: (url: string) => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export default function AvatarUploader({
  currentAvatar,
  fullName,
  email,
  onUploaded,
}: AvatarUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatar)
  const inputRef = useRef<HTMLInputElement>(null)

  const initials = (fullName || email || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)

      // Client-side validation
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Please upload a PNG, JPEG, WebP, or GIF image.')
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setError('Image must be 5MB or smaller.')
        return
      }

      setUploading(true)

      try {
        // Local preview
        const localUrl = URL.createObjectURL(file)
        setPreviewUrl(localUrl)

        // Upload via /api/storage (multipart)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('bucket', 'avatars')

        const res = await fetch('/api/storage', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: 'Upload failed' }))) as { error?: string }
          throw new Error(err.error || `Upload failed (status ${res.status})`)
        }

        const json = await res.json()
        const storedPath = json.data?.path as string | undefined
        if (!storedPath) throw new Error('Storage did not return a file path')

        // The avatar URL is the storage endpoint with the path
        const avatarUrl = `/api/storage?path=${encodeURIComponent(storedPath)}`
        setPreviewUrl(avatarUrl)
        onUploaded(avatarUrl)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
        // Revert preview on failure
        setPreviewUrl(currentAvatar)
      } finally {
        setUploading(false)
        // Reset input so selecting the same file again triggers onChange
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [currentAvatar, onUploaded],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div className="mb-6 p-5 sm:p-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Avatar</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Shown in the navbar, dashboard, and on shared projects. PNG, JPEG, WebP, or GIF up to 5MB.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Avatar preview */}
        <div className="flex-shrink-0">
          <div
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-[var(--bg-tertiary)] border-2 border-[var(--border-color)] flex items-center justify-center text-2xl font-semibold text-[var(--text-secondary)]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={fullName || 'Your avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <span aria-hidden>{initials || '?'}</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-black rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? 'Uploading…' : 'Upload new image'}
            </button>
            {currentAvatar && (
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(null)
                  onUploaded('')
                }}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-50 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Tip: Drag and drop an image onto the circle above.
          </p>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
