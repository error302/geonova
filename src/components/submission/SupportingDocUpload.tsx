'use client';

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/api-client/client'
import { logger } from '@/lib/logger'

interface Doc {
  id: string
  type: string
  label: string
  required: boolean
  file_url: string | null
}

export function SupportingDocUpload({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const dbClient = useMemo(() => createClient(), [])

  const loadDocs = useCallback(async () => {
    const { data } = await dbClient
      .from('supporting_documents')
      .select('*')
            .eq('project_id', projectId) as unknown as { data: Doc[] | null }
    setDocs((data ?? []) as Doc[])
  }, [projectId, dbClient])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  async function handleUpload(docId: string, docType: string, file: File) {
    setUploading(docId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', `submission-docs/${projectId}/${docType}`)

      const res = await fetch('/api/storage', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Upload failed')

      const json = await res.json() as { url: string }
      const fileUrl = json.url

      await dbClient
        .from('supporting_documents')
        .update({
          file_url: fileUrl,
          uploaded_at: new Date().toISOString()
        })
        .eq('id', docId)

      await loadDocs()
    } catch (err) {
      logger.error('Upload failed:', { error: err })
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Supporting Documents</h3>
      {docs.map(doc => (
        <div
          key={doc.id}
          className="flex items-center justify-between border rounded-lg p-4"
        >
          <div>
            <p className="font-medium text-sm">{doc.label}</p>
            <p className="text-xs text-muted-foreground">
              {doc.required ? 'Required' : 'Optional'}
              {doc.file_url && (
                <span className="ml-2 text-green-400"> Uploaded</span>
              )}
            </p>
          </div>
          <label className="cursor-pointer">
            <span className="text-sm bg-secondary px-3 py-1.5 rounded border">
              {uploading === doc.id ? 'Uploading...' : doc.file_url ? 'Replace' : 'Upload PDF'}
            </span>
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              disabled={uploading === doc.id}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleUpload(doc.id, doc.type, file)
              }}
            />
          </label>
        </div>
      ))}
    </div>
  )
}
