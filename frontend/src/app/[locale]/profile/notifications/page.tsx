'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, Package, CreditCard, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'
import { apiFetch } from '@/lib/api-fetch'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

const notificationIcons: Record<string, typeof Bell> = {
  order_shipped: Package,
  order_delivered: CheckCircle,
  payment_success: CreditCard,
  payment_failed: AlertCircle,
  info: Info,
  default: Bell,
}

export default function NotificationsPage() {
  const t = useTranslations('profile')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/notifications')
      if (!response.ok) {
        throw new Error('Failed to fetch notifications')
      }

      const data = await response.json()
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await apiFetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      })

      if (!response.ok) {
        throw new Error('Failed to mark notification as read')
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      )
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await apiFetch('/api/notifications/read-all', {
        method: 'PATCH',
      })

      if (!response.ok) {
        throw new Error('Failed to mark all as read')
      }

      // Update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Error marking all as read:', err)
    }
  }

  const getIcon = (type: string) => {
    const Icon = notificationIcons[type] || notificationIcons.default
    return <Icon className="h-5 w-5" />
  }

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('notifications') || 'Notifications'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-start gap-4 p-4 border rounded-lg animate-pulse">
                  <div className="h-10 w-10 bg-muted rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('notifications') || 'Notifications'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4" />
              <p>{error}</p>
              <Button onClick={fetchNotifications} variant="outline" className="mt-4">
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('notifications') || 'Notifications'}</CardTitle>
              <CardDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                  : 'All notifications are read'}
              </CardDescription>
            </div>
            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} variant="outline" size="sm">
                Mark all as read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                  className={`flex items-start gap-4 p-4 border rounded-lg transition-colors ${
                    !notification.is_read
                      ? 'bg-primary/5 border-primary/20 cursor-pointer hover:bg-primary/10'
                      : 'bg-card hover:bg-muted/50'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center h-10 w-10 rounded-full ${
                      !notification.is_read ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className={`font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notification.title}
                      </h3>
                      {!notification.is_read && (
                        <Badge variant="default" className="flex-shrink-0 h-2 w-2 rounded-full p-0" />
                      )}
                    </div>
                    {notification.body && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{notification.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
