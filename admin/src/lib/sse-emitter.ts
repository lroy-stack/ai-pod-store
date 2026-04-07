// Simple in-memory event emitter for SSE
// NOTE: This only works for single-instance deployments
// For multi-instance production, use Redis pub/sub

type SSECallback = (event: string, data: any) => void

class SSEEmitter {
  private listeners: Set<SSECallback> = new Set()

  subscribe(callback: SSECallback) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  emit(event: string, data: any) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data)
      } catch (err) {
        console.error('[SSEEmitter] Callback error:', err)
      }
    })
  }

  getListenerCount() {
    return this.listeners.size
  }
}

// Global singleton instance
export const sseEmitter = new SSEEmitter()
