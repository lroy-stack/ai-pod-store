'use client'

import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/admin-api'

const RECONNECT_DELAYS = [5000, 10000, 30000, 60000] // 5s, 10s, 30s, 60s

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    // Note: admin-session is httpOnly — not readable via document.cookie
    // The SSE endpoint validates the session server-side and returns 401 if invalid
    const eventSource = new EventSource(apiUrl('/api/events/stream'))
    eventSourceRef.current = eventSource

    eventSource.addEventListener('connected', () => {
      console.log('[SSE] Connected to admin event stream')
    })

    eventSource.addEventListener('heartbeat', () => {
      // Silent heartbeat
    })

    // Handle new order events
    eventSource.addEventListener('new_order', (e) => {
      try {
        const data = JSON.parse(e.data)
        toast.success('New Order', {
          description: `Order #${data.order_id || 'N/A'} received`,
          action: data.order_id ? {
            label: 'View',
            onClick: () => { window.location.href = `/orders/${data.order_id}` }
          } : undefined
        })
      } catch (err) {
        console.error('[SSE] Failed to parse new_order event:', err)
      }
    })

    // Handle agent cycle completion events
    eventSource.addEventListener('agent_cycle', (e) => {
      try {
        const data = JSON.parse(e.data)
        toast.info('Agent Cycle Complete', {
          description: `${data.agent_name || 'Agent'} finished cycle`,
          action: {
            label: 'View',
            onClick: () => { window.location.href = '/agent' }
          }
        })
      } catch (err) {
        console.error('[SSE] Failed to parse agent_cycle event:', err)
      }
    })

    // Handle error events
    eventSource.addEventListener('error_alert', (e) => {
      try {
        const data = JSON.parse(e.data)
        toast.error('System Error', {
          description: data.message || 'An error occurred',
          duration: 10000
        })
      } catch (err) {
        console.error('[SSE] Failed to parse error_alert event:', err)
      }
    })

    // Handle generic alerts
    eventSource.addEventListener('alert', (e) => {
      try {
        const data = JSON.parse(e.data)
        toast.warning('Alert', {
          description: data.message || 'System alert',
          duration: 8000
        })
      } catch (err) {
        console.error('[SSE] Failed to parse alert event:', err)
      }
    })

    // Handle sync error events (e.g. Printful sync failed)
    eventSource.addEventListener('sync_error', (e) => {
      try {
        const data = JSON.parse(e.data)
        toast.error('Sync Error', {
          description: data.message || 'Sync operation failed',
          duration: 10000,
          action: data.url ? {
            label: 'Details',
            onClick: () => { window.location.href = data.url }
          } : undefined
        })
      } catch (err) {
        console.error('[SSE] Failed to parse sync_error event:', err)
      }
    })

    // Handle webhook failure events
    eventSource.addEventListener('webhook_failed', (e) => {
      try {
        const data = JSON.parse(e.data)
        toast.error('Webhook Failed', {
          description: data.message || `Webhook delivery failed${data.event_type ? `: ${data.event_type}` : ''}`,
          duration: 10000
        })
      } catch (err) {
        console.error('[SSE] Failed to parse webhook_failed event:', err)
      }
    })

    // Handle margin alert events
    eventSource.addEventListener('margin_alert', (e) => {
      try {
        const data = JSON.parse(e.data)
        toast.warning('Margin Alert', {
          description: data.message || `Product margin below threshold${data.product_name ? `: ${data.product_name}` : ''}`,
          duration: 8000,
          action: data.product_id ? {
            label: 'View',
            onClick: () => { window.location.href = `/products/${data.product_id}` }
          } : undefined
        })
      } catch (err) {
        console.error('[SSE] Failed to parse margin_alert event:', err)
      }
    })

    // Handle data integrity issue events
    eventSource.addEventListener('integrity_issue', (e) => {
      try {
        const data = JSON.parse(e.data)
        toast.error('Integrity Issue', {
          description: data.message || 'Data integrity issue detected',
          duration: 12000,
          action: data.url ? {
            label: 'Investigate',
            onClick: () => { window.location.href = data.url }
          } : undefined
        })
      } catch (err) {
        console.error('[SSE] Failed to parse integrity_issue event:', err)
      }
    })

    // Dispatch custom events so NotificationsContext can listen without duplicate SSE
    const dispatchSSE = (type: string, data: any) => {
      window.dispatchEvent(new CustomEvent('sse-event', { detail: { type, data } }))
    }

    // Re-dispatch all known event types for NotificationsContext
    for (const eventType of ['new_order', 'agent_cycle', 'error_alert', 'alert', 'sync_error', 'webhook_failed', 'margin_alert', 'integrity_issue', 'notification']) {
      eventSource.addEventListener(eventType, (e: MessageEvent) => {
        try {
          dispatchSSE(eventType, JSON.parse(e.data))
        } catch { /* already handled by specific listeners above */ }
      })
    }

    // Reset reconnect counter on successful connection
    eventSource.onopen = () => {
      reconnectAttemptRef.current = 0
    }

    // Handle connection errors with exponential backoff reconnection
    eventSource.onerror = () => {
      eventSource.close()
      eventSourceRef.current = null
      const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)]
      reconnectAttemptRef.current++
      reconnectTimerRef.current = setTimeout(() => {
        connect()
      }, delay)
    }
  }, [])  

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connect])  

  return <>{children}</>
}
