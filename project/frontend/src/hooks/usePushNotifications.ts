'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { apiFetch } from '@/lib/api-fetch'

export function usePushNotifications() {
  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Check current permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (!user) return false
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

    try {
      setLoading(true)

      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.warn('[Push] VAPID public key not configured')
        return false
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })

      const subJson = subscription.toJSON()

      const res = await apiFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      })

      if (res.ok) {
        setSubscribed(true)
        return true
      }
      return false
    } catch (error) {
      console.error('[Push] Subscribe error:', error)
      return false
    } finally {
      setLoading(false)
    }
  }, [user])

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false

    const result = await Notification.requestPermission()
    setPermission(result)

    if (result === 'granted') {
      return await subscribe()
    }
    return false
  }, [subscribe])

  return {
    permission,
    subscribed,
    loading,
    requestPermission,
    supported: typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window,
  }
}
