'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { apiUrl } from '@/lib/admin-api'

export function SSEProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only connect if admin session cookie exists
    if (!document.cookie.includes('admin-session')) return

    const eventSource = new EventSource(apiUrl('/api/events/stream'))

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

    // Handle connection errors — silent close, no reload loop
    eventSource.onerror = () => {
      eventSource.close()
    }

    // Cleanup on unmount
    return () => {
      eventSource.close()
    }
  }, [])

  return <>{children}</>
}
