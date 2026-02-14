import { NextRequest, NextResponse } from 'next/server'

const BRIDGE_URL = process.env.PODCLAW_BRIDGE_URL || 'http://localhost:8000'
const BRIDGE_TOKEN = process.env.PODCLAW_BRIDGE_AUTH_TOKEN || ''

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
  const { path } = await params
  return proxyToBridge(req, path.join('/'))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyToBridge(req, path.join('/'))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyToBridge(req, path.join('/'))
}
