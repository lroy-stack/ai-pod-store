import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import type { SessionData } from '@/lib/session'

const BRIDGE_URL = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000'
const BRIDGE_TOKEN = process.env.PODCLAW_BRIDGE_AUTH_TOKEN || ''

export const POST = withAuth(async (req: NextRequest, session: SessionData) => {
  const body = await req.json()

  try {
    const res = await fetch(`${BRIDGE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BRIDGE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const error = await res.text()
      return NextResponse.json(
        { error: `Bridge error: ${error}` },
        { status: res.status }
      )
    }

    // Passthrough the SSE stream
    return new Response(res.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'PodClaw bridge offline', offline: true },
      { status: 503 }
    )
  }
})
