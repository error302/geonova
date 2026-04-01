'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

export default function WorkspaceRedirect() {
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    if (params.id) {
      router.replace(`/project/${params.id}`)
    }
  }, [params.id, router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-zinc-400 text-sm">Redirecting to main workspace...</div>
    </div>
  )
}