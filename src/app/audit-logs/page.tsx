// ponytail: Phase 5 Batch 3 — converted from 'use client' + useEffect + createClient()
// (legacy Supabase proxy) to a server component with direct db.query().
// Eliminates the client-side fetch roundtrip; data is in the initial HTML.

import { auth } from '@/lib/auth-v5'
import { db, setCurrentUserId } from '@/lib/db'
import Link from 'next/link'

interface AuditLog {
  id: string
  user_id: string
  action: string
  table_name: string | null
  record_id: string | null
  details: unknown
  ip_address: string | null
  created_at: string
}

export default async function AuditLogsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        Please <Link href="/login" className="text-[var(--accent)] underline">log in</Link> to view audit logs.
      </div>
    )
  }

  setCurrentUserId(String(session.user.id))

  let logs: AuditLog[] = []
  let dbError = false

  try {
    const { rows } = await db.query(
      `SELECT id, user_id, action, table_name, record_id, details, ip_address, created_at
       FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [session.user.id],
    )
    logs = rows as AuditLog[]
  } catch {
    dbError = true
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>
      {dbError ? (
        <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-400 text-sm">
          Unable to load audit logs. The database may be temporarily unavailable.
        </div>
      ) : logs.length === 0 ? (
        <div className="text-[var(--text-muted)]">No audit logs found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Table</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{log.action}</td>
                  <td>{log.table_name || '—'}</td>
                  <td className="max-w-md"><pre className="text-xs">{JSON.stringify(log.details, null, 2)}</pre></td>
                  <td>{log.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
