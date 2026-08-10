import { getDB } from './syncQueue'

export async function saveFieldbookOffline(fieldbook: Record<string, unknown>): Promise<void> {
  const db = await getDB()
  await db.put('fieldbooks', fieldbook)
}

export async function getOfflineFieldbooks(projectId: string, type?: string): Promise<any[]> {
  const db = await getDB()
  const all = await db.getAll('fieldbooks')
  return all
    .filter((fb: { project_id?: string; type?: string }) => {
      if (projectId && fb.project_id !== projectId) return false
      if (type && fb.type !== type) return false
      return true
    })
    .sort((a: { updated_at?: string | null; created_at?: string | null }, b: { updated_at?: string | null; created_at?: string | null }) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')))
}

