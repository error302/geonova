'use client'

import { useState } from 'react'

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  time: string
  read: boolean
  actionUrl?: string
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'success',
    title: 'Project Completed',
    message: 'Boundary Survey for Karen Project has been completed successfully.',
    time: '2 hours ago',
    read: false,
    actionUrl: '/project/1'
  },
  {
    id: '2',
    type: 'info',
    title: 'Calibration Due',
    message: 'Leica TS16 total station calibration is due in 7 days.',
    time: '5 hours ago',
    read: false,
    actionUrl: '/equipment'
  },
  {
    id: '3',
    type: 'warning',
    title: 'Subscription Expiring',
    message: 'Your Pro subscription expires in 14 days. Please renew.',
    time: '1 day ago',
    read: true,
    actionUrl: '/pricing'
  },
  {
    id: '4',
    type: 'info',
    title: 'New Benchmark Available',
    message: 'New benchmark data added for Nairobi region.',
    time: '2 days ago',
    read: true,
  },
  {
    id: '5',
    type: 'success',
    title: 'Peer Review Complete',
    message: 'Your survey plan has been reviewed by Eng. Joseph Kamau.',
    time: '3 days ago',
    read: true,
    actionUrl: '/peer-review'
  },
]

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(mockNotifications)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '✓'
      case 'warning': return '⚠'
      case 'error': return '✕'
      default: return 'ℹ'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-600">You have {unreadCount} unread notifications</p>
          </div>
          <button
            onClick={markAllAsRead}
            className="text-blue-600 hover:underline"
          >
            Mark all as read
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg font-medium ${
              filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="space-y-3">
          {filteredNotifications.map(notification => (
            <div
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              className={`bg-white rounded-xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition ${
                !notification.read ? 'border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${getTypeColor(notification.type)}`}>
                  {getTypeIcon(notification.type)}
                </span>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                    <span className="text-xs text-gray-500">{notification.time}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                  {notification.actionUrl && (
                    <a
                      href={notification.actionUrl}
                      className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                      onClick={e => e.stopPropagation()}
                    >
                      View details →
                    </a>
                  )}
                </div>
                {!notification.read && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredNotifications.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-3">🔔</div>
            <p>No notifications</p>
          </div>
        )}
      </div>
    </div>
  )
}
