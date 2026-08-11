import { getDB } from './syncQueue'
import type { SavedFieldbook } from '@/app/fieldbook/types'

export async function saveFieldbookOffline(fieldbook: Record<string, unknown>): Promise<void> {
  const db = await getDB()
  await db.put('fieldbooks', fieldbook)
}

export async function getOfflineFieldbooks(projectId: string, type?: string): Promise<SavedFieldbook[]> {
  const db = await getDB()
  const all = await db.getAll('fieldbooks')
  return all
    .filter((fb: Record<string, unknown>) => {
      if (projectId && fb.project_id !== projectId) return false
      if (type && fb.type !== type) return false
      return true
    })
    .sort((a: Record<string, unknown>, b: Record<string, unknown>) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? ''))) as SavedFieldbook[]
}

