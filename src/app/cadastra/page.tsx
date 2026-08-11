'use client';

import { useState, useEffect } from 'react'
import BoundaryUploader from '@/components/cadastra/BoundaryUploader'
import ComparisonPanel from '@/components/cadastra/ComparisonPanel'
import ValidationReport from '@/components/cadastra/ValidationReport'
import { validateBoundary } from '@/lib/compute/cadastraValidator'
import type { BoundaryPolygon, ValidationResult } from '@/types/cadastra'
import { logger } from '@/lib/logger'

export default function CadastraValidatorPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  // AUDIT FIX (2026-07-03): Was hardcoded 'default-project'. Now reads
  // projectId from URL query (?project=X) or null for standalone mode.
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('project') || params.get('projectId')
    if (pid) setProjectId(pid)
  }, [])
  
  const handleValidate = async (boundary: BoundaryPolygon) => {
    setLoading(true)
    try {
      const response = await validateBoundary(projectId, boundary)
      setResult(response.validation)
    } catch (err) {
      logger.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">CadastraAI Validator</h1>
      
      <div className="space-y-6">
        <BoundaryUploader onUpload={handleValidate} loading={loading} />
        
        {result && (
          <>
            <ComparisonPanel result={result} />
            <ValidationReport result={result} projectId={projectId ?? 'standalone'} />
          </>
        )}
      </div>
    </div>
  )
}