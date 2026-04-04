'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AuditLog {
  id: string
  user_id: string
  action: string
  project_id?: string
  point_id?: string
  details: any
  ip_address: string
  user_agent: string
  created_at: string
  projects?: { name: string } | null
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) {
        supabase
          .from('audit_logs')
          .select('*, projects:project_id(name)')
          .eq('user_id', data.user.id)
          .order('created_at', { ascending: false })
          .limit(100)
          .then(({ data }) => {
            setLogs(data || [])
            setLoading(false)
          })
      } else {
        setLoading(false)
      }
    })
  }, [])

  if (loading) return <div className="max-w-6xl mx-auto px-4 py-8">Loading audit logs...</div>

  if (!user) return <div className="max-w-6xl mx-auto px-4 py-8">Please log in to view audit logs.</div>

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>
      {logs.length === 0 ? (
        <div className="text-[var(--text-muted)]">No audit logs found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Project</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{log.action}</td>
                  <td>{(log as any).projects?.name || log.project_id || '—'}</td>
                  <td className="max-w-md"><pre className="text-xs">{JSON.stringify(log.details, null, 2)}</pre></td>
                  <td>{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
