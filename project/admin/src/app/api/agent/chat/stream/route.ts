import { NextRequest, NextResponse } from 'next/server'

const BRIDGE_URL = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000'
const BRIDGE_TOKEN = process.env.PODCLAW_BRIDGE_AUTH_TOKEN || ''

function checkAdminAuth(req: NextRequest): NextResponse | null {
  const sessionCookie = req.cookies.get('admin-session')
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const sessionData = JSON.parse(sessionCookie.value)
    if (sessionData.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    return null
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

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
}
