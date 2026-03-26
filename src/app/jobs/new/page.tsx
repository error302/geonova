'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import JobForm from '@/components/jobs/JobForm'

export default function NewJobPage() {
  const router = useRouter()

  const handleSuccess = () => {
    router.push('/jobs')
    router.refresh()
  }

  useEffect(() => {
    document.title = 'New Field Mission - METARDU'
  }, [])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center">
          <button 
            onClick={() => router.back()}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-2"
          >
            ← Back
          </button>
          <span className="ml-4 text-[var(--text-secondary)] font-medium">/ New Mission</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-3">New Field Mission</h1>
          <p className="text-[var(--text-secondary)]">METARDU will recommend equipment and generate preparation checklists</p>
        </div>

        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-2xl p-8">
          <JobForm onSuccess={handleSuccess} />
        </div>

        <div className="mt-12 text-center text-[var(--text-muted)] text-sm">
          <p>Need location mapping? Add it in mission details after creation 📍</p>
        </div>
      </main>
    </div>
  )
}

