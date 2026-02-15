import { NextRequest, NextResponse } from 'next/server'

const BRIDGE_URL = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000'
const BRIDGE_TOKEN = process.env.PODCLAW_BRIDGE_AUTH_TOKEN || ''

function checkAdminAuth(req: NextRequest): NextResponse | null {
  const sessionCookie = req.cookies.get('admin-session')

  if (!sessionCookie) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const sessionData = JSON.parse(sessionCookie.value)
    if (sessionData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
    return null // Auth successful
  } catch {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    )
  }
}

async function proxyToBridge(req: NextRequest, path: string) {
  const url = `${BRIDGE_URL}/${path}${req.nextUrl.search}`
  try {
    const res = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${BRIDGE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? await req.text() : undefined,
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Check admin authentication
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { path } = await params
  return proxyToBridge(req, path.join('/'))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Check admin authentication
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { path } = await params
  return proxyToBridge(req, path.join('/'))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Check admin authentication
  const authError = checkAdminAuth(req)
  if (authError) return authError

  const { path } = await params
  return proxyToBridge(req, path.join('/'))
}
