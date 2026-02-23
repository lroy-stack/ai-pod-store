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

export async function GET(req: NextRequest) {
  const authError = checkAdminAuth(req)
  if (authError) return authError

  try {
    const res = await fetch(`${BRIDGE_URL}/chat/conversations${req.nextUrl.search}`, {
      headers: { 'Authorization': `Bearer ${BRIDGE_TOKEN}` },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json(
      { error: 'PodClaw bridge offline', offline: true },
      { status: 503 }
    )
  }
}
