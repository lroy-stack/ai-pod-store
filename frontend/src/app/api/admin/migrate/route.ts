import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (error) {
    return authErrorResponse(error)
  }

  return NextResponse.json(
    { error: 'Raw SQL execution via API is permanently disabled. Use Supabase CLI for migrations.' },
    { status: 403 }
  )
}
