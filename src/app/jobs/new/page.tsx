'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import JobForm from '@/components/jobs/JobForm'

export default function NewJobPage() {
  const router = useRouter()

  const handleSuccess = () => {
    router.push('/jobs')
    router.refresh() // Revalidate route
  }

  useEffect(() => {
    // Page title
    document.title = 'New Field Mission - GeoNova'
  }, [])

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center">
          <button 
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-200 flex items-center gap-2"
          >
            ← Back
          </button>
          <span className="ml-4 text-gray-400 font-medium">/ New Mission</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-100 mb-3">New Field Mission</h1>
          <p className="text-gray-400">GeoNova will recommend equipment and generate preparation checklists</p>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
          <JobForm onSuccess={handleSuccess} />
        </div>

        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>Need location mapping? Add it in mission details after creation 📍</p>
        </div>
      </main>
    </div>
  )
}

