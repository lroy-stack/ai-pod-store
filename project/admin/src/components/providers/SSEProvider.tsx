'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

interface SSEEvent {
  type: 'new_order' | 'agent_cycle' | 'error' | 'alert'
  message: string
  data?: any
}

export function SSEProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Establish SSE connection
    const eventSource = new EventSource('/api/events/stream')

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
            onClick: () => window.location.href = `/orders/${data.order_id}`
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
            onClick: () => window.location.href = '/agent'
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
          duration: 10000 // Longer duration for errors
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

    // Handle connection errors
    eventSource.onerror = (err) => {
      console.error('[SSE] Connection error:', err)
      eventSource.close()

      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        console.log('[SSE] Attempting to reconnect...')
        window.location.reload()
      }, 5000)
    }

    // Cleanup on unmount
    return () => {
      eventSource.close()
    }
  }, [])

  return <>{children}</>
}
