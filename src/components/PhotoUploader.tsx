'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Photo } from '@/lib/reports/surveyReport/types'

interface PhotoUploaderProps {
  projectId: string
  photos: Photo[]
  onChange: (photos: Photo[]) => void
  maxPhotos?: number
}

export default function PhotoUploader({ projectId, photos, onChange, maxPhotos = 8 }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (photos.length >= maxPhotos) return

    setUploading(true)
    const remaining = maxPhotos - photos.length
    const toUpload = Array.from(files).slice(0, remaining)

    try {
      for (const file of toUpload) {
        const ext = file.name.split('.').pop()
        const filename = `${projectId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('survey_photos')
          .upload(filename, file, { contentType: file.type })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          continue
        }

        const { data: urlData } = supabase.storage
          .from('survey_photos')
          .getPublicUrl(filename)

        const newPhoto: Photo = {
          filename,
          url: urlData.publicUrl,
          caption: file.name.replace(/\.[^.]+$/, ''),
          orientation: '',
          dateTaken: new Date().toISOString().slice(0, 10),
        }

        onChange([...photos, newPhoto])
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = (index: number) => {
    const updated = [...photos]
    updated.splice(index, 1)
    onChange(updated)
  }

  const updatePhoto = (index: number, field: keyof Photo, value: string) => {
    const updated = [...photos]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      {photos.length < maxPhotos && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border-color)] hover:border-[var(--accent)]/50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <div>
              <p className="text-sm text-[var(--text-primary)] font-medium">
                {uploading ? 'Uploading...' : 'Drop photos here or click to upload'}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {photos.length}/{maxPhotos} photos · JPG, PNG, WebP
              </p>
            </div>
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {photos.map((photo, i) => (
            <div key={i} className="border border-[var(--border-color)] rounded-lg p-3 bg-[var(--bg-tertiary)]/30">
              <div className="flex gap-2">
                <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-[var(--bg-tertiary)]">
                  <img src={photo.url} alt={photo.caption || ''} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    value={photo.caption || ''}
                    onChange={e => updatePhoto(i, 'caption', e.target.value)}
                    placeholder="Caption"
                    className="w-full px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                  />
                  <input
                    value={photo.orientation || ''}
                    onChange={e => updatePhoto(i, 'orientation', e.target.value)}
                    placeholder="View direction (e.g. Looking North)"
                    className="w-full px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
