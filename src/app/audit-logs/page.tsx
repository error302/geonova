'use client'

import { useState } from 'react'

interface AuditLog {
  id: string
  action: string
  resource: string
  user: string
  timestamp: string
  ipAddress: string
  details?: string
}

const mockLogs: AuditLog[] = [
  {
    id: '1',
    action: 'CREATE',
    resource: 'Project',
    user: 'john@survey.co.ke',
    timestamp: '2024-01-15 14:32:15',
    ipAddress: '197.232.1.1',
    details: 'Created project: Karen Residential Survey'
  },
  {
    id: '2',
    action: 'UPDATE',
    resource: 'Survey Points',
    user: 'john@survey.co.ke',
    timestamp: '2024-01-15 14:35:22',
    ipAddress: '197.232.1.1',
    details: 'Added 12 new survey points'
  },
  {
    id: '3',
    action: 'EXPORT',
    resource: 'Data',
    user: 'john@survey.co.ke',
    timestamp: '2024-01-15 14:40:08',
    ipAddress: '197.232.1.1',
    details: 'Exported project to DXF format'
  },
  {
    id: '4',
    action: 'LOGIN',
    resource: 'Auth',
    user: 'jane@company.co.ke',
    timestamp: '2024-01-15 13:22:45',
    ipAddress: '197.232.2.55',
    details: 'Successful login'
  },
  {
    id: '5',
    action: 'DELETE',
    resource: 'Point',
    user: 'john@survey.co.ke',
    timestamp: '2024-01-15 12:15:33',
    ipAddress: '197.232.1.1',
    details: 'Deleted point: TP-015'
  },
  {
    id: '6',
    action: 'SIGN',
    resource: 'Document',
    user: 'john@survey.co.ke',
    timestamp: '2024-01-15 11:45:12',
    ipAddress: '197.232.1.1',
    details: 'Digitally signed survey report'
  },
  {
    id: '7',
    action: 'API_CALL',
    resource: 'Coordinates',
    user: 'system',
    timestamp: '2024-01-15 10:30:00',
    ipAddress: '197.232.1.1',
    details: 'Coordinate transformation API call'
  },
  {
    id: '8',
    action: 'UPDATE',
    resource: 'Settings',
    user: 'admin@company.co.ke',
    timestamp: '2024-01-15 09:15:44',
    ipAddress: '197.232.3.100',
    details: 'Updated organization settings'
  },
]

export default function AuditLogsPage() {
  const [logs] = useState(mockLogs)
  const [filter, setFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const filteredLogs = logs.filter(log => {
    const matchesSearch = filter === '' || 
      log.action.toLowerCase().includes(filter.toLowerCase()) ||
      log.resource.toLowerCase().includes(filter.toLowerCase()) ||
      log.user.toLowerCase().includes(filter.toLowerCase())
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter
    
    return matchesSearch && matchesAction
  })

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800'
      case 'UPDATE': return 'bg-blue-100 text-blue-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      case 'EXPORT': return 'bg-purple-100 text-purple-800'
      case 'LOGIN': return 'bg-gray-100 text-gray-800'
      case 'SIGN': return 'bg-yellow-100 text-yellow-800'
      case 'API_CALL': return 'bg-cyan-100 text-cyan-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600">Track all activities in your account</p>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Search logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 min-w-64 p-3 border rounded-lg"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="p-3 border rounded-lg"
          >
            <option value="all">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="EXPORT">Export</option>
            <option value="LOGIN">Login</option>
            <option value="SIGN">Sign</option>
          </select>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Action</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Resource</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Details</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">IP Address</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs rounded ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm">{log.resource}</td>
                  <td className="py-3 px-4 text-sm">{log.user}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                    {log.details}
                  </td>
                  <td className="py-3 px-4 text-sm font-mono text-gray-500">
                    {log.ipAddress}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {log.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No logs found matching your criteria</p>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          Showing {filteredLogs.length} of {logs.length} log entries
        </div>
      </div>
    </div>
  )
}
