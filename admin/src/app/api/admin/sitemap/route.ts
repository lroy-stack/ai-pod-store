import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'

export const POST = withAuth(async (req, session) => {
  try {
    const response = await fetch(`${FRONTEND_URL}/api/admin/sitemap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error proxying sitemap generation:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate sitemap'
      },
      { status: 500 }
    )
  }
})

export const GET = withAuth(async (req, session) => {
  try {
    const response = await fetch(`${FRONTEND_URL}/api/admin/sitemap`, {
      method: 'GET',
    })

    const data = await response.json()

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Error proxying sitemap info:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sitemap info'
      },
      { status: 500 }
    )
  }
})
