import { getDB } from './syncQueue'

export async function saveFieldbookOffline(fieldbook: any): Promise<void> {
  const db = await getDB()
  await db.put('fieldbooks', fieldbook)
}

export async function getOfflineFieldbooks(projectId: string, type?: string): Promise<any[]> {
  const db = await getDB()
  const all = await db.getAll('fieldbooks')
  return all
    .filter((fb: any) => {
      if (projectId && fb.project_id !== projectId) return false
      if (type && fb.type !== type) return false
      return true
    })
    .sort((a: any, b: any) => String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')))
}

