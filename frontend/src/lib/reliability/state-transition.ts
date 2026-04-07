/**
 * StateTransitionValidator — Enforces valid state transitions
 *
 * Defines and validates state transition matrices for all major entities
 * (orders, products, returns, agent_sessions, users). Prevents invalid
 * state transitions that could lead to data inconsistency.
 *
 * @module reliability/state-transition
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface TransitionResult {
  success: boolean
  fromState?: string
  toState?: string
  error?: string
}

/**
 * Transition matrix definitions
 * Each key is a "from" state, and the value is an array of allowed "to" states
 */
const TRANSITION_MATRICES: Record<string, Record<string, string[]>> = {
  // Orders: pending → paid → submitted → in_production → shipped → delivered
  orders: {
    pending: ['paid', 'cancelled'],
    paid: ['submitted', 'requires_review', 'cancelled', 'refunded'],
    submitted: ['in_production', 'shipped', 'requires_review', 'cancelled'],
    in_production: ['shipped', 'requires_review', 'cancelled'],
    shipped: ['delivered', 'refunded'],
    requires_review: ['paid', 'cancelled', 'refunded'],
    delivered: ['refunded'], // Can only refund after delivery
    cancelled: [], // Terminal state
    refunded: [], // Terminal state
    failed: [], // Terminal state — POD production failure
    disputed: [], // Terminal state — Stripe chargebacks
  },

  // Products: draft → pending_review/publishing → active → archived → deleted
  products: {
    draft: ['pending_review', 'publishing', 'deleted'],
    pending_review: ['publishing', 'draft', 'deleted'],
    publishing: ['active', 'draft'], // Can fail back to draft
    active: ['archived', 'deleted'],
    archived: ['active', 'deleted'],
    deleted: [], // Terminal state (soft delete)
  },

  // Returns: return_requested → return_approved → item_shipped → item_received → return_completed
  returns: {
    return_requested: ['return_approved', 'rejected', 'expired'],
    return_approved: ['item_shipped', 'expired'],
    item_shipped: ['item_received', 'expired'],
    item_received: ['return_completed'],
    return_completed: [], // Terminal state
    rejected: [], // Terminal state
    expired: [], // Terminal state
  },

  // Agent sessions: running → completed/error
  agent_sessions: {
    running: ['completed', 'error'],
    completed: [], // Terminal state
    error: [], // Terminal state
  },

  // Users: active → suspended → banned (if status field exists)
  users: {
    active: ['suspended', 'banned', 'deleted'],
    suspended: ['active', 'banned'],
    banned: ['active'], // Can be unbanned by admin
    deleted: [], // Terminal state (soft delete)
  },
}

/**
 * Get status column name for a table
 * Most tables use 'status', but some might use different names
 */
function getStatusColumn(table: string): string {
  const columnMap: Record<string, string> = {
    orders: 'status',
    products: 'status',
    returns: 'status',
    agent_sessions: 'status',
    users: 'status', // Assuming status field exists
  }
  return columnMap[table] || 'status'
}

/**
 * Validate if a state transition is allowed
 *
 * @param table - Table name (orders, products, returns, agent_sessions, users)
 * @param fromState - Current state
 * @param toState - Desired state
 * @returns boolean - true if transition is allowed
 */
export function isValidTransition(
  table: string,
  fromState: string,
  toState: string
): boolean {
  const matrix = TRANSITION_MATRICES[table]
  if (!matrix) {
    console.warn(`[StateTransition] Unknown table: ${table}`)
    return false
  }

  const allowedTransitions = matrix[fromState]
  if (!allowedTransitions) {
    console.warn(`[StateTransition] Unknown fromState: ${fromState} for table ${table}`)
    return false
  }

  // Allow staying in the same state (idempotent transitions)
  if (fromState === toState) {
    return true
  }

  return allowedTransitions.includes(toState)
}

/**
 * Perform a validated state transition
 *
 * This function:
 * 1. Reads the current state from the database
 * 2. Validates the transition is allowed
 * 3. Updates the state if valid
 * 4. Returns success/failure result
 *
 * @param table - Table name (orders, products, returns, agent_sessions, users)
 * @param id - Record ID (UUID)
 * @param fromState - Expected current state (for optimistic locking)
 * @param toState - Desired new state
 * @returns Promise<TransitionResult>
 *
 * @example
 * ```typescript
 * const result = await transition(
 *   'orders',
 *   '123e4567-e89b-12d3-a456-426614174000',
 *   'paid',
 *   'submitted'
 * )
 * if (result.success) {
 *   console.log('Transition successful')
 * } else {
 *   console.error('Invalid transition:', result.error)
 * }
 * ```
 */
export async function transition(
  table: string,
  id: string,
  fromState: string,
  toState: string
): Promise<TransitionResult> {
  try {
    // Step 1: Validate transition is allowed
    if (!isValidTransition(table, fromState, toState)) {
      return {
        success: false,
        fromState,
        toState,
        error: `Invalid transition: ${table}.${fromState} → ${toState}`,
      }
    }

    // Step 2: Read current state from database
    const statusColumn = getStatusColumn(table)
    const { data: record, error: readError } = await supabaseAdmin
      .from(table)
      .select(statusColumn)
      .eq('id', id)
      .single()

    if (readError || !record) {
      console.error(`[StateTransition] Failed to read ${table}/${id}:`, readError)
      return {
        success: false,
        error: readError?.message || `Record not found: ${table}/${id}`,
      }
    }

    const currentState = (record as any)[statusColumn]

    // Step 3: Check optimistic lock (fromState must match current state)
    if (currentState !== fromState) {
      console.warn(
        `[StateTransition] State mismatch: expected ${fromState}, found ${currentState}`
      )
      return {
        success: false,
        fromState: currentState,
        toState,
        error: `State mismatch: expected ${fromState}, found ${currentState}`,
      }
    }

    // Step 4: Idempotency check - if already in target state, return success
    if (currentState === toState) {
      console.log(`[StateTransition] Already in state ${toState}, idempotent success`)
      return {
        success: true,
        fromState,
        toState,
      }
    }

    // Step 5: Update state
    const { error: updateError } = await supabaseAdmin
      .from(table)
      .update({ [statusColumn]: toState })
      .eq('id', id)
      .eq(statusColumn, fromState) // Double-check state hasn't changed (race condition protection)

    if (updateError) {
      console.error(`[StateTransition] Failed to update ${table}/${id}:`, updateError)
      return {
        success: false,
        error: updateError.message,
      }
    }

    console.log(`[StateTransition] ${table}/${id}: ${fromState} → ${toState}`)
    return {
      success: true,
      fromState,
      toState,
    }
  } catch (err: any) {
    console.error('[StateTransition] Unexpected error:', err)
    return {
      success: false,
      error: err?.message || 'Unexpected error',
    }
  }
}

/**
 * Get all valid transitions from a given state
 *
 * @param table - Table name
 * @param fromState - Current state
 * @returns string[] - Array of allowed destination states
 */
export function getValidTransitions(table: string, fromState: string): string[] {
  const matrix = TRANSITION_MATRICES[table]
  if (!matrix || !matrix[fromState]) {
    return []
  }
  return matrix[fromState]
}

/**
 * Get the complete transition matrix for a table
 *
 * @param table - Table name
 * @returns Record<string, string[]> - The transition matrix
 */
export function getTransitionMatrix(table: string): Record<string, string[]> {
  return TRANSITION_MATRICES[table] || {}
}
