/**
 * Admin Credits Adjustment API
 *
 * POST /api/admin/credits/adjust
 * Allows admins to manually adjust user credit balances
 */

import { createClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac'

async function handler(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { user_id, amount, reason } = body

    // Validate inputs
    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json(
        { error: 'user_id is required and must be a string' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || amount === 0) {
      return NextResponse.json(
        { error: 'amount is required and must be a non-zero number' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Fetch current user credit balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, credit_balance')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const oldBalance = user.credit_balance || 0
    const newBalance = oldBalance + amount

    // Prevent negative balances
    if (newBalance < 0) {
      return NextResponse.json(
        { error: 'Cannot adjust credits below zero. User would have negative balance.' },
        { status: 400 }
      )
    }

    // Atomic update with optimistic locking — prevents TOCTOU race condition
    // Only updates if credit_balance hasn't changed since we read it
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({ credit_balance: newBalance })
      .eq('id', user_id)
      .eq('credit_balance', oldBalance)
      .select('id')

    if (!updateError && (!updated || updated.length === 0)) {
      // Optimistic lock failed — balance was modified concurrently
      return NextResponse.json(
        { error: 'Credit balance was modified concurrently. Please retry.' },
        { status: 409 }
      )
    }

    if (updateError) {
      console.error('Error updating user credit balance:', updateError)
      return NextResponse.json(
        { error: 'Failed to update credit balance' },
        { status: 500 }
      )
    }

    // Create credit transaction record
    const { error: txError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id,
        amount,
        reason: reason || 'admin_adjustment',
        balance_after: newBalance,
      })

    if (txError) {
      console.error('Error creating credit transaction:', txError)
      // Don't fail the request, but log the error
    }

    // Create audit log entry
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        actor_type: 'admin',
        action: 'credit_adjustment',
        resource_type: 'user',
        resource_id: user_id,
        changes: {
          old_balance: oldBalance,
          new_balance: newBalance,
          amount,
        },
        metadata: {
          user_email: user.email,
          reason: reason || 'admin_adjustment',
        },
      })

    if (auditError) {
      console.error('Error creating audit log:', auditError)
      // Don't fail the request, but log the error
    }

    return NextResponse.json({
      success: true,
      user_id,
      old_balance: oldBalance,
      new_balance: newBalance,
      amount,
    })
  } catch (error) {
    console.error('Error in credits adjust API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withPermission('users', 'update', handler)
