import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { requiredEnv } from '@/lib/env'

const PODCLAW_BRIDGE_URL = requiredEnv('PODCLAW_BRIDGE_URL')
const PODCLAW_API_KEY = requiredEnv('PODCLAW_API_KEY')

/**
 * GET /api/admin/agent/soul
 *
 * Returns current SOUL.md content and pending proposals
 */
export const GET = withAuth(async (req, session) => {
  try {
    // Fetch current SOUL.md content
    const soulRes = await fetch(`${PODCLAW_BRIDGE_URL}/soul`, {
      headers: {
        'Authorization': `Bearer ${PODCLAW_API_KEY}`,
      },
    })

    if (!soulRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch SOUL.md' },
        { status: soulRes.status }
      )
    }

    const soulData = await soulRes.json()

    // Fetch pending proposals
    const proposalsRes = await fetch(`${PODCLAW_BRIDGE_URL}/soul/proposals`, {
      headers: {
        'Authorization': `Bearer ${PODCLAW_API_KEY}`,
      },
    })

    if (!proposalsRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch proposals' },
        { status: proposalsRes.status }
      )
    }

    const proposalsData = await proposalsRes.json()

    return NextResponse.json({
      soul: soulData.content || '',
      proposals: proposalsData.proposals || [],
      count: proposalsData.count || 0,
    })
  } catch (error) {
    console.error('Failed to fetch soul data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

/**
 * POST /api/admin/agent/soul
 *
 * Approve or reject a soul proposal
 * Body: { action: 'approve' | 'reject', proposalId: string, reason?: string }
 */
export const POST = withAuth(async (req, session) => {
  try {
    const body = await req.json()
    const { action, proposalId, reason } = body

    if (!action || !proposalId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, proposalId' },
        { status: 400 }
      )
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    const endpoint = action === 'approve'
      ? `${PODCLAW_BRIDGE_URL}/soul/proposals/${proposalId}/approve`
      : `${PODCLAW_BRIDGE_URL}/soul/proposals/${proposalId}/reject`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PODCLAW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: action === 'reject' && reason ? JSON.stringify({ reason }) : undefined,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.detail || `Failed to ${action} proposal` },
        { status: response.status }
      )
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to process soul proposal:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
