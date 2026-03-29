'use client'

import { useState } from 'react'
import BoundaryUploader from '@/components/cadastra/BoundaryUploader'
import ComparisonPanel from '@/components/cadastra/ComparisonPanel'
import ValidationReport from '@/components/cadastra/ValidationReport'
import { validateBoundary } from '@/lib/compute/cadastraValidator'
import type { BoundaryPolygon, ValidationResult } from '@/types/cadastra'

export default function CadastraValidatorPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const projectId = 'default-project'
  
  const handleValidate = async (boundary: BoundaryPolygon) => {
    setLoading(true)
    try {
      const response = await validateBoundary(projectId, boundary)
      setResult(response.validation)
    } catch (err) {
      console.error(err)
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
            <ValidationReport result={result} projectId={projectId} />
          </>
        )}
      </div>
    </div>
  )
}