import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import type { SessionData } from '@/lib/session'
import { requiredEnv } from '@/lib/env'

const BRIDGE_URL = requiredEnv('PODCLAW_BRIDGE_URL')
const BRIDGE_TOKEN = requiredEnv('PODCLAW_BRIDGE_AUTH_TOKEN')

export const GET = withAuth(async (
  req: NextRequest,
  session: SessionData,
  context?: { params: Promise<{ id: string }> }
) => {
  const { id } = await context!.params
  try {
    const res = await fetch(`${BRIDGE_URL}/chat/conversations/${id}`, {
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
})

export const DELETE = withAuth(async (
  req: NextRequest,
  session: SessionData,
  context?: { params: Promise<{ id: string }> }
) => {
  const { id } = await context!.params
  try {
    const res = await fetch(`${BRIDGE_URL}/chat/conversations/${id}`, {
      method: 'DELETE',
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
})
