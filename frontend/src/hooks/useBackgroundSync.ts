'use client'

import { useEffect, useState } from 'react'
import { useOnlineStatus } from './useOnlineStatus'

interface PendingAction {
  id: string
  type: 'add-to-cart' | 'remove-from-cart' | 'update-cart'
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  timestamp: number
}

/**
 * Hook to manage background sync for offline actions
 * Queues actions when offline and syncs when back online
 */
export function useBackgroundSync() {
  const isOnline = useOnlineStatus()
  const [hasPendingActions, setHasPendingActions] = useState(false)

  useEffect(() => {
    // Listen for sync success messages from service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'sync-success') {
        checkPendingActions()
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleMessage)
    checkPendingActions()

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage)
    }
  }, [])

  useEffect(() => {
    // When coming back online, trigger sync
    if (isOnline && 'serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then((registration) => {
        // @ts-ignore - SyncManager not in all browsers
        return registration.sync.register('sync-cart')
      }).catch((error) => {
        console.error('Failed to register sync:', error)
      })
    }
  }, [isOnline])

  const checkPendingActions = async () => {
    const actions = await getPendingActions()
    setHasPendingActions(actions.length > 0)
  }

  const queueAction = async (action: Omit<PendingAction, 'id' | 'timestamp'>) => {
    const pendingAction: PendingAction = {
      ...action,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    }

    await savePendingAction(pendingAction)
    setHasPendingActions(true)

    // If online and sync is supported, register sync immediately
    if (isOnline && 'serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready
        // @ts-ignore
        await registration.sync.register('sync-cart')
      } catch (error) {
        console.error('Failed to register sync:', error)
      }
    }
  }

  return {
    queueAction,
    hasPendingActions,
  }
}

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pod-ai-sync', 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'id' })
      }
    }
  })
}

async function getPendingActions(): Promise<PendingAction[]> {
  try {
    const db = await openDB()
    const tx = db.transaction('pendingActions', 'readonly')
    const store = tx.objectStore('pendingActions')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return []
  }
}

async function savePendingAction(action: PendingAction): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction('pendingActions', 'readwrite')
    const store = tx.objectStore('pendingActions')
    return new Promise((resolve, reject) => {
      const request = store.add(action)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Failed to save pending action:', error)
  }
}
