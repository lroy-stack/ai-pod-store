import { NextRequest, NextResponse } from 'next/server'
import { sseEmitter } from '@/lib/sse-emitter'

// This endpoint simulates SSE events for testing
// In production, events would be triggered by actual system events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { eventType = 'new_order', data = {} } = body

    // Emit event to all connected SSE clients
    sseEmitter.emit(eventType, {
      ...data,
      timestamp: Date.now()
    })

    return NextResponse.json({
      success: true,
      message: 'Event broadcasted to SSE clients',
      eventType,
      data,
      listeners: sseEmitter.getListenerCount()
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
